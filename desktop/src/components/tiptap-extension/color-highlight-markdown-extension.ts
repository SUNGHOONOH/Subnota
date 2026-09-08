import { Highlight } from "@tiptap/extension-highlight"

const escapeHtmlAttribute = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")

const unescapeHtmlAttribute = (value: string) =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&")

const firstMatchIndex = (source: string, values: string[]) => {
  const indexes = values
    .map((value) => source.indexOf(value))
    .filter((index) => index >= 0)

  return indexes.length > 0 ? Math.min(...indexes) : -1
}

/**
 * Tiptap's default Markdown serializer writes every highlight as `==text==`,
 * which drops the multicolor mark attribute. Keep that shorthand for an
 * uncolored mark and use inline HTML only when a color must round-trip.
 */
export const ColorHighlightMarkdown = Highlight.extend({
  renderMarkdown(node, helpers) {
    const content = helpers.renderChildren(node)
    const color = node.attrs?.color

    return typeof color === "string" && color
      ? `<mark data-color="${escapeHtmlAttribute(color)}">${content}</mark>`
      : `==${content}==`
  },

  parseMarkdown(token, helpers) {
    return helpers.applyMark(
      "highlight",
      helpers.parseInline(token.tokens || []),
      typeof token.color === "string" && token.color
        ? { color: token.color }
        : undefined,
    )
  },

  markdownTokenizer: {
    name: "highlight",
    level: "inline",
    start: (source) => firstMatchIndex(source, ['<mark data-color="', "=="]),
    tokenize(source, _tokens, helpers) {
      const colored =
        /^<mark data-color="([^"]*)">([\s\S]+?)<\/mark>/.exec(source)
      if (colored) {
        const content = colored[2]

        return {
          color: unescapeHtmlAttribute(colored[1]),
          raw: colored[0],
          text: content,
          tokens: helpers.inlineTokens(content),
          type: "highlight",
        }
      }

      const plain = /^(==)([^=]+)(==)/.exec(source)
      if (!plain) return undefined

      const content = plain[2].trim()
      return {
        raw: plain[0],
        text: content,
        tokens: helpers.inlineTokens(content),
        type: "highlight",
      }
    },
  },
})
