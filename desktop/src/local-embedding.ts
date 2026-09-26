/**
 * 로컬 임베딩의 main-process 경계.
 *
 * 모델 다운로드·파일 상태·renderer IPC는 main에 남긴다. 실제 Transformers.js와
 * ONNX Runtime 세션 생성 및 추론은 local-embedding-worker Utility Process가
 * 맡는다. native onnxruntime-node를 Worker Thread에 올리지 않으면서 main
 * process의 UI 제어 경로를 CPU 추론에서 분리하기 위한 구조다.
 *
 * 왜 로컬인가: 지금은 문장 하나를 검색할 때마다 백엔드 → HF Inference API
 * 왕복이 일어난다. 실측상 로컬은 13ms로 일정한 반면 HF 경로는 100ms~수 초로
 * 들쭉날쭉했다(콜드스타트). ambient처럼 곁에서 조용히 뜨는 기능은 평균보다
 * 이 일관성이 중요하다. 호출 비용도 0이 된다.
 *
 * 왜 llama.cpp가 아닌가: node-llama-cpp로 먼저 붙였다가 걷어냈다. 같은 모델·
 * 같은 양자화인데 llama.cpp 본체보다 벡터 품질이 확연히 낮았다(AUC -0.055,
 * 짧은 문장에서 더 나쁨). 설정 문제가 아니었다 — 토큰열·풀링·causal_attn이
 * 전부 동일했고 어떤 옵션을 줘도 결과가 비트 단위로 같았다.
 * 자세한 근거는 docs/embedding-migration-plan.md 참고.
 *
 * 모델은 앱에 번들하지 않는다(한·영 사전 BGE-M3와 A.X 합계 약 600MB). 첫 사용
 * 시 userData로 내려받고, 이후 실행부터는 로컬 캐시를 그대로 쓴다. 앱을 지웠다
 * 다시 깔아도 캐시는 남으므로(macOS·Windows 모두 제거 시 userData를 지우지
 * 않는다) 크기·해시를 확인해 그대로 쓴다. 업데이트로 모델이 바뀌면 새 모델을
 * 검증한 뒤 옛 모델 폴더(RETIRED_EMBEDDING_MODEL_REPOS)를 지운다.
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
  RETIRED_EMBEDDING_MODEL_REPOS,
  EMBEDDING_VECTOR_DIMENSIONS,
  TOPIC_MODEL_BYTES,
  TOPIC_MODEL_FILES,
  TOPIC_MODEL_REPO,
  TOPIC_MODEL_REVISION,
  TOPIC_MODEL_SHA256,
  TOPIC_MODEL_TOTAL_BYTES,
  TOPIC_MODEL_WEIGHTS,
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
const MODEL_TOTAL_BYTES = EMBEDDING_MODEL_BYTES + TOPIC_MODEL_TOTAL_BYTES;
const topicFileUrl = (name: string) => `https://huggingface.co/${TOPIC_MODEL_REPO}/resolve/${TOPIC_MODEL_REVISION}/${name}`;

/**
 * 문서 벡터와 질의 벡터를 가르는 딱지. bge-m3는 접두사를 쓰지 않아 둘이 같은
 * 값이 되지만, CSLS가 청크마다 질의 벡터를 따로 요구하고 iOS는 접두사 모델
 * (e5-small)을 쓰므로 구분 자체는 남겨 둔다.
 */
export type EmbeddingPrefix = 'passage' | 'query';
// ponytail: bge-m3는 접두사 없음. 접두사 모델로 바꾸면 여기만 고치면 된다.
const prefixed = (_prefix: EmbeddingPrefix, text: string) => text;

export interface LocalEmbeddingStatus {
  downloadedBytes: number;
  error?: string;
  modelId: string;
  ready: boolean;
  state: 'absent' | 'downloading' | 'loading' | 'ready' | 'failed';
  totalBytes: number;
  topicReady: boolean;
  topicError?: string;
}

type EmbeddingMode = 'index' | 'interactive';
type UtilityMethod = 'embed' | 'topics' | 'ensure' | 'initialize' | 'release-all' | 'release-index';

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
const topicFilePath = (name: string) => path.join(cacheDirectory(), TOPIC_MODEL_REPO, TOPIC_MODEL_REVISION, name);
const topicFiles = [
  { name: TOPIC_MODEL_WEIGHTS, bytes: TOPIC_MODEL_BYTES, sha256: TOPIC_MODEL_SHA256 },
  ...TOPIC_MODEL_FILES,
];
const topicFilesPresent = () => topicFiles.every(file => {
  try { return fs.statSync(topicFilePath(file.name)).size === file.bytes; } catch { return false; }
});
const legacyWeightsPath = () =>
  path.join(getLegacyModelCacheDirectory(), EMBEDDING_MODEL_REPO, EMBEDDING_MODEL_WEIGHTS);

let status: LocalEmbeddingStatus = {
  downloadedBytes: 0,
  modelId: EMBEDDING_MODEL_ID,
  ready: false,
  state: 'absent',
  totalBytes: MODEL_TOTAL_BYTES,
  topicReady: false,
};
let inspectedDisk = false;
let weightsVerified = false;
let topicFilesVerified = false;
let prunedStaleCache = false;
let modelDownloadPromise: Promise<LocalEmbeddingStatus> | null = null;
let indexEmbeddingQueue: Promise<void> = Promise.resolve();
let interactiveExtractorLoaded = false;
let indexExtractorLoaded = false;
let topicExtractorLoaded = false;
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
        const topicReady = topicFilesPresent();
        setStatus({
          downloadedBytes: downloadedBytes + (topicReady ? TOPIC_MODEL_TOTAL_BYTES : 0),
          ready: downloadedBytes === EMBEDDING_MODEL_BYTES,
          state: downloadedBytes === EMBEDDING_MODEL_BYTES ? 'ready' : 'absent',
          topicReady,
        });
      }
    } catch {
      // userData를 아직 읽을 수 없으면 다음 호출에서 다시 본다.
      inspectedDisk = false;
    }
  }
  return status;
};

// 업데이트로 검색 모델이 바뀐 사용자에게 남아 있는 옛 모델 폴더(두 캐시 위치 모두).
const retiredModelDirectories = () =>
  RETIRED_EMBEDDING_MODEL_REPOS.flatMap(repo => [
    path.join(cacheDirectory(), repo),
    path.join(getLegacyModelCacheDirectory(), repo),
  ]);

const retiredModelBytes = () =>
  retiredModelDirectories().reduce((total, target) => {
    try {
      return total + directorySize(target);
    } catch {
      return total;
    }
  }, 0);

/**
 * 렌더러가 받기 창을 그릴 때 쓰는 상태. 받을 크기는 이미 있는 파일을 빼고
 * 계산하고, 옛 모델 크기가 0보다 크면 "업데이트로 바뀜" 문구를 쓴다.
 */
const statusForRenderer = () => {
  const current = currentStatus();
  return {
    ...current,
    pendingDownloadBytes:
      (current.ready ? 0 : EMBEDDING_MODEL_BYTES) + (current.topicReady ? 0 : TOPIC_MODEL_TOTAL_BYTES),
    retiredModelBytes: retiredModelBytes(),
  };
};

// 새 모델을 검증한 뒤에만 부른다. 받다가 실패하면 옛 모델은 그대로 남는다.
const removeRetiredModels = () => {
  for (const target of retiredModelDirectories()) {
    try {
      fs.rmSync(target, { force: true, recursive: true });
    } catch {
      // 정리는 부가 작업이다. 실패해도 새 모델 사용을 막지 않는다.
    }
  }
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
    topicExtractorLoaded = false;
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
  topicExtractorLoaded = false;
};

const ensureRemoteExtractor = async (mode: EmbeddingMode) => {
  const loaded = mode === 'index' ? indexExtractorLoaded : interactiveExtractorLoaded;
  if (loaded) return;

  setStatus({
    downloadedBytes: EMBEDDING_MODEL_BYTES + (status.topicReady ? TOPIC_MODEL_TOTAL_BYTES : 0),
    error: undefined,
    ready: false,
    state: 'loading',
    totalBytes: MODEL_TOTAL_BYTES,
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

const ensureTopicFiles = async (onProgress: (bytes: number) => void) => {
  if (topicFilesVerified && topicFilesPresent()) return;
  let completed = 0;
  for (const file of topicFiles) {
    const target = topicFilePath(file.name);
    if (fs.existsSync(target) && await fileMatchesExpectedModel(target, file.bytes, file.sha256)) {
      completed += file.bytes;
      onProgress(completed);
      continue;
    }
    await downloadWeightsResumable({
      expectedBytes: file.bytes,
      expectedSha256: file.sha256,
      onProgress: progress => onProgress(completed + progress.downloadedBytes),
      targetPath: target,
      url: topicFileUrl(file.name),
    });
    completed += file.bytes;
    onProgress(completed);
  }
  topicFilesVerified = true;
  pruneStaleModelCache(path.join(cacheDirectory(), TOPIC_MODEL_REPO), TOPIC_MODEL_REVISION);
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
    ({ downloadedBytes }) =>
      setStatus({
        downloadedBytes,
        totalBytes: MODEL_TOTAL_BYTES,
      }),
    allowDownload,
  );
  if (!prunedStaleCache) {
    prunedStaleCache = true;
    pruneStaleModelCache(
      path.join(cacheDirectory(), EMBEDDING_MODEL_REPO),
      EMBEDDING_MODEL_REVISION,
    );
    removeRetiredModels();
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
      setStatus({
        downloadedBytes: EMBEDDING_MODEL_BYTES,
        ready: true,
        state: 'downloading',
        totalBytes: MODEL_TOTAL_BYTES,
      });
      await ensureTopicFiles(bytes => setStatus({
        downloadedBytes: EMBEDDING_MODEL_BYTES + bytes,
        totalBytes: MODEL_TOTAL_BYTES,
      }));
      setStatus({ ready: true, state: 'ready', topicReady: true, topicError: undefined });
    } catch (error) {
      if (status.ready) {
        setStatus({
          ready: true,
          state: 'ready',
          topicReady: false,
          topicError: utilityErrorMessage(error),
        });
      } else {
        setStatus({ error: utilityErrorMessage(error), ready: false, state: 'failed' });
      }
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
  fs.rmSync(path.join(cacheDirectory(), TOPIC_MODEL_REPO), { force: true, recursive: true });
  weightsVerified = false;
  topicFilesVerified = false;
  inspectedDisk = true;
  setStatus({
    downloadedBytes: 0,
    error: undefined,
    ready: false,
    state: 'absent',
    totalBytes: MODEL_TOTAL_BYTES,
    topicReady: false,
    topicError: undefined,
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

// 한 건씩 임베딩하는 규칙(배치 금지)은 Utility Process 쪽 runtime 이 지킨다.
// 접두사는 여기서 붙여 보낸다 — worker 는 받은 문자열을 그대로 임베딩만 한다.

/** 검색 질의용. */
export const embedTexts = async (texts: string[]): Promise<number[][]> => {
  await ensureModel();
  return requestEmbeddingUtility<number[][]>('embed', {
    mode: 'interactive',
    texts: texts.map(text => prefixed('query', text)),
  });
};

/**
 * 색인용. CSLS 채점이 청크마다 질의 벡터도 요구하므로 같은 색인 세션에서
 * 질의 쪽 벡터도 만들 수 있어야 한다.
 */
export const embedTextsForIndex = async (
  texts: string[],
  prefix: EmbeddingPrefix = 'passage',
): Promise<number[][]> => {
  await ensureIndexModel();
  return requestEmbeddingUtility<number[][]>('embed', {
    mode: 'index',
    texts: texts.map(text => prefixed(prefix, text)),
  });
};

/** A.X is optional: callers may skip topic vectors without stopping body indexing. */
export const topicWordsForIndex = async (texts: string[]): Promise<string[][]> => {
  if (!currentStatus().topicReady) throw new Error('A.X model is not available.');
  await initializeEmbeddingUtility();
  topicExtractorLoaded = true;
  return requestEmbeddingUtility<string[][]>('topics', { texts });
};

export const releaseIndexModel = async (): Promise<void> => {
  if (!indexExtractorLoaded && !topicExtractorLoaded) return;
  await requestEmbeddingUtility<null>('release-index');
  indexExtractorLoaded = false;
  topicExtractorLoaded = false;
  setStatus({ ready: true, state: 'ready' });
};

const enqueueIndexEmbedding = (
  texts: string[],
  prefix: EmbeddingPrefix,
): Promise<number[][]> => {
  const result = indexEmbeddingQueue.then(() => embedTextsForIndex(texts, prefix));
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
  return statusForRenderer();
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

ipcMain.handle(
  'local-embed:index',
  async (event, texts: unknown, prefix: unknown = 'passage') => {
    assertTrustedSender(event);
    if (!validTexts(texts)) throw new Error('Invalid embedding input.');
    if (prefix !== 'passage' && prefix !== 'query') {
      throw new Error('Invalid embedding prefix.');
    }
    if (texts.length === 0) return [];
    if (texts.length > 64) throw new Error('Too many texts in one embedding request.');
    return enqueueIndexEmbedding(texts, prefix);
  },
);

ipcMain.handle('local-embed:topics', async (event, texts: unknown) => {
  assertTrustedSender(event);
  if (!validTexts(texts) || texts.length > 64) throw new Error('Invalid topic extraction input.');
  if (texts.length === 0) return [];
  return topicWordsForIndex(texts);
});

ipcMain.handle('local-embed:release-index', async event => {
  assertTrustedSender(event);
  await releaseIndexModelWhenIdle();
});

app.once?.('before-quit', () => {
  embeddingProcess?.kill();
});
