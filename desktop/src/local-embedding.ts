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
 * 이후 실행부터는 로컬 캐시를 그대로 쓴다.
 */
import { app, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const MODEL_REPO = 'Xenova/bge-m3';
const MODEL_DTYPE = 'q8';
// Xenova/bge-m3 = BAAI/bge-m3의 ONNX 변환판. dtype q8은 onnx/model_quantized.onnx.
// 로컬 인덱스 무효화 판정에 쓰므로 실제 모델·엔진·양자화에서 값을 만든다.
// 이 값이 바뀌면 기존 로컬 벡터는 버리고 다시 색인해야 한다.
export const EMBEDDING_MODEL_ID = `${MODEL_REPO}@onnx-${MODEL_DTYPE}`;
const MODEL_WEIGHTS = 'onnx/model_quantized.onnx';
const MODEL_BYTES = 569_694_530; // 진행률 표시용. 실제 값은 progress 이벤트로 대체된다.
export const EMBEDDING_VECTOR_DIMENSIONS = 1024;

export interface LocalEmbeddingStatus {
  downloadedBytes: number;
  modelId: string;
  ready: boolean;
  state: 'absent' | 'downloading' | 'loading' | 'ready' | 'failed';
  totalBytes: number;
  error?: string;
}

const cacheDirectory = () => path.join(app.getPath('userData'), 'models');
const weightsPath = () => path.join(cacheDirectory(), MODEL_REPO, MODEL_WEIGHTS);

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
      if (fs.existsSync(weightsPath())) {
        setStatus({
          downloadedBytes: fs.statSync(weightsPath()).size,
          ready: true,
          state: 'ready',
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
// Transformers.js가 다운로드와 캐시를 모두 처리한다. 부분 파일 관리도
// 라이브러리 몫이라 우리가 따로 할 일이 없다.
type Extractor = (
  text: string,
  options: { pooling: 'cls'; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

type DisposableExtractor = Extractor & { dispose: () => Promise<void> };

let interactiveExtractorPromise: Promise<DisposableExtractor> | null = null;
let indexExtractorPromise: Promise<DisposableExtractor> | null = null;
let indexEmbeddingQueue: Promise<void> = Promise.resolve();

const loadExtractor = async (
  mode: 'index' | 'interactive',
): Promise<DisposableExtractor> => {
  const alreadyOnDisk = fs.existsSync(weightsPath());
  setStatus({
    ready: false,
    state: alreadyOnDisk ? 'loading' : 'downloading',
    error: undefined,
  });

  // ESM 전용이라 동적 import로 가져온다. vite.main.config.ts에서 external로
  // 두었기 때문에 번들되지 않고 런타임에 node_modules에서 로드된다.
  const { env, pipeline } = await import('@huggingface/transformers');
  env.cacheDir = cacheDirectory();
  env.allowLocalModels = false; // 저장소 경로가 아니라 HF Hub에서만 받는다

  // 여러 파일(가중치·토크나이저)이 병렬로 내려오므로 파일별 진행률을 합산한다.
  const progress = new Map<string, { loaded: number; total: number }>();
  const extract = await pipeline('feature-extraction', MODEL_REPO, {
    dtype: MODEL_DTYPE,
    // 세션 옵션은 생성 시 고정된다. CPU를 오래 점유하는 색인 세션만
    // 2개 스레드로 제한하고, 커서 질의용 세션은 ORT 기본값을 유지한다.
    ...(mode === 'index'
      ? { session_options: { intraOpNumThreads: 2 } }
      : {}),
    progress_callback: (event: {
      file?: string;
      loaded?: number;
      status?: string;
      total?: number;
    }) => {
      if (event.status !== 'progress' || !event.file) return;
      progress.set(event.file, { loaded: event.loaded ?? 0, total: event.total ?? 0 });
      let loaded = 0;
      let total = 0;
      for (const entry of progress.values()) {
        loaded += entry.loaded;
        total += entry.total;
      }
      setStatus({ downloadedBytes: loaded, totalBytes: total || MODEL_BYTES });
    },
  });

  setStatus({ state: 'ready', ready: true });
  return extract as unknown as DisposableExtractor;
};

const ensureExtractor = (
  mode: 'index' | 'interactive',
): Promise<DisposableExtractor> => {
  const current =
    mode === 'index' ? indexExtractorPromise : interactiveExtractorPromise;
  if (current) return current;

  const next = loadExtractor(mode).catch(error => {
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

export const ensureModel = (): Promise<DisposableExtractor> =>
  ensureExtractor('interactive');

export const ensureIndexModel = (): Promise<DisposableExtractor> =>
  ensureExtractor('index');

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
