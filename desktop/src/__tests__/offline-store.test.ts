import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MEMO_CATEGORY, MINI_SUBNOTA_CATEGORY } from '../lib/memoCategory';
import {
  applyLocalMemoSyncResult,
  createLocalMemoRow,
  createLocalInboxSession,
  getLocalWorkspaceOwner,
  loadLocalActivityCompletions,
  loadLocalMemoRecoveries,
  loadLocalInboxDeleteTombstones,
  loadLocalInboxItems,
  loadLocalInboxQueue,
  loadLocalMemos,
  loadLocalScheduleInbox,
  loadLocalScheduleInboxActions,
  loadLocalTopicMap,
  markLocalInboxSessionDeleted,
  markLocalMemoDeleted,
  persistLocalMemoEventually,
  removeLocalInboxSessionIfNotDeleted,
  removeLocalScheduleInboxItem,
  removeLocalScheduleInboxAction,
  replaceLocalInboxCache,
  replaceLocalScheduleInbox,
  restoreLocalMemoSnapshotAfterPull,
  saveLocalTopicMap,
  replaceSyncedMemos,
  preserveLocalMemoRecovery,
  setLocalWorkspaceOwner,
  updateLocalMemoSyncedBase,
  upsertLocalMemo,
  upsertLocalActivityCompletionEventually,
  upsertLocalScheduleInboxAction,
} from '../services/local/offlineStore';
import { InboxSession } from '../services/backend/inboxService';
import { MemoRow } from '../types';

const makeLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    clear: vi.fn(() => store.clear()),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    removeItem: vi.fn((key: string) => store.delete(key)),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  };
};

const makeMemo = (patch: Partial<MemoRow>): MemoRow => ({
  category: DEFAULT_MEMO_CATEGORY,
  content: 'Remote memo',
  content_hash: 'hash',
  created_at: '2026-06-01T00:00:00.000Z',
  id: 'remote-1',
  is_archived: false,
  updated_at: '2026-06-01T00:00:00.000Z',
  ...patch,
});

const createSqliteBridge = () => {
  const records = new Map<string, Map<string, unknown>>();
  const bucket = (owner: string | null, type: string) => {
    const key = `${owner ?? 'guest'}:${type}`;
    const existing = records.get(key);
    if (existing) return existing;
    const created = new Map<string, unknown>();
    records.set(key, created);
    return created;
  };

  return {
    localDbApplyMemoSyncResult: vi.fn(
      async (owner, id, expectedLocalContent, value) => {
        const target = bucket(owner, 'memo');
        const existing = target.get(id) as { content?: string } | undefined;
        if (existing?.content !== expectedLocalContent) return false;
        target.set(id, value);
        return true;
      },
    ),
    localDbDelete: vi.fn(async (owner, type, id) => void bucket(owner, type).delete(id)),
    localDbDeleteInboxPendingIfNotDeleted: vi.fn(async (owner, id) => {
      const target = bucket(owner, 'inbox');
      const existing = target.get(id) as
        | { local_sync_status?: string }
        | undefined;
      if (existing?.local_sync_status === 'pending_delete') return false;
      target.delete(id);
      return true;
    }),
    localDbList: vi.fn(async (owner, type) => Array.from(bucket(owner, type).values())),
    localDbMigrate: vi.fn(async (owner, datasets) => {
      for (const [type, values] of [
        ['memo', datasets.memos],
        ['calendar', datasets.calendarBlocks],
        ['inbox', datasets.inboxItems],
      ]) {
        for (const value of values ?? []) {
          if (!bucket(owner, type).has(value.id)) bucket(owner, type).set(value.id, value);
        }
      }
    }),
    localDbReplaceSynced: vi.fn(async (owner, type, values, preserveIds = []) => {
      const target = bucket(owner, type);
      const preserved = new Set(preserveIds);
      for (const [id, value] of target) {
        const status = (value as { local_sync_status?: string }).local_sync_status;
        if (status && status !== 'synced') preserved.add(id);
        if ((!status || status === 'synced') && !preserved.has(id)) {
          target.delete(id);
        }
      }
      for (const value of values) {
        if (preserved.has(value.id)) continue;
        target.set(value.id, { ...value, local_sync_status: 'synced' });
      }
      return Array.from(target.values());
    }),
    localDbUpsert: vi.fn(async (owner, type, id, value) => {
      const target = bucket(owner, type);
      const existing = target.get(id) as
        | { synced_content?: string | null; synced_content_hash?: string | null }
        | undefined;
      const next = value as {
        local_sync_status?: string;
        synced_content?: string | null;
        synced_content_hash?: string | null;
      };
      if (
        type === 'memo' &&
        (next.local_sync_status === 'pending' ||
          next.local_sync_status === 'failed') &&
        existing &&
        (typeof existing.synced_content === 'string' ||
          typeof existing.synced_content_hash === 'string')
      ) {
        target.set(id, {
          ...next,
          synced_content: existing.synced_content ?? null,
          synced_content_hash: existing.synced_content_hash ?? null,
        });
        return;
      }
      target.set(id, value);
    }),
    localDbPatchMemoSyncBase: vi.fn(
      async (owner, id, syncedContent, syncedContentHash) => {
        const target = bucket(owner, 'memo');
        const existing = target.get(id);
        if (!existing) return null;
        const patched = {
          ...(existing as object),
          synced_content: syncedContent,
          synced_content_hash: syncedContentHash,
        };
        target.set(id, patched);
        return patched;
      },
    ),
    localDbRestoreMemoSnapshotAfterPull: vi.fn(async (owner, id, value) => {
      bucket(owner, 'memo').set(id, value);
    }),
  };
};

describe('offline memo store', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: createSqliteBridge(),
      localStorage: makeLocalStorage(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('stores Quick Subnota memos with their category intact', async () => {
    const memo = await upsertLocalMemo({
      category: MINI_SUBNOTA_CATEGORY,
      content: 'Quick capture',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'mini-1',
    });
    expect(memo.category).toBe(MINI_SUBNOTA_CATEGORY);
    expect((await loadLocalMemos())[0].category).toBe(MINI_SUBNOTA_CATEGORY);
  });

  it('defaults uncategorized local memos to Ideas', async () => {
    const memo = await upsertLocalMemo({
      content: 'Regular memo',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'normal-1',
    });
    expect(memo.category).toBe(DEFAULT_MEMO_CATEGORY);
  });

  it('persists clearing all content from an existing memo', async () => {
    await upsertLocalMemo({
      content: 'Content to clear',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'clearable-memo',
    });
    await upsertLocalMemo({
      content: '',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'clearable-memo',
    });
    expect((await loadLocalMemos()).find(memo => memo.id === 'clearable-memo')?.content).toBe('');
  });

  it('does not let a later pending edit erase the acknowledged sync base', async () => {
    const createdAt = '2026-06-13T00:00:00.000Z';
    await upsertLocalMemo({
      content: '코데이터 솔루',
      created_at: createdAt,
      id: 'sync-base-memo',
    });
    await updateLocalMemoSyncedBase('sync-base-memo', {
      content: '코데이터 솔루',
      hash: 'server-hash-a',
    });

    await upsertLocalMemo({
      content: '코데이터 솔루션',
      created_at: createdAt,
      id: 'sync-base-memo',
      synced_content: null,
      synced_content_hash: null,
    });

    const stored = (await loadLocalMemos()).find(
      memo => memo.id === 'sync-base-memo',
    );
    expect(stored?.content).toBe('코데이터 솔루션');
    expect(stored?.synced_content).toBe('코데이터 솔루');
    expect(stored?.synced_content_hash).toBe('server-hash-a');
  });

  it('applies a canonical sync result only while the expected local content is current', async () => {
    const createdAt = '2026-06-13T00:00:00.000Z';
    await upsertLocalMemo({
      content: '요청에 실린 내용',
      created_at: createdAt,
      id: 'compare-apply-memo',
    });
    const canonical = createLocalMemoRow(
      {
        content: '원격과 병합된 내용',
        created_at: createdAt,
        id: 'compare-apply-memo',
        synced_content: '원격과 병합된 내용',
        synced_content_hash: 'server-hash-b',
      },
      'synced',
    );

    await expect(
      applyLocalMemoSyncResult(canonical, '요청에 실린 내용'),
    ).resolves.toBe(true);
    await expect(
      applyLocalMemoSyncResult(
        { ...canonical, content: '뒤늦은 과거 응답' },
        '이미 오래된 내용',
      ),
    ).resolves.toBe(false);
    expect((await loadLocalMemos())[0]).toEqual(canonical);
  });

  it('keeps a delete tombstone newer than a retried edit', async () => {
    vi.useFakeTimers();
    const bridge = createSqliteBridge();
    vi.stubGlobal('window', {
      electronAPI: bridge,
      localStorage: makeLocalStorage(),
    });
    const createdAt = '2026-06-13T00:00:00.000Z';
    await upsertLocalMemo({
      content: '삭제 전 내용',
      created_at: createdAt,
      id: 'delete-wins-memo',
    });
    bridge.localDbUpsert.mockRejectedValueOnce(new Error('SQLite busy'));

    const retriedEdit = persistLocalMemoEventually(
      createLocalMemoRow({
        content: '재시도 중인 편집',
        created_at: createdAt,
        id: 'delete-wins-memo',
      }),
    );
    await vi.advanceTimersByTimeAsync(0);
    const deleted = markLocalMemoDeleted(
      'delete-wins-memo',
      'pending_delete',
    );
    await vi.advanceTimersByTimeAsync(250);
    await Promise.all([retriedEdit, deleted]);

    const stored = (await loadLocalMemos()).find(
      memo => memo.id === 'delete-wins-memo',
    );
    expect(stored).toEqual(
      expect.objectContaining({
        is_archived: true,
        local_sync_status: 'pending_delete',
      }),
    );
    expect(bridge.localDbUpsert).toHaveBeenCalledTimes(3);
    expect(bridge.localDbUpsert.mock.calls[1]?.[3]).toEqual(
      expect.objectContaining({ content: '재시도 중인 편집' }),
    );
    expect(bridge.localDbUpsert.mock.calls.at(-1)?.[3]).toEqual(
      expect.objectContaining({ is_archived: true }),
    );
    vi.useRealTimers();
  });

  it('keeps pending memos when remote synced memos are merged', async () => {
    await upsertLocalMemo({
      category: MINI_SUBNOTA_CATEGORY,
      content: 'Offline quick note',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'mini-pending',
    });
    const merged = await replaceSyncedMemos([
      makeMemo({ category: DEFAULT_MEMO_CATEGORY, id: 'remote-normal' }),
    ]);
    expect(merged.find(memo => memo.id === 'mini-pending')?.category).toBe(MINI_SUBNOTA_CATEGORY);
    expect(merged.find(memo => memo.id === 'remote-normal')?.category).toBe(DEFAULT_MEMO_CATEGORY);
  });

  it('does not replace a pending memo when the remote snapshot has the same id', async () => {
    const createdAt = '2026-06-13T00:00:00.000Z';
    await upsertLocalMemo({
      content: '아직 저장되지 않은 로컬 편집',
      created_at: createdAt,
      id: 'pending-collision',
      synced_content: '마지막 동기화 내용',
      synced_content_hash: 'last-synced-hash',
    });

    const merged = await replaceSyncedMemos([
      makeMemo({
        content: '뒤늦게 도착한 원격 스냅샷',
        id: 'pending-collision',
      }),
    ]);

    expect(merged.find(memo => memo.id === 'pending-collision')).toEqual(
      expect.objectContaining({
        content: '아직 저장되지 않은 로컬 편집',
        local_sync_status: 'pending',
        synced_content: '마지막 동기화 내용',
        synced_content_hash: 'last-synced-hash',
      }),
    );
  });

  it('restores an exact local snapshot after a late active-pane race', async () => {
    const bridge = createSqliteBridge();
    vi.stubGlobal('window', {
      electronAPI: bridge,
      localStorage: makeLocalStorage(),
    });
    const snapshot = makeMemo({
      content: '편집기 A',
      content_hash: 'hash-a',
      id: 'late-active-memo',
      local_sync_status: 'pending',
      synced_content: '기준 A',
      synced_content_hash: 'base-hash-a',
    });

    await upsertLocalMemo(
      { ...snapshot, content: '원격 B', synced_content: '원격 B' },
      'synced',
    );
    await restoreLocalMemoSnapshotAfterPull(snapshot);

    expect(bridge.localDbRestoreMemoSnapshotAfterPull).toHaveBeenCalledWith(
      null,
      snapshot.id,
      snapshot,
    );
    expect((await loadLocalMemos()).find(memo => memo.id === snapshot.id)).toEqual(
      snapshot,
    );
  });

  it('preserves protected memo content and sync base during a remote snapshot replace', async () => {
    const bridge = createSqliteBridge();
    vi.stubGlobal('window', {
      electronAPI: bridge,
      localStorage: makeLocalStorage(),
    });
    const createdAt = '2026-06-13T00:00:00.000Z';
    await upsertLocalMemo(
      {
        content: '열린 에디터 A',
        created_at: createdAt,
        id: 'memo-a',
        synced_content: '열린 에디터 A',
        synced_content_hash: 'hash-a',
      },
      'synced',
    );
    await upsertLocalMemo(
      { content: '기존 C', created_at: createdAt, id: 'memo-c' },
      'synced',
    );
    await upsertLocalMemo(
      { content: '사라질 D', created_at: createdAt, id: 'memo-d' },
      'synced',
    );

    const merged = await replaceSyncedMemos(
      [
        makeMemo({
          content: '원격 B',
          content_hash: 'hash-b',
          id: 'memo-a',
          synced_content_hash: 'hash-b',
        }),
        makeMemo({
          content: '원격에서 갱신된 C',
          content_hash: 'hash-c2',
          id: 'memo-c',
          synced_content_hash: 'hash-c2',
        }),
      ],
      undefined,
      new Set(['memo-a']),
    );

    expect(bridge.localDbReplaceSynced).toHaveBeenLastCalledWith(
      null,
      'memo',
      expect.any(Array),
      ['memo-a'],
    );
    expect(merged.find(memo => memo.id === 'memo-a')).toEqual(
      expect.objectContaining({
        content: '열린 에디터 A',
        synced_content: '열린 에디터 A',
        synced_content_hash: 'hash-a',
      }),
    );
    expect(merged.find(memo => memo.id === 'memo-c')).toEqual(
      expect.objectContaining({
        content: '원격에서 갱신된 C',
        synced_content: '원격에서 갱신된 C',
        synced_content_hash: 'hash-c2',
      }),
    );
    expect(merged.some(memo => memo.id === 'memo-d')).toBe(false);
  });

  it('keeps conflict recovery hidden and idempotent instead of creating memos', async () => {
    await preserveLocalMemoRecovery({
      content: '복구할 서버 문장',
      memoId: 'memo-with-conflict',
      source: 'server',
      sourceUpdatedAt: '2026-07-30T05:00:00.000Z',
    });
    await preserveLocalMemoRecovery({
      content: '복구할 서버 문장',
      memoId: 'memo-with-conflict',
      source: 'server',
      sourceUpdatedAt: '2026-07-30T05:00:00.000Z',
    });

    expect(await loadLocalMemos()).toEqual([]);
    const recoveries = await loadLocalMemoRecoveries();
    expect(recoveries).toHaveLength(1);
    expect(recoveries[0]).toEqual(
      expect.objectContaining({
        content: '복구할 서버 문장',
        memo_id: 'memo-with-conflict',
        source: 'server',
      }),
    );
  });

  it('isolates local data by authenticated user', async () => {
    setLocalWorkspaceOwner('sqlite-user-a');
    await upsertLocalMemo({
      content: 'User A memo',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'user-a-memo',
    });
    setLocalWorkspaceOwner('sqlite-user-b');
    expect(await loadLocalMemos()).toEqual([]);
    await upsertLocalMemo({
      content: 'User B memo',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'user-b-memo',
    });
    expect((await loadLocalMemos()).map(memo => memo.id)).toEqual(['user-b-memo']);
    expect((await loadLocalMemos('sqlite-user-a')).map(memo => memo.id)).toEqual(['user-a-memo']);
  });

  it('switches the live workspace owner even when localStorage persistence fails', () => {
    setLocalWorkspaceOwner('owner-a');
    expect(getLocalWorkspaceOwner()).toBe('owner-a');
    vi.mocked(window.localStorage.setItem).mockImplementationOnce(() => {
      throw new Error('storage denied');
    });

    setLocalWorkspaceOwner('owner-b');

    expect(getLocalWorkspaceOwner()).toBe('owner-b');
    expect(window.localStorage.getItem('subnota.macos.local.activeOwner.v1')).toBe(
      'owner-a',
    );
  });

  it('observes a workspace owner persisted by another renderer', () => {
    setLocalWorkspaceOwner('owner-a');
    window.localStorage.setItem(
      'subnota.macos.local.activeOwner.v1',
      'owner-b',
    );

    expect(getLocalWorkspaceOwner()).toBe('owner-b');
  });

  it('migrates legacy localStorage data once and removes its data key', async () => {
    window.localStorage.setItem(
      'subnota.macos.local.memos.v1',
      JSON.stringify([makeMemo({ id: 'legacy-memo' })]),
    );
    expect(await loadLocalMemos()).toEqual([]);
    setLocalWorkspaceOwner('sqlite-migration-user');
    expect((await loadLocalMemos()).map(memo => memo.id)).toEqual(['legacy-memo']);
    expect(window.localStorage.getItem('subnota.macos.local.memos.v1')).toBeNull();
  });
});

const makeInboxSession = (patch: Partial<InboxSession>): InboxSession => ({
  canonicalUrl: null,
  channelTitle: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  description: null,
  domain: 'example.com',
  duration: null,
  id: 'remote-inbox-1',
  keywords: [],
  liked: false,
  originalUrl: 'https://example.com/a',
  publishedAt: null,
  selectedText: null,
  sourceType: 'url',
  summary: null,
  summaryBasis: null,
  summaryDetail: null,
  summaryOneLiner: null,
  summaryProvider: null,
  summarySearchText: null,
  summaryStatus: 'ready',
  thumbnailUrl: null,
  title: 'Remote item',
  userNote: null,
  ...patch,
});

describe('offline inbox store', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: createSqliteBridge(),
      localStorage: makeLocalStorage(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('caches fetched sessions while keeping the pending queue', async () => {
    const queued = await createLocalInboxSession('https://example.com/queued');
    const cached = await replaceLocalInboxCache([
      makeInboxSession({ id: 'remote-1' }),
    ]);

    // 캐시 교체 후에도 대기 큐 항목은 살아 있어야 한다.
    expect(cached.map(item => item.id).sort()).toEqual(
      ['remote-1', queued.clientId].sort(),
    );
    // 큐 로드는 pending만 — 캐시(synced) 행이 재전송 루프로 새면 서버
    // 항목을 다시 POST하게 된다 (버그 재현 지점).
    expect((await loadLocalInboxQueue()).map(item => item.id)).toEqual([
      queued.clientId,
    ]);
    expect(await loadLocalInboxItems()).toHaveLength(2);
  });

  it('keeps a pending-delete tombstone across restart and a matching server refetch', async () => {
    const pending = await createLocalInboxSession('https://example.com/deleted');
    await markLocalInboxSessionDeleted(pending);

    // A restarted renderer reloads the SQLite row, but never retries it as a POST.
    expect(await loadLocalInboxQueue()).toEqual([]);
    expect(await loadLocalInboxDeleteTombstones()).toEqual([
      expect.objectContaining({
        clientId: pending.clientId,
        id: pending.clientId,
        local_sync_status: 'pending_delete',
      }),
    ]);

    // The server may have committed the original POST after the renderer exited.
    const reloaded = await replaceLocalInboxCache([
      makeInboxSession({
        clientId: pending.clientId,
        id: 'server-created-after-renderer-exit',
      }),
    ]);
    const deletedClientIds = new Set(
      (await loadLocalInboxDeleteTombstones()).map(item => item.clientId),
    );
    const visible = reloaded.filter(
      item =>
        item.local_sync_status !== 'pending_delete' &&
        (!item.clientId || !deletedClientIds.has(item.clientId)),
    );

    expect(visible).toEqual([]);
    expect(reloaded.map(item => item.id).sort()).toEqual(
      [pending.clientId, 'server-created-after-renderer-exit'].sort(),
    );
  });

  it('keys a synced deletion by server id and prevents a POST cleanup from removing it', async () => {
    const synced = makeInboxSession({
      clientId: 'original-client-id',
      id: 'known-server-id',
    });
    await replaceLocalInboxCache([synced]);
    await markLocalInboxSessionDeleted(synced);

    await expect(
      removeLocalInboxSessionIfNotDeleted('known-server-id'),
    ).resolves.toBe(false);
    expect(await loadLocalInboxDeleteTombstones()).toEqual([
      expect.objectContaining({
        clientId: 'original-client-id',
        id: 'known-server-id',
        local_sync_status: 'pending_delete',
      }),
    ]);
  });

  it('replaces the previous cache on refetch', async () => {
    await replaceLocalInboxCache([makeInboxSession({ id: 'old-item' })]);
    const next = await replaceLocalInboxCache([
      makeInboxSession({ id: 'new-item' }),
    ]);
    expect(next.map(item => item.id)).toEqual(['new-item']);
  });
});

describe('offline growth store', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: createSqliteBridge(),
      localStorage: makeLocalStorage(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retains and retries a transient first-completion write', async () => {
    vi.useFakeTimers();
    const bridge = createSqliteBridge();
    bridge.localDbUpsert.mockRejectedValueOnce(new Error('SQLite busy'));
    vi.stubGlobal('window', {
      electronAPI: bridge,
      localStorage: makeLocalStorage(),
    });
    const completion = {
      calendar_block_id: 'growth-block-1',
      completed_at: '2026-08-11T00:00:00.000Z',
      id: 'growth-1',
      local_date: '2026-08-11',
    };

    const persisted = upsertLocalActivityCompletionEventually(completion);
    await vi.advanceTimersByTimeAsync(250);
    await persisted;

    expect(await loadLocalActivityCompletions()).toEqual([
      expect.objectContaining({
        calendar_block_id: 'growth-block-1',
        local_sync_status: 'pending',
      }),
    ]);
  });
});

describe('offline schedule-inbox / topic-map cache', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      electronAPI: createSqliteBridge(),
      localStorage: makeLocalStorage(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('replaces the schedule inbox cache and removes handled items', async () => {
    const row = {
      all_day: false,
      confidence: 'auto' as const,
      created_at: '2026-07-01T00:00:00.000Z',
      id: 'sched-1',
      memo_id: 'memo-1',
      scheduled_at: '2026-07-02T09:00:00.000Z',
      source_text: '내일 9시 회의',
      status: 'pending' as const,
      time_text: '9시',
      title: '회의',
    };
    await replaceLocalScheduleInbox([row]);
    expect((await loadLocalScheduleInbox()).map(item => item.id)).toEqual(['sched-1']);

    await removeLocalScheduleInboxItem('sched-1');
    expect(await loadLocalScheduleInbox()).toEqual([]);
  });

  it('persists schedule inbox actions as a local outbox', async () => {
    await upsertLocalScheduleInboxAction('sched-accepted', 'accepted');
    expect(await loadLocalScheduleInboxActions()).toEqual([
      expect.objectContaining({
        id: 'sched-accepted',
        status: 'accepted',
      }),
    ]);

    await removeLocalScheduleInboxAction('sched-accepted');
    expect(await loadLocalScheduleInboxActions()).toEqual([]);
  });

  it('round-trips the topic map as a single record', async () => {
    expect(await loadLocalTopicMap()).toBeNull();
    const map = {
      clusters: [
        {
          confidence: 0.8,
          id: 'topic-1',
          keywords: ['커피'],
          label: '홈카페',
          memoCount: 2,
          representativeMemoIds: ['m1'],
        },
      ],
      edges: [],
      globalEdges: [],
      inboxEdges: [],
      inboxMemberships: [],
      memberships: [{ memoId: 'm1', score: 0.9, topicId: 'topic-1' }],
    };
    await saveLocalTopicMap(map);
    const loaded = await loadLocalTopicMap();
    expect(loaded?.clusters[0]?.label).toBe('홈카페');
    expect(loaded?.memberships).toHaveLength(1);

    // 두 번째 저장은 같은 레코드를 덮어쓴다 (blob 1개 유지).
    await saveLocalTopicMap({ ...map, clusters: [] });
    expect((await loadLocalTopicMap())?.clusters).toEqual([]);
  });
});
