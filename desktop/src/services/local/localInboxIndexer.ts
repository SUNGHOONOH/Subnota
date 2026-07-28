import { hashText } from '../../lib/contentHash';
import type { InboxSession } from '../backend/inboxService';

const LOCAL_INBOX_INDEX_DEBOUNCE_MS = 2_000;

interface LocalInboxVectorState {
  inboxSessionId: string;
  sourceContentHash: string;
}

interface LocalInboxIndexApi {
  localDbDeleteInboxVector: (
    ownerId: string | null,
    inboxSessionId: string,
  ) => Promise<void>;
  localDbInboxVectorState: (
    ownerId: string | null,
  ) => Promise<LocalInboxVectorState[]>;
  localDbReplaceInboxVector: (
    ownerId: string | null,
    inboxSessionId: string,
    sourceContentHash: string,
    expectedSourceText: string,
    vector: number[],
  ) => Promise<{ stored: boolean }>;
  localDbSetOwner: (ownerId: string | null) => Promise<void>;
  localEmbedForIndex: (texts: string[]) => Promise<number[][]>;
  localEmbedReleaseIndexModel: () => Promise<void>;
}

interface LocalInboxIndexerOptions {
  api?: LocalInboxIndexApi;
  debounceMs?: number;
}

export const localInboxEmbeddingText = (item: InboxSession) => {
  const values = [
    item.title,
    item.summary,
    item.summarySearchText,
    item.userNote,
    item.selectedText,
    ...item.keywords,
  ];
  return [...new Set(values.map(value => value?.trim()).filter(Boolean))]
    .join('\n')
    .slice(0, 4000);
};

export const createLocalInboxIndexer = (
  options: LocalInboxIndexerOptions = {},
) => {
  const debounceMs =
    options.debounceMs ?? LOCAL_INBOX_INDEX_DEBOUNCE_MS;
  let generation = 0;
  let queue = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const getApi = (): LocalInboxIndexApi => {
    if (options.api) return options.api;
    if (!window.electronAPI?.localDbInboxVectorState) {
      throw new Error('Local inbox index bridge is unavailable.');
    }
    return window.electronAPI;
  };

  const run = async (
    items: InboxSession[],
    ownerId: string | null,
    expectedGeneration: number,
  ) => {
    if (expectedGeneration !== generation) return;
    const api = getApi();
    await api.localDbSetOwner(ownerId);
    const existing = new Map(
      (await api.localDbInboxVectorState(ownerId)).map(state => [
        state.inboxSessionId,
        state.sourceContentHash,
      ]),
    );

    try {
      for (const item of items) {
        if (expectedGeneration !== generation) return;
        const text = localInboxEmbeddingText(item);
        if (!text) {
          if (existing.has(item.id)) {
            await api.localDbDeleteInboxVector(ownerId, item.id);
          }
          continue;
        }
        const sourceContentHash = hashText(text);
        if (existing.get(item.id) === sourceContentHash) continue;

        // 배치 호출 금지: 메모 청크와 동일하게 한 항목씩 임베딩한다.
        const [vector] = await api.localEmbedForIndex([text]);
        if (expectedGeneration !== generation) return;
        await api.localDbReplaceInboxVector(
          ownerId,
          item.id,
          sourceContentHash,
          text,
          vector,
        );
      }
    } finally {
      await api.localEmbedReleaseIndexModel().catch(() => undefined);
    }
  };

  const enqueue = (items: InboxSession[], ownerId: string | null) => {
    const expectedGeneration = generation;
    queue = queue
      .catch(() => undefined)
      .then(() => run(items, ownerId, expectedGeneration));
    return queue;
  };

  return {
    cancel: () => {
      generation += 1;
      if (timer) clearTimeout(timer);
      timer = null;
      void getApi().localEmbedReleaseIndexModel().catch(() => undefined);
    },
    reconcile: (items: InboxSession[], ownerId: string | null) =>
      enqueue(items, ownerId),
    scheduleReconcile: (items: InboxSession[], ownerId: string | null) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void enqueue(items, ownerId);
      }, debounceMs);
    },
  };
};

const localInboxIndexer = createLocalInboxIndexer();

export const cancelLocalInboxIndexing = localInboxIndexer.cancel;
export const reconcileLocalInboxIndex = localInboxIndexer.reconcile;
export const scheduleLocalInboxIndexReconcile =
  localInboxIndexer.scheduleReconcile;
