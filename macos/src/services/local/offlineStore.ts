import { hashText } from '../../lib/contentHash';
import { getMemoCategory } from '../../lib/memoCategory';
import { CalendarBlockRow, MemoRow } from '../../types';
import { ActivityCompletion, DailyCompletion, ForestTree } from '../../features/tree/model/treeTypes';
import { InboxSession, InboxSourceType } from '../backend/inboxService';

const MEMOS_KEY = 'subnota.macos.local.memos.v1';
const CALENDAR_BLOCKS_KEY = 'subnota.macos.local.calendarBlocks.v1';
const INBOX_QUEUE_KEY = 'subnota.macos.local.inboxQueue.v1';
const ACTIVE_OWNER_KEY = 'subnota.macos.local.activeOwner.v1';
const SQLITE_MIGRATION_KEY = 'subnota.macos.sqliteMigration.v1';

type LocalSyncStatus = 'failed' | 'pending' | 'pending_delete' | 'synced';
type RecordType =
  | 'activity_completion'
  | 'calendar'
  | 'daily_completion'
  | 'inbox'
  | 'memo'
  | 'tree';

export type LocalMemoRow = MemoRow & { local_sync_status?: LocalSyncStatus };
export type LocalCalendarBlockRow = CalendarBlockRow & {
  local_sync_status?: LocalSyncStatus;
};
export type LocalInboxSession = InboxSession & {
  clientId: string;
  local_sync_status?: 'failed' | 'pending';
};

const migrationPromises = new Map<string, Promise<void>>();
const canUseLocalStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const loadActiveOwner = () => {
  if (!canUseLocalStorage()) return null;
  try {
    return window.localStorage.getItem(ACTIVE_OWNER_KEY);
  } catch {
    return null;
  }
};

export const getLocalWorkspaceOwner = loadActiveOwner;

const ownerKey = (ownerId?: string) => ownerId ?? loadActiveOwner() ?? null;
const scopedKey = (baseKey: string, ownerId?: string) =>
  `${baseKey}.${ownerKey(ownerId) ? `user.${ownerKey(ownerId)}` : 'guest'}`;

export const setLocalWorkspaceOwner = (ownerId: string | null) => {
  if (!canUseLocalStorage()) return;
  try {
    if (ownerId) window.localStorage.setItem(ACTIVE_OWNER_KEY, ownerId);
    else window.localStorage.removeItem(ACTIVE_OWNER_KEY);
  } catch {
    // Authentication still works when browser storage is unavailable.
  }
};

const readLegacyJson = <T,>(key: string, fallback: T): T => {
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const getApi = () => {
  if (!window.electronAPI?.localDbList) {
    throw new Error('SQLite bridge is unavailable.');
  }
  return window.electronAPI;
};

const ensureMigrated = (ownerId?: string) => {
  const owner = ownerKey(ownerId);
  const migrationId = owner ?? 'guest';
  const existing = migrationPromises.get(migrationId);
  if (existing) return existing;

  const migration = (async () => {
    await getApi().localDbSetOwner?.(owner);
    const marker = `${SQLITE_MIGRATION_KEY}.${migrationId}`;
    if (canUseLocalStorage() && window.localStorage.getItem(marker) === 'done') return;

    const sourceKey = (baseKey: string) => {
      const scoped = scopedKey(baseKey, owner ?? undefined);
      return readLegacyJson<unknown[]>(
        scoped,
        owner ? readLegacyJson<unknown[]>(baseKey, []) : [],
      );
    };
    await getApi().localDbMigrate(owner, {
      calendarBlocks: sourceKey(CALENDAR_BLOCKS_KEY),
      inboxItems: sourceKey(INBOX_QUEUE_KEY),
      memos: sourceKey(MEMOS_KEY),
    });

    if (canUseLocalStorage()) {
      for (const key of [MEMOS_KEY, CALENDAR_BLOCKS_KEY, INBOX_QUEUE_KEY]) {
        window.localStorage.removeItem(scopedKey(key, owner ?? undefined));
        if (owner) window.localStorage.removeItem(key);
      }
      window.localStorage.setItem(marker, 'done');
    }
    migrationPromises.delete(migrationId);
  })().catch(error => {
    migrationPromises.delete(migrationId);
    throw error;
  });
  migrationPromises.set(migrationId, migration);
  return migration;
};

const list = async <T,>(recordType: RecordType, ownerId?: string) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  return (await getApi().localDbList(ownerKey(ownerId), recordType)) as T[];
};

const byUpdatedDesc = (a: { updated_at: string }, b: { updated_at: string }) =>
  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

const inferSourceType = (url: string): InboxSourceType => {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('instagram.com')) return 'instagram';
  return 'url';
};

export const loadLocalMemos = (ownerId?: string) => list<LocalMemoRow>('memo', ownerId);

export const loadVisibleLocalMemos = async (ownerId?: string) =>
  (await loadLocalMemos(ownerId)).filter(memo => !memo.is_archived).sort(byUpdatedDesc);

export const createLocalMemoRow = (
  memo: Pick<MemoRow, 'content' | 'created_at' | 'id'> & {
    category?: string | null;
    content_updated_at?: string | null;
    synced_content_hash?: string | null;
    updated_at?: string;
  },
  syncStatus: LocalSyncStatus = 'pending',
): LocalMemoRow => ({
  category: getMemoCategory(memo.category),
  content: memo.content,
  content_hash: hashText(memo.content),
  content_updated_at: memo.content_updated_at ?? memo.updated_at ?? new Date().toISOString(),
  created_at: memo.created_at,
  id: memo.id,
  is_archived: false,
  local_sync_status: syncStatus,
  // Carry the last-synced server hash forward across local edits so the cloud
  // push can use it as the optimistic-concurrency base.
  synced_content_hash: memo.synced_content_hash ?? null,
  updated_at: memo.updated_at ?? new Date().toISOString(),
});

export const persistLocalMemo = async (memo: LocalMemoRow, ownerId?: string) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(ownerKey(ownerId), 'memo', memo.id, memo);
  return memo;
};

export const upsertLocalMemo = (
  memo: Parameters<typeof createLocalMemoRow>[0],
  syncStatus: LocalSyncStatus = 'pending',
  ownerId?: string,
) => persistLocalMemo(createLocalMemoRow(memo, syncStatus), ownerId);

export const markLocalMemoDeleted = async (
  memoId: string,
  syncStatus: LocalSyncStatus,
  ownerId?: string,
) => {
  const memo = (await loadLocalMemos(ownerId)).find(item => item.id === memoId);
  const now = new Date().toISOString();
  await persistLocalMemo(
    {
      ...(memo ?? createLocalMemoRow({ content: '', created_at: now, id: memoId })),
      is_archived: true,
      local_sync_status: syncStatus,
      updated_at: now,
    },
    ownerId,
  );
};

export const replaceSyncedMemos = async (remoteMemos: MemoRow[], ownerId?: string) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  const records = (await getApi().localDbReplaceSynced(
    ownerKey(ownerId),
    'memo',
    remoteMemos,
  )) as LocalMemoRow[];
  return records.filter(memo => !memo.is_archived).sort(byUpdatedDesc);
};

export const loadLocalCalendarBlocks = (ownerId?: string) =>
  list<LocalCalendarBlockRow>('calendar', ownerId);

export const loadVisibleLocalCalendarBlocks = async (ownerId?: string) =>
  (await loadLocalCalendarBlocks(ownerId))
    .filter(block => block.local_sync_status !== 'pending_delete')
    .sort((a, b) =>
      (a.all_day_date ?? a.start_date).localeCompare(b.all_day_date ?? b.start_date),
    );

export const upsertLocalCalendarBlock = async (
  block: CalendarBlockRow,
  syncStatus: LocalSyncStatus = 'pending',
  ownerId?: string,
) => {
  const next = { ...block, local_sync_status: syncStatus };
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(ownerKey(ownerId), 'calendar', block.id, next);
  return next;
};

export const markLocalCalendarBlockDeleted = async (
  blockId: string,
  syncStatus: LocalSyncStatus,
  ownerId?: string,
) => {
  const block = (await loadLocalCalendarBlocks(ownerId)).find(item => item.id === blockId);
  if (!block) return;
  await upsertLocalCalendarBlock({ ...block }, syncStatus, ownerId);
};

export const removeLocalCalendarBlock = async (blockId: string, ownerId?: string) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbDelete(ownerKey(ownerId), 'calendar', blockId);
};

export const replaceSyncedCalendarBlocks = async (
  remoteBlocks: CalendarBlockRow[],
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  const records = (await getApi().localDbReplaceSynced(
    ownerKey(ownerId),
    'calendar',
    remoteBlocks,
  )) as LocalCalendarBlockRow[];
  return records.filter(block => block.local_sync_status !== 'pending_delete');
};

export const loadLocalInboxQueue = (ownerId?: string) =>
  list<LocalInboxSession>('inbox', ownerId);

export const createLocalInboxSession = async (
  url: string,
  ownerId?: string,
): Promise<LocalInboxSession> => {
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
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(ownerKey(ownerId), 'inbox', clientId, item);
  return item;
};

export const removeLocalInboxSession = async (clientId: string, ownerId?: string) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbDelete(ownerKey(ownerId), 'inbox', clientId);
};

// Growth events (append-only). Keyed by block id / local date so re-recording
// the same completion is a no-op locally (matches the DB unique constraints).
export type LocalActivityCompletion = ActivityCompletion & {
  local_sync_status?: LocalSyncStatus;
};
export type LocalDailyCompletion = DailyCompletion & {
  local_sync_status?: LocalSyncStatus;
};

export const loadLocalActivityCompletions = (ownerId?: string) =>
  list<LocalActivityCompletion>('activity_completion', ownerId);

export const upsertLocalActivityCompletion = async (
  record: ActivityCompletion,
  syncStatus: LocalSyncStatus = 'pending',
  ownerId?: string,
) => {
  const next = { ...record, local_sync_status: syncStatus };
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(
    ownerKey(ownerId),
    'activity_completion',
    record.calendar_block_id,
    next,
  );
  return next;
};

export const loadLocalDailyCompletions = (ownerId?: string) =>
  list<LocalDailyCompletion>('daily_completion', ownerId);

export const upsertLocalDailyCompletion = async (
  record: DailyCompletion,
  syncStatus: LocalSyncStatus = 'pending',
  ownerId?: string,
) => {
  const next = { ...record, local_sync_status: syncStatus };
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(
    ownerKey(ownerId),
    'daily_completion',
    record.local_date,
    next,
  );
  return next;
};

// Planted (forest) trees. Keyed by generation so a re-plant is a no-op locally.
export type LocalForestTree = ForestTree & { local_sync_status?: LocalSyncStatus };

export const loadLocalTrees = (ownerId?: string) =>
  list<LocalForestTree>('tree', ownerId);

export const upsertLocalTree = async (
  record: ForestTree,
  syncStatus: LocalSyncStatus = 'pending',
  ownerId?: string,
) => {
  const next = { ...record, local_sync_status: syncStatus };
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(ownerKey(ownerId), 'tree', String(record.generation), next);
  return next;
};
