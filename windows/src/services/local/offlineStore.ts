import { hashText } from '../../lib/contentHash';
import { getMemoCategory } from '../../lib/memoCategory';
import { CalendarBlockRow, MemoRow } from '../../types';
import { InboxSession, InboxSourceType } from '../backend/inboxService';

const MEMOS_KEY = 'subnota.windows.local.memos.v1';
const CALENDAR_BLOCKS_KEY = 'subnota.windows.local.calendarBlocks.v1';
const INBOX_QUEUE_KEY = 'subnota.windows.local.inboxQueue.v1';

type LocalSyncStatus = 'failed' | 'pending' | 'pending_delete' | 'synced';

export type LocalMemoRow = MemoRow & {
  local_sync_status?: LocalSyncStatus;
};

export type LocalCalendarBlockRow = CalendarBlockRow & {
  local_sync_status?: LocalSyncStatus;
};

export type LocalInboxSession = InboxSession & {
  clientId: string;
  local_sync_status?: 'failed' | 'pending';
};

const canUseLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const readJson = <T,>(key: string, fallback: T): T => {
  if (!canUseLocalStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = <T,>(key: string, value: T) => {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const byUpdatedDesc = (a: { updated_at: string }, b: { updated_at: string }) =>
  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

const inferSourceType = (url: string): InboxSourceType => {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'youtube';
  }
  if (lower.includes('instagram.com')) {
    return 'instagram';
  }
  return 'url';
};

export const loadLocalMemos = () => readJson<LocalMemoRow[]>(MEMOS_KEY, []);

export const loadVisibleLocalMemos = () =>
  loadLocalMemos()
    .filter(memo => !memo.is_archived)
    .sort(byUpdatedDesc);

export const saveLocalMemos = (memos: LocalMemoRow[]) => {
  writeJson(MEMOS_KEY, memos.sort(byUpdatedDesc));
};

export const upsertLocalMemo = (
  memo: Pick<MemoRow, 'content' | 'created_at' | 'id'> & {
    category?: string | null;
    updated_at?: string;
  },
  syncStatus: LocalSyncStatus = 'pending',
) => {
  const now = new Date().toISOString();
  const contentHash = hashText(memo.content);
  const nextMemo: LocalMemoRow = {
    category: getMemoCategory(memo.category),
    content: memo.content,
    content_hash: contentHash,
    created_at: memo.created_at,
    id: memo.id,
    is_archived: false,
    local_sync_status: syncStatus,
    updated_at: memo.updated_at ?? now,
  };
  const previous = loadLocalMemos();
  const exists = previous.some(item => item.id === memo.id);
  const next = exists
    ? previous.map(item => (item.id === memo.id ? { ...item, ...nextMemo } : item))
    : [nextMemo, ...previous];

  saveLocalMemos(next);
  return nextMemo;
};

export const markLocalMemoDeleted = (memoId: string, syncStatus: LocalSyncStatus) => {
  const now = new Date().toISOString();
  saveLocalMemos(
    loadLocalMemos().map(memo =>
      memo.id === memoId
        ? {
            ...memo,
            is_archived: true,
            local_sync_status: syncStatus,
            updated_at: now,
          }
        : memo,
    ),
  );
};

export const replaceSyncedMemos = (remoteMemos: MemoRow[]) => {
  const merged = new Map<string, LocalMemoRow>();

  remoteMemos.forEach(memo => {
    merged.set(memo.id, { ...memo, local_sync_status: 'synced' });
  });

  loadLocalMemos()
    .filter(memo => memo.local_sync_status && memo.local_sync_status !== 'synced')
    .forEach(memo => merged.set(memo.id, memo));

  const next = Array.from(merged.values());
  saveLocalMemos(next);
  return next.filter(memo => !memo.is_archived).sort(byUpdatedDesc);
};

export const loadLocalCalendarBlocks = () =>
  readJson<LocalCalendarBlockRow[]>(CALENDAR_BLOCKS_KEY, []);

export const loadVisibleLocalCalendarBlocks = () =>
  loadLocalCalendarBlocks()
    .filter(block => block.local_sync_status !== 'pending_delete')
    .sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    );

export const saveLocalCalendarBlocks = (blocks: LocalCalendarBlockRow[]) => {
  writeJson(CALENDAR_BLOCKS_KEY, blocks);
};

export const upsertLocalCalendarBlock = (
  block: CalendarBlockRow,
  syncStatus: LocalSyncStatus = 'pending',
) => {
  const nextBlock: LocalCalendarBlockRow = {
    ...block,
    local_sync_status: syncStatus,
  };
  const previous = loadLocalCalendarBlocks();
  const exists = previous.some(item => item.id === block.id);
  const next = exists
    ? previous.map(item => (item.id === block.id ? { ...item, ...nextBlock } : item))
    : [...previous, nextBlock];

  saveLocalCalendarBlocks(next);
  return nextBlock;
};

export const markLocalCalendarBlockDeleted = (
  blockId: string,
  syncStatus: LocalSyncStatus,
) => {
  saveLocalCalendarBlocks(
    loadLocalCalendarBlocks().map(block =>
      block.id === blockId
        ? { ...block, local_sync_status: syncStatus }
        : block,
    ),
  );
};

export const removeLocalCalendarBlock = (blockId: string) => {
  saveLocalCalendarBlocks(
    loadLocalCalendarBlocks().filter(block => block.id !== blockId),
  );
};

export const replaceSyncedCalendarBlocks = (remoteBlocks: CalendarBlockRow[]) => {
  const merged = new Map<string, LocalCalendarBlockRow>();

  remoteBlocks.forEach(block => {
    merged.set(block.id, { ...block, local_sync_status: 'synced' });
  });

  loadLocalCalendarBlocks()
    .filter(block => block.local_sync_status && block.local_sync_status !== 'synced')
    .forEach(block => merged.set(block.id, block));

  const next = Array.from(merged.values());
  saveLocalCalendarBlocks(next);
  return next.filter(block => block.local_sync_status !== 'pending_delete');
};

export const loadLocalInboxQueue = () =>
  readJson<LocalInboxSession[]>(INBOX_QUEUE_KEY, []);

export const saveLocalInboxQueue = (items: LocalInboxSession[]) => {
  writeJson(INBOX_QUEUE_KEY, items);
};

export const createLocalInboxSession = (url: string): LocalInboxSession => {
  const now = new Date().toISOString();
  const clientId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: LocalInboxSession = {
    canonicalUrl: null,
    channelTitle: null,
    clientId,
    createdAt: now,
    description: null,
    domain: null,
    duration: null,
    id: clientId,
    local_sync_status: 'pending',
    originalUrl: url,
    publishedAt: null,
    selectedText: null,
    sourceType: inferSourceType(url),
    summary: null,
    summaryBasis: null,
    summaryDetail: null,
    summaryOneLiner: null,
    summaryProvider: null,
    summarySearchText: null,
    summaryStatus: 'pending',
    thumbnailUrl: null,
    title: url,
    userNote: null,
  };

  saveLocalInboxQueue([item, ...loadLocalInboxQueue()]);
  return item;
};

export const removeLocalInboxSession = (clientId: string) => {
  saveLocalInboxQueue(loadLocalInboxQueue().filter(item => item.clientId !== clientId));
};
