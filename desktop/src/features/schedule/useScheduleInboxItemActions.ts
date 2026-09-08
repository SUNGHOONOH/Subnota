import { type Dispatch, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  defaultCalendarEndDate,
} from '../calendar/calendarUtils';
import { DEFAULT_CALENDAR_COLOR } from '../calendar/calendarCategories';
import { toValidDate } from '../../lib/viewCrashGuards';
import {
  removeLocalScheduleInboxAction,
  removeLocalScheduleInboxItem,
  upsertLocalScheduleInboxAction,
} from '../../services/local/offlineStore';
import { updateScheduleInboxStatus } from '../../services/supabase/data';
import type {
  CalendarBlockDraft,
  ScheduleInboxRow,
} from '../../types';

interface ScheduleInboxOverrides {
  allDay?: boolean;
  note?: string | null;
  startDate?: Date;
  title?: string;
}

interface UseScheduleInboxItemActionsOptions {
  isCurrentSession: (expectedSession: Session) => boolean;
  saveCalendarBlock: (
    draft: CalendarBlockDraft,
  ) => Promise<boolean | undefined>;
  scheduleInbox: ScheduleInboxRow[];
  session: Session | null;
  setScheduleInbox: Dispatch<SetStateAction<ScheduleInboxRow[]>>;
}

export const useScheduleInboxItemActions = ({
  isCurrentSession,
  saveCalendarBlock,
  scheduleInbox,
  session,
  setScheduleInbox,
}: UseScheduleInboxItemActionsOptions) => {
  const placeScheduleInboxItem = async (
    item: ScheduleInboxRow,
    overrides: ScheduleInboxOverrides = {},
  ) => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    const start = overrides.startDate ?? toValidDate(item.scheduled_at);
    if (!start) {
      return;
    }
    const allDay = overrides.allDay ?? Boolean(item.all_day);

    const saved = await saveCalendarBlock({
      allDay,
      color: DEFAULT_CALENDAR_COLOR,
      endDate: allDay ? null : defaultCalendarEndDate(start).toISOString(),
      note: overrides.note ?? item.source_text,
      startDate: start.toISOString(),
      title: overrides.title ?? item.title,
    });
    if (!saved) return;
    await upsertLocalScheduleInboxAction(
      item.id,
      'accepted',
      currentSession.user.id,
    );
    await removeLocalScheduleInboxItem(item.id, currentSession.user.id);
    if (!isCurrentSession(currentSession)) {
      return;
    }
    setScheduleInbox((previous) =>
      previous.filter((inbox) => inbox.id !== item.id),
    );
    void updateScheduleInboxStatus(currentSession, item.id, 'accepted')
      .then(() =>
        removeLocalScheduleInboxAction(item.id, currentSession.user.id),
      )
      .catch(() => undefined);
  };

  const deleteScheduleInboxItem = async (item: ScheduleInboxRow) => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    await upsertLocalScheduleInboxAction(
      item.id,
      'dismissed',
      currentSession.user.id,
    );
    await removeLocalScheduleInboxItem(item.id, currentSession.user.id);
    if (!isCurrentSession(currentSession)) {
      return;
    }
    setScheduleInbox((previous) =>
      previous.filter((inbox) => inbox.id !== item.id),
    );
    void updateScheduleInboxStatus(currentSession, item.id, 'dismissed')
      .then(() =>
        removeLocalScheduleInboxAction(item.id, currentSession.user.id),
      )
      .catch(() => undefined);
  };

  const dropScheduleInboxItem = (itemId: string, startDate: Date) => {
    const item = scheduleInbox.find((candidate) => candidate.id === itemId);
    if (item) {
      void placeScheduleInboxItem(item, { allDay: false, startDate });
    }
  };

  return {
    deleteScheduleInboxItem,
    dropScheduleInboxItem,
    placeScheduleInboxItem,
  };
};
