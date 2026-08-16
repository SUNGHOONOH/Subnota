import { hashText } from '../../lib/contentHash';
import { getMemoCategory } from '../../lib/memoCategory';
import {
  CalendarBlockRow,
  MemoRow,
  ScheduleInboxRow,
  TopicMapData,
} from '../../types';
import { ActivityCompletion, DailyCompletion } from '../../features/report/growthTypes';
import { InboxSession, InboxSourceType } from '../backend/inboxService';
import { createLatestWriteQueue } from '../../lib/latestWriteQueue';

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
  | 'memo_recovery'
  | 'schedule_inbox'
  | 'schedule_inbox_action'
  | 'topic_map';

export type LocalMemoRow = MemoRow & { local_sync_status?: LocalSyncStatus };
export interface LocalMemoRecovery {
  content: string;
  content_hash: string;
  created_at: string;
  id: string;
  memo_id: string;
  source: 'local' | 'server';
  source_updated_at: string | null;
  updated_at: string;
}
export type LocalCalendarBlockRow = CalendarBlockRow & {
  local_sync_status?: LocalSyncStatus;
};
// 'inbox' 컬렉션에는 대기 큐(pending/failed), 삭제 tombstone
// (pending_delete), 서버 목록의 로컬 캐시(synced)가 함께 산다.
export type LocalInboxItem = InboxSession & {
  local_sync_status?: LocalSyncStatus;
};
export type LocalInboxSession = LocalInboxItem & {
  clientId: string;
};

export interface LocalScheduleInboxAction {
  id: string;
  status: 'accepted' | 'dismissed';
  updated_at: string;
}

const migrationPromises = new Map<string, Promise<void>>();
const getLocalStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
const canUseLocalStorage = () => Boolean(getLocalStorage());
let activeOwnerOverride:
  | { ownerId: string | null; storage: Storage | null }
  | undefined;

const loadActiveOwner = () => {
  const storage = getLocalStorage();
  if (activeOwnerOverride?.storage === storage) {
    return activeOwnerOverride.ownerId;
  }
  activeOwnerOverride = undefined;
  try {
    return storage?.getItem(ACTIVE_OWNER_KEY) ?? null;
  } catch {
    return null;
  }
};

export const getLocalWorkspaceOwner = loadActiveOwner;

const ownerKey = (ownerId?: string) => ownerId ?? loadActiveOwner() ?? null;
const scopedKey = (baseKey: string, ownerId?: string) =>
  `${baseKey}.${ownerKey(ownerId) ? `user.${ownerKey(ownerId)}` : 'guest'}`;

export const setLocalWorkspaceOwner = (ownerId: string | null) => {
  const storage = getLocalStorage();
  // The active renderer must switch owners even when persistence is denied.
  // localStorage is only the reload hint; it cannot be the live authority at
  // an account privacy boundary.
  if (!storage) {
    activeOwnerOverride = { ownerId, storage };
    return;
  }
  try {
    if (ownerId) storage.setItem(ACTIVE_OWNER_KEY, ownerId);
    else storage.removeItem(ACTIVE_OWNER_KEY);
    activeOwnerOverride = undefined;
  } catch {
    activeOwnerOverride = { ownerId, storage };
    // Authentication still works when browser storage is unavailable.
  }
};

export const clearLocalWorkspaceOwner = async (ownerId: string) => {
  await getApi().localDbClearOwner(ownerId);
  const storage = getLocalStorage();
  if (storage) {
    const ownerMarker = `.user.${ownerId}`;
    for (const key of Object.keys(storage)) {
      if (key.includes(ownerMarker)) {
        storage.removeItem(key);
      }
    }
  }
  migrationPromises.delete(ownerId);
  setLocalWorkspaceOwner(null);
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

export const loadLocalMemoRecoveries = (ownerId?: string) =>
  list<LocalMemoRecovery>('memo_recovery', ownerId);

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
  // Embedding 색인은 입력 중이 아니라 앱 시작·에디터 이탈·검색 직전에
  // 명시적으로 flush한다. 여기서는 메모 저장만 책임진다.
  return memo;
};

const localMemoWriteQueue = createLatestWriteQueue<{
  memo: LocalMemoRow;
  ownerId?: string;
}>({
  shouldRetry: error =>
    !(
      error instanceof Error &&
      error.message.includes('temporarily unavailable during restore')
    ),
  write: async ({ memo, ownerId }) => {
    await persistLocalMemo(memo, ownerId);
  },
});

// 편집 중 SQLite가 잠깐 실패하면 메모별 최신 내용만 남겨 제한적으로 재시도한다.
// 재시도 한도를 넘긴 오류는 호출자에게 돌려 저장 실패를 숨기지 않는다.
export const persistLocalMemoEventually = (
  memo: LocalMemoRow,
  ownerId?: string,
) =>
  localMemoWriteQueue.enqueue(
    `${ownerKey(ownerId) ?? 'guest'}:${memo.id}`,
    { memo, ownerId },
  );

// The renderer must stop accepting edits before awaiting this during shutdown.
// A previously exhausted write gets one new bounded retry budget on each drain.
export const flushPendingLocalMemoWrites = () => localMemoWriteQueue.drain();

// Conflict recovery belongs to the local history, not the visible memo list.
// The content hash makes retries idempotent, so one conflict can never fan out
// into several user-visible notes.
export const preserveLocalMemoRecovery = async (
  recovery: {
    content: string;
    memoId: string;
    source: LocalMemoRecovery['source'];
    sourceUpdatedAt?: string | null;
  },
  ownerId?: string,
) => {
  const contentHash = hashText(recovery.content);
  const now = new Date().toISOString();
  const row: LocalMemoRecovery = {
    content: recovery.content,
    content_hash: contentHash,
    created_at: now,
    id: `${recovery.memoId}:${contentHash}`,
    memo_id: recovery.memoId,
    source: recovery.source,
    source_updated_at: recovery.sourceUpdatedAt ?? null,
    updated_at: now,
  };
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(
    ownerKey(ownerId),
    'memo_recovery',
    row.id,
    row,
  );
  return row;
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
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  return getApi().localDbPatchMemoSyncBase(
    ownerKey(ownerId),
    memoId,
    base.content,
    base.hash,
  ) as Promise<LocalMemoRow | null>;
};

export const applyLocalMemoSyncResult = async (
  memo: LocalMemoRow,
  expectedLocalContent: string,
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  return getApi().localDbApplyMemoSyncResult(
    ownerKey(ownerId),
    memo.id,
    expectedLocalContent,
    memo,
  );
};

export const markLocalMemoDeleted = async (
  memoId: string,
  syncStatus: LocalSyncStatus,
  ownerId?: string,
) => {
  const memo = (await loadLocalMemos(ownerId)).find(item => item.id === memoId);
  const now = new Date().toISOString();
  // Deletes share the edit queue and key. A tombstone that arrives while an
  // older edit is retrying replaces that edit instead of being overwritten by it.
  await persistLocalMemoEventually(
    {
      ...(memo ?? createLocalMemoRow({ content: '', created_at: now, id: memoId })),
      is_archived: true,
      local_sync_status: syncStatus,
      updated_at: now,
    },
    ownerId,
  );
};

export const replaceSyncedMemos = async (
  remoteMemos: MemoRow[],
  ownerId?: string,
  preserveIds?: ReadonlySet<string>,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  const records = (await getApi().localDbReplaceSynced(
    ownerKey(ownerId),
    'memo',
    // Pulled rows are the synced state by definition — keep their content as
    // the 3-way merge base for later conflicts.
    remoteMemos.map(memo => ({ ...memo, synced_content: memo.content })),
    preserveIds ? [...preserveIds] : undefined,
  )) as LocalMemoRow[];
  return records.filter(memo => !memo.is_archived).sort(byUpdatedDesc);
};

export const restoreLocalMemoSnapshotAfterPull = async (
  memo: LocalMemoRow,
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbRestoreMemoSnapshotAfterPull(
    ownerKey(ownerId),
    memo.id,
    memo,
  );
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

export const loadLocalInboxDeleteTombstones = async (ownerId?: string) =>
  (await loadLocalInboxItems(ownerId)).filter(
    item => item.local_sync_status === 'pending_delete',
  );

export const isLocalInboxSessionDeleted = async (
  recordId: string,
  ownerId?: string,
) =>
  (await loadLocalInboxItems(ownerId)).some(
    item =>
      item.id === recordId && item.local_sync_status === 'pending_delete',
  );

// 서버로 아직 못 올린 대기 항목만. 캐시(synced) 행이 섞이면 큐 재전송
// 루프가 서버 항목을 다시 POST하므로 반드시 여기서 걸러야 한다.
export const loadLocalInboxQueue = async (ownerId?: string) =>
  (await loadLocalInboxItems(ownerId)).filter(
    (item): item is LocalInboxSession =>
      item.local_sync_status === 'pending' || item.local_sync_status === 'failed',
  );

// 서버에서 받아온 목록으로 로컬 캐시를 교체한다. replaceSynced는 synced
// 행만 갈아끼우고 pending/failed 큐와 pending_delete tombstone은 보존한다.
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

export const markLocalInboxSessionDeleted = async (
  item: InboxSession,
  ownerId?: string,
) => {
  const tombstone: LocalInboxItem = {
    ...item,
    id: item.id,
    local_sync_status: 'pending_delete',
  };
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbUpsert(
    ownerKey(ownerId),
    'inbox',
    item.id,
    tombstone,
  );
  return tombstone;
};

export const removeLocalInboxSession = async (clientId: string, ownerId?: string) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbDelete(ownerKey(ownerId), 'inbox', clientId);
};

export const removeLocalInboxSessionIfNotDeleted = async (
  recordId: string,
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  return getApi().localDbDeleteInboxPendingIfNotDeleted(
    ownerKey(ownerId),
    recordId,
  );
};

// 일정 저장함 캐시 — 서버 배치 결과의 표시용. 처리된 항목은 먼저 캐시에서
// 걷어내고, schedule_inbox_action outbox가 서버 상태 반영을 재시도한다.
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

export const loadLocalScheduleInboxActions = (ownerId?: string) =>
  list<LocalScheduleInboxAction>('schedule_inbox_action', ownerId);

export const upsertLocalScheduleInboxAction = async (
  id: string,
  status: LocalScheduleInboxAction['status'],
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  const action: LocalScheduleInboxAction = {
    id,
    status,
    updated_at: new Date().toISOString(),
  };
  await getApi().localDbUpsert(
    ownerKey(ownerId),
    'schedule_inbox_action',
    id,
    action,
  );
  return action;
};

export const removeLocalScheduleInboxAction = async (
  id: string,
  ownerId?: string,
) => {
  await ensureMigrated(ownerId);
  await getApi().localDbSetOwner?.(ownerKey(ownerId));
  await getApi().localDbDelete(ownerKey(ownerId), 'schedule_inbox_action', id);
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

type LocalGrowthWrite =
  | {
      kind: 'activity';
      ownerId?: string;
      record: ActivityCompletion;
      syncStatus: LocalSyncStatus;
    }
  | {
      kind: 'daily';
      ownerId?: string;
      record: DailyCompletion;
      syncStatus: LocalSyncStatus;
    };

const localGrowthWriteQueue = createLatestWriteQueue<LocalGrowthWrite>({
  shouldRetry: error =>
    !(
      error instanceof Error &&
      error.message.includes('temporarily unavailable during restore')
    ),
  write: async write => {
    if (write.kind === 'activity') {
      await upsertLocalActivityCompletion(
        write.record,
        write.syncStatus,
        write.ownerId,
      );
      return;
    }
    await upsertLocalDailyCompletion(
      write.record,
      write.syncStatus,
      write.ownerId,
    );
  },
});

export const upsertLocalActivityCompletionEventually = (
  record: ActivityCompletion,
  syncStatus: LocalSyncStatus = 'pending',
  ownerId?: string,
) =>
  localGrowthWriteQueue.enqueue(
    `${ownerKey(ownerId) ?? 'guest'}:activity:${record.calendar_block_id}`,
    { kind: 'activity', ownerId, record, syncStatus },
  );

export const upsertLocalDailyCompletionEventually = (
  record: DailyCompletion,
  syncStatus: LocalSyncStatus = 'pending',
  ownerId?: string,
) =>
  localGrowthWriteQueue.enqueue(
    `${ownerKey(ownerId) ?? 'guest'}:daily:${record.local_date}`,
    { kind: 'daily', ownerId, record, syncStatus },
  );

export const flushPendingLocalGrowthWrites = () =>
  localGrowthWriteQueue.drain();
