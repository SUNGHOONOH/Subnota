import { Editor } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import { StarterKit } from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';

import { ColorHighlightMarkdown } from '../components/tiptap-extension/color-highlight-markdown-extension';

const createEditor = (content: ConstructorParameters<typeof Editor>[0]['content']) =>
  new Editor({
    content,
    contentType: typeof content === 'string' ? 'markdown' : 'json',
    extensions: [
      StarterKit,
      ColorHighlightMarkdown.configure({ multicolor: true }),
      Markdown,
    ],
  });

describe('multicolor highlight Markdown round-trip', () => {
  it('keeps each highlight color after serializing and parsing again', () => {
    const original = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              marks: [
                {
                  attrs: { color: 'var(--tt-color-highlight-red)' },
                  type: 'highlight',
                },
              ],
              text: '빨강',
              type: 'text',
            },
            { text: ' / ', type: 'text' },
            {
              marks: [
                {
                  attrs: { color: 'var(--tt-color-highlight-blue)' },
                  type: 'highlight',
                },
              ],
              text: '파랑',
              type: 'text',
            },
          ],
        },
      ],
    });

    const markdown = original.getMarkdown();
    const restored = createEditor(markdown);
    const colors = restored
      .getJSON()
      .content?.[0]?.content?.map((node) => node.marks?.[0]?.attrs?.color)
      .filter(Boolean);

    expect(markdown).toContain(
      '<mark data-color="var(--tt-color-highlight-red)">빨강</mark>',
    );
    expect(colors).toEqual([
      'var(--tt-color-highlight-red)',
      'var(--tt-color-highlight-blue)',
    ]);

    original.destroy();
    restored.destroy();
  });

  it('continues to parse the existing colorless ==highlight== syntax', () => {
    const editor = createEditor('기존 ==형광펜== 문법');

    expect(editor.getJSON().content?.[0]?.content?.[1]?.marks?.[0]).toEqual({
      attrs: { color: null },
      type: 'highlight',
    });

    editor.destroy();
  });
});
