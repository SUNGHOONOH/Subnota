import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/components/MemoSplitPaneHeader.tsx'),
  'utf8',
);

describe('split-pane tab header', () => {
  it('keeps tab selection and tab closing as separate buttons', () => {
    expect(source).toContain('className="split-tab-select"');
    expect(source).toContain('className="split-tab-close"');
    expect(source).toContain('onCloseEditor(pane, editor.id);');
    expect(source).not.toContain('role="button"');
  });
});
