import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const actionSource = readFileSync(
  resolve(__dirname, '../features/calendar/useCalendarCategoryActions.ts'),
  'utf8',
);

describe('calendar category actions boundary', () => {
  it('keeps App with category callback wiring and removes both action bodies', () => {
    expect(appSource).toContain(
      "import { useCalendarCategoryActions } from './features/calendar/useCalendarCategoryActions';",
    );
    expect(appSource).toContain(
      'const { deleteCalendarCategory, saveCalendarCategory } =',
    );
    expect(appSource).not.toContain(
      'const saveCalendarCategory = async (draft: CalendarCategoryDraft) =>',
    );
    expect(appSource).not.toContain(
      'const deleteCalendarCategory = async (categoryId: string) =>',
    );
  });

  it('trims names, rejects empty categories, and keeps alphabetical ordering', () => {
    expect(actionSource).toContain('const name = draft.name.trim();');
    expect(actionSource).toContain('if (!name) return null;');
    expect(actionSource).toContain(
      "a.name.localeCompare(b.name, 'ko')",
    );
    expect(actionSource).toContain('id: createUuid(),');
  });

  it('persists the optimistic category list for the current account', () => {
    expect(actionSource).toContain('setCalendarCategories(nextCategories);');
    expect(actionSource).toContain(
      'saveCalendarCategories(session?.user.id ?? null, nextCategories);',
    );
    expect(actionSource).toContain('return category;');
  });

  it('reassigns category blocks through the existing save action before removal', () => {
    const reassign = actionSource.indexOf('const saved = await Promise.all(');
    const saveBlock = actionSource.indexOf('saveCalendarBlock({', reassign);
    const removeCategory = actionSource.indexOf(
      'const nextCategories = calendarCategories.filter(',
    );

    expect(reassign).toBeGreaterThanOrEqual(0);
    expect(saveBlock).toBeGreaterThan(reassign);
    expect(removeCategory).toBeGreaterThan(saveBlock);
    expect(actionSource).toContain('categoryId: null,');
    expect(actionSource).toContain('color: DEFAULT_CALENDAR_COLOR,');
  });

  it('does not remove a category when any dependent block save fails', () => {
    expect(actionSource).toContain(
      'if (saved.some((result) => !result)) return false;',
    );
    expect(actionSource).toContain('return true;');
  });
});
