import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const deleteSource = readFileSync(
  resolve(__dirname, '../features/memo/useDeleteMemo.ts'),
  'utf8',
);

describe('memo deletion boundary', () => {
  it('keeps App with deletion wiring and removes the mutation body', () => {
    expect(appSource).toContain(
      "import { useDeleteMemo } from './features/memo/useDeleteMemo';",
    );
    expect(appSource).toContain(
      'const { deleteMemoById } = useDeleteMemo({',
    );
    expect(appSource).not.toContain(
      'const deleteMemoById = async (id: string) =>',
    );
  });

  it('marks the memo as deleting and removes it optimistically from the view', () => {
    expect(deleteSource).toContain('deletingMemoIdsRef.current.add(id);');
    expect(deleteSource).toContain(
      'memoLocalWriteRevisionsRef.current.set(',
    );
    expect(deleteSource).toContain(
      'setMemos((previous) => previous.filter((memo) => memo.id !== id));',
    );
    expect(deleteSource).toContain('setManualMemoSyncRetryIds((previous) =>');
  });

  it('keeps active memo selection valid after deleting the current memo', () => {
    expect(deleteSource).toContain('if (id === activeMemoId) {');
    expect(deleteSource).toContain('const nextActive = nextMemos[0] ?? null;');
    expect(deleteSource).toContain(
      'setActiveDraftCategory(getMemoCategory(nextActive?.category));',
    );
  });

  it('persists the local tombstone before attempting Cloud archive', () => {
    const tombstone = deleteSource.indexOf(
      "await markLocalMemoDeleted(id, 'pending_delete', ownerId);",
    );
    const archive = deleteSource.indexOf(
      'await archiveMemo(currentSession, id);',
    );

    expect(tombstone).toBeGreaterThanOrEqual(0);
    expect(tombstone).toBeLessThan(archive);
    expect(deleteSource).toContain(
      "await markLocalMemoDeleted(id, 'synced', ownerId);",
    );
  });

  it('restores local state and alerts on durable local failure, while retaining retryable tombstones', () => {
    expect(deleteSource).toContain('const restoreMemo = (previous: MemoRow[]) =>');
    expect(deleteSource).toContain('local-failed');
    expect(deleteSource).toContain('Could not delete the note.');
    expect(deleteSource).toContain(
      "await markLocalMemoDeleted(id, 'pending_delete', ownerId).catch(",
    );
    expect(deleteSource).toContain('deletingMemoIdsRef.current.delete(id);');
  });
});
