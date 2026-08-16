import { Extension } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

import { parseDates } from "../../lib/dateParser"

// Inline decoration that highlights natural-language / numeric dates the same
// way the legacy editor did. Decorations are derived per textblock (not per
// text node) so a date split by marks — e.g. a bold "3월" followed by plain
// " 6일" — is still recognized as one token. Leaf nodes are replaced with a
// single placeholder char so string offsets map 1:1 to document positions.
const dateHighlightKey = new PluginKey("dateHighlight")
export const DATE_HIGHLIGHT_LANGUAGE_META = "subnota:date-highlight-language"

export const buildDecorations = (
  doc: ProseMirrorNode,
  language: 'en' | 'ko' = 'ko',
): DecorationSet => {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return true
    }

    const text = node.textBetween(0, node.content.size, undefined, "￼")
    if (text) {
      let matches
      try {
        matches = parseDates(text, Date.now(), language)
      } catch {
        return false
      }

      for (const match of matches) {
        const from = pos + 1 + match.index
        const to = from + match.length
        if (to <= from) {
          continue
        }
        decorations.push(
          Decoration.inline(from, to, { class: "date-token" }),
        )
      }
    }

    return false
  })

  return DecorationSet.create(doc, decorations)
}

export const DateHighlight = Extension.create<{ language: 'en' | 'ko' }>({
  name: "dateHighlight",

  addOptions() {
    return { language: 'ko' }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dateHighlightKey,
        state: {
          init: (_config, { doc }) => ({
            decorations: buildDecorations(doc, this.options.language),
            language: this.options.language,
          }),
          apply: (tr, value) => {
            const language = tr.getMeta(DATE_HIGHLIGHT_LANGUAGE_META) ?? value.language

            if (!tr.docChanged && language === value.language) {
              return value
            }

            return {
              decorations: buildDecorations(tr.doc, language),
              language,
            }
          },
        },
        props: {
          decorations(state) {
            return dateHighlightKey.getState(state)?.decorations
          },
        },
      }),
    ]
  },
})

export default DateHighlight
