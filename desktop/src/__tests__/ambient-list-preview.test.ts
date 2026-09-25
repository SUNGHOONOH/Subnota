import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const source = read('features/search/useAmbientListPreview.ts');
const appSource = read('App.tsx');

describe('ambient list preview action', () => {
  it('does nothing without a target and waits for the visible index flush', () => {
    expect(source).toContain('const target = ambientTarget;');
    expect(source).toContain('if (!target) return;');
    expect(source).toContain('const indexed = await flushLocalMemoIndexForUser();');
    expect(source).toContain('if (!indexed) return;');
  });

  it('preserves the bounded local search contract and stale-target guard', () => {
    expect(source).toContain('limit: 8');
    expect(source).toContain('minimumSimilarity: AMBIENT_LIST_MIN_SIMILARITY');
    expect(source).toContain('memoId: target.memoId');
    expect(source).toContain('ownerId');
    expect(source).toContain('queryText: target.queryText');
    expect(source).toContain('getLocalWorkspaceOwner() !== ownerId');
    expect(source).toContain('ambientTargetRef.current?.editorId !== target.editorId');
    expect(source).toContain('ambientTargetRef.current?.queryText !== target.queryText');
  });

  it('opens only non-empty results and keeps the preview promotion metadata', () => {
    expect(source).toContain('if (response.results.length > 0)');
    expect(source).toContain("handleOpenPreview(response.results, 'list', {");
    expect(source).toContain('isAmbientList: true');
    expect(source).toContain("t('새 메모 탭으로 열기', 'Open in a new note tab')");
  });

  it('keeps search errors inside the preview panel and lets cancellation stay quiet', () => {
    expect(source).toContain('formatLocalMemoSearchErrorMessage(caught)');
    expect(source).toContain('if (!message) return;');
    expect(source).toContain("setActiveSidePanel('preview');");
    expect(source).toContain('isAmbientList: true');
    expect(source).toContain("mode: 'list'");
    expect(appSource).toContain('const { openAmbientListInPreview } = useAmbientListPreview({');
    expect(appSource).not.toContain('const openAmbientListInPreview = async () => {');
  });
});
