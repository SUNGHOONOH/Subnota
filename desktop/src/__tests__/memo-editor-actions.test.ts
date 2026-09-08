import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const actionSource = readFileSync(
  resolve(__dirname, '../features/memo/useMemoEditorActions.ts'),
  'utf8',
);

describe('memo editor actions boundary', () => {
  it('keeps App with editor callback wiring and removes the editor action bodies', () => {
    expect(appSource).toContain(
      "import { useMemoEditorActions } from './features/memo/useMemoEditorActions';",
    );
    expect(appSource).toContain('} = useMemoEditorActions({');
    expect(appSource).not.toContain(
      'const changeMemoDraft = (value: string, previousEditorContent?: string) =>',
    );
    expect(appSource).not.toContain(
      'const createMemoFromContent = (\n    content: string,',
    );
  });

  it('creates a draft identity only when the first non-empty input arrives', () => {
    expect(actionSource).toContain('let memoId = activeMemoIdRef.current;');
    expect(actionSource).toContain('if (!memoId && value.trim()) {');
    expect(actionSource).toContain('activeMemoIdRef.current = memoId;');
    expect(actionSource).toContain('activeMemoCreatedAtRef.current = createdAt;');
  });

  it('clears ambient search state whenever the editor draft changes', () => {
    expect(actionSource).toContain('ambientTargetRef.current = null;');
    expect(actionSource).toContain('setAmbientTarget(null);');
    expect(actionSource).toContain('setAmbientResult(null);');
    expect(actionSource).toContain('setAmbientError(null);');
  });

  it('routes draft changes and ID updates through the shared save boundary', () => {
    expect(actionSource).toContain('saveMemoContent(');
    expect(actionSource).toContain(
      'saveMemoContent(id, content, { category, createdAt })',
    );
    expect(actionSource).toContain(
      'saveMemoContent(id, content, undefined, previousEditorContent);',
    );
  });

  it('rejects empty programmatic notes while preserving the existing user-facing error', () => {
    expect(actionSource).toContain('const memo = saveMemoContent(id, content, { category, createdAt });');
    expect(actionSource).toContain('if (!memo) {');
    expect(actionSource).toContain(
      "t('빈 메모는 생성할 수 없습니다.', 'Cannot create an empty note.')",
    );
    expect(actionSource).toContain('DEFAULT_MEMO_CATEGORY');
  });
});
