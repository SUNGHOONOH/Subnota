import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../services/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { upsertMemo } from '../services/supabase/data';

const session = { user: { id: 'user-1' } } as never;
const memo = {
  baseHash: 'hBase',
  category: 'general',
  content: 'hello',
  contentUpdatedAt: '2026-01-02T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'm1',
};

beforeEach(() => {
  rpc.mockReset();
});

describe('upsertMemo (optimistic concurrency)', () => {
  it('sends the base hash and returns the canonical memo on a normal update', async () => {
    rpc.mockResolvedValue({ data: [{ content: 'hello', content_hash: 'hNew', status: 'updated' }], error: null });

    const res = await upsertMemo(session, memo);

    expect(rpc).toHaveBeenCalledWith(
      'upsert_memo_if_base_hash',
      expect.objectContaining({ p_base_hash: 'hBase', p_id: 'm1' }),
    );
    expect(res.status).toBe('updated');
    expect(res.memo?.content).toBe('hello');
    expect(res.memo?.synced_content_hash).toBe('hNew');
  });

  it('adopts the server canonical content on conflict', async () => {
    rpc.mockResolvedValue({
      data: [{ conflict_copy_id: 'copy-1', content: 'server wins', content_hash: 'hServer', status: 'conflict' }],
      error: null,
    });

    const res = await upsertMemo(session, memo);

    expect(res.status).toBe('conflict');
    expect(res.memo?.content).toBe('server wins');
    expect(res.memo?.content_hash).toBe('hServer');
    expect(res.memo?.synced_content_hash).toBe('hServer');
  });

  it('returns deleted with a null memo when the id is tombstoned', async () => {
    rpc.mockResolvedValue({ data: [{ content: null, content_hash: null, status: 'deleted' }], error: null });

    const res = await upsertMemo(session, memo);

    expect(res.status).toBe('deleted');
    expect(res.memo).toBeNull();
  });

  it('throws on rpc error so the caller keeps the memo retryable', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(upsertMemo(session, memo)).rejects.toBeTruthy();
  });
});
