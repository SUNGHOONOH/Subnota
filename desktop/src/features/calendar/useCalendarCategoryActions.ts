import type { Dispatch, SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import { createUuid } from '../../lib/contentHash';
import { DEFAULT_CALENDAR_COLOR, saveCalendarCategories } from './calendarCategories';
import type {
  CalendarBlockDraft,
  CalendarBlockRow,
  CalendarCategoryDraft,
  CalendarCategoryRow,
} from '../../types';

interface UseCalendarCategoryActionsOptions {
  calendarBlocks: CalendarBlockRow[];
  calendarCategories: CalendarCategoryRow[];
  saveCalendarBlock: (draft: CalendarBlockDraft) => Promise<boolean>;
  session: Session | null;
  setCalendarCategories: Dispatch<SetStateAction<CalendarCategoryRow[]>>;
}

export const useCalendarCategoryActions = ({
  calendarBlocks,
  calendarCategories,
  saveCalendarBlock,
  session,
  setCalendarCategories,
}: UseCalendarCategoryActionsOptions) => {
  const saveCalendarCategory = async (draft: CalendarCategoryDraft) => {
    const name = draft.name.trim();
    if (!name) return null;

    const category: CalendarCategoryRow = {
      color: draft.color,
      id: createUuid(),
      name,
    };
    const nextCategories = [...calendarCategories, category].sort((a, b) =>
      a.name.localeCompare(b.name, 'ko'),
    );
    setCalendarCategories(nextCategories);
    saveCalendarCategories(session?.user.id ?? null, nextCategories);
    return category;
  };

  const deleteCalendarCategory = async (categoryId: string) => {
    if (!calendarCategories.some((category) => category.id === categoryId)) {
      return false;
    }
    const saved = await Promise.all(
      calendarBlocks
        .filter((block) => block.category_id === categoryId)
        .map((block) =>
          saveCalendarBlock({
            allDay: Boolean(block.all_day),
            categoryId: null,
            color: DEFAULT_CALENDAR_COLOR,
            endDate: block.end_date,
            id: block.id,
            note: block.note,
            order: block.order ?? 0,
            startDate: block.start_date,
            title: block.title,
          }),
        ),
    );
    if (saved.some((result) => !result)) return false;

    const nextCategories = calendarCategories.filter(
      (category) => category.id !== categoryId,
    );
    setCalendarCategories(nextCategories);
    saveCalendarCategories(session?.user.id ?? null, nextCategories);
    return true;
  };

  return { deleteCalendarCategory, saveCalendarCategory };
};
