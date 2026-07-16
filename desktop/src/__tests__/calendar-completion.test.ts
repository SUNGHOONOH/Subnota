import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.fn(() => ({
  select: () => ({
    single: () => Promise.resolve({ data: { id: 'b1', is_completed: true }, error: null }),
  }),
}));
vi.mock('../services/supabase/client', () => ({
  supabase: { from: () => ({ upsert: (...args: unknown[]) => upsert(...args) }) },
}));

import { upsertCalendarBlock } from '../services/supabase/data';

const session = { user: { id: 'user-1' } } as never;
const base = {
  allDay: false,
  color: '#66705A',
  id: 'b1',
  note: null,
  order: 0,
  startDate: '2026-06-25T09:00:00.000Z',
  title: '운동',
};

beforeEach(() => {
  upsert.mockClear();
});

describe('upsertCalendarBlock (completion is preserved, not reset)', () => {
  it('sends the completion through to the server instead of hardcoding false', async () => {
    await upsertCalendarBlock(session, {
      ...base,
      isCompleted: true,
      completedAt: '2026-06-25T10:00:00.000Z',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'b1',
        is_completed: true,
        completed_at: '2026-06-25T10:00:00.000Z',
      }),
      expect.anything(),
    );
  });

  it('defaults to not-completed with a null timestamp when completion is omitted', async () => {
    await upsertCalendarBlock(session, base);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_completed: false, completed_at: null }),
      expect.anything(),
    );
  });
});
