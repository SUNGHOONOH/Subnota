import {
  createLocalEmbeddingRuntime,
} from './local-embedding-runtime';
import type {
  LocalEmbeddingMode,
  LocalEmbeddingRuntime,
} from './local-embedding-runtime';

type WorkerMethod = 'embed' | 'ensure' | 'initialize' | 'release-all' | 'release-index';

interface WorkerRequest {
  cacheDirectory?: string;
  id: number;
  method: WorkerMethod;
  mode?: LocalEmbeddingMode;
  texts?: string[];
}

interface WorkerResponse {
  error?: string;
  id: number;
  ok: boolean;
  result?: null | number[][];
}

interface QueueEntry {
  request: WorkerRequest;
}

const parentPort = process.parentPort;
if (!parentPort) {
  throw new Error('The embedding worker requires an Electron Utility Process.');
}

let runtime: LocalEmbeddingRuntime | null = null;
let runtimeCacheDirectory: string | null = null;
let running = false;
const interactiveQueue: QueueEntry[] = [];
const backgroundQueue: QueueEntry[] = [];

const reply = (response: WorkerResponse) => parentPort.postMessage(response);

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const run = async (request: WorkerRequest): Promise<null | number[][]> => {
  switch (request.method) {
    case 'initialize': {
      if (typeof request.cacheDirectory !== 'string' || request.cacheDirectory.length === 0) {
        throw new Error('Embedding cache directory is required.');
      }
      if (runtime && runtimeCacheDirectory !== request.cacheDirectory) {
        await runtime.releaseAll();
        runtime = null;
      }
      if (!runtime) {
        runtime = createLocalEmbeddingRuntime(request.cacheDirectory);
        runtimeCacheDirectory = request.cacheDirectory;
      }
      return null;
    }
    case 'ensure': {
      if (!runtime || !request.mode) throw new Error('Embedding worker is not initialized.');
      await runtime.ensure(request.mode);
      return null;
    }
    case 'embed': {
      if (!runtime || !request.mode || !Array.isArray(request.texts)) {
        throw new Error('Embedding worker is not initialized.');
      }
      return runtime.embed(request.mode, request.texts);
    }
    case 'release-index': {
      await runtime?.releaseIndex();
      return null;
    }
    case 'release-all': {
      await runtime?.releaseAll();
      return null;
    }
  }
};

const drain = () => {
  if (running) return;
  const entry = interactiveQueue.shift() ?? backgroundQueue.shift();
  if (!entry) return;

  running = true;
  void run(entry.request)
    .then(result => reply({ id: entry.request.id, ok: true, result }))
    .catch(error =>
      reply({ id: entry.request.id, ok: false, error: errorMessage(error) }),
    )
    .finally(() => {
      running = false;
      drain();
    });
};

parentPort.on('message', event => {
  const request = event.data as WorkerRequest;
  if (!request || typeof request !== 'object' || !Number.isSafeInteger(request.id)) return;
  if (!['embed', 'ensure', 'initialize', 'release-all', 'release-index'].includes(request.method)) {
    reply({ id: request.id, ok: false, error: 'Unknown embedding worker method.' });
    return;
  }

  // 이미 대기 중인 색인이 있더라도 사용자 검색은 다음 작업으로 먼저 처리한다.
  if (request.method === 'embed' && request.mode === 'interactive') {
    interactiveQueue.push({ request });
  } else {
    backgroundQueue.push({ request });
  }
  drain();
});

parentPort.postMessage({ type: 'ready' });
