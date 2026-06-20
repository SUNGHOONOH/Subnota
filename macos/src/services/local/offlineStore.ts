import { hashText } from '../../lib/contentHash';
import { getMemoCategory } from '../../lib/memoCategory';
import { CalendarBlockRow, MemoRow } from '../../types';
import { InboxSession, InboxSourceType } from '../backend/inboxService';

const MEMOS_KEY = 'subnota.macos.local.memos.v1';
const CALENDAR_BLOCKS_KEY = 'subnota.macos.local.calendarBlocks.v1';
const INBOX_QUEUE_KEY = 'subnota.macos.local.inboxQueue.v1';
const ACTIVE_OWNER_KEY = 'subnota.macos.local.activeOwner.v1';
const WORKSPACE_SESSION_KEY = 'subnota.workspaceSession.v1';
const WORKSPACE_KEYS = [
  MEMOS_KEY,
  CALENDAR_BLOCKS_KEY,
  INBOX_QUEUE_KEY,
  WORKSPACE_SESSION_KEY,
] as const;

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

const loadActiveOwner = () => {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    return window.localStorage.getItem(ACTIVE_OWNER_KEY);
  } catch {
    return null;
  }
};

export const getLocalWorkspaceOwner = loadActiveOwner;

const scopedKey = (baseKey: string, ownerId?: string) => {
  const owner = ownerId ?? loadActiveOwner();
  return `${baseKey}.${owner ? `user.${owner}` : 'guest'}`;
};

export const setLocalWorkspaceOwner = (
  ownerId: string | null,
  options: { migrateLegacy?: boolean } = {},
) => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    if (!ownerId) {
      window.localStorage.removeItem(ACTIVE_OWNER_KEY);
      return;
    }

    window.localStorage.setItem(ACTIVE_OWNER_KEY, ownerId);

    if (!options.migrateLegacy) {
      return;
    }

    for (const baseKey of WORKSPACE_KEYS) {
      const legacyValue = window.localStorage.getItem(baseKey);
      const nextKey = scopedKey(baseKey, ownerId);
      if (legacyValue !== null && window.localStorage.getItem(nextKey) === null) {
        window.localStorage.setItem(nextKey, legacyValue);
        window.localStorage.removeItem(baseKey);
      }
    }
  } catch {
    // Local persistence is best-effort; online storage remains authoritative.
  }
};

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

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota and privacy-mode failures must not interrupt editing.
  }
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

export const loadLocalMemos = (ownerId?: string) =>
  readJson<LocalMemoRow[]>(scopedKey(MEMOS_KEY, ownerId), []);

export const loadVisibleLocalMemos = (ownerId?: string) =>
  loadLocalMemos(ownerId)
    .filter(memo => !memo.is_archived)
    .sort(byUpdatedDesc);

export const saveLocalMemos = (memos: LocalMemoRow[], ownerId?: string) => {
  writeJson(scopedKey(MEMOS_KEY, ownerId), memos.sort(byUpdatedDesc));
};

export const upsertLocalMemo = (
  memo: Pick<MemoRow, 'content' | 'created_at' | 'id'> & {
    category?: string | null;
    updated_at?: string;
  },
  syncStatus: LocalSyncStatus = 'pending',
  ownerId?: string,
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
  const previous = loadLocalMemos(ownerId);
  const exists = previous.some(item => item.id === memo.id);
  const next = exists
    ? previous.map(item => (item.id === memo.id ? { ...item, ...nextMemo } : item))
    : [nextMemo, ...previous];

  saveLocalMemos(next, ownerId);
  return nextMemo;
};

export const markLocalMemoDeleted = (
  memoId: string,
  syncStatus: LocalSyncStatus,
  ownerId?: string,
) => {
  const now = new Date().toISOString();
  saveLocalMemos(
    loadLocalMemos(ownerId).map(memo =>
      memo.id === memoId
        ? {
            ...memo,
            is_archived: true,
            local_sync_status: syncStatus,
            updated_at: now,
          }
        : memo,
    ),
    ownerId,
  );
};

export const replaceSyncedMemos = (remoteMemos: MemoRow[], ownerId?: string) => {
  const merged = new Map<string, LocalMemoRow>();

  remoteMemos.forEach(memo => {
    merged.set(memo.id, { ...memo, local_sync_status: 'synced' });
  });

  loadLocalMemos(ownerId)
    .filter(memo => memo.local_sync_status && memo.local_sync_status !== 'synced')
    .forEach(memo => merged.set(memo.id, memo));

  const next = Array.from(merged.values());
  saveLocalMemos(next, ownerId);
  return next.filter(memo => !memo.is_archived).sort(byUpdatedDesc);
};

export const loadLocalCalendarBlocks = (ownerId?: string) =>
  readJson<LocalCalendarBlockRow[]>(scopedKey(CALENDAR_BLOCKS_KEY, ownerId), []);

export const loadVisibleLocalCalendarBlocks = (ownerId?: string) =>
  loadLocalCalendarBlocks(ownerId)
    .filter(block => block.local_sync_status !== 'pending_delete')
    .sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    );

export const saveLocalCalendarBlocks = (
  blocks: LocalCalendarBlockRow[],
  ownerId?: string,
) => {
  writeJson(scopedKey(CALENDAR_BLOCKS_KEY, ownerId), blocks);
};

export const upsertLocalCalendarBlock = (
  block: CalendarBlockRow,
  syncStatus: LocalSyncStatus = 'pending',
  ownerId?: string,
) => {
  const nextBlock: LocalCalendarBlockRow = {
    ...block,
    local_sync_status: syncStatus,
  };
  const previous = loadLocalCalendarBlocks(ownerId);
  const exists = previous.some(item => item.id === block.id);
  const next = exists
    ? previous.map(item => (item.id === block.id ? { ...item, ...nextBlock } : item))
    : [...previous, nextBlock];

  saveLocalCalendarBlocks(next, ownerId);
  return nextBlock;
};

export const markLocalCalendarBlockDeleted = (
  blockId: string,
  syncStatus: LocalSyncStatus,
  ownerId?: string,
) => {
  saveLocalCalendarBlocks(
    loadLocalCalendarBlocks(ownerId).map(block =>
      block.id === blockId
        ? { ...block, local_sync_status: syncStatus }
        : block,
    ),
    ownerId,
  );
};

export const removeLocalCalendarBlock = (blockId: string, ownerId?: string) => {
  saveLocalCalendarBlocks(
    loadLocalCalendarBlocks(ownerId).filter(block => block.id !== blockId),
    ownerId,
  );
};

export const replaceSyncedCalendarBlocks = (
  remoteBlocks: CalendarBlockRow[],
  ownerId?: string,
) => {
  const merged = new Map<string, LocalCalendarBlockRow>();

  remoteBlocks.forEach(block => {
    merged.set(block.id, { ...block, local_sync_status: 'synced' });
  });

  loadLocalCalendarBlocks(ownerId)
    .filter(block => block.local_sync_status && block.local_sync_status !== 'synced')
    .forEach(block => merged.set(block.id, block));

  const next = Array.from(merged.values());
  saveLocalCalendarBlocks(next, ownerId);
  return next.filter(block => block.local_sync_status !== 'pending_delete');
};

export const loadLocalInboxQueue = (ownerId?: string) =>
  readJson<LocalInboxSession[]>(scopedKey(INBOX_QUEUE_KEY, ownerId), []);

export const saveLocalInboxQueue = (items: LocalInboxSession[], ownerId?: string) => {
  writeJson(scopedKey(INBOX_QUEUE_KEY, ownerId), items);
};

export const createLocalInboxSession = (
  url: string,
  ownerId?: string,
): LocalInboxSession => {
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

  saveLocalInboxQueue([item, ...loadLocalInboxQueue(ownerId)], ownerId);
  return item;
};

export const removeLocalInboxSession = (clientId: string, ownerId?: string) => {
  saveLocalInboxQueue(
    loadLocalInboxQueue(ownerId).filter(item => item.clientId !== clientId),
    ownerId,
  );
};
