import { beforeEach, describe, expect, it, vi } from 'vitest';

const pipelineCalls: unknown[][] = [];
const extractCalls: Array<{ mode: 'index' | 'interactive'; text: unknown }> = [];
const disposeIndexExtractor = vi.fn(async () => undefined);

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
      if (text === 'invalid-vector') return { data: new Float32Array([1, 0, 0]) };
      const data = new Float32Array(1024);
      data[0] = 1;
      return { data };
    };
    return Object.assign(extract, {
      dispose: mode === 'index' ? disposeIndexExtractor : vi.fn(),
    });
  },
}));

describe('local embedding runtime', () => {
  beforeEach(() => {
    pipelineCalls.length = 0;
    extractCalls.length = 0;
    disposeIndexExtractor.mockClear();
  });

  it('벡터 공간을 보존하도록 텍스트를 한 건씩 임베딩한다', async () => {
    const { createLocalEmbeddingRuntime } = await import('../local-embedding-runtime');
    const runtime = createLocalEmbeddingRuntime('/tmp/subnota-model-cache');

    const result = await runtime.embed('interactive', ['가', '나', '다']);

    expect(extractCalls).toEqual([
      { mode: 'interactive', text: '가' },
      { mode: 'interactive', text: '나' },
      { mode: 'interactive', text: '다' },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(1024);
  });

  it('배경 색인 세션에만 ONNX 스레드 제한을 적용하고 해제한다', async () => {
    const { createLocalEmbeddingRuntime } = await import('../local-embedding-runtime');
    const runtime = createLocalEmbeddingRuntime('/tmp/subnota-model-cache');

    await runtime.embed('index', ['첫 청크']);

    expect(pipelineCalls[0]?.[2]).toMatchObject({
      dtype: 'q8',
      revision: '4de13258303883538bd53b696b452bf8099f0858',
      session_options: { intraOpNumThreads: 2 },
    });
    await runtime.releaseIndex();
    expect(disposeIndexExtractor).toHaveBeenCalledOnce();
  });

  it('대화형 세션에는 기존처럼 ONNX 기본 스레드 설정을 유지한다', async () => {
    const { createLocalEmbeddingRuntime } = await import('../local-embedding-runtime');
    const runtime = createLocalEmbeddingRuntime('/tmp/subnota-model-cache');

    await runtime.embed('interactive', ['질의 문장']);

    expect(pipelineCalls[0]?.[2]).toMatchObject({ dtype: 'q8' });
    expect(pipelineCalls[0]?.[2]).not.toHaveProperty('session_options');
  });

  it('잘못된 차원의 벡터는 Utility Process 밖으로 전달하지 않는다', async () => {
    const { createLocalEmbeddingRuntime } = await import('../local-embedding-runtime');
    const runtime = createLocalEmbeddingRuntime('/tmp/subnota-model-cache');

    await expect(runtime.embed('index', ['invalid-vector'])).rejects.toThrow('invalid vector');
  });
});
