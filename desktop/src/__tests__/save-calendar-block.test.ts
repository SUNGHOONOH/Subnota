import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const saveSource = readFileSync(
  resolve(__dirname, '../features/calendar/useSaveCalendarBlock.ts'),
  'utf8',
);

describe('calendar block save boundary', () => {
  it('keeps App with save callback wiring and removes the mutation body', () => {
    expect(appSource).toContain(
      "import { useSaveCalendarBlock } from './features/calendar/useSaveCalendarBlock';",
    );
    expect(appSource).toContain(
      'const { saveCalendarBlock } = useSaveCalendarBlock({',
    );
    expect(appSource).not.toContain(
      'const saveCalendarBlock = async (draft: CalendarBlockDraft) =>',
    );
  });

  it('preserves event identity, local date, duration, and title normalization', () => {
    expect(saveSource).toContain('const id = draft.id ?? createUuid();');
    expect(saveSource).toContain(
      'all_day_date: draft.allDay ? toLocalCalendarDate(draft.startDate) : null,',
    );
    expect(saveSource).toContain(
      'const fallbackEndDate = new Date(startMs + 60 * 60 * 1000).toISOString();',
    );
    expect(saveSource).toContain("title: draft.title.trim() || t('새 일정', 'New event'),");
  });

  it('keeps optimistic local-first persistence for signed-out and signed-in users', () => {
    const optimistic = saveSource.indexOf('setCalendarBlocks((previous) =>');
    const localWrite = saveSource.indexOf(
      "upsertLocalCalendarBlock(localBlock, 'pending', ownerId)",
    );
    const signedOutBranch = saveSource.indexOf('if (!currentSession) {');
    const remoteQueue = saveSource.indexOf(
      'calendarMutationQueueRef.current.enqueue(id, async ({ isLatest }) =>',
    );

    expect(optimistic).toBeGreaterThanOrEqual(0);
    expect(optimistic).toBeLessThan(localWrite);
    expect(localWrite).toBeLessThan(signedOutBranch);
    expect(signedOutBranch).toBeLessThan(remoteQueue);
  });

  it('keeps remote updates behind the keyed queue and latest/session guards', () => {
    expect(saveSource).toContain('await localPersistPromise;');
    expect(saveSource).toContain('await upsertCalendarBlock(currentSession, {');
    expect(saveSource).toContain("await upsertLocalCalendarBlock(block, 'synced', ownerId);");
    expect(saveSource.match(/if \(!isLatest\(\)\) return;/g)).toHaveLength(5);
    expect(saveSource).toContain('if (!isCurrentSession(currentSession)) return;');
  });

  it('marks failed local sync and alerts when the durable local write fails', () => {
    expect(saveSource).toContain("await upsertLocalCalendarBlock(localBlock, 'failed', ownerId)");
    expect(saveSource).toContain("local_sync_status: 'failed'");
    expect(saveSource).toContain('Could not save the event.');
    expect(saveSource).toContain('기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.');
  });
});
