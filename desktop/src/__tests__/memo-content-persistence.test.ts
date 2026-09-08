import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const persistenceSource = readFileSync(
  resolve(__dirname, '../features/memo/useMemoContentPersistence.ts'),
  'utf8',
);

describe('Memo content persistence boundary', () => {
  it('keeps App as the editor wiring boundary', () => {
    expect(appSource).toContain(
      "import { useMemoContentPersistence } from './features/memo/useMemoContentPersistence';",
    );
    expect(appSource).toContain(
      'const { saveMemoContent } = useMemoContentPersistence({',
    );
    expect(appSource).not.toContain('const saveMemoContent = (');
  });

  it('rejects empty drafts and ignores writes during quit or deletion', () => {
    expect(persistenceSource).toContain('if (isPreparingToQuitRef.current)');
    expect(persistenceSource).toContain(
      'if (deletingMemoIdsRef.current.has(id))',
    );
    expect(persistenceSource).toContain(
      "if (!existingMemo && !content.trim() && !allowEmpty)",
    );
  });

  it('rebases editor input against the canonical memo before persisting', () => {
    expect(persistenceSource).toContain(
      'rebaseEditorChangeOntoCanonical(',
    );
    expect(persistenceSource).toContain(
      'preserveLocalMemoRecovery(',
    );
    expect(persistenceSource.indexOf('rebaseEditorChangeOntoCanonical(')).toBeLessThan(
      persistenceSource.indexOf('createLocalMemoRow('),
    );
  });

  it('updates the ref and React snapshot before the asynchronous local write', () => {
    const refUpdate = persistenceSource.indexOf(
      'memosRef.current = mergeLocalMemo(memosRef.current);',
    );
    const reactUpdate = persistenceSource.indexOf(
      'setMemos((previous) => mergeLocalMemo(previous));',
    );
    const localWrite = persistenceSource.indexOf(
      'persistLocalMemoEventually(localMemo, ownerId)',
    );

    expect(refUpdate).toBeGreaterThanOrEqual(0);
    expect(reactUpdate).toBeGreaterThan(refUpdate);
    expect(localWrite).toBeGreaterThan(reactUpdate);
  });

  it('only clears the latest revision and schedules cloud sync for the current owner', () => {
    expect(persistenceSource).toContain(
      'memoLocalWriteRevisionsRef.current.get(id) !== localRevision',
    );
    expect(persistenceSource).toContain(
      'getLocalWorkspaceOwner() !== (ownerId ?? null)',
    );
    expect(persistenceSource).toContain('scheduleMemoCloudSync(currentSession, {');
    expect(persistenceSource).toContain(
      'pendingLocalMemoWritePromisesRef.current.get(id) === localWritePromise',
    );
  });
});
