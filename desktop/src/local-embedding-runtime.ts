import {
  EMBEDDING_MODEL_DTYPE,
  EMBEDDING_MODEL_REPO,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_VECTOR_DIMENSIONS,
  TOPIC_MODEL_REPO,
  TOPIC_MODEL_REVISION,
  TOPIC_MODEL_WEIGHTS,
} from './local-embedding-config';
import { eligibleTopicTokenIds, rankTopicWords, topicPrompt } from './lib/topicWords';
import path from 'node:path';

export type LocalEmbeddingMode = 'index' | 'interactive';

type Extractor = (
  text: string,
  options: { pooling: 'cls'; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

type DisposableExtractor = Extractor & { dispose: () => Promise<void> };

export interface LocalEmbeddingRuntime {
  embed: (mode: LocalEmbeddingMode, texts: string[]) => Promise<number[][]>;
  topics: (texts: string[]) => Promise<string[][]>;
  ensure: (mode: LocalEmbeddingMode) => Promise<void>;
  releaseAll: () => Promise<void>;
  releaseIndex: () => Promise<void>;
}

/**
 * ONNX 세션은 이 런타임을 가진 프로세스 안에서만 생성한다. main process는
 * 파일 준비와 IPC 중계만 맡고, native 추론은 Utility Process에 격리한다.
 */
export const createLocalEmbeddingRuntime = (
  cacheDirectory: string,
): LocalEmbeddingRuntime => {
  let interactiveExtractorPromise: Promise<DisposableExtractor> | null = null;
  let indexExtractorPromise: Promise<DisposableExtractor> | null = null;
  type TopicSession = {
    run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: ArrayLike<number>; dims: number[] }>>;
    release: () => Promise<void>;
  };
  type TopicTokenizer = {
    (text: string, options: { truncation: boolean; max_length: number }): Promise<{ input_ids: { data: ArrayLike<number> }; attention_mask: { data: ArrayLike<number> } }>;
    mask_token_id: number;
    all_special_ids: number[];
    get_vocab: () => Map<string, number>;
  };
  let topicSessionPromise: Promise<{ session: TopicSession; tokenizer: TopicTokenizer; tokens: string[]; eligibleIds: number[] }> | null = null;

  const ensureTopicSession = () => {
    if (topicSessionPromise) return topicSessionPromise;
    const next = (async () => {
      const [{ AutoTokenizer, env }, ort] = await Promise.all([
        import('@huggingface/transformers'),
        import('onnxruntime-node'),
      ]);
      const modelDir = path.join(cacheDirectory, TOPIC_MODEL_REPO, TOPIC_MODEL_REVISION);
      env.allowLocalModels = true;
      let tokenizer: TopicTokenizer;
      try {
        tokenizer = await AutoTokenizer.from_pretrained(modelDir, { local_files_only: true }) as unknown as TopicTokenizer;
      } finally {
        env.allowLocalModels = false;
      }
      const tokens: string[] = [];
      for (const [token, id] of tokenizer.get_vocab()) tokens[id] = token;
      const session = await ort.InferenceSession.create(path.join(modelDir, TOPIC_MODEL_WEIGHTS), {
        intraOpNumThreads: 2,
      });
      return {
        session: session as unknown as TopicSession,
        tokenizer,
        tokens,
        eligibleIds: eligibleTopicTokenIds(tokens, tokenizer.all_special_ids),
      };
    })().catch(error => {
      topicSessionPromise = null;
      throw error;
    });
    topicSessionPromise = next;
    return next;
  };

  const releaseTopicSession = async () => {
    const active = topicSessionPromise;
    topicSessionPromise = null;
    if (!active) return;
    try { await (await active).session.release(); } catch { /* A failed load owns no session. */ }
  };

  const loadExtractor = async (
    mode: LocalEmbeddingMode,
  ): Promise<DisposableExtractor> => {
    // ESM 전용이라 동적 import로 가져온다. Vite main build에서 external로 두어
    // 패키징된 앱도 unpack된 onnxruntime-node를 런타임에 찾게 한다.
    const { env, pipeline } = await import('@huggingface/transformers');
    env.cacheDir = cacheDirectory;
    env.allowLocalModels = false;

    const extract = await pipeline('feature-extraction', EMBEDDING_MODEL_REPO, {
      dtype: EMBEDDING_MODEL_DTYPE,
      revision: EMBEDDING_MODEL_REVISION,
      // 색인 전용 세션만 제한한다. 대화형 검색의 기존 동작과 벡터 품질은
      // 바꾸지 않는다.
      ...(mode === 'index'
        ? { session_options: { intraOpNumThreads: 2 } }
        : {}),
      progress_callback: () => undefined,
    });

    return extract as unknown as DisposableExtractor;
  };

  const ensureExtractor = (mode: LocalEmbeddingMode) => {
    const current =
      mode === 'index' ? indexExtractorPromise : interactiveExtractorPromise;
    if (current) return current;

    const next = loadExtractor(mode).catch(error => {
      if (mode === 'index') indexExtractorPromise = null;
      else interactiveExtractorPromise = null;
      throw error;
    });
    if (mode === 'index') indexExtractorPromise = next;
    else interactiveExtractorPromise = next;
    return next;
  };

  const releaseExtractor = async (
    active: Promise<DisposableExtractor> | null,
  ) => {
    if (!active) return;
    try {
      const extract = await active;
      await extract.dispose();
    } catch {
      // 모델 로드 실패는 호출자에게 이미 전달했다. 해제 실패가 앱 종료나
      // 모델 삭제를 막으면 안 된다.
    }
  };

  const releaseIndex = async () => {
    const active = indexExtractorPromise;
    indexExtractorPromise = null;
    await releaseExtractor(active);
    await releaseTopicSession();
  };

  return {
    ensure: async mode => {
      await ensureExtractor(mode);
    },
    embed: async (mode, texts) => {
      const extract = await ensureExtractor(mode);
      const out: number[][] = [];
      // 배열 배치는 CLS 위치에 padding이 섞여 벡터 공간을 바꾼다. 한 건씩
      // 호출하는 기존 규칙을 Utility Process에서도 그대로 지킨다.
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
    },
    topics: async texts => {
      const { session, tokenizer, tokens, eligibleIds } = await ensureTopicSession();
      const ort = await import('onnxruntime-node');
      const result: string[][] = [];
      for (const text of texts) {
        const encoded = await tokenizer(topicPrompt(text), { truncation: true, max_length: 512 });
        const ids = Array.from(encoded.input_ids.data, Number);
        const masks = ids.flatMap((id, index) => id === tokenizer.mask_token_id ? [index] : []);
        if (masks.length !== 3) throw new Error('A.X prompt is missing mask tokens.');
        const shape = [1, ids.length];
        const output = await session.run({
          input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), shape),
          attention_mask: new ort.Tensor('int64', BigInt64Array.from(encoded.attention_mask.data, BigInt), shape),
        });
        const logits = output.logits;
        if (!logits || logits.dims[0] !== 1 || logits.dims[1] !== ids.length || logits.dims[2] !== tokens.length) {
          throw new Error('A.X returned invalid logits.');
        }
        result.push(rankTopicWords(logits.data, tokens.length, masks, tokens, eligibleIds));
      }
      return result;
    },
    releaseAll: async () => {
      const interactive = interactiveExtractorPromise;
      const index = indexExtractorPromise;
      interactiveExtractorPromise = null;
      indexExtractorPromise = null;
      await Promise.all([releaseExtractor(interactive), releaseExtractor(index)]);
      await releaseTopicSession();
    },
    releaseIndex,
  };
};
