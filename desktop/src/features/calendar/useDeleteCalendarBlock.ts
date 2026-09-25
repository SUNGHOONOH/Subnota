import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  markLocalCalendarBlockDeleted,
  removeLocalCalendarBlock,
} from '../../services/local/offlineStore';
import { deleteCalendarBlock } from '../../services/supabase/data';
import type { CalendarBlockRow } from '../../types';

interface CalendarMutationQueueRef {
  current: {
    enqueue: (
      key: string,
      action: (options: { isLatest: () => boolean }) => Promise<void>,
    ) => Promise<void>;
  };
}

interface UseDeleteCalendarBlockOptions {
  calendarBlocks: CalendarBlockRow[];
  calendarMutationQueueRef: MutableRefObject<CalendarMutationQueueRef['current']>;
  isCurrentSession: (expectedSession: Session) => boolean;
  session: Session | null;
  setCalendarBlocks: Dispatch<SetStateAction<CalendarBlockRow[]>>;
  t: (korean: string, english: string) => string;
  trackCalendarLocalWrite: <T>(promise: Promise<T>) => Promise<T>;
}

export const useDeleteCalendarBlock = ({
  calendarBlocks,
  calendarMutationQueueRef,
  isCurrentSession,
  session,
  setCalendarBlocks,
  t,
  trackCalendarLocalWrite,
}: UseDeleteCalendarBlockOptions) => {
  const removeCalendarBlock = async (blockId: string) => {
    if (!window.confirm(t('블럭을 삭제하시겠습니까?', 'Delete this event?'))) {
      return;
    }

    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const existingBlock = calendarBlocks.find((block) => block.id === blockId);
    setCalendarBlocks((previous) =>
      previous.filter((block) => block.id !== blockId),
    );
    let localDeletePersisted = false;
    const localDeletePromise = trackCalendarLocalWrite(
      markLocalCalendarBlockDeleted(blockId, 'pending_delete', ownerId),
    ).then(() => {
      localDeletePersisted = true;
    });
    const restoreAfterLocalDeleteFailure = () => {
      if (existingBlock && currentSession && isCurrentSession(currentSession)) {
        setCalendarBlocks((previous) =>
          previous.some((block) => block.id === blockId)
            ? previous
            : [...previous, existingBlock],
        );
      }
      window.alert(
        t(
          '일정을 삭제하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
          'Could not delete the event.\nCheck that this device has enough storage, then try again.',
        ),
      );
    };

    if (!currentSession) {
      try {
        await localDeletePromise;
      } catch {
        if (existingBlock) {
          setCalendarBlocks((previous) =>
            previous.some((block) => block.id === blockId)
              ? previous
              : [...previous, existingBlock],
          );
        }
        window.alert(
          t(
            '일정을 삭제하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
            'Could not delete the event.\nCheck that this device has enough storage, then try again.',
          ),
        );
      }
      return;
    }

    void calendarMutationQueueRef.current.enqueue(
      blockId,
      async ({ isLatest }) => {
        try {
          await localDeletePromise;
          if (!isLatest()) return;
          await deleteCalendarBlock(currentSession, blockId);
          if (!isLatest()) return;
          await removeLocalCalendarBlock(blockId, ownerId);
        } catch {
          if (!isLatest()) return;
          if (!localDeletePersisted) {
            restoreAfterLocalDeleteFailure();
            return;
          }
          await markLocalCalendarBlockDeleted(
            blockId,
            'pending_delete',
            ownerId,
          ).catch(() => undefined);
          if (!isLatest()) return;
        }
      },
    );
    await localDeletePromise.catch(() => undefined);
  };

  return { removeCalendarBlock };
};
