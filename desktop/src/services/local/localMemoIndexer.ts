import { hashText } from '../../lib/contentHash';
import { chunkMemoText, isMeaningfulChunk } from '../../lib/memoChunker';
import { MemoRow } from '../../types';

export const LOCAL_INDEX_DEBOUNCE_MS = 2_000;

export interface LocalMemoIndexProgress {
  completedChunks: number;
  downloadedBytes: number;
  error?: string;
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
      start: number;
      text: string;
      vector: number[] | null;
    }>,
  ) => Promise<{ stored: boolean }>;
  localDbSetOwner: (ownerId: string | null) => Promise<void>;
  localEmbedForIndex: (texts: string[]) => Promise<number[][]>;
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

export const indexableChunksForMemo = (memo: MemoRow) =>
  chunkMemoText(memo.content).filter(chunk => isMeaningfulChunk(chunk.text));

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
  ) => {
    if (expectedGeneration !== generation) return;
    const api = getApi();
    const baseProgress: LocalMemoIndexProgress = {
      completedChunks: 0,
      downloadedBytes: 0,
      ownerId,
      stage: 'preparing',
      totalBytes: 0,
      totalChunks: 0,
    };
    emit(baseProgress);

    await api.localDbSetOwner(ownerId);
    const existing = new Map(
      (await api.localDbMemoVectorState(ownerId)).map(state => [
        state.memoId,
        state,
      ]),
    );
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
            vectors.push({ ...chunk, vector: null });
            continue;
          }
          const [vector] = await api.localEmbedForIndex([chunk.text]);
          if (expectedGeneration !== generation) return;
          vectors.push({ ...chunk, vector });
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

  const enqueue = (memos: MemoRow[], ownerId: string | null) => {
    const expectedGeneration = generation;
    queue = queue
      .catch(() => undefined)
      .then(() => run(memos, ownerId, expectedGeneration));
    return queue;
  };

  const schedule = (
    key: string,
    memos: MemoRow[],
    ownerId: string | null,
  ) => {
    const previous = timers.get(key);
    if (previous) clearTimeout(previous);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void enqueue(memos, ownerId);
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
    reconcile: (memos: MemoRow[], ownerId: string | null) =>
      enqueue(memos, ownerId),
    scheduleMemo: (memo: MemoRow, ownerId: string | null) =>
      schedule(`${ownerId ?? 'guest'}:${memo.id}`, [memo], ownerId),
    scheduleReconcile: (memos: MemoRow[], ownerId: string | null) =>
      schedule(`${ownerId ?? 'guest'}:workspace`, memos, ownerId),
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
