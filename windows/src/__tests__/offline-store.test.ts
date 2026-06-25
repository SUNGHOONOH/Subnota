import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MEMO_CATEGORY, MINI_SUBNOTA_CATEGORY } from '../lib/memoCategory';
import {
  loadLocalMemos,
  replaceSyncedMemos,
  setLocalWorkspaceOwner,
  upsertLocalMemo,
} from '../services/local/offlineStore';
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
    localDbDelete: vi.fn(async (owner, type, id) => void bucket(owner, type).delete(id)),
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
    localDbReplaceSynced: vi.fn(async (owner, type, values) => {
      const target = bucket(owner, type);
      for (const [id, value] of target) {
        const status = (value as { local_sync_status?: string }).local_sync_status;
        if (!status || status === 'synced') target.delete(id);
      }
      for (const value of values) {
        target.set(value.id, { ...value, local_sync_status: 'synced' });
      }
      return Array.from(target.values());
    }),
    localDbUpsert: vi.fn(async (owner, type, id, value) => {
      bucket(owner, type).set(id, value);
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

  it('stores Mini Subnota memos with their category intact', async () => {
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

  it('migrates legacy localStorage data once and removes its data key', async () => {
    window.localStorage.setItem(
      'subnota.windows.local.memos.v1',
      JSON.stringify([makeMemo({ id: 'legacy-memo' })]),
    );
    expect(await loadLocalMemos()).toEqual([]);
    setLocalWorkspaceOwner('sqlite-migration-user');
    expect((await loadLocalMemos()).map(memo => memo.id)).toEqual(['legacy-memo']);
    expect(window.localStorage.getItem('subnota.windows.local.memos.v1')).toBeNull();
  });
});
