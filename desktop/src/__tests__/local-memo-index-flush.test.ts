import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/search/useLocalMemoIndexFlush.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('local memo index flush boundary', () => {
  it('keeps the App integration as a hook wiring boundary', () => {
    expect(appSource).toContain(
      "import { useLocalMemoIndexFlush } from './features/search/useLocalMemoIndexFlush';",
    );
    expect(appSource).toContain('useLocalMemoIndexFlush({');
    expect(appSource).not.toContain('await reconcileLocalMemoIndex(');
  });

  it('waits for only the selected memo writes before indexing', () => {
    expect(source).toContain('pendingLocalMemoWritePromisesRef.current');
    expect(source).toContain('.filter(([memoId]) => !selectedIds || selectedIds.has(memoId))');
    expect(source).toContain('await Promise.all(pendingWrites);');
    expect(source).toContain('memosRef.current.filter(');
  });

  it('keeps the embedding model gate for visible indexing requests', () => {
    expect(source).toContain('window.electronAPI?.localEmbedStatus?.()');
    expect(source).toContain('if (!modelStatus?.ready)');
    expect(source).toContain('if (isVisible) setEmbeddingGateOpen(true);');
    expect(source).toContain('return false;');
  });

  it('preserves the owner-aware reconcile call and explicit user wrapper', () => {
    expect(source).toContain('reconcileLocalMemoIndex(');
    expect(source).toContain('getLocalWorkspaceOwner(),');
    expect(source).toContain('const flushLocalMemoIndexForUser = useCallback(');
    expect(source).toContain('flushLocalMemoIndex(undefined, true)');
  });

  it('does not render a component or introduce indexing side effects on import', () => {
    expect(source).not.toContain('return <');
    expect(source).not.toContain('useEffect(');
  });
});
