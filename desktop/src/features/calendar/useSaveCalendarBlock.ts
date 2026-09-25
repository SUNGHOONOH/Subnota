import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import { toLocalCalendarDate } from './calendarUtils';
import { createUuid } from '../../lib/contentHash';
import {
  upsertLocalCalendarBlock,
} from '../../services/local/offlineStore';
import { upsertCalendarBlock } from '../../services/supabase/data';
import type { CalendarBlockDraft, CalendarBlockRow } from '../../types';

interface CalendarMutationQueueRef {
  current: {
    enqueue: (
      key: string,
      action: (options: { isLatest: () => boolean }) => Promise<void>,
    ) => Promise<void>;
  };
}

interface UseSaveCalendarBlockOptions {
  calendarBlocks: CalendarBlockRow[];
  calendarMutationQueueRef: MutableRefObject<CalendarMutationQueueRef['current']>;
  isCurrentSession: (expectedSession: Session) => boolean;
  session: Session | null;
  setCalendarBlocks: Dispatch<SetStateAction<CalendarBlockRow[]>>;
  t: (korean: string, english: string) => string;
  trackCalendarLocalWrite: <T>(promise: Promise<T>) => Promise<T>;
}

export const useSaveCalendarBlock = ({
  calendarBlocks,
  calendarMutationQueueRef,
  isCurrentSession,
  session,
  setCalendarBlocks,
  t,
  trackCalendarLocalWrite,
}: UseSaveCalendarBlockOptions) => {
  const saveCalendarBlock = async (draft: CalendarBlockDraft) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const id = draft.id ?? createUuid();
    const now = new Date().toISOString();
    const existingBlock = calendarBlocks.find((block) => block.id === id);
    const startMs = new Date(draft.startDate).getTime();
    const fallbackEndDate = new Date(startMs + 60 * 60 * 1000).toISOString();
    const candidateEndDate =
      draft.endDate ?? existingBlock?.end_date ?? fallbackEndDate;
    const endDate =
      !draft.allDay && new Date(candidateEndDate).getTime() > startMs
        ? candidateEndDate
        : draft.allDay
          ? null
          : fallbackEndDate;
    const localBlock: CalendarBlockRow = {
      all_day: draft.allDay,
      all_day_date: draft.allDay ? toLocalCalendarDate(draft.startDate) : null,
      category_id: draft.categoryId ?? null,
      color: draft.color,
      created_at: existingBlock?.created_at ?? now,
      end_date: endDate,
      id,
      is_completed: existingBlock?.is_completed ?? false,
      completed_at: existingBlock?.completed_at ?? null,
      local_sync_status: 'pending',
      note: draft.note,
      order: draft.order ?? 0,
      start_date: draft.startDate,
      title: draft.title.trim() || t('새 일정', 'New event'),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updated_at: now,
    };

    setCalendarBlocks((previous) => {
      const exists = previous.some((item) => item.id === localBlock.id);
      return exists
        ? previous.map((item) =>
            item.id === localBlock.id ? localBlock : item,
          )
        : [...previous, localBlock];
    });
    const localPersistPromise = trackCalendarLocalWrite(
      upsertLocalCalendarBlock(localBlock, 'pending', ownerId),
    );

    if (!currentSession) {
      try {
        await localPersistPromise;
        return true;
      } catch {
        setCalendarBlocks((previous) =>
          existingBlock
            ? previous.map((item) =>
                item.id === existingBlock.id ? existingBlock : item,
              )
            : previous.filter((item) => item.id !== id),
        );
        window.alert(
          t(
            '일정을 저장하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
            'Could not save the event.\nCheck that this device has enough storage, then try again.',
          ),
        );
        return false;
      }
    }

    void calendarMutationQueueRef.current.enqueue(id, async ({ isLatest }) => {
      try {
        await localPersistPromise;
        if (!isLatest()) return;
        const block = await upsertCalendarBlock(currentSession, {
          ...draft,
          categoryId: localBlock.category_id ?? null,
          endDate: localBlock.end_date,
          id,
          isCompleted: existingBlock?.is_completed ?? false,
          completedAt: existingBlock?.completed_at ?? null,
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
        await upsertLocalCalendarBlock(localBlock, 'failed', ownerId).catch(
          () => undefined,
        );
        if (!isLatest()) return;
        if (!isCurrentSession(currentSession)) return;
        setCalendarBlocks((previous) =>
          previous.map((item) =>
            item.id === id ? { ...item, local_sync_status: 'failed' } : item,
          ),
        );
      }
    });
    try {
      await localPersistPromise;
      return true;
    } catch {
      window.alert(
        t(
          '일정을 저장하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
          'Could not save the event.\nCheck that this device has enough storage, then try again.',
        ),
      );
      return false;
    }
  };

  return { saveCalendarBlock };
};
