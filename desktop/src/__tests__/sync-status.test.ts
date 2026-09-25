import { describe, expect, it } from 'vitest';

import {
  countFailedSync,
  countPendingSync,
} from '../features/settings/syncStatus';

describe('sync status counts', () => {
  it('counts pending and pending-delete memo/calendar records', () => {
    expect(
      countPendingSync({
        calendarBlocks: [
          { local_sync_status: 'pending' },
          { local_sync_status: 'pending_delete' },
          { local_sync_status: 'synced' },
        ],
        inboxItems: [],
        memos: [
          { local_sync_status: 'pending' },
          { local_sync_status: 'pending_delete' },
        ],
      }),
    ).toBe(4);
  });

  it('keeps inbox pending-delete rows out of the pending count', () => {
    expect(
      countPendingSync({
        calendarBlocks: [],
        inboxItems: [
          { local_sync_status: 'pending_delete' },
          { local_sync_status: 'pending' },
        ],
        memos: [],
      }),
    ).toBe(1);
  });

  it('counts failures consistently across all three data sources', () => {
    expect(
      countFailedSync({
        calendarBlocks: [{ local_sync_status: 'failed' }],
        inboxItems: [
          { local_sync_status: 'failed' },
          { local_sync_status: 'synced' },
        ],
        memos: [{ local_sync_status: 'failed' }],
      }),
    ).toBe(3);
  });
});
