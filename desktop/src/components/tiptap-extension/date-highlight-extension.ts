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

export const buildDecorations = (doc: ProseMirrorNode): DecorationSet => {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return true
    }

    const text = node.textBetween(0, node.content.size, undefined, "￼")
    if (text) {
      let matches
      try {
        matches = parseDates(text)
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

export const DateHighlight = Extension.create({
  name: "dateHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dateHighlightKey,
        state: {
          init: (_config, { doc }) => buildDecorations(doc),
          apply: (tr, value) =>
            tr.docChanged ? buildDecorations(tr.doc) : value,
        },
        props: {
          decorations(state) {
            return dateHighlightKey.getState(state)
          },
        },
      }),
    ]
  },
})

export default DateHighlight
