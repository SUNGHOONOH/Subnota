import { hashText } from '../../lib/contentHash';
import { hasSearchableContent, normalizeChunkText } from '../../lib/chunkText';
import { chunkMemoText, isMeaningfulChunk } from '../../lib/memoChunker';
import { MemoRow } from '../../types';

export const LOCAL_INDEX_DEBOUNCE_MS = 5_000;

export interface LocalMemoIndexProgress {
  completedChunks: number;
  downloadedBytes: number;
  error?: string;
  isInitialIndex: boolean;
  /**
   * 사용자가 직접 요청한 실행인가. blur 정리와 자동 ambient 검색은 사용자가
   * 시킨 적 없는 배경 작업이라 진행 상황을 그리지 않는다 — 다른 메모를
   * 클릭했을 뿐인데 "준비 완료!"가 뜨고 닫으라고 하면 안 된다.
   */
  isVisible: boolean;
  ownerId: string | null;
  stage:
    | 'complete'
    | 'downloading'
    | 'failed'
    | 'indexing'
    | 'loading'
    | 'preparing';
  totalBytes: number;
  totalChunks: number;
}

interface LocalMemoVectorState {
  chunkCount: number;
  memoId: string;
  sourceContentHash: string;
}

interface LocalMemoIndexApi {
  localDbMemoVectorState: (
    ownerId: string | null,
  ) => Promise<LocalMemoVectorState[]>;
  localDbMemoVectorTexts: (
    ownerId: string | null,
    memoId: string,
  ) => Promise<string[]>;
  localDbReplaceMemoVectors: (
    ownerId: string | null,
    memoId: string,
    sourceContentHash: string,
    expectedContent: string,
    chunks: Array<{
      end: number;
      id: string;
      index: number;
      queryVector: number[] | null;
      start: number;
      text: string;
      vector: number[] | null;
    }>,
  ) => Promise<{ stored: boolean }>;
  localDbSetOwner: (ownerId: string | null) => Promise<void>;
  localEmbedForIndex: (
    texts: string[],
    prefix?: 'passage' | 'query',
  ) => Promise<number[][]>;
  localEmbedReleaseIndexModel: () => Promise<void>;
  localEmbedStatus: () => Promise<{
    downloadedBytes: number;
    state: 'absent' | 'downloading' | 'failed' | 'loading' | 'ready';
    totalBytes: number;
  }>;
}

interface LocalMemoIndexerOptions {
  api?: LocalMemoIndexApi;
  debounceMs?: number;
}

const sourceContentHash = (memo: MemoRow) =>
  memo.content_hash || hashText(memo.content);

// `isMeaningfulChunk`는 백엔드 chunking.py와 맞춘 계약이라 그대로 두고,
// 색인에만 더 엄한 기준을 얹는다. 내용어가 둘 미만인 조각(`&nbsp;`, `1.`,
// `교통`)은 코퍼스 한가운데에 놓여 아무 질의에나 1등으로 올라온다 —
// 실측으로 1등이 쓰레기인 질의가 4.4%였고, 빼면 0%가 된다.
export const indexableChunksForMemo = (memo: MemoRow) =>
  chunkMemoText(memo.content).filter(
    chunk => isMeaningfulChunk(chunk.text) && hasSearchableContent(chunk.text),
  );

export const createLocalMemoIndexer = (
  options: LocalMemoIndexerOptions = {},
) => {
  const debounceMs = options.debounceMs ?? LOCAL_INDEX_DEBOUNCE_MS;
  const listeners = new Set<(progress: LocalMemoIndexProgress) => void>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let generation = 0;
  let queue = Promise.resolve();

  const getApi = (): LocalMemoIndexApi => {
    if (options.api) return options.api;
    if (!window.electronAPI?.localDbMemoVectorState) {
      throw new Error('Local memo index bridge is unavailable.');
    }
    return window.electronAPI;
  };

  const emit = (progress: LocalMemoIndexProgress) => {
    listeners.forEach(listener => listener(progress));
  };

  const run = async (
    memos: MemoRow[],
    ownerId: string | null,
    expectedGeneration: number,
    isVisible: boolean,
  ) => {
    if (expectedGeneration !== generation) return;
    const api = getApi();
    await api.localDbSetOwner(ownerId);
    const existing = new Map(
      (await api.localDbMemoVectorState(ownerId)).map(state => [
        state.memoId,
        state,
      ]),
    );
    const baseProgress: LocalMemoIndexProgress = {
      completedChunks: 0,
      downloadedBytes: 0,
      isInitialIndex: existing.size === 0,
      isVisible,
      ownerId,
      stage: 'preparing',
      totalBytes: 0,
      totalChunks: 0,
    };
    emit(baseProgress);
    if (expectedGeneration !== generation) return;

    const staleMemos = memos
      .filter(memo => !memo.is_archived)
      .filter(
        memo =>
          existing.get(memo.id)?.sourceContentHash !== sourceContentHash(memo),
      );
    const stale = await Promise.all(
      staleMemos.map(async memo => ({
        chunks: indexableChunksForMemo(memo),
        memo,
        reusableTexts: new Set(
          await api.localDbMemoVectorTexts(ownerId, memo.id),
        ),
      })),
    );
    const totalChunks = stale.reduce(
      (total, item) =>
        total +
        item.chunks.filter(chunk => !item.reusableTexts.has(chunk.text)).length,
      0,
    );

    if (stale.length === 0) {
      emit({ ...baseProgress, stage: 'complete' });
      return;
    }

    let completedChunks = 0;
    let latestStatus = {
      downloadedBytes: 0,
      totalBytes: 0,
    };
    const reportModelStatus = async () => {
      try {
        const next = await api.localEmbedStatus();
        latestStatus = {
          downloadedBytes: next.downloadedBytes,
          totalBytes: next.totalBytes,
        };
        if (
          expectedGeneration === generation &&
          (next.state === 'downloading' || next.state === 'loading')
        ) {
          emit({
            ...baseProgress,
            ...latestStatus,
            completedChunks,
            stage: next.state,
            totalChunks,
          });
        }
      } catch {
        // The active embedding call will surface the actionable failure.
      }
    };
    await reportModelStatus();
    const statusTimer = setInterval(() => {
      void reportModelStatus();
    }, 250);

    try {
      let rejectedSnapshots = 0;
      for (const { memo, chunks, reusableTexts } of stale) {
        if (expectedGeneration !== generation) return;
        const vectors = [];
        for (const chunk of chunks) {
          if (reusableTexts.has(chunk.text)) {
            vectors.push({ ...chunk, queryVector: null, vector: null });
            continue;
          }
          // CSLS 채점은 청크마다 문서 벡터와 질의 벡터를 모두 요구한다.
          // 청크당 임베딩이 2회라 색인 시간이 2배지만(실측 2.3초 → 4.6초),
          // 배경 작업이라 체감되지 않는다.
          // 임베딩에는 마크업을 벗긴 본문을 넣는다. 저장되는 `chunk.text`는
          // 원문 그대로다 — 오프셋과 편집기 텍스트 매칭의 기준이라 손대면 안 된다.
          const searchable = normalizeChunkText(chunk.text);
          const [vector] = await api.localEmbedForIndex([searchable]);
          if (expectedGeneration !== generation) return;
          const [queryVector] = await api.localEmbedForIndex(
            [searchable],
            'query',
          );
          if (expectedGeneration !== generation) return;
          vectors.push({ ...chunk, queryVector, vector });
          completedChunks += 1;
          emit({
            ...baseProgress,
            ...latestStatus,
            completedChunks,
            stage: 'indexing',
            totalChunks,
          });
        }
        const result = await api.localDbReplaceMemoVectors(
          ownerId,
          memo.id,
          sourceContentHash(memo),
          memo.content,
          vectors,
        );
        if (!result.stored) rejectedSnapshots += 1;
      }

      if (expectedGeneration === generation) {
        if (rejectedSnapshots > 0) {
          emit({
            ...baseProgress,
            ...latestStatus,
            completedChunks,
            error: '색인 중 변경된 메모를 최신 내용으로 다시 준비합니다.',
            stage: 'failed',
            totalChunks,
          });
          return;
        }
        emit({
          ...baseProgress,
          ...latestStatus,
          completedChunks,
          stage: 'complete',
          totalChunks,
        });
      }
    } catch (error) {
      if (expectedGeneration === generation) {
        emit({
          ...baseProgress,
          ...latestStatus,
          completedChunks,
          error: error instanceof Error ? error.message : String(error),
          stage: 'failed',
          totalChunks,
        });
      }
    } finally {
      clearInterval(statusTimer);
      await api.localEmbedReleaseIndexModel().catch(() => undefined);
    }
  };

  const enqueue = (
    memos: MemoRow[],
    ownerId: string | null,
    isVisible: boolean,
  ) => {
    const expectedGeneration = generation;
    queue = queue
      .catch(() => undefined)
      .then(() => run(memos, ownerId, expectedGeneration, isVisible));
    return queue;
  };

  const schedule = (
    key: string,
    memos: MemoRow[],
    ownerId: string | null,
    isVisible: boolean,
  ) => {
    const previous = timers.get(key);
    if (previous) clearTimeout(previous);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void enqueue(memos, ownerId, isVisible);
      }, debounceMs),
    );
  };

  return {
    cancel: () => {
      generation += 1;
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
      void getApi().localEmbedReleaseIndexModel().catch(() => undefined);
    },
    reconcile: (memos: MemoRow[], ownerId: string | null, isVisible = false) =>
      enqueue(memos, ownerId, isVisible),
    scheduleMemo: (memo: MemoRow, ownerId: string | null, isVisible = false) =>
      schedule(`${ownerId ?? 'guest'}:${memo.id}`, [memo], ownerId, isVisible),
    scheduleReconcile: (
      memos: MemoRow[],
      ownerId: string | null,
      isVisible = false,
    ) => schedule(`${ownerId ?? 'guest'}:workspace`, memos, ownerId, isVisible),
    subscribe: (listener: (progress: LocalMemoIndexProgress) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const localMemoIndexer = createLocalMemoIndexer();

export const cancelLocalMemoIndexing = localMemoIndexer.cancel;
export const reconcileLocalMemoIndex = localMemoIndexer.reconcile;
export const scheduleLocalMemoIndex = localMemoIndexer.scheduleMemo;
export const scheduleLocalMemoIndexReconcile =
  localMemoIndexer.scheduleReconcile;
export const subscribeLocalMemoIndexProgress = localMemoIndexer.subscribe;
