import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const appSource = read('App.tsx');
const actionSource = read('features/schedule/useScheduleInboxItemActions.ts');

describe('schedule inbox item action boundary', () => {
  it('keeps App with callback wiring and removes the action bodies', () => {
    expect(appSource).toContain(
      "import { useScheduleInboxItemActions } from './features/schedule/useScheduleInboxItemActions';",
    );
    expect(appSource).toContain(
      'useScheduleInboxItemActions({',
    );
    expect(appSource).not.toContain('const placeScheduleInboxItem = async (');
    expect(appSource).not.toContain('const deleteScheduleInboxItem = async (');
    expect(appSource).not.toContain('const dropScheduleInboxItem = (itemId: string, startDate: Date) => {');
  });

  it('preserves the accepted placement contract and calendar defaults', () => {
    expect(actionSource).toContain('if (!currentSession) {');
    expect(actionSource).toContain('toValidDate(item.scheduled_at)');
    expect(actionSource).toContain('defaultCalendarEndDate(start).toISOString()');
    expect(actionSource).toContain('await saveCalendarBlock({');
    expect(actionSource).toContain("'accepted'");
    expect(actionSource).toContain('setScheduleInbox((previous) =>');
  });

  it('keeps local outbox persistence before remote status updates', () => {
    expect(actionSource).toContain('await upsertLocalScheduleInboxAction(');
    expect(actionSource).toContain('await removeLocalScheduleInboxItem(');
    expect(actionSource).toContain("updateScheduleInboxStatus(currentSession, item.id, 'accepted')");
    expect(actionSource).toContain("removeLocalScheduleInboxAction(item.id, currentSession.user.id)");
  });

  it('preserves dismissal as a separate offline-safe action', () => {
    expect(actionSource).toContain("'dismissed'");
    expect(actionSource).toContain("updateScheduleInboxStatus(currentSession, item.id, 'dismissed')");
  });

  it('keeps calendar drag-and-drop routed through the same placement path', () => {
    expect(actionSource).toContain('const item = scheduleInbox.find');
    expect(actionSource).toContain(
      'void placeScheduleInboxItem(item, { allDay: false, startDate });',
    );
  });
});
