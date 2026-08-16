import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'

import {
  getLinkHrefAtPosition,
  sanitizeUrl,
} from '../lib/tiptap-utils'

describe('editor link opening', () => {
  it('finds a link mark at positions inside and on the edge of a link', () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: '열기',
            marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
          }],
        }],
      },
    })

    const positions = Array.from(
      { length: editor.state.doc.content.size + 1 },
      (_, position) => position,
    )
    expect(
      positions.some(
        position =>
          getLinkHrefAtPosition(editor.state.doc, position) ===
          'https://example.com',
      ),
    ).toBe(true)
    expect(getLinkHrefAtPosition(editor.state.doc, 0)).toBeNull()
    editor.destroy()
  })

  it('keeps unsafe protocols from reaching external-open IPC', () => {
    expect(sanitizeUrl('https://example.com', 'http://localhost')).toBe(
      'https://example.com/',
    )
    expect(sanitizeUrl('javascript:alert(1)', 'http://localhost')).toBe('#')
  })
})
