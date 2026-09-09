import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downloadMocks = vi.hoisted(() => ({
  downloadWeightsResumable: vi.fn(async () => undefined),
  fileMatchesExpectedModel: vi.fn(async () => true),
}));

const utilityProcessMocks = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;
  const listeners = new Map<string, Listener[]>();
  const messages: Array<Record<string, unknown>> = [];
  let releaseSlowIndexEmbedding: (() => void) | null = null;

  const emit = (event: string, ...args: unknown[]) => {
    for (const listener of listeners.get(event) ?? []) listener(...args);
  };
  const addListener = (event: string, listener: Listener) => {
    const current = listeners.get(event) ?? [];
    current.push(listener);
    listeners.set(event, current);
  };
  const child = {
    kill: vi.fn(() => true),
    on: (event: string, listener: Listener) => {
      addListener(event, listener);
      return child;
    },
    once: (event: string, listener: Listener) => {
      addListener(event, listener);
      return child;
    },
    postMessage: (message: Record<string, unknown>) => {
      messages.push(message);
      const respond = () => {
        const texts = Array.isArray(message.texts) ? message.texts : [];
        const result =
          message.method === 'embed'
            ? texts.map(() => Array.from({ length: 1024 }, (_, index) => (index === 0 ? 1 : 0)))
            : null;
        emit('message', { id: message.id, ok: true, result });
      };
      if (
        message.method === 'embed' &&
        message.mode === 'index' &&
        Array.isArray(message.texts) &&
        message.texts[0] === '느린 청크'
      ) {
        releaseSlowIndexEmbedding = respond;
        return;
      }
      queueMicrotask(respond);
    },
  };
  const fork = vi.fn(() => {
    queueMicrotask(() => {
      emit('spawn');
      emit('message', { type: 'ready' });
    });
    return child;
  });

  return {
    child,
    fork,
    messages,
    releaseSlowIndexEmbedding: () => releaseSlowIndexEmbedding?.(),
    reset: () => {
      listeners.clear();
      messages.length = 0;
      releaseSlowIndexEmbedding = null;
      child.kill.mockClear();
      fork.mockClear();
    },
  };
});

vi.mock('../local-embedding-download', () => ({
  downloadWeightsResumable: downloadMocks.downloadWeightsResumable,
  fileMatchesExpectedModel: downloadMocks.fileMatchesExpectedModel,
  freeDiskBytes: vi.fn(() => 1_000_000_000),
}));

const ipcHandlers: Record<string, (event: unknown, ...args: unknown[]) => unknown> = {};

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/subnota-test-userdata',
    isPackaged: false,
    once: vi.fn(),
  },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn;
    },
  },
  utilityProcess: {
    fork: utilityProcessMocks.fork,
  },
}));

const trustedEvent = { senderFrame: { url: 'http://localhost:5173/' } };
const testUserDataRoot = '/tmp/subnota-test-userdata';
const testModelRoot = `${testUserDataRoot}/Models/Embedding/Xenova/bge-m3`;
const legacyModelRoot = `${testUserDataRoot}/models/Xenova/bge-m3`;
const testWeightsPath = path.join(
  testModelRoot,
  '4de13258303883538bd53b696b452bf8099f0858/onnx/model_quantized.onnx',
);

const seedVerifiedWeights = () => {
  fs.mkdirSync(path.dirname(testWeightsPath), { recursive: true });
  fs.closeSync(fs.openSync(testWeightsPath, 'w'));
  fs.truncateSync(testWeightsPath, 569_694_530);
};

const messagesFor = (method: string) =>
  utilityProcessMocks.messages.filter(message => message.method === method);

describe('local-embedding IPC', () => {
  beforeEach(async () => {
    fs.rmSync(testUserDataRoot, { force: true, recursive: true });
    downloadMocks.downloadWeightsResumable.mockReset();
    downloadMocks.downloadWeightsResumable.mockResolvedValue(undefined);
    downloadMocks.fileMatchesExpectedModel.mockReset();
    downloadMocks.fileMatchesExpectedModel.mockResolvedValue(true);
    utilityProcessMocks.reset();
    for (const key of Object.keys(ipcHandlers)) delete ipcHandlers[key];
    vi.resetModules();
    await import('../local-embedding');
  });

  afterEach(() => {
    fs.rmSync(testUserDataRoot, { force: true, recursive: true });
  });

  it('기존 renderer IPC 채널을 모두 유지한다', () => {
    expect(Object.keys(ipcHandlers).sort()).toEqual([
      'local-embed:delete-model',
      'local-embed:disk-space',
      'local-embed:download-model',
      'local-embed:embed',
      'local-embed:ensure-model',
      'local-embed:index',
      'local-embed:release-index',
      'local-embed:status',
    ]);
  });

  it('모델이 없어도 status가 안전하게 응답한다', () => {
    const status = ipcHandlers['local-embed:status'](trustedEvent) as {
      modelId: string;
      state: string;
    };
    expect(status.modelId).toBe(
      'Xenova/bge-m3@4de13258303883538bd53b696b452bf8099f0858:onnx-q8',
    );
    expect(['absent', 'ready']).toContain(status.state);
  });

  it('검증한 가중치를 pinned revision 캐시 경로에 쓴다', async () => {
    await ipcHandlers['local-embed:download-model'](trustedEvent);

    expect(downloadMocks.downloadWeightsResumable).toHaveBeenCalledWith(
      expect.objectContaining({ targetPath: testWeightsPath }),
    );
  });

  it('기존 캐시가 같은 파일이면 재다운로드 없이 pinned 경로로 이동한다', async () => {
    const legacyPath = path.join(legacyModelRoot, 'onnx/model_quantized.onnx');
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.closeSync(fs.openSync(legacyPath, 'w'));
    fs.truncateSync(legacyPath, 569_694_530);
    const partialPath = `${testWeightsPath}.part`;
    fs.mkdirSync(path.dirname(partialPath), { recursive: true });
    fs.writeFileSync(partialPath, 'stale partial');

    await ipcHandlers['local-embed:download-model'](trustedEvent);

    expect(fs.existsSync(legacyPath)).toBe(false);
    expect(fs.existsSync(testWeightsPath)).toBe(true);
    expect(fs.existsSync(partialPath)).toBe(false);
    expect(downloadMocks.downloadWeightsResumable).not.toHaveBeenCalled();
  });

  it('다운로드 완료 후 Utility Process에서 세션을 준비하고 ready를 유지한다', async () => {
    downloadMocks.downloadWeightsResumable.mockImplementation(async options => {
      options.onProgress({
        downloadedBytes: 569_694_530,
        totalBytes: 569_694_530,
      });
    });

    await ipcHandlers['local-embed:download-model'](trustedEvent);

    expect(ipcHandlers['local-embed:status'](trustedEvent)).toMatchObject({
      downloadedBytes: 569_694_530,
      totalBytes: 569_694_530,
      state: 'ready',
    });
    expect(utilityProcessMocks.fork).toHaveBeenCalledOnce();
    expect(messagesFor('initialize')).toHaveLength(1);
    expect(messagesFor('ensure')).toEqual([
      expect.objectContaining({ mode: 'interactive' }),
    ]);
  });

  it('동시에 온 다운로드 요청은 하나의 모델 받기 작업을 공유한다', async () => {
    let releaseDownload: (() => void) | null = null;
    downloadMocks.downloadWeightsResumable.mockImplementation(async options => {
      await new Promise<void>(resolve => {
        releaseDownload = resolve;
      });
      fs.mkdirSync(path.dirname(options.targetPath), { recursive: true });
      fs.closeSync(fs.openSync(options.targetPath, 'w'));
      fs.truncateSync(options.targetPath, 569_694_530);
      options.onProgress({
        downloadedBytes: 569_694_530,
        totalBytes: 569_694_530,
      });
    });

    const first = ipcHandlers['local-embed:download-model'](trustedEvent);
    await vi.waitFor(() =>
      expect(downloadMocks.downloadWeightsResumable).toHaveBeenCalledOnce(),
    );
    const second = ipcHandlers['local-embed:download-model'](trustedEvent);

    expect(downloadMocks.downloadWeightsResumable).toHaveBeenCalledOnce();
    releaseDownload?.();
    await Promise.all([first, second]);
    expect(downloadMocks.downloadWeightsResumable).toHaveBeenCalledOnce();
  });

  it('신뢰할 수 없는 sender를 거부한다', () => {
    const evil = { senderFrame: { url: 'https://evil.example.com/' } };
    expect(() => ipcHandlers['local-embed:status'](evil)).toThrow('Untrusted IPC sender');
  });

  it('잘못된 입력과 너무 큰 요청을 모델 로드 전에 거부한다', async () => {
    const embed = ipcHandlers['local-embed:embed'];
    await expect(embed(trustedEvent, 'not-an-array')).rejects.toThrow('Invalid embedding input');
    await expect(embed(trustedEvent, [1, 2])).rejects.toThrow('Invalid embedding input');
    await expect(
      embed(trustedEvent, Array.from({ length: 65 }, () => 'x')),
    ).rejects.toThrow('Too many texts');
    expect(utilityProcessMocks.fork).not.toHaveBeenCalled();
  });

  it('빈 배열은 Utility Process를 시작하지 않고 즉시 반환한다', async () => {
    await expect(ipcHandlers['local-embed:embed'](trustedEvent, [])).resolves.toEqual([]);
    expect(utilityProcessMocks.fork).not.toHaveBeenCalled();
  });

  it('준비 파일이 없으면 색인이 다운로드를 시작하지 않고 거부한다', async () => {
    await expect(
      ipcHandlers['local-embed:index'](trustedEvent, ['첫 청크']),
    ).rejects.toThrow('검색 준비 파일을 먼저 내려받아 주세요.');
    expect(downloadMocks.downloadWeightsResumable).not.toHaveBeenCalled();
  });

  it('대화형 검색 요청을 Utility Process에 전달한다', async () => {
    seedVerifiedWeights();
    const result = await ipcHandlers['local-embed:embed'](trustedEvent, ['가', '나', '다']);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(1024);
    expect(messagesFor('embed')).toEqual([
      expect.objectContaining({ mode: 'interactive', texts: ['가', '나', '다'] }),
    ]);
  });

  it('색인 요청과 index 세션 해제를 Utility Process에 전달한다', async () => {
    seedVerifiedWeights();
    const result = await ipcHandlers['local-embed:index'](
      trustedEvent,
      ['첫 청크', '둘째 청크'],
    );

    expect(result).toHaveLength(2);
    expect(messagesFor('ensure')).toEqual([
      expect.objectContaining({ mode: 'index' }),
    ]);
    expect(messagesFor('embed')).toEqual([
      expect.objectContaining({ mode: 'index', texts: ['첫 청크', '둘째 청크'] }),
    ]);

    await ipcHandlers['local-embed:release-index'](trustedEvent);
    expect(messagesFor('release-index')).toHaveLength(1);
  });

  it('여러 renderer의 색인을 직렬화하고 모든 대기 작업 뒤에 해제한다', async () => {
    seedVerifiedWeights();
    const index = ipcHandlers['local-embed:index'];
    const first = index(trustedEvent, ['느린 청크']);
    await vi.waitFor(() =>
      expect(messagesFor('embed')).toEqual([
        expect.objectContaining({ mode: 'index', texts: ['느린 청크'] }),
      ]),
    );

    const second = index(trustedEvent, ['다음 창 청크']);
    const release = ipcHandlers['local-embed:release-index'](trustedEvent);
    expect(messagesFor('release-index')).toHaveLength(0);

    utilityProcessMocks.releaseSlowIndexEmbedding();
    await Promise.all([first, second, release]);

    expect(messagesFor('embed')).toEqual([
      expect.objectContaining({ texts: ['느린 청크'] }),
      expect.objectContaining({ texts: ['다음 창 청크'] }),
    ]);
    expect(messagesFor('release-index')).toHaveLength(1);
  });

  it('디스크 여유 공간과 필요한 공간을 알려 준다', () => {
    const space = ipcHandlers['local-embed:disk-space'](trustedEvent) as {
      freeBytes: number | null;
      requiredBytes: number;
    };
    expect(space.requiredBytes).toBeGreaterThan(569_000_000);
    expect(space.freeBytes === null || space.freeBytes >= 0).toBe(true);
  });
});

describe('pruneStaleModelCache', () => {
  const repoRoot = path.join('/tmp', `subnota-prune-${process.pid}`);
  const revision = '4de13258303883538bd53b696b452bf8099f0858';

  beforeEach(() => {
    fs.rmSync(repoRoot, { force: true, recursive: true });
    fs.mkdirSync(path.join(repoRoot, revision, 'onnx'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, revision, 'onnx', 'model.onnx'), 'keep');
    fs.writeFileSync(path.join(repoRoot, revision, 'tokenizer.json'), 'keep');
    fs.mkdirSync(path.join(repoRoot, 'onnx'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'onnx', 'model.onnx.tmp.2170.s22kl9'), 'x'.repeat(40));
    fs.writeFileSync(path.join(repoRoot, 'tokenizer.json'), 'y'.repeat(10));
    fs.writeFileSync(path.join(repoRoot, '.DS_Store'), 'z');
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { force: true, recursive: true });
  });

  it('고정한 revision만 남기고 잔해를 지운다', async () => {
    const { pruneStaleModelCache } = await import('../local-embedding');
    const removed = pruneStaleModelCache(repoRoot, revision);

    expect(fs.readdirSync(repoRoot)).toEqual([revision]);
    expect(removed).toBe(51);
  });

  it('캐시가 없어도 던지지 않는다', async () => {
    const { pruneStaleModelCache } = await import('../local-embedding');
    expect(pruneStaleModelCache(path.join(repoRoot, 'missing'), revision)).toBe(0);
  });
});
