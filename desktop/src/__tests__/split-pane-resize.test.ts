import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/useSplitPaneResize.ts'),
  'utf8',
);
const workspaceSource = readFileSync(
  resolve(__dirname, '../features/memo/components/MemoSplitWorkspace.tsx'),
  'utf8',
);

describe('split pane resize boundary', () => {
  it('keeps resize state and the minimum-width calculation in the hook', () => {
    expect(workspaceSource).toContain(
      "import { useSplitPaneResize } from '../useSplitPaneResize';",
    );
    expect(workspaceSource).toContain('const beginResizePane = useSplitPaneResize({');
    expect(workspaceSource).not.toContain(
      'const beginResizePane = (\n    event: React.PointerEvent<HTMLDivElement>',
    );
    expect(source).toContain('containerRef.current');
    expect(source).toContain('container.getBoundingClientRect().width');
    expect(source).toContain('paneWidths[leftPaneId] ?? 100 / paneCount');
    expect(source).toContain('Math.max(panes.length, 1)');
    expect(source).toContain('SPLIT_PANE_MIN_WIDTH_PX / containerWidth');
    expect(source).toContain('setPaneWidths(latestWidths);');
  });

  it('restores pointer listeners and document interaction state exactly once on end', () => {
    expect(source.match(/window\.removeEventListener\(/g)).toHaveLength(4);
    expect(source).toContain("window.removeEventListener('pointermove', onPointerMove);");
    expect(source).toContain("window.removeEventListener('pointerup', onPointerUp);");
    expect(source).toContain("window.removeEventListener('pointercancel', onPointerUp);");
    expect(source).toContain("window.removeEventListener('blur', onPointerUp);");
    expect(source).toContain('document.body.style.cursor = previousCursor;');
    expect(source).toContain('document.body.style.userSelect = previousUserSelect;');
    expect(source.match(/onPaneWidthsChange\?\.\(latestWidths\)/g)).toHaveLength(1);
  });

  it('registers pointer move, end, cancel, and blur cleanup listeners', () => {
    expect(source).toContain("window.addEventListener('pointermove', onPointerMove);");
    expect(source).toContain("window.addEventListener('pointerup', onPointerUp);");
    expect(source).toContain("window.addEventListener('pointercancel', onPointerUp);");
    expect(source).toContain("window.addEventListener('blur', onPointerUp);");
    expect(source).toContain('event.currentTarget.setPointerCapture(event.pointerId);');
  });
});
