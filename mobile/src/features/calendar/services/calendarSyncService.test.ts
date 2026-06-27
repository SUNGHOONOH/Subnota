import { syncPendingCalendarBricks } from './calendarSyncService';
import { supabase } from '../../../shared/supabase/client';
import { useMemoStore } from '../../../store/useMemoStore';

jest.mock('../../../shared/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('../../../store/useMemoStore', () => ({
  useMemoStore: { getState: jest.fn() },
}));

const getUser = supabase.auth.getUser as jest.Mock;
const from = supabase.from as jest.Mock;
const getState = useMemoStore.getState as unknown as jest.Mock;

const makeBrick = (patch: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  day: 5,
  note: 'note',
  order: 2,
  scheduledAt: Date.UTC(2026, 5, 26, 0, 0, 0),
  syncStatus: 'pending' as const,
  time: null,
  title: 'calendar block',
  tone: 'olive' as const,
  ...patch,
});

const makeState = () => ({
  markCalendarBrickSyncFailed: jest.fn(),
  markCalendarBrickSynced: jest.fn(),
  purgeCalendarBrick: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

it('upserts pending calendar bricks with the full calendar_blocks payload', async () => {
  const state = makeState();
  const upsert = jest.fn().mockResolvedValue({ error: null });
  getState.mockReturnValue(state);
  from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { upsert: jest.fn().mockResolvedValue({ error: null }) };
    }
    return { upsert };
  });

  const result = await syncPendingCalendarBricks([makeBrick()]);

  expect(upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      all_day: true,
      all_day_date: '2026-06-26',
      completed_at: null,
      id: '11111111-1111-4111-8111-111111111111',
      is_completed: false,
      start_date: '2026-06-26T00:00:00.000Z',
      time_zone: expect.any(String),
      user_id: 'user-1',
    }),
    { onConflict: 'id' },
  );
  expect(state.markCalendarBrickSynced).toHaveBeenCalledWith(
    '11111111-1111-4111-8111-111111111111',
    expect.any(String),
  );
  expect(result.syncedCount).toBe(1);
});
