import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downloadMocks = vi.hoisted(() => ({
  downloadWeightsResumable: vi.fn(async () => undefined),
  fileMatchesExpectedModel: vi.fn(async () => true),
}));

vi.mock('../local-embedding-download', () => ({
  downloadWeightsResumable: downloadMocks.downloadWeightsResumable,
  fileMatchesExpectedModel: downloadMocks.fileMatchesExpectedModel,
  freeDiskBytes: vi.fn(() => 1_000_000_000),
}));

// local-embedding은 electron app/ipcMain에 의존한다. 모델 로딩(569MB)이나
// 실제 추론 없이 IPC 계약과 상태 전이만 검증한다.
const ipcHandlers: Record<
  string,
  (event: unknown, ...args: unknown[]) => unknown
> = {};

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/subnota-test-userdata',
    isPackaged: false,
  },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn;
    },
  },
}));

// 추출기는 호출 인자만 기록한다 — 실제 모델은 띄우지 않는다.
const extractCalls: Array<{ mode: 'index' | 'interactive'; text: unknown }> = [];
const pipelineCalls: unknown[][] = [];
const disposeIndexExtractor = vi.fn(async () => undefined);
let releaseSlowIndexExtract: (() => void) | null = null;
vi.mock('@huggingface/transformers', () => ({
  env: {},
  pipeline: async (...args: unknown[]) => {
    pipelineCalls.push(args);
    const options = args[2] as {
      session_options?: { intraOpNumThreads?: number };
      progress_callback?: (event: {
        file: string;
        loaded: number;
        status: string;
        total: number;
      }) => void;
    };
    options.progress_callback?.({
      file: 'tokenizer.json',
      loaded: 0,
      status: 'progress',
      total: 100,
    });
    const mode = options.session_options ? 'index' : 'interactive';
    const extract = async (text: unknown) => {
      extractCalls.push({ mode, text });
      if (mode === 'index' && text === '느린 청크') {
        await new Promise<void>(resolve => {
          releaseSlowIndexExtract = resolve;
        });
      }
      if (text === 'invalid-vector') {
        return { data: new Float32Array([1, 0, 0]) };
      }
      const data = new Float32Array(1024);
      data[0] = 1;
      return { data };
    };
    return Object.assign(extract, {
      dispose: mode === 'index' ? disposeIndexExtractor : vi.fn(),
    });
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

describe('local-embedding IPC', () => {
  beforeEach(async () => {
    fs.rmSync(testUserDataRoot, { force: true, recursive: true });
    extractCalls.length = 0;
    pipelineCalls.length = 0;
    downloadMocks.downloadWeightsResumable.mockReset();
    downloadMocks.downloadWeightsResumable.mockResolvedValue(undefined);
    downloadMocks.fileMatchesExpectedModel.mockReset();
    downloadMocks.fileMatchesExpectedModel.mockResolvedValue(true);
    disposeIndexExtractor.mockClear();
    releaseSlowIndexExtract = null;
    for (const key of Object.keys(ipcHandlers)) delete ipcHandlers[key];
    vi.resetModules();
    await import('../local-embedding');
  });

  afterEach(() => {
    fs.rmSync(testUserDataRoot, { force: true, recursive: true });
  });

  it('대화형·색인용 IPC 채널을 등록한다', () => {
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

  // 모델이 없는 상태에서도 status는 터지지 않아야 한다. 모듈 로드 시점에
  // app.getPath를 부르면 앱 준비 전에 죽는 회귀가 있었다.
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

  it('검증한 가중치를 pinned revision의 Transformers.js 캐시 경로에 쓴다', async () => {
    await ipcHandlers['local-embed:download-model'](trustedEvent);

    expect(downloadMocks.downloadWeightsResumable).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPath: testWeightsPath,
      }),
    );
  });

  it('기존 main 캐시가 같은 파일이면 재다운로드 없이 pinned 경로로 이동한다', async () => {
    const legacyPath = path.join(legacyModelRoot, 'onnx/model_quantized.onnx');
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.closeSync(fs.openSync(legacyPath, 'w'));
    fs.truncateSync(legacyPath, 569_694_530);
    const partialPath = path.join(
      testModelRoot,
      '4de13258303883538bd53b696b452bf8099f0858/onnx/model_quantized.onnx.part',
    );
    fs.mkdirSync(path.dirname(partialPath), { recursive: true });
    fs.writeFileSync(partialPath, 'stale partial');

    await ipcHandlers['local-embed:download-model'](trustedEvent);

    expect(fs.existsSync(legacyPath)).toBe(false);
    expect(
      fs.existsSync(
        path.join(
          testModelRoot,
          '4de13258303883538bd53b696b452bf8099f0858/onnx/model_quantized.onnx',
        ),
      ),
    ).toBe(true);
    expect(fs.existsSync(partialPath)).toBe(false);
    expect(downloadMocks.downloadWeightsResumable).not.toHaveBeenCalled();
  });

  it('가중치 완료 뒤 보조 파일 진행률이 전체 다운로드를 되돌리지 않는다', async () => {
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

  it('잘못된 입력을 거부한다', async () => {
    const embed = ipcHandlers['local-embed:embed'];
    await expect(embed(trustedEvent, 'not-an-array')).rejects.toThrow('Invalid embedding input');
    await expect(embed(trustedEvent, [1, 2])).rejects.toThrow('Invalid embedding input');
    // 한 번에 너무 많은 텍스트는 모델 로딩 전에 막는다.
    await expect(
      embed(trustedEvent, Array.from({ length: 65 }, () => 'x')),
    ).rejects.toThrow('Too many texts');
  });

  it('빈 배열은 모델을 로드하지 않고 즉시 반환한다', async () => {
    await expect(ipcHandlers['local-embed:embed'](trustedEvent, [])).resolves.toEqual([]);
    expect(extractCalls).toEqual([]);
    expect(pipelineCalls).toEqual([]);
  });

  it('준비 파일이 없으면 색인이 다운로드를 시작하지 않고 거부한다', async () => {
    await expect(
      ipcHandlers['local-embed:index'](trustedEvent, ['첫 청크']),
    ).rejects.toThrow('검색 준비 파일을 먼저 내려받아 주세요.');
    expect(downloadMocks.downloadWeightsResumable).not.toHaveBeenCalled();
  });

  // 배열을 한 번에 넘기면 패딩이 CLS 위치로 새어 들어와 벡터가 달라진다
  // (실측: 배치 vs 단건 코사인 0.978~0.992). 속도를 이유로 배치로 바꾸면
  // 로컬 인덱스와 질의의 벡터 공간이 어긋나므로 반드시 한 건씩 불러야 한다.
  it('텍스트를 배치가 아니라 한 건씩 임베딩한다', async () => {
    seedVerifiedWeights();
    const result = await ipcHandlers['local-embed:embed'](trustedEvent, ['가', '나', '다']);
    expect(extractCalls).toEqual([
      { mode: 'interactive', text: '가' },
      { mode: 'interactive', text: '나' },
      { mode: 'interactive', text: '다' },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(1024);
  });

  it('배경 색인에만 ONNX 스레드 제한을 적용하고 완료 후 해제한다', async () => {
    seedVerifiedWeights();
    const result = await ipcHandlers['local-embed:index'](
      trustedEvent,
      ['첫 청크', '둘째 청크'],
    );

    expect(result).toHaveLength(2);
    expect(extractCalls).toEqual([
      { mode: 'index', text: '첫 청크' },
      { mode: 'index', text: '둘째 청크' },
    ]);
    expect(pipelineCalls[0]?.[2]).toMatchObject({
      dtype: 'q8',
      revision: '4de13258303883538bd53b696b452bf8099f0858',
      session_options: { intraOpNumThreads: 2 },
    });

    await ipcHandlers['local-embed:release-index'](trustedEvent);
    expect(disposeIndexExtractor).toHaveBeenCalledOnce();
  });

  it('여러 renderer의 색인을 직렬화하고 모든 대기 작업 뒤 모델을 해제한다', async () => {
    seedVerifiedWeights();
    const index = ipcHandlers['local-embed:index'];
    const first = index(trustedEvent, ['느린 청크']);
    await vi.waitFor(() => expect(releaseSlowIndexExtract).not.toBeNull());

    const second = index(trustedEvent, ['다음 창 청크']);
    const release = ipcHandlers['local-embed:release-index'](trustedEvent);
    expect(disposeIndexExtractor).not.toHaveBeenCalled();
    expect(extractCalls).toEqual([{ mode: 'index', text: '느린 청크' }]);

    releaseSlowIndexExtract?.();
    await Promise.all([first, second, release]);

    expect(extractCalls).toEqual([
      { mode: 'index', text: '느린 청크' },
      { mode: 'index', text: '다음 창 청크' },
    ]);
    expect(disposeIndexExtractor).toHaveBeenCalledOnce();
  });

  it('대화형 질의에는 ONNX 스레드 제한을 적용하지 않는다', async () => {
    seedVerifiedWeights();
    await ipcHandlers['local-embed:embed'](trustedEvent, ['질의 문장']);

    expect(pipelineCalls[0]?.[2]).toMatchObject({ dtype: 'q8' });
    expect(pipelineCalls[0]?.[2]).not.toHaveProperty('session_options');
  });

  it('1024차원이 아닌 결과는 저장·검색 경로로 넘기지 않는다', async () => {
    seedVerifiedWeights();
    await expect(
      ipcHandlers['local-embed:index'](trustedEvent, ['invalid-vector']),
    ).rejects.toThrow('invalid vector');
  });
  // 570MB를 받다 실패하는 것보다 시작 전에 막는 편이 낫다.
  it('디스크 여유 공간과 필요한 공간을 알려 준다', () => {
    const space = ipcHandlers['local-embed:disk-space'](trustedEvent) as {
      freeBytes: number | null;
      requiredBytes: number;
    };
    expect(space.requiredBytes).toBeGreaterThan(569_000_000);
    expect(space.freeBytes === null || space.freeBytes >= 0).toBe(true);
  });
});
