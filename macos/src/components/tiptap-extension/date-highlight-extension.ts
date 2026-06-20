import { Extension } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

import { parseDates } from "@/lib/dateParser"

// Inline decoration that highlights natural-language / numeric dates the same
// way the legacy editor did. Decorations are derived per text node so string
// offsets from parseDates map directly to document positions.
const dateHighlightKey = new PluginKey("dateHighlight")

const buildDecorations = (doc: ProseMirrorNode): DecorationSet => {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return
    }

    let matches
    try {
      matches = parseDates(node.text)
    } catch {
      return
    }

    for (const match of matches) {
      const from = pos + match.index
      const to = from + match.length
      if (to <= from) {
        continue
      }
      decorations.push(
        Decoration.inline(from, to, { class: "date-token" }),
      )
    }
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
