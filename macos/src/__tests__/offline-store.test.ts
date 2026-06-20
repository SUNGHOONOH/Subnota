import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_MEMO_CATEGORY,
  MINI_SUBNOTA_CATEGORY,
} from '../lib/memoCategory';
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
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
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

describe('offline memo store', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: makeLocalStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores Mini Subnota memos with their category intact', () => {
    const memo = upsertLocalMemo({
      category: MINI_SUBNOTA_CATEGORY,
      content: 'Quick capture',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'mini-1',
    });

    expect(memo.category).toBe(MINI_SUBNOTA_CATEGORY);
    expect(loadLocalMemos()[0].category).toBe(MINI_SUBNOTA_CATEGORY);
  });

  it('defaults uncategorized local memos to Ideas', () => {
    const memo = upsertLocalMemo({
      content: 'Regular memo',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'normal-1',
    });

    expect(memo.category).toBe(DEFAULT_MEMO_CATEGORY);
  });

  it('keeps pending Mini Subnota memos when remote synced memos are merged', () => {
    upsertLocalMemo({
      category: MINI_SUBNOTA_CATEGORY,
      content: 'Offline quick note',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'mini-pending',
    });

    const merged = replaceSyncedMemos([
      makeMemo({
        category: DEFAULT_MEMO_CATEGORY,
        id: 'remote-normal',
      }),
    ]);

    expect(merged.find(memo => memo.id === 'mini-pending')?.category).toBe(
      MINI_SUBNOTA_CATEGORY,
    );
    expect(merged.find(memo => memo.id === 'remote-normal')?.category).toBe(
      DEFAULT_MEMO_CATEGORY,
    );
  });

  it('isolates local data by authenticated user', () => {
    setLocalWorkspaceOwner('user-a');
    upsertLocalMemo({
      content: 'User A memo',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'user-a-memo',
    });

    setLocalWorkspaceOwner('user-b');
    expect(loadLocalMemos()).toEqual([]);

    upsertLocalMemo({
      content: 'User B memo',
      created_at: '2026-06-13T00:00:00.000Z',
      id: 'user-b-memo',
    });

    expect(loadLocalMemos().map(memo => memo.id)).toEqual(['user-b-memo']);
    expect(loadLocalMemos('user-a').map(memo => memo.id)).toEqual([
      'user-a-memo',
    ]);
  });

  it('migrates legacy data only when explicitly requested', () => {
    window.localStorage.setItem(
      'subnota.macos.local.memos.v1',
      JSON.stringify([makeMemo({ id: 'legacy-memo' })]),
    );

    setLocalWorkspaceOwner('interactive-user');
    expect(loadLocalMemos()).toEqual([]);

    setLocalWorkspaceOwner('cached-user', { migrateLegacy: true });
    expect(loadLocalMemos().map(memo => memo.id)).toEqual(['legacy-memo']);
    expect(loadLocalMemos('interactive-user')).toEqual([]);
  });
});
