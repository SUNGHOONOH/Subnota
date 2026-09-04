/**
 * 로컬 임베딩 — ONNX Runtime으로 기기에서 직접 벡터를 만든다.
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
 * 모델은 앱에 번들하지 않는다(569MB). 첫 사용 시 userData로 내려받고,
 * 이후 실행부터는 로컬 캐시를 그대로 쓴다. MAS도 같은 경로를 쓴다 —
 * 번들하면 앱이 343MB에서 900MB가 되고, 받은 파일을 캐시로 한 번 더
 * 복사하게 되어 디스크를 두 배로 먹었다.
 */
import { app, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

import {
  downloadWeightsResumable,
  fileMatchesExpectedModel,
  freeDiskBytes,
} from './local-embedding-download';
import {
  getLegacyModelCacheDirectory,
  getModelCacheDirectory,
} from './app-storage';

const MODEL_REPO = 'Xenova/bge-m3';
const MODEL_REVISION = '4de13258303883538bd53b696b452bf8099f0858';
const MODEL_DTYPE = 'q8';
// Xenova/bge-m3 = BAAI/bge-m3의 ONNX 변환판. dtype q8은 onnx/model_quantized.onnx.
// 로컬 인덱스 무효화 판정에 쓰므로 실제 모델·엔진·양자화에서 값을 만든다.
// 이 값이 바뀌면 기존 로컬 벡터는 버리고 다시 색인해야 한다.
export const EMBEDDING_MODEL_ID = `${MODEL_REPO}@${MODEL_REVISION}:onnx-${MODEL_DTYPE}`;
const MODEL_WEIGHTS = 'onnx/model_quantized.onnx';
const MODEL_BYTES = 569_694_530;
const MODEL_SHA256 = '0826f8c1ab9edf1801db86c61919d4d108e8bfc0b809ec823ad366882ff0b77d';
const WEIGHTS_URL = `https://huggingface.co/${MODEL_REPO}/resolve/${MODEL_REVISION}/${MODEL_WEIGHTS}`;
// 가중치 + 토크나이저·설정 + 여유. 부족하면 받기 전에 막는다 — 570MB를 받다
// 실패하는 것보다 시작 전에 알려 주는 편이 낫다.
const REQUIRED_DISK_BYTES = MODEL_BYTES + 200_000_000;
export const EMBEDDING_VECTOR_DIMENSIONS = 1024;

export interface LocalEmbeddingStatus {
  downloadedBytes: number;
  modelId: string;
  ready: boolean;
  state: 'absent' | 'downloading' | 'loading' | 'ready' | 'failed';
  totalBytes: number;
  error?: string;
}

const cacheDirectory = getModelCacheDirectory;
// Transformers.js의 FileCache는 main이 아닌 revision을 캐시 키 경로에 넣는다.
// 전용 다운로더도 같은 위치에 써야 검증한 파일을 pipeline이 그대로 사용한다.
const weightsPath = () =>
  path.join(cacheDirectory(), MODEL_REPO, MODEL_REVISION, MODEL_WEIGHTS);
const partialWeightsPath = () => `${weightsPath()}.part`;
// revision 고정 전 버전이 사용하던 캐시 위치. 파일 내용이 현재 pinned
// revision과 일치할 때만 새 위치로 옮겨 재다운로드를 피한다.
const legacyWeightsPath = () =>
  path.join(getLegacyModelCacheDirectory(), MODEL_REPO, MODEL_WEIGHTS);

let status: LocalEmbeddingStatus = {
  downloadedBytes: 0,
  modelId: EMBEDDING_MODEL_ID,
  ready: false,
  state: 'absent',
  totalBytes: MODEL_BYTES,
};

const setStatus = (patch: Partial<LocalEmbeddingStatus>) => {
  status = { ...status, ...patch };
};

// 모델 존재 여부는 처음 물어볼 때 확인한다. 모듈 로드 시점에 app.getPath를
// 부르면 앱이 준비되기 전(테스트 포함)에 터진다.
let inspectedDisk = false;
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
          ready: downloadedBytes === MODEL_BYTES,
          state: downloadedBytes === MODEL_BYTES ? 'ready' : 'absent',
        });
      }
    } catch {
      // userData를 아직 읽을 수 없으면 다음 호출에서 다시 본다.
      inspectedDisk = false;
    }
  }
  return status;
};

// ── 모델 로딩 ────────────────────────────────────────────────────────────
// 큰 가중치는 revision·크기·SHA-256을 고정한 전용 이어받기 경로로 확보하고,
// 토크나이저와 설정 같은 작은 파일만 Transformers.js 캐시에 맡긴다.
type Extractor = (
  text: string,
  options: { pooling: 'cls'; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

type DisposableExtractor = Extractor & { dispose: () => Promise<void> };

let interactiveExtractorPromise: Promise<DisposableExtractor> | null = null;
let indexExtractorPromise: Promise<DisposableExtractor> | null = null;
let indexEmbeddingQueue: Promise<void> = Promise.resolve();
let modelDownloadPromise: Promise<LocalEmbeddingStatus> | null = null;
let weightsVerified = false;

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
      MODEL_BYTES,
      MODEL_SHA256,
    );
    if (current) {
      fs.rmSync(partialWeightsPath(), { force: true });
      weightsVerified = true;
      return;
    }
    if (!allowDownload) {
      throw new Error('검색 준비 파일을 먼저 내려받아 주세요.');
    }
  }
  if (!fs.existsSync(weightsPath()) && fs.existsSync(legacyWeightsPath())) {
    const legacyIsCurrent = await fileMatchesExpectedModel(
      legacyWeightsPath(),
      MODEL_BYTES,
      MODEL_SHA256,
    );
    if (legacyIsCurrent) {
      fs.mkdirSync(path.dirname(weightsPath()), { recursive: true });
      fs.renameSync(legacyWeightsPath(), weightsPath());
      fs.rmSync(partialWeightsPath(), { force: true });
      weightsVerified = true;
      return;
    }
  }
  if (!allowDownload) {
    throw new Error('검색 준비 파일을 먼저 내려받아 주세요.');
  }
  if (!fs.existsSync(weightsPath())) {
    const { freeBytes, requiredBytes } = diskSpaceForModel();
    if (freeBytes !== null && freeBytes < requiredBytes) {
      const shortfall = Math.ceil((requiredBytes - freeBytes) / 1_000_000);
      throw new Error(`저장 공간이 ${shortfall}MB 부족합니다.`);
    }
  }
  await downloadWeightsResumable({
    expectedBytes: MODEL_BYTES,
    expectedSha256: MODEL_SHA256,
    onProgress,
    targetPath: weightsPath(),
    url: WEIGHTS_URL,
  });
  fs.rmSync(partialWeightsPath(), { force: true });
  weightsVerified = true;
};

// Transformers.js는 중단된 다운로드의 임시 파일(`*.tmp.<pid>.<rand>`)을 지우지
// 않는다. 그리고 revision을 고정하기 전 버전은 `<repo>/` 바로 아래에 받았으므로,
// 고정 이후에는 같은 파일이 `<repo>/<revision>/`과 두 벌로 남는다. 지금 코드는
// `<revision>/` 밖에는 아무것도 쓰지 않으니, 그 바깥은 전부 과거의 잔해다.
//
// 실측: 이 상태로 49MB(중단된 가중치) + 16MB(중복 tokenizer)가 방치돼 있었다.
// deleteModel은 사용자가 [삭제]를 눌러야만 돌아서 여기까지 손이 닿지 않았다.
export const pruneStaleModelCache = (repoRoot: string, keepRevision: string) => {
  let removedBytes = 0;
  let entries: string[];
  try {
    entries = fs.readdirSync(repoRoot);
  } catch {
    return 0; // 캐시가 아직 없으면 정리할 것도 없다.
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

let prunedStaleCache = false;

const loadExtractor = async (
  mode: 'index' | 'interactive',
  allowDownload = true,
): Promise<DisposableExtractor> => {
  const alreadyOnDisk =
    fs.existsSync(weightsPath()) || fs.existsSync(legacyWeightsPath());
  setStatus({
    ready: false,
    state: alreadyOnDisk ? 'loading' : 'downloading',
    error: undefined,
  });

  await ensureWeights(
    ({ downloadedBytes, totalBytes }) =>
      setStatus({ downloadedBytes, totalBytes: totalBytes || MODEL_BYTES }),
    allowDownload,
  );
  // 가중치가 제자리에 있다고 확인된 뒤에 한 번만. 이 시점 이후로 앱은
  // `<revision>/` 밖에 쓰지 않으므로 진행 중인 다운로드와 부딪히지 않는다.
  if (!prunedStaleCache) {
    prunedStaleCache = true;
    pruneStaleModelCache(path.join(cacheDirectory(), MODEL_REPO), MODEL_REVISION);
  }
  // 가중치가 끝난 뒤 Transformers.js가 받는 tokenizer/config 파일의
  // 진행률은 570MB 가중치와 다른 작업이다. 그 값을 같은 바이트 카운터에
  // 쓰면 완료 직후 진행률이 0으로 되돌아간 것처럼 보인다.
  setStatus({
    downloadedBytes: MODEL_BYTES,
    totalBytes: MODEL_BYTES,
    ready: false,
    state: 'loading',
  });

  // ESM 전용이라 동적 import로 가져온다. vite.main.config.ts에서 external로
  // 두었기 때문에 번들되지 않고 런타임에 node_modules에서 로드된다.
  const { env, pipeline } = await import('@huggingface/transformers');
  env.cacheDir = cacheDirectory();
  env.allowLocalModels = false; // 저장소 경로가 아니라 HF Hub에서만 받는다

  // 가중치 진행률과 보조 파일 진행률은 서로 다른 단위라 합산하지 않는다.
  // 보조 파일 진행률을 같은 카운터에 쓰면 모델 다운로드가 끝난 뒤 0부터
  // 다시 시작하는 것처럼 표시된다. 이 단계는 loading 상태로만 표시한다.
  const extract = await pipeline('feature-extraction', MODEL_REPO, {
    dtype: MODEL_DTYPE,
    revision: MODEL_REVISION,
    // 세션 옵션은 생성 시 고정된다. CPU를 오래 점유하는 색인 세션만
    // 2개 스레드로 제한하고, 커서 질의용 세션은 ORT 기본값을 유지한다.
    ...(mode === 'index'
      ? { session_options: { intraOpNumThreads: 2 } }
      : {}),
    progress_callback: () => undefined,
  });

  setStatus({ state: 'ready', ready: true });
  return extract as unknown as DisposableExtractor;
};

const ensureExtractor = (
  mode: 'index' | 'interactive',
  allowDownload = true,
): Promise<DisposableExtractor> => {
  const current =
    mode === 'index' ? indexExtractorPromise : interactiveExtractorPromise;
  if (current) return current;

  const next = loadExtractor(mode, allowDownload).catch(error => {
    if (mode === 'index') {
      indexExtractorPromise = null;
    } else {
      interactiveExtractorPromise = null;
    }
    const message = error instanceof Error ? error.message : String(error);
    setStatus({ state: 'failed', ready: false, error: message });
    throw error;
  });
  if (mode === 'index') {
    indexExtractorPromise = next;
  } else {
    interactiveExtractorPromise = next;
  }
  return next;
};

/** 남은 공간과 필요한 공간. UI가 받기 전에 안내하는 데 쓴다. */
export const diskSpaceForModel = () => ({
  freeBytes: freeDiskBytes(cacheDirectory()),
  requiredBytes: REQUIRED_DISK_BYTES,
});

/**
 * 모델을 내려받기만 한다(추론 세션은 만들지 않는다). 관문에서 부르는 경로라
 * 진행률을 상태에 계속 반영하고, 큰 가중치는 이어받기로 처리한다.
 */
export const downloadModel = (): Promise<LocalEmbeddingStatus> => {
  if (modelDownloadPromise) return modelDownloadPromise;

  const next = (async () => {
    setStatus({ downloadedBytes: 0, ready: false, state: 'downloading', error: undefined });
    try {
      await ensureWeights(({ downloadedBytes, totalBytes }) =>
        setStatus({ downloadedBytes, totalBytes: totalBytes || MODEL_BYTES }),
      );
      // 토크나이저·설정 등 작은 파일은 Transformers.js가 채운다.
      await ensureExtractor('interactive');
    } catch (error) {
      setStatus({
        state: 'failed',
        error: error instanceof Error ? error.message : '모델을 받지 못했습니다.',
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
  await releaseIndexModel();
  interactiveExtractorPromise = null;
  indexExtractorPromise = null;
  fs.rmSync(path.join(cacheDirectory(), MODEL_REPO), {
    force: true,
    recursive: true,
  });
  fs.rmSync(path.join(getLegacyModelCacheDirectory(), MODEL_REPO), {
    force: true,
    recursive: true,
  });
  weightsVerified = false;
  inspectedDisk = true;
  setStatus({
    downloadedBytes: 0,
    ready: false,
    state: 'absent',
    totalBytes: MODEL_BYTES,
    error: undefined,
  });
  return status;
};

const requireDownloadedModel = () => {
  if (!currentStatus().ready) {
    throw new Error('검색 준비 파일을 먼저 내려받아 주세요.');
  }
};

export const ensureModel = (): Promise<DisposableExtractor> => {
  requireDownloadedModel();
  return ensureExtractor('interactive', false);
};

export const ensureIndexModel = (): Promise<DisposableExtractor> => {
  requireDownloadedModel();
  return ensureExtractor('index', false);
};

const embedWith = async (
  texts: string[],
  ensure: () => Promise<DisposableExtractor>,
): Promise<number[][]> => {
  const extract = await ensure();
  const out: number[][] = [];
  // ⚠️ 한 건씩 부른다. 배열을 한 번에 넘기면 패딩이 CLS 위치로 새어 들어와
  // 결과가 달라진다(실측: 같은 문장의 배치 vs 단건 코사인 0.978~0.992).
  // 벡터 공간 일관성이 깨지므로 속도를 위해 배치로 바꾸지 말 것.
  for (const text of texts) {
    const { data } = await extract(text, { pooling: 'cls', normalize: true });
    if (
      data.length !== EMBEDDING_VECTOR_DIMENSIONS ||
      Array.from(data).some(value => !Number.isFinite(value))
    ) {
      throw new Error('Local embedding returned an invalid vector.');
    }
    out.push(Array.from(data));
  }
  return out;
};

export const embedTexts = (texts: string[]): Promise<number[][]> =>
  embedWith(texts, ensureModel);

export const embedTextsForIndex = (texts: string[]): Promise<number[][]> =>
  embedWith(texts, ensureIndexModel);

export const releaseIndexModel = async (): Promise<void> => {
  const active = indexExtractorPromise;
  indexExtractorPromise = null;
  if (!active) return;
  try {
    const extract = await active;
    await extract.dispose();
    setStatus({ ready: true, state: 'ready' });
  } catch {
    // Loading failures already update status in ensureExtractor.
  }
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
  // Another window queued work while this release request was waiting.
  if (pending !== indexEmbeddingQueue) return;
  await releaseIndexModel();
};

// ── IPC ─────────────────────────────────────────────────────────────────
const assertTrustedSender = (event: Electron.IpcMainInvokeEvent) => {
  const url = event.senderFrame?.url ?? event.sender?.getURL?.() ?? '';
  if (!url && !app.isPackaged) return;
  const trustedProduction = url.startsWith('subnota-app://bundle/');
  const trustedDevelopment =
    !app.isPackaged && /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(url);
  if (!trustedProduction && !trustedDevelopment) throw new Error('Untrusted IPC sender.');
};

ipcMain.handle('local-embed:status', (event) => {
  assertTrustedSender(event);
  return currentStatus();
});

ipcMain.handle('local-embed:ensure-model', async (event) => {
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
  if (!Array.isArray(texts) || texts.some(t => typeof t !== 'string')) {
    throw new Error('Invalid embedding input.');
  }
  if (texts.length === 0) return [];
  if (texts.length > 64) throw new Error('Too many texts in one embedding request.');
  return embedTexts(texts as string[]);
});

ipcMain.handle('local-embed:index', async (event, texts: unknown) => {
  assertTrustedSender(event);
  if (!Array.isArray(texts) || texts.some(t => typeof t !== 'string')) {
    throw new Error('Invalid embedding input.');
  }
  if (texts.length === 0) return [];
  if (texts.length > 64) throw new Error('Too many texts in one embedding request.');
  return enqueueIndexEmbedding(texts as string[]);
});

ipcMain.handle('local-embed:release-index', async event => {
  assertTrustedSender(event);
  await releaseIndexModelWhenIdle();
});
