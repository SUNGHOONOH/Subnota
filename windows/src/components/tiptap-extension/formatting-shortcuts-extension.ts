import { Extension } from "@tiptap/core"

// Event the link popover listens for so ⌘K can open it from anywhere (the
// toolbar lives in a separate component tree from the editor that owns this
// keymap, so a window-level event is the simplest cross-tree channel).
export const OPEN_LINK_EVENT = "subnota:open-link"

// Bold (Mod-b), italic (Mod-i), underline (Mod-u) and code block (Mod-Alt-c)
// already ship with their StarterKit/CodeBlock defaults. StarterKit binds strike
// to Mod-Shift-s, but the common macOS convention (Obsidian/Notion) is
// Mod-Shift-x, so we remap it here. ⌘K opens the link popover.
export const FormattingShortcuts = Extension.create({
  name: "formattingShortcuts",

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-x": () => this.editor.commands.toggleStrike(),
      "Mod-k": () => {
        window.dispatchEvent(new CustomEvent(OPEN_LINK_EVENT))
        return true
      },
    }
  },
})
