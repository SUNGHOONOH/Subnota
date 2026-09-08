import type { MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';

import { DEFAULT_CALENDAR_COLOR } from './calendarCategories';
import {
  loadLocalCalendarBlocks,
  removeLocalCalendarBlock,
  upsertLocalCalendarBlock,
} from '../../services/local/offlineStore';
import {
  deleteCalendarBlock,
  upsertCalendarBlock,
} from '../../services/supabase/data';

interface CalendarMutationQueueRef {
  current: {
    enqueue: (
      key: string,
      action: (options: { isLatest: () => boolean }) => Promise<void>,
    ) => Promise<void>;
  };
}

/**
 * Registers every pending calendar mutation at startup. A slow row must not
 * block later edits for another id, and a failed row remains retryable.
 */
export const syncPendingCalendarBlocks = async (
  currentSession: Session,
  ownerId: string,
  calendarMutationQueueRef: MutableRefObject<CalendarMutationQueueRef['current']>,
) => {
  const pendingCalendarBlocks = (
    await loadLocalCalendarBlocks(ownerId)
  ).filter(
    (block) =>
      block.local_sync_status && block.local_sync_status !== 'synced',
  );

  await Promise.all(
    pendingCalendarBlocks.map((block) =>
      calendarMutationQueueRef.current.enqueue(
        block.id,
        async ({ isLatest }) => {
          if (!isLatest()) return;
          if (block.local_sync_status === 'pending_delete') {
            await deleteCalendarBlock(currentSession, block.id);
            if (!isLatest()) return;
            await removeLocalCalendarBlock(block.id, ownerId);
            return;
          }

          if (
            block.local_sync_status &&
            block.local_sync_status !== 'synced'
          ) {
            const savedBlock = await upsertCalendarBlock(currentSession, {
              allDay: Boolean(block.all_day),
              categoryId: block.category_id ?? null,
              color: block.color ?? DEFAULT_CALENDAR_COLOR,
              completedAt: block.completed_at ?? null,
              endDate: block.end_date,
              id: block.id,
              isCompleted: Boolean(block.is_completed),
              note: block.note,
              order: block.order ?? 0,
              startDate: block.start_date,
              title: block.title,
            });
            if (!isLatest()) return;
            await upsertLocalCalendarBlock(savedBlock, 'synced', ownerId);
          }
        },
      ).catch((error) => {
        // Keep this row pending while allowing unrelated records and the rest
        // of the workspace to finish syncing.
        console.warn(
          'Pending calendar sync failed; keeping it for retry.',
          error,
        );
      }),
    ),
  );
};
