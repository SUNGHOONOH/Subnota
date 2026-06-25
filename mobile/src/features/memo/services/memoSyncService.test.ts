import { syncPendingMemos } from './memoSyncService';
import { supabase } from '../../../shared/supabase/client';
import { useMemoStore } from '../../../store/useMemoStore';

jest.mock('../../../shared/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('../../../store/useMemoStore', () => ({
  useMemoStore: { getState: jest.fn() },
}));

const getUser = supabase.auth.getUser as jest.Mock;
const from = supabase.from as jest.Mock;
const rpc = supabase.rpc as jest.Mock;
const getState = useMemoStore.getState as unknown as jest.Mock;

const makeMemo = (patch: Record<string, unknown> = {}) => ({
  id: '11111111-1111-1111-1111-111111111111',
  content: 'local content',
  contentHash: 'hLocal',
  syncedContentHash: 'hBase',
  category: 'general',
  syncStatus: 'pending',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_100_000,
  ...patch,
});

const makeState = (memo: ReturnType<typeof makeMemo>) => ({
  applyRemoteMemo: jest.fn(),
  deletedMemoIds: [] as string[],
  markMemoDeletedSynced: jest.fn(),
  markMemoSynced: jest.fn(),
  markMemoSyncFailed: jest.fn(),
  memos: [memo],
});

beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { upsert: jest.fn().mockResolvedValue({ error: null }) };
    }
    return {
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    };
  });
});

it('marks the memo synced with the server hash on a normal update', async () => {
  const state = makeState(makeMemo());
  getState.mockReturnValue(state);
  rpc.mockResolvedValue({ data: [{ status: 'updated', content: 'local content', content_hash: 'hLocal' }], error: null });

  const result = await syncPendingMemos();

  expect(rpc).toHaveBeenCalledWith('upsert_memo_if_base_hash', expect.objectContaining({
    p_id: '11111111-1111-1111-1111-111111111111',
    p_base_hash: 'hBase',
    p_content_hash: 'hLocal',
  }));
  expect(state.markMemoSynced).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'hLocal');
  expect(state.applyRemoteMemo).not.toHaveBeenCalled();
  expect(result.syncedCount).toBe(1);
});

it('adopts the canonical server version on conflict (local edit preserved server-side as a copy)', async () => {
  const state = makeState(makeMemo());
  getState.mockReturnValue(state);
  rpc.mockResolvedValue({
    data: [{ status: 'conflict', content: 'server wins', content_hash: 'hServer', conflict_copy_id: 'copy-1' }],
    error: null,
  });

  await syncPendingMemos();

  expect(state.applyRemoteMemo).toHaveBeenCalledWith(
    '11111111-1111-1111-1111-111111111111',
    'server wins',
    'hServer',
    'general',
  );
  expect(state.markMemoSynced).not.toHaveBeenCalled();
});

it('stops re-pushing a memo deleted on another device (delete-wins)', async () => {
  const state = makeState(makeMemo());
  getState.mockReturnValue(state);
  rpc.mockResolvedValue({ data: [{ status: 'deleted', content: null, content_hash: null }], error: null });

  await syncPendingMemos();

  expect(state.markMemoSynced).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'hLocal');
  expect(state.applyRemoteMemo).not.toHaveBeenCalled();
});

it('marks the memo failed when the rpc errors (stays pending for retry)', async () => {
  const state = makeState(makeMemo());
  getState.mockReturnValue(state);
  rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

  await syncPendingMemos();

  expect(state.markMemoSyncFailed).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  expect(state.markMemoSynced).not.toHaveBeenCalled();
});
