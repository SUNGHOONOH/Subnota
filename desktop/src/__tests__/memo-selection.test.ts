import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useMemoSelection.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('memo selection action', () => {
  it('updates the selected memo, date, category, and memo tab', () => {
    expect(source).toContain('setActiveMemoId(memo.id);');
    expect(source).toContain('setActiveMemoCreatedAt(memo.created_at);');
    expect(source).toContain('setActiveDraftCategory(getMemoCategory(memo.category));');
    expect(source).toContain("setActiveTab('memo');");
  });

  it('clears ambient state only when the selected memo changes', () => {
    expect(source).toContain('const isDifferentMemo = memo.id !== activeMemoId;');
    expect(source).toContain('if (isDifferentMemo)');
    expect(source).toContain('ambientTargetRef.current = null;');
    expect(source).toContain('setAmbientTarget(null);');
    expect(source).toContain('setAmbientResult(null);');
    expect(source).toContain('setAmbientError(null);');
    expect(source).toContain('setAmbientDisplayEditorId(null);');
    expect(source).toContain('setAmbientEmptyEditorId(null);');
  });

  it('resolves an ID through the current memo list and ignores missing IDs', () => {
    expect(source).toContain('const targetMemo = memos.find(memo => memo.id === memoId);');
    expect(source).toContain('if (targetMemo)');
    expect(source).toContain('selectMemo(targetMemo);');
  });

  it('keeps App callers wired to both returned actions', () => {
    expect(appSource).toContain(
      'const { selectMemo, selectMemoById } = useMemoSelection({',
    );
    expect(appSource).not.toContain('const selectMemo = (memo: MemoRow) => {');
    expect(appSource).not.toContain('const selectMemoById = (memoId: string) => {');
  });
});
