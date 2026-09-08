import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const appSource = read('App.tsx');
const deleteSource = read('features/calendar/useDeleteCalendarBlock.ts');

describe('calendar block deletion boundary', () => {
  it('keeps App with deletion wiring and removes the mutation body', () => {
    expect(appSource).toContain(
      "import { useDeleteCalendarBlock } from './features/calendar/useDeleteCalendarBlock';",
    );
    expect(appSource).toContain(
      'const { removeCalendarBlock } = useDeleteCalendarBlock({',
    );
    expect(appSource).not.toContain(
      'const removeCalendarBlock = async (blockId: string) => {',
    );
  });

  it('preserves confirmation and optimistic local tombstone writes', () => {
    expect(deleteSource).toContain(
      "window.confirm(t('블럭을 삭제하시겠습니까?', 'Delete this event?'))",
    );
    expect(deleteSource).toContain('setCalendarBlocks((previous) =>');
    expect(deleteSource).toContain(
      "markLocalCalendarBlockDeleted(blockId, 'pending_delete', ownerId)",
    );
    expect(deleteSource).toContain('localDeletePersisted = true');
  });

  it('keeps remote deletion behind the existing keyed queue and latest guards', () => {
    expect(deleteSource).toContain('calendarMutationQueueRef.current.enqueue(');
    expect(deleteSource).toContain('await localDeletePromise;');
    expect(deleteSource).toContain('await deleteCalendarBlock(currentSession, blockId);');
    expect(deleteSource).toContain('if (!isLatest()) return;');
    expect(deleteSource).toContain('await removeLocalCalendarBlock(blockId, ownerId);');
  });

  it('restores the row and alerts when local persistence fails', () => {
    expect(deleteSource).toContain('restoreAfterLocalDeleteFailure');
    expect(deleteSource).toContain('Could not delete the event.');
    expect(deleteSource).toContain('if (existingBlock) {');
  });

  it('keeps a persisted tombstone retryable when Cloud deletion fails', () => {
    expect(deleteSource).toContain(
      "await markLocalCalendarBlockDeleted(\n            blockId,\n            'pending_delete',",
    );
    expect(deleteSource).toContain(
      "if (!localDeletePersisted) {\n            restoreAfterLocalDeleteFailure();",
    );
  });
});
