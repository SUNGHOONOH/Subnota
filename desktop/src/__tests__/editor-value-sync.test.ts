import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('editor value synchronization', () => {
  const readEditorSource = () =>
    readFileSync(
      resolve(__dirname, '../components/tiptap-templates/simple/simple-editor.tsx'),
      'utf8',
    );

  it('parses the initial value as Markdown instead of HTML', () => {
    const source = readEditorSource();

    expect(source).toMatch(
      /content:\s*value,\s*\n\s*contentType:\s*["']markdown["']/,
    );
  });

  it('never replaces the live document with a serialized parent value', () => {
    const source = readEditorSource();

    expect(source).not.toMatch(/commands\.setContent\(value/);
  });

  it('reports the previous live Markdown so the parent can rebase the next edit', () => {
    const source = readEditorSource();

    expect(source).toContain('const lastMarkdownRef = useRef(value)');
    expect(source).toContain('onChange(markdown, previousMarkdown)');
  });

  it('disables browser text services that can interfere with Korean IME', () => {
    const source = readEditorSource();

    expect(source).toMatch(/spellcheck:\s*["']false["']/);
    expect(source).toMatch(/autocorrect:\s*["']off["']/);
  });

  it('does not install Typography rules that silently rewrite punctuation', () => {
    const source = readEditorSource();

    expect(source).not.toContain('@tiptap/extension-typography');
    expect(source).not.toMatch(/^\s*Typography,\s*$/m);
  });
});
