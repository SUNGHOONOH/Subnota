import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { DEFAULT_CALENDAR_COLOR } from './calendarCategories';
import {
  blockLocalDate,
  blocksForLocalDate,
  isDayComplete,
} from '../report/dayCompletion';
import { createUuid } from '../../lib/contentHash';
import {
  loadLocalActivityCompletions,
  loadLocalDailyCompletions,
  upsertLocalActivityCompletion,
  upsertLocalActivityCompletionEventually,
  upsertLocalCalendarBlock,
  upsertLocalDailyCompletion,
  upsertLocalDailyCompletionEventually,
} from '../../services/local/offlineStore';
import {
  recordActivityCompletion,
  recordDailyCompletion,
  upsertCalendarBlock,
} from '../../services/supabase/data';
import type { ActivityCompletion, DailyCompletion } from '../report/growthTypes';
import type { CalendarBlockRow } from '../../types';

interface CalendarMutationQueueRef {
  current: {
    enqueue: (
      key: string,
      action: (options: { isLatest: () => boolean }) => Promise<void>,
    ) => Promise<void>;
  };
}

interface UseCalendarCompletionActionsOptions {
  calendarBlocks: CalendarBlockRow[];
  calendarMutationQueueRef: MutableRefObject<CalendarMutationQueueRef['current']>;
  isCurrentSession: (expectedSession: Session) => boolean;
  session: Session | null;
  sessionRef: MutableRefObject<Session | null>;
  setActivityCompletions: Dispatch<SetStateAction<ActivityCompletion[]>>;
  setCalendarBlocks: Dispatch<SetStateAction<CalendarBlockRow[]>>;
  t: (korean: string, english: string) => string;
  trackCalendarLocalWrite: <T>(promise: Promise<T>) => Promise<T>;
}

export const useCalendarCompletionActions = ({
  calendarBlocks,
  calendarMutationQueueRef,
  isCurrentSession,
  session,
  sessionRef,
  setActivityCompletions,
  setCalendarBlocks,
  t,
  trackCalendarLocalWrite,
}: UseCalendarCompletionActionsOptions) => {
  // Permanent growth events: recorded the first time a block is completed and
  // when a whole day becomes complete. Local-first (works offline); the cloud
  // insert is best-effort and idempotent. Never removed on uncomplete/delete.
  const recordGrowthOnComplete = async (
    block: CalendarBlockRow,
    nextBlocks: CalendarBlockRow[],
  ) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const now = new Date().toISOString();
    const localDate = blockLocalDate(block);

    let pendingActivity: ActivityCompletion | null = null;
    const activity = await loadLocalActivityCompletions(ownerId);
    if (!activity.some((item) => item.calendar_block_id === block.id)) {
      const record = {
        id: createUuid(),
        calendar_block_id: block.id,
        completed_at: now,
        local_date: localDate,
      };
      await upsertLocalActivityCompletionEventually(record, 'pending', ownerId);
      pendingActivity = record;
      if ((sessionRef.current?.user.id ?? null) === (ownerId ?? null)) {
        setActivityCompletions((previous) =>
          previous.some(
            (item) => item.calendar_block_id === record.calendar_block_id,
          )
            ? previous
            : [...previous, record],
        );
      }
    }

    let pendingDaily: DailyCompletion | null = null;
    const dayBlocks = blocksForLocalDate(nextBlocks, localDate);
    if (isDayComplete(dayBlocks)) {
      const daily = await loadLocalDailyCompletions(ownerId);
      if (!daily.some((item) => item.local_date === localDate)) {
        const record = {
          id: createUuid(),
          local_date: localDate,
          completed_at: now,
          todo_count: dayBlocks.length,
        };
        await upsertLocalDailyCompletionEventually(record, 'pending', ownerId);
        pendingDaily = record;
      }
    }

    // The returned promise covers every durable local growth write. Cloud
    // delivery continues as an idempotent outbox and must not hold app quit.
    if (currentSession && pendingActivity) {
      const activityToSync = pendingActivity;
      void recordActivityCompletion(currentSession, activityToSync)
        .then(() =>
          upsertLocalActivityCompletion(activityToSync, 'synced', ownerId),
        )
        .catch(() => undefined);
    }
    if (currentSession && pendingDaily) {
      const dailyToSync = pendingDaily;
      void recordDailyCompletion(currentSession, dailyToSync)
        .then(() => upsertLocalDailyCompletion(dailyToSync, 'synced', ownerId))
        .catch(() => undefined);
    }
  };

  const toggleCalendarBlockCompleted = async (blockId: string) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const existing = calendarBlocks.find((block) => block.id === blockId);
    if (!existing) {
      return;
    }
    const nextCompleted = !existing.is_completed;
    const now = new Date().toISOString();
    const updated: CalendarBlockRow = {
      ...existing,
      is_completed: nextCompleted,
      completed_at: nextCompleted ? now : null,
      local_sync_status: 'pending',
      updated_at: now,
    };

    setCalendarBlocks((previous) =>
      previous.map((block) => (block.id === blockId ? updated : block)),
    );
    const localPersistPromise = trackCalendarLocalWrite(
      upsertLocalCalendarBlock(updated, 'pending', ownerId),
    );

    const nextBlocks = calendarBlocks.map((block) =>
      block.id === blockId ? updated : block,
    );
    if (nextCompleted) {
      const growthPersistPromise = trackCalendarLocalWrite(
        localPersistPromise.then(() =>
          recordGrowthOnComplete(updated, nextBlocks),
        ),
      );
      void growthPersistPromise.catch(() => {
        if ((sessionRef.current?.user.id ?? null) !== (ownerId ?? null)) return;
        window.alert(
          t(
            '완료 표시를 저장하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
            'Could not save the completion.\nCheck that this device has enough storage, then try again.',
          ),
        );
      });
    }
    void calendarMutationQueueRef.current.enqueue(
      blockId,
      async ({ isLatest }) => {
        try {
          await localPersistPromise;
        } catch {
          if (!isLatest()) return;
          if ((sessionRef.current?.user.id ?? null) !== (ownerId ?? null)) {
            return;
          }
          setCalendarBlocks((previous) =>
            previous.map((item) =>
              item.id === blockId && item === updated ? existing : item,
            ),
          );
          window.alert(
            t(
              '일정을 저장하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
              'Could not save the event.\nCheck that this device has enough storage, then try again.',
            ),
          );
          return;
        }
        if (!isLatest()) return;
        if (!currentSession) return;
        try {
          const block = await upsertCalendarBlock(currentSession, {
            allDay: Boolean(updated.all_day),
            categoryId: updated.category_id ?? null,
            color: updated.color ?? DEFAULT_CALENDAR_COLOR,
            id: updated.id,
            isCompleted: nextCompleted,
            completedAt: updated.completed_at,
            endDate: updated.end_date,
            note: updated.note,
            order: updated.order ?? 0,
            startDate: updated.start_date,
            title: updated.title,
          });
          if (!isLatest()) return;
          await upsertLocalCalendarBlock(block, 'synced', ownerId);
          if (!isLatest()) return;
          if (!isCurrentSession(currentSession)) return;
          setCalendarBlocks((previous) =>
            previous.map((item) => (item.id === block.id ? block : item)),
          );
        } catch {
          if (!isLatest()) return;
          await upsertLocalCalendarBlock(updated, 'failed', ownerId).catch(
            () => undefined,
          );
          if (!isLatest()) return;
          if (!isCurrentSession(currentSession)) return;
          setCalendarBlocks((previous) =>
            previous.map((item) =>
              item.id === blockId
                ? { ...item, local_sync_status: 'failed' }
                : item,
            ),
          );
        }
      },
    );
    await localPersistPromise.catch(() => undefined);
  };

  return { toggleCalendarBlockCompleted };
};
