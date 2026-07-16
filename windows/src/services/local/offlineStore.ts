import { hashText } from '../../lib/contentHash';
import { getMemoCategory } from '../../lib/memoCategory';
import {
  CalendarBlockRow,
  MemoRow,
  ScheduleInboxRow,
  TopicMapData,
} from '../../types';
import { ActivityCompletion, DailyCompletion, ForestTree } from '../../features/tree/model/treeTypes';
import { InboxSession, InboxSourceType } from '../backend/inboxService';

const MEMOS_KEY = 'subnota.windows.local.memos.v1';
const CALENDAR_BLOCKS_KEY = 'subnota.windows.local.calendarBlocks.v1';
const INBOX_QUEUE_KEY = 'subnota.windows.local.inboxQueue.v1';
const ACTIVE_OWNER_KEY = 'subnota.windows.local.activeOwner.v1';
const SQLITE_MIGRATION_KEY = 'subnota.windows.sqliteMigration.v1';

type LocalSyncStatus = 'failed' | 'pending' | 'pending_delete' | 'synced';
type RecordType =
  | 'activity_completion'
  | 'calendar'
  | 'daily_completion'
  | 'inbox'
  | 'memo'
  | 'schedule_inbox'
  | 'topic_map'
  | 'tree';

export type LocalMemoRow = MemoRow & { local_sync_status?: LocalSyncStatus };
export type LocalCalendarBlockRow = CalendarBlockRow & {
  local_sync_status?: LocalSyncStatus;
};
// 'inbox' 컬렉션에는 두 종류의 행이 산다: 아직 서버로 못 올린 대기 큐
// (pending/failed, clientId 필수)와 서버 목록의 로컬 캐시(synced).
export type LocalInboxItem = InboxSession & {
  local_sync_status?: 'failed' | 'pending' | 'synced';
};
export type LocalInboxSession = LocalInboxItem & {
  clientId: string;
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
    synced_content?: string | null;
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
  // Carry the last-synced server content/hash forward across local edits: the
  // hash is the optimistic-concurrency base for pushes, the content is the
  // shared base for 3-way conflict merges.
  synced_content: memo.synced_content ?? null,
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

export const getLocalMemo = async (memoId: string, ownerId?: string) =>
  (await loadLocalMemos(ownerId)).find(memo => memo.id === memoId) ?? null;

// Record the server-acknowledged sync base without touching newer local
// content. Every acked push must land here — dropping an ack leaves a stale
// base hash behind, and the next push gets misread as a cross-device conflict.
export const updateLocalMemoSyncedBase = async (
  memoId: string,
  base: { content: string; hash: string | null },
  ownerId?: string,
) => {
  const memo = await getLocalMemo(memoId, ownerId);
  if (!memo) return;
  await persistLocalMemo(
    { ...memo, synced_content: base.content, synced_content_hash: base.hash },
    ownerId,
  );
};

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
    // Pulled rows are the synced state by definition — keep their content as
    // the 3-way merge base for later conflicts.
    remoteMemos.map(memo => ({ ...memo, synced_content: memo.content })),
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

// 캐시 + 대기 큐 전체 — 앱 시작 시 즉시 표시용(local-first).
export const loadLocalInboxItems = (ownerId?: string) =>
  list<LocalInboxItem>('inbox', ownerId);

// 서버로 아직 못 올린 대기 항목만. 캐시(synced) 행이 섞이면 큐 재전송
// 루프가 서버 항목을 다시 POST하므로 반드시 여기서 걸러야 한다.
export const loadLocalInboxQueue = async (ownerId?: string) =>
  (await loadLocalInboxItems(ownerId)).filter(
    (item): item is LocalInboxSession =>
      item.local_sync_status === 'pending' || item.local_sync_status === 'failed',
  );

// 서버에서 받아온 목록으로 로컬 캐시를 교체한다. replaceSynced는 synced
// 행만 갈아끼우고 pending/failed 큐 행은 보존한다.
export const replaceLocalInboxCache = async (
  items: InboxSession[],
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  return (await getApi().localDbReplaceSynced(
    ownerKey(ownerId),
    'inbox',
    items,
  )) as LocalInboxItem[];
};

// 서버 반영이 확인된 항목 한 건을 캐시에 upsert한다 — 저장/큐 재전송/좋아요
// 직후처럼 전체 목록을 다시 받기 전에 로컬 상태를 맞춰두는 용도.
export const cacheLocalInboxItem = async (
  item: InboxSession,
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(ownerKey(ownerId), 'inbox', item.id, {
    ...item,
    local_sync_status: 'synced',
  });
};

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
    keywords: [],
    liked: false,
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

// 일정 inbox 캐시 — 서버 배치 결과의 읽기 전용 표시용. 수락/무시 쓰기는
// 온라인 전용이며, 처리된 항목은 removeLocalScheduleInboxItem으로 걷어낸다.
export const loadLocalScheduleInbox = (ownerId?: string) =>
  list<ScheduleInboxRow>('schedule_inbox', ownerId);

export const replaceLocalScheduleInbox = async (
  rows: ScheduleInboxRow[],
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbReplaceSynced(ownerKey(ownerId), 'schedule_inbox', rows);
};

export const removeLocalScheduleInboxItem = async (
  id: string,
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbDelete(ownerKey(ownerId), 'schedule_inbox', id);
};

// Topics 지도 캐시 — 야간 배치 결과 전체를 단일 레코드(blob)로 저장한다.
const TOPIC_MAP_RECORD_ID = 'latest';

export const loadLocalTopicMap = async (
  ownerId?: string,
): Promise<TopicMapData | null> => {
  const rows = await list<TopicMapData>('topic_map', ownerId);
  return rows[0] ?? null;
};

export const saveLocalTopicMap = async (
  map: TopicMapData,
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(ownerKey(ownerId), 'topic_map', TOPIC_MAP_RECORD_ID, map);
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
