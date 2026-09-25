import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const appSource = read('App.tsx');
const completionSource = read('features/calendar/useCalendarCompletionActions.ts');

describe('calendar completion action boundary', () => {
  it('keeps App with completion callback wiring and removes the growth body', () => {
    expect(appSource).toContain(
      "import { useCalendarCompletionActions } from './features/calendar/useCalendarCompletionActions';",
    );
    expect(appSource).toContain(
      'const { toggleCalendarBlockCompleted } = useCalendarCompletionActions({',
    );
    expect(appSource).not.toContain(
      'const recordGrowthOnComplete = async (',
    );
  });

  it('records activity and daily growth locally before best-effort Cloud delivery', () => {
    expect(completionSource).toContain('loadLocalActivityCompletions(ownerId)');
    expect(completionSource).toContain(
      "upsertLocalActivityCompletionEventually(record, 'pending', ownerId)",
    );
    expect(completionSource).toContain('isDayComplete(dayBlocks)');
    expect(completionSource).toContain(
      "upsertLocalDailyCompletionEventually(record, 'pending', ownerId)",
    );
    expect(completionSource).toContain('recordActivityCompletion(currentSession, activityToSync)');
    expect(completionSource).toContain('recordDailyCompletion(currentSession, dailyToSync)');
  });

  it('keeps completion optimistic and tracks durable local writes', () => {
    expect(completionSource).toContain('const updated: CalendarBlockRow = {');
    expect(completionSource).toContain('local_sync_status: \'pending\'');
    expect(completionSource).toContain('setCalendarBlocks((previous) =>');
    expect(completionSource).toContain('trackCalendarLocalWrite(');
    expect(completionSource).toContain('await localPersistPromise.catch(() => undefined);');
  });

  it('preserves keyed remote mutation and stale-result guards', () => {
    expect(completionSource).toContain('calendarMutationQueueRef.current.enqueue(');
    expect(completionSource.match(/if \(!isLatest\(\)\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(completionSource).toContain('if (!isCurrentSession(currentSession)) return;');
    expect(completionSource).toContain("await upsertLocalCalendarBlock(block, 'synced', ownerId);");
  });

  it('preserves local failure recovery and user-facing alerts', () => {
    expect(completionSource).toContain("await upsertLocalCalendarBlock(updated, 'failed', ownerId)");
    expect(completionSource).toContain('Could not save the completion.');
    expect(completionSource).toContain('Could not save the event.');
  });
});
