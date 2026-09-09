/**
 * 로컬 임베딩의 main-process 경계.
 *
 * 모델 다운로드·파일 상태·renderer IPC는 main에 남긴다. 실제 Transformers.js와
 * ONNX Runtime 세션 생성 및 추론은 local-embedding-worker Utility Process가
 * 맡는다. native onnxruntime-node를 Worker Thread에 올리지 않으면서 main
 * process의 UI 제어 경로를 CPU 추론에서 분리하기 위한 구조다.
 */
import { app, ipcMain, utilityProcess } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

import {
  EMBEDDING_MODEL_BYTES,
  EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_REPO,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_MODEL_SHA256,
  EMBEDDING_MODEL_WEIGHTS,
  EMBEDDING_REQUIRED_DISK_BYTES,
  EMBEDDING_VECTOR_DIMENSIONS,
} from './local-embedding-config';
import {
  downloadWeightsResumable,
  fileMatchesExpectedModel,
  freeDiskBytes,
} from './local-embedding-download';
import {
  getLegacyModelCacheDirectory,
  getModelCacheDirectory,
} from './app-storage';

export { EMBEDDING_MODEL_ID, EMBEDDING_VECTOR_DIMENSIONS };

const WEIGHTS_URL = `https://huggingface.co/${EMBEDDING_MODEL_REPO}/resolve/${EMBEDDING_MODEL_REVISION}/${EMBEDDING_MODEL_WEIGHTS}`;

export interface LocalEmbeddingStatus {
  downloadedBytes: number;
  error?: string;
  modelId: string;
  ready: boolean;
  state: 'absent' | 'downloading' | 'loading' | 'ready' | 'failed';
  totalBytes: number;
}

type EmbeddingMode = 'index' | 'interactive';
type UtilityMethod = 'embed' | 'ensure' | 'initialize' | 'release-all' | 'release-index';

interface UtilityResponse {
  error?: unknown;
  id?: unknown;
  ok?: unknown;
  result?: unknown;
  type?: unknown;
}

interface PendingUtilityRequest {
  reject: (reason?: unknown) => void;
  resolve: (value: unknown) => void;
}

const cacheDirectory = getModelCacheDirectory;
const weightsPath = () =>
  path.join(
    cacheDirectory(),
    EMBEDDING_MODEL_REPO,
    EMBEDDING_MODEL_REVISION,
    EMBEDDING_MODEL_WEIGHTS,
  );
const partialWeightsPath = () => `${weightsPath()}.part`;
const legacyWeightsPath = () =>
  path.join(getLegacyModelCacheDirectory(), EMBEDDING_MODEL_REPO, EMBEDDING_MODEL_WEIGHTS);

let status: LocalEmbeddingStatus = {
  downloadedBytes: 0,
  modelId: EMBEDDING_MODEL_ID,
  ready: false,
  state: 'absent',
  totalBytes: EMBEDDING_MODEL_BYTES,
};
let inspectedDisk = false;
let weightsVerified = false;
let prunedStaleCache = false;
let modelDownloadPromise: Promise<LocalEmbeddingStatus> | null = null;
let indexEmbeddingQueue: Promise<void> = Promise.resolve();
let interactiveExtractorLoaded = false;
let indexExtractorLoaded = false;
let embeddingProcess: Electron.UtilityProcess | null = null;
let embeddingProcessReady: Promise<Electron.UtilityProcess> | null = null;
let nextUtilityRequestId = 1;
const pendingUtilityRequests = new Map<number, PendingUtilityRequest>();

const setStatus = (patch: Partial<LocalEmbeddingStatus>) => {
  status = { ...status, ...patch };
};

// 모델 존재 여부는 처음 물어볼 때 확인한다. 모듈 로드 시점에 app.getPath를
// 부르면 앱이 준비되기 전(테스트 포함)에 터진다.
const currentStatus = (): LocalEmbeddingStatus => {
  if (!inspectedDisk && status.state === 'absent') {
    inspectedDisk = true;
    try {
      const candidate = fs.existsSync(weightsPath())
        ? weightsPath()
        : fs.existsSync(legacyWeightsPath())
          ? legacyWeightsPath()
          : null;
      if (candidate) {
        const downloadedBytes = fs.statSync(candidate).size;
        setStatus({
          downloadedBytes,
          ready: downloadedBytes === EMBEDDING_MODEL_BYTES,
          state: downloadedBytes === EMBEDDING_MODEL_BYTES ? 'ready' : 'absent',
        });
      }
    } catch {
      // userData를 아직 읽을 수 없으면 다음 호출에서 다시 본다.
      inspectedDisk = false;
    }
  }
  return status;
};

const utilityErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const rejectUtilityRequests = (error: Error) => {
  for (const pending of pendingUtilityRequests.values()) pending.reject(error);
  pendingUtilityRequests.clear();
};

const isUtilityResult = (message: UtilityResponse) =>
  Number.isSafeInteger(message.id) && typeof message.ok === 'boolean';

const workerEntryPath = () => path.join(__dirname, 'local-embedding-worker.js');

const startEmbeddingProcess = (): Promise<Electron.UtilityProcess> => {
  if (embeddingProcess && embeddingProcessReady) return embeddingProcessReady;

  const child = utilityProcess.fork(workerEntryPath(), [], {
    serviceName: 'subnota-embedding',
    stdio: 'ignore',
  });
  embeddingProcess = child;

  let settled = false;
  let resolveReady: (value: Electron.UtilityProcess) => void;
  let rejectReady: (reason?: unknown) => void;
  const ready = new Promise<Electron.UtilityProcess>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  embeddingProcessReady = ready;

  const fail = (error: Error) => {
    if (embeddingProcess !== child) return;
    embeddingProcess = null;
    embeddingProcessReady = null;
    interactiveExtractorLoaded = false;
    indexExtractorLoaded = false;
    if (!settled) {
      settled = true;
      rejectReady(error);
    }
    rejectUtilityRequests(error);
  };

  child.on('message', (message: UtilityResponse) => {
    if (message?.type === 'ready') {
      if (!settled) {
        settled = true;
        resolveReady(child);
      }
      return;
    }
    if (!isUtilityResult(message)) return;
    const requestId = message.id as number;
    const pending = pendingUtilityRequests.get(requestId);
    if (!pending) return;
    pendingUtilityRequests.delete(requestId);
    if (message.ok) pending.resolve(message.result);
    else pending.reject(new Error(utilityErrorMessage(message.error)));
  });
  child.once('error', (type, location) => {
    fail(new Error(`로컬 임베딩 프로세스 오류 (${type}): ${location}`));
  });
  child.once('exit', code => {
    fail(new Error(`로컬 임베딩 프로세스가 종료되었습니다. (code ${code})`));
  });

  return ready;
};

const requestEmbeddingUtility = async <T>(
  method: UtilityMethod,
  payload: Record<string, unknown> = {},
): Promise<T> => {
  const child = await startEmbeddingProcess();
  const id = nextUtilityRequestId++;
  return new Promise<T>((resolve, reject) => {
    pendingUtilityRequests.set(id, { resolve, reject });
    try {
      child.postMessage({ id, method, ...payload });
    } catch (error) {
      pendingUtilityRequests.delete(id);
      reject(error);
    }
  });
};

const initializeEmbeddingUtility = () =>
  requestEmbeddingUtility<null>('initialize', { cacheDirectory: cacheDirectory() });

const releaseAllEmbeddingExtractors = async () => {
  if (!embeddingProcess || !embeddingProcessReady) return;
  try {
    await requestEmbeddingUtility<null>('release-all');
  } catch {
    // 프로세스가 이미 끝났다면 native 세션도 함께 사라진 상태다.
  }
  interactiveExtractorLoaded = false;
  indexExtractorLoaded = false;
};

const ensureRemoteExtractor = async (mode: EmbeddingMode) => {
  const loaded = mode === 'index' ? indexExtractorLoaded : interactiveExtractorLoaded;
  if (loaded) return;

  setStatus({
    downloadedBytes: EMBEDDING_MODEL_BYTES,
    error: undefined,
    ready: false,
    state: 'loading',
    totalBytes: EMBEDDING_MODEL_BYTES,
  });
  try {
    await initializeEmbeddingUtility();
    await requestEmbeddingUtility<null>('ensure', { mode });
    if (mode === 'index') indexExtractorLoaded = true;
    else interactiveExtractorLoaded = true;
    setStatus({ ready: true, state: 'ready' });
  } catch (error) {
    setStatus({
      error: utilityErrorMessage(error),
      ready: false,
      state: 'failed',
    });
    throw error;
  }
};

const ensureWeights = async (
  onProgress: (progress: { downloadedBytes: number; totalBytes: number }) => void,
  allowDownload = true,
) => {
  if (weightsVerified && fs.existsSync(weightsPath())) {
    fs.rmSync(partialWeightsPath(), { force: true });
    return;
  }
  if (fs.existsSync(weightsPath())) {
    const current = await fileMatchesExpectedModel(
      weightsPath(),
      EMBEDDING_MODEL_BYTES,
      EMBEDDING_MODEL_SHA256,
    );
    if (current) {
      fs.rmSync(partialWeightsPath(), { force: true });
      weightsVerified = true;
      return;
    }
    if (!allowDownload) throw new Error('검색 준비 파일을 먼저 내려받아 주세요.');
  }
  if (!fs.existsSync(weightsPath()) && fs.existsSync(legacyWeightsPath())) {
    const legacyIsCurrent = await fileMatchesExpectedModel(
      legacyWeightsPath(),
      EMBEDDING_MODEL_BYTES,
      EMBEDDING_MODEL_SHA256,
    );
    if (legacyIsCurrent) {
      fs.mkdirSync(path.dirname(weightsPath()), { recursive: true });
      fs.renameSync(legacyWeightsPath(), weightsPath());
      fs.rmSync(partialWeightsPath(), { force: true });
      weightsVerified = true;
      return;
    }
  }
  if (!allowDownload) throw new Error('검색 준비 파일을 먼저 내려받아 주세요.');
  if (!fs.existsSync(weightsPath())) {
    const { freeBytes, requiredBytes } = diskSpaceForModel();
    if (freeBytes !== null && freeBytes < requiredBytes) {
      const shortfall = Math.ceil((requiredBytes - freeBytes) / 1_000_000);
      throw new Error(`저장 공간이 ${shortfall}MB 부족합니다.`);
    }
  }
  await downloadWeightsResumable({
    expectedBytes: EMBEDDING_MODEL_BYTES,
    expectedSha256: EMBEDDING_MODEL_SHA256,
    onProgress,
    targetPath: weightsPath(),
    url: WEIGHTS_URL,
  });
  fs.rmSync(partialWeightsPath(), { force: true });
  weightsVerified = true;
};

// Transformers.js가 남기는 revision 고정 전 캐시·중단 임시 파일은 현재 경로와
// 겹치지 않는다. 모델을 실제로 쓸 수 있다고 확인한 뒤에만 정리한다.
export const pruneStaleModelCache = (repoRoot: string, keepRevision: string) => {
  let removedBytes = 0;
  let entries: string[];
  try {
    entries = fs.readdirSync(repoRoot);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry === keepRevision) continue;
    const target = path.join(repoRoot, entry);
    try {
      removedBytes += directorySize(target);
      fs.rmSync(target, { force: true, recursive: true });
    } catch {
      // 정리는 부가 작업이다. 실패해도 모델 로딩을 막지 않는다.
    }
  }
  return removedBytes;
};

const directorySize = (target: string): number => {
  const info = fs.statSync(target);
  if (!info.isDirectory()) return info.size;
  return fs
    .readdirSync(target)
    .reduce((total, entry) => total + directorySize(path.join(target, entry)), 0);
};

const prepareWeightsForInference = async (allowDownload = true) => {
  const alreadyOnDisk =
    fs.existsSync(weightsPath()) || fs.existsSync(legacyWeightsPath());
  setStatus({
    error: undefined,
    ready: false,
    state: alreadyOnDisk ? 'loading' : 'downloading',
  });
  await ensureWeights(
    ({ downloadedBytes, totalBytes }) =>
      setStatus({
        downloadedBytes,
        totalBytes: totalBytes || EMBEDDING_MODEL_BYTES,
      }),
    allowDownload,
  );
  if (!prunedStaleCache) {
    prunedStaleCache = true;
    pruneStaleModelCache(
      path.join(cacheDirectory(), EMBEDDING_MODEL_REPO),
      EMBEDDING_MODEL_REVISION,
    );
  }
};

/** 남은 공간과 필요한 공간. UI가 받기 전에 안내하는 데 쓴다. */
export const diskSpaceForModel = () => ({
  freeBytes: freeDiskBytes(cacheDirectory()),
  requiredBytes: EMBEDDING_REQUIRED_DISK_BYTES,
});

/** 모델을 내려받고 Utility Process에서 대화형 세션을 한 번 준비한다. */
export const downloadModel = (): Promise<LocalEmbeddingStatus> => {
  if (modelDownloadPromise) return modelDownloadPromise;

  const next = (async () => {
    setStatus({
      downloadedBytes: 0,
      error: undefined,
      ready: false,
      state: 'downloading',
    });
    try {
      await prepareWeightsForInference(true);
      await ensureRemoteExtractor('interactive');
    } catch (error) {
      setStatus({
        error: utilityErrorMessage(error),
        ready: false,
        state: 'failed',
      });
    }
    return status;
  })();
  modelDownloadPromise = next;
  void next.finally(() => {
    if (modelDownloadPromise === next) modelDownloadPromise = null;
  });
  return next;
};

/** 모델 파일을 지워 공간을 되찾는다. 다음 사용 때 다시 받는다. */
export const deleteModel = async (): Promise<LocalEmbeddingStatus> => {
  await releaseAllEmbeddingExtractors();
  fs.rmSync(path.join(cacheDirectory(), EMBEDDING_MODEL_REPO), {
    force: true,
    recursive: true,
  });
  fs.rmSync(path.join(getLegacyModelCacheDirectory(), EMBEDDING_MODEL_REPO), {
    force: true,
    recursive: true,
  });
  weightsVerified = false;
  inspectedDisk = true;
  setStatus({
    downloadedBytes: 0,
    error: undefined,
    ready: false,
    state: 'absent',
    totalBytes: EMBEDDING_MODEL_BYTES,
  });
  return status;
};

const requireDownloadedModel = () => {
  if (!currentStatus().ready) {
    throw new Error('검색 준비 파일을 먼저 내려받아 주세요.');
  }
};

export const ensureModel = async (): Promise<void> => {
  requireDownloadedModel();
  await ensureRemoteExtractor('interactive');
};

export const ensureIndexModel = async (): Promise<void> => {
  requireDownloadedModel();
  await ensureRemoteExtractor('index');
};

export const embedTexts = async (texts: string[]): Promise<number[][]> => {
  await ensureModel();
  return requestEmbeddingUtility<number[][]>('embed', { mode: 'interactive', texts });
};

export const embedTextsForIndex = async (texts: string[]): Promise<number[][]> => {
  await ensureIndexModel();
  return requestEmbeddingUtility<number[][]>('embed', { mode: 'index', texts });
};

export const releaseIndexModel = async (): Promise<void> => {
  if (!indexExtractorLoaded) return;
  await requestEmbeddingUtility<null>('release-index');
  indexExtractorLoaded = false;
  setStatus({ ready: true, state: 'ready' });
};

const enqueueIndexEmbedding = (texts: string[]): Promise<number[][]> => {
  const result = indexEmbeddingQueue.then(() => embedTextsForIndex(texts));
  indexEmbeddingQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const releaseIndexModelWhenIdle = async (): Promise<void> => {
  const pending = indexEmbeddingQueue;
  await pending;
  if (pending !== indexEmbeddingQueue) return;
  await releaseIndexModel();
};

const assertTrustedSender = (event: Electron.IpcMainInvokeEvent) => {
  const url = event.senderFrame?.url ?? event.sender?.getURL?.() ?? '';
  if (!url && !app.isPackaged) return;
  const trustedProduction = url.startsWith('subnota-app://bundle/');
  const trustedDevelopment =
    !app.isPackaged && /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(url);
  if (!trustedProduction && !trustedDevelopment) throw new Error('Untrusted IPC sender.');
};

const validTexts = (texts: unknown): texts is string[] =>
  Array.isArray(texts) && texts.every(text => typeof text === 'string');

ipcMain.handle('local-embed:status', event => {
  assertTrustedSender(event);
  return currentStatus();
});

ipcMain.handle('local-embed:ensure-model', async event => {
  assertTrustedSender(event);
  await ensureModel();
  return status;
});

ipcMain.handle('local-embed:download-model', async event => {
  assertTrustedSender(event);
  return downloadModel();
});

ipcMain.handle('local-embed:delete-model', async event => {
  assertTrustedSender(event);
  return deleteModel();
});

ipcMain.handle('local-embed:disk-space', event => {
  assertTrustedSender(event);
  return diskSpaceForModel();
});

ipcMain.handle('local-embed:embed', async (event, texts: unknown) => {
  assertTrustedSender(event);
  if (!validTexts(texts)) throw new Error('Invalid embedding input.');
  if (texts.length === 0) return [];
  if (texts.length > 64) throw new Error('Too many texts in one embedding request.');
  return embedTexts(texts);
});

ipcMain.handle('local-embed:index', async (event, texts: unknown) => {
  assertTrustedSender(event);
  if (!validTexts(texts)) throw new Error('Invalid embedding input.');
  if (texts.length === 0) return [];
  if (texts.length > 64) throw new Error('Too many texts in one embedding request.');
  return enqueueIndexEmbedding(texts);
});

ipcMain.handle('local-embed:release-index', async event => {
  assertTrustedSender(event);
  await releaseIndexModelWhenIdle();
});

app.once?.('before-quit', () => {
  embeddingProcess?.kill();
});
