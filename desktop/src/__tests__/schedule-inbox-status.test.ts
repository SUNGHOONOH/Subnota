import { describe, expect, it } from 'vitest';

import { updateScheduleInboxStatus } from '../services/supabase/data';

describe('schedule inbox status updates', () => {
  it('does not send development-only non-UUID ids to PostgREST', async () => {
    await expect(
      updateScheduleInboxStatus(
        { user: { id: 'user-1' } } as never,
        'sample-schedule-001',
        'dismissed',
      ),
    ).resolves.toBeUndefined();
  });
});
