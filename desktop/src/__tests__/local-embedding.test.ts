import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    };
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

describe('local-embedding IPC', () => {
  beforeEach(async () => {
    extractCalls.length = 0;
    pipelineCalls.length = 0;
    disposeIndexExtractor.mockClear();
    releaseSlowIndexExtract = null;
    for (const key of Object.keys(ipcHandlers)) delete ipcHandlers[key];
    vi.resetModules();
    await import('../local-embedding');
  });

  it('대화형·색인용 IPC 채널을 등록한다', () => {
    expect(Object.keys(ipcHandlers).sort()).toEqual([
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
    expect(status.modelId).toBe('Xenova/bge-m3@onnx-q8');
    expect(['absent', 'ready']).toContain(status.state);
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

  // 배열을 한 번에 넘기면 패딩이 CLS 위치로 새어 들어와 벡터가 달라진다
  // (실측: 배치 vs 단건 코사인 0.978~0.992). 속도를 이유로 배치로 바꾸면
  // 로컬 인덱스와 질의의 벡터 공간이 어긋나므로 반드시 한 건씩 불러야 한다.
  it('텍스트를 배치가 아니라 한 건씩 임베딩한다', async () => {
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
      session_options: { intraOpNumThreads: 2 },
    });

    await ipcHandlers['local-embed:release-index'](trustedEvent);
    expect(disposeIndexExtractor).toHaveBeenCalledOnce();
  });

  it('여러 renderer의 색인을 직렬화하고 모든 대기 작업 뒤 모델을 해제한다', async () => {
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
    await ipcHandlers['local-embed:embed'](trustedEvent, ['질의 문장']);

    expect(pipelineCalls[0]?.[2]).toMatchObject({ dtype: 'q8' });
    expect(pipelineCalls[0]?.[2]).not.toHaveProperty('session_options');
  });

  it('1024차원이 아닌 결과는 저장·검색 경로로 넘기지 않는다', async () => {
    await expect(
      ipcHandlers['local-embed:index'](trustedEvent, ['invalid-vector']),
    ).rejects.toThrow('invalid vector');
  });
});
