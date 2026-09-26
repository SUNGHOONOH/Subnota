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
const testModelRoot = `${testUserDataRoot}/Models/Embedding/Hoon03/subnota-bge-m3-koen-int8-onnx`;
const legacyModelRoot = `${testUserDataRoot}/models/Hoon03/subnota-bge-m3-koen-int8-onnx`;
const testWeightsPath = path.join(
  testModelRoot,
  '3b2aa404f867251423f68c5c51b23d91688ab97b/onnx/model_quantized.onnx',
);

const seedVerifiedWeights = () => {
  fs.mkdirSync(path.dirname(testWeightsPath), { recursive: true });
  fs.closeSync(fs.openSync(testWeightsPath, 'w'));
  fs.truncateSync(testWeightsPath, 406_126_989);
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
      'local-embed:topics',
    ]);
  });

  it('모델이 없어도 status가 안전하게 응답한다', () => {
    const status = ipcHandlers['local-embed:status'](trustedEvent) as {
      modelId: string;
      state: string;
    };
    expect(status.modelId).toBe(
      'Hoon03/subnota-bge-m3-koen-int8-onnx@3b2aa404f867251423f68c5c51b23d91688ab97b:onnx-q8:cls:norm1',
    );
    expect(['absent', 'ready']).toContain(status.state);
  });

  it('검증한 가중치를 pinned revision 캐시 경로에 쓴다', async () => {
    await ipcHandlers['local-embed:download-model'](trustedEvent);

    expect(downloadMocks.downloadWeightsResumable).toHaveBeenCalledWith(
      expect.objectContaining({ targetPath: testWeightsPath }),
    );
    expect(downloadMocks.downloadWeightsResumable).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPath: expect.stringContaining('Hoon03/subnota-ax-encoder-int8-onnx'),
        url: expect.stringContaining('ce7ce9a158b28352fed762f86aab028385bc5f23'),
      }),
    );
  });

  it('기존 캐시가 같은 파일이면 재다운로드 없이 pinned 경로로 이동한다', async () => {
    const legacyPath = path.join(legacyModelRoot, 'onnx/model_quantized.onnx');
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.closeSync(fs.openSync(legacyPath, 'w'));
    fs.truncateSync(legacyPath, 406_126_989);
    const partialPath = `${testWeightsPath}.part`;
    fs.mkdirSync(path.dirname(partialPath), { recursive: true });
    fs.writeFileSync(partialPath, 'stale partial');

    await ipcHandlers['local-embed:download-model'](trustedEvent);

    expect(fs.existsSync(legacyPath)).toBe(false);
    expect(fs.existsSync(testWeightsPath)).toBe(true);
    expect(fs.existsSync(partialPath)).toBe(false);
    expect(downloadMocks.downloadWeightsResumable).not.toHaveBeenCalledWith(
      expect.objectContaining({ targetPath: testWeightsPath }),
    );
  });

  it('다운로드 완료 후 Utility Process에서 세션을 준비하고 ready를 유지한다', async () => {
    downloadMocks.downloadWeightsResumable.mockImplementation(async options => {
      options.onProgress({
        downloadedBytes: 406_126_989,
        totalBytes: 406_126_989,
      });
    });

    await ipcHandlers['local-embed:download-model'](trustedEvent);

    expect(ipcHandlers['local-embed:status'](trustedEvent)).toMatchObject({
      downloadedBytes: 596_120_278,
      totalBytes: 596_120_278,
      topicReady: true,
      state: 'ready',
    });
    expect(utilityProcessMocks.fork).toHaveBeenCalledOnce();
    expect(messagesFor('initialize')).toHaveLength(1);
    expect(messagesFor('ensure')).toEqual([
      expect.objectContaining({ mode: 'interactive' }),
    ]);
  });

  it('A.X 파일 다운로드가 실패해도 BGE 검색 준비 상태를 유지한다', async () => {
    downloadMocks.downloadWeightsResumable.mockImplementation(async options => {
      if (String(options.url).endsWith('/config.json')) throw new Error('A.X download failed');
      if (String(options.url).includes('Hoon03/subnota-bge-m3-koen-int8-onnx')) {
        options.onProgress({ downloadedBytes: 406_126_989, totalBytes: 406_126_989 });
      }
    });
    await ipcHandlers['local-embed:download-model'](trustedEvent);
    expect(ipcHandlers['local-embed:status'](trustedEvent)).toMatchObject({
      ready: true,
      state: 'ready',
      topicReady: false,
      topicError: 'A.X download failed',
    });
  });

  // 업데이트로 모델이 바뀐 사용자. 옛 다국어 사전 모델(570MB)은 새 모델을 받아
  // 검증한 뒤에만 지운다 — 받다가 실패해도 중간 상태로 남지 않게.
  const retiredWeights = path.join(
    testUserDataRoot,
    'Models/Embedding/Xenova/bge-m3/4de13258303883538bd53b696b452bf8099f0858/onnx/model_quantized.onnx',
  );
  const seedRetiredModel = () => {
    fs.mkdirSync(path.dirname(retiredWeights), { recursive: true });
    fs.writeFileSync(retiredWeights, 'x'.repeat(1_000));
  };

  it('옛 모델이 남아 있으면 교체 안내에 쓸 크기와 받을 크기를 알려 준다', () => {
    seedRetiredModel();
    expect(ipcHandlers['local-embed:status'](trustedEvent)).toMatchObject({
      pendingDownloadBytes: 596_120_278,
      retiredModelBytes: 1_000,
      state: 'absent',
    });
  });

  it('새 모델을 받아 검증한 뒤 옛 모델 폴더를 지운다', async () => {
    seedRetiredModel();
    await ipcHandlers['local-embed:download-model'](trustedEvent);
    expect(fs.existsSync(path.join(testUserDataRoot, 'Models/Embedding/Xenova/bge-m3'))).toBe(false);
    expect(ipcHandlers['local-embed:status'](trustedEvent)).toMatchObject({ retiredModelBytes: 0 });
  });

  it('새 모델 받기가 실패하면 옛 모델을 지우지 않는다', async () => {
    seedRetiredModel();
    downloadMocks.downloadWeightsResumable.mockRejectedValue(new Error('offline'));
    await ipcHandlers['local-embed:download-model'](trustedEvent);
    expect(fs.existsSync(retiredWeights)).toBe(true);
  });

  it('모델 삭제는 BGE와 A.X 캐시를 함께 제거한다', async () => {
    seedVerifiedWeights();
    const topicRoot = path.join(testUserDataRoot, 'Models/Embedding/Hoon03/subnota-ax-encoder-int8-onnx');
    fs.mkdirSync(topicRoot, { recursive: true });
    fs.writeFileSync(path.join(topicRoot, 'marker'), 'cached');

    const status = await ipcHandlers['local-embed:delete-model'](trustedEvent);
    expect(status).toMatchObject({ ready: false, state: 'absent', topicReady: false });
    expect(fs.existsSync(testModelRoot)).toBe(false);
    expect(fs.existsSync(topicRoot)).toBe(false);
  });

  it('동시에 온 다운로드 요청은 하나의 모델 받기 작업을 공유한다', async () => {
    let releaseDownload: (() => void) | null = null;
    downloadMocks.downloadWeightsResumable.mockImplementation(async options => {
      if (options.targetPath === testWeightsPath) {
        await new Promise<void>(resolve => { releaseDownload = resolve; });
      }
      fs.mkdirSync(path.dirname(options.targetPath), { recursive: true });
      fs.closeSync(fs.openSync(options.targetPath, 'w'));
      fs.truncateSync(options.targetPath, options.expectedBytes);
      options.onProgress({
        downloadedBytes: options.expectedBytes,
        totalBytes: options.expectedBytes,
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
    expect(downloadMocks.downloadWeightsResumable).toHaveBeenCalledTimes(7);
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

  // bge-m3 는 접두사를 쓰지 않는다 — 본문 그대로 worker 에 가야 한다.
  it('대화형 검색 요청을 Utility Process에 전달한다', async () => {
    seedVerifiedWeights();
    const result = await ipcHandlers['local-embed:embed'](trustedEvent, ['가', '나', '다']);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(1024);
    expect(messagesFor('embed')).toEqual([
      expect.objectContaining({ mode: 'interactive', texts: ['가', '나', '다'] }),
    ]);
  });

  // 색인 경로는 문서 벡터가 기본이고, CSLS 채점에 쓸 질의 벡터도 같은 index
  // 세션에서 만들 수 있어야 한다. bge-m3 는 접두사가 없어 두 요청의 본문이 같다.
  it('색인은 문서·질의 딱지를 모두 받고, 모르는 딱지는 거부한다', async () => {
    seedVerifiedWeights();
    await ipcHandlers['local-embed:index'](trustedEvent, ['본문 청크']);
    await ipcHandlers['local-embed:index'](trustedEvent, ['본문 청크'], 'query');

    expect(messagesFor('embed')).toEqual([
      expect.objectContaining({ mode: 'index', texts: ['본문 청크'] }),
      expect.objectContaining({ mode: 'index', texts: ['본문 청크'] }),
    ]);
    await expect(
      ipcHandlers['local-embed:index'](trustedEvent, ['본문 청크'], 'document'),
    ).rejects.toThrow('Invalid embedding prefix');
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

  // 약 600MB 모델과 여유 공간을 포함한 필요량을 받기 전에 확인한다.
  it('디스크 여유 공간과 필요한 공간을 알려 준다', () => {
    const space = ipcHandlers['local-embed:disk-space'](trustedEvent) as {
      freeBytes: number | null;
      requiredBytes: number;
    };
    expect(space.requiredBytes).toBeGreaterThan(700_000_000);
    expect(space.freeBytes === null || space.freeBytes >= 0).toBe(true);
  });
});

describe('pruneStaleModelCache', () => {
  const repoRoot = path.join('/tmp', `subnota-prune-${process.pid}`);
  const revision = '3b2aa404f867251423f68c5c51b23d91688ab97b';

  beforeEach(() => {
    fs.rmSync(repoRoot, { force: true, recursive: true });
    fs.mkdirSync(path.join(repoRoot, revision, 'onnx'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, revision, 'onnx', 'model_quantized.onnx'), 'keep');
    fs.writeFileSync(path.join(repoRoot, revision, 'tokenizer.json'), 'keep');
    fs.mkdirSync(path.join(repoRoot, 'onnx'), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, 'onnx', 'model_quantized.onnx.tmp.2170.s22kl9'), 'x'.repeat(40));
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
    expect(fs.existsSync(path.join(repoRoot, revision, 'onnx', 'model_quantized.onnx'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, revision, 'tokenizer.json'))).toBe(true);
    expect(removed).toBe(51); // 40 + 10 + 1
  });

  it('캐시가 없어도 던지지 않는다', async () => {
    const { pruneStaleModelCache } = await import('../local-embedding');
    expect(pruneStaleModelCache(path.join(repoRoot, 'missing'), revision)).toBe(0);
  });
});
