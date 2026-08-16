import type { Editor } from "@tiptap/core"
import { OPEN_LINK_EVENT } from "../../tiptap-extension/formatting-shortcuts-extension"

export interface SlashCommand {
  id: string
  keywords: string[]
  label: string
  labelEn?: string
  run: (editor: Editor) => void
}

export interface SlashQuery {
  anchorPos: number
  query: string
}

/** Parse the slash command immediately before the current cursor. */
export const parseSlashQuery = (
  textBefore: string,
  cursorPos: number,
): SlashQuery | null => {
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBefore)
  if (!match) return null

  return {
    anchorPos: cursorPos - match[1].length - 1,
    query: match[1],
  }
}

// 본문 블록 삽입/변환과 링크 열기. 노트 제목 자체와 다른 인라인 서식은 넣지 않는다.
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "heading",
    keywords: ["제목", "h1", "heading", "머리글"],
    label: "제목",
    labelEn: "Heading",
    run: editor => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "bullet-list",
    keywords: ["목록", "list", "bullet", "글머리"],
    label: "목록",
    labelEn: "Bulleted list",
    run: editor => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered-list",
    keywords: ["번호", "ordered", "number", "숫자"],
    label: "번호 목록",
    labelEn: "Numbered list",
    run: editor => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "task-list",
    keywords: ["체크", "task", "todo", "할일"],
    label: "체크리스트",
    labelEn: "Checklist",
    run: editor => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "blockquote",
    keywords: ["인용", "quote"],
    label: "인용",
    labelEn: "Quote",
    run: editor => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code-block",
    keywords: ["코드", "code"],
    label: "코드",
    labelEn: "Code block",
    run: editor => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "divider",
    keywords: ["구분선", "divider", "hr", "line"],
    label: "구분선",
    labelEn: "Divider",
    run: editor => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "link",
    keywords: ["링크", "link", "url"],
    label: "링크",
    labelEn: "Link",
    run: editor => {
      editor.view.focus()
      window.dispatchEvent(
        new CustomEvent(OPEN_LINK_EVENT, { detail: { editor } }),
      )
    },
  },
]

export const getSlashCommands = (language: 'en' | 'ko') =>
  language === 'en'
    ? SLASH_COMMANDS.map(({ labelEn, ...command }) => ({
        ...command,
        label: labelEn ?? command.label,
      }))
    : SLASH_COMMANDS

export const filterSlashCommands = (
  query: string,
  commands: SlashCommand[] = SLASH_COMMANDS,
) => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return commands
  }
  return commands.filter(
    command =>
      command.label.toLowerCase().includes(normalized) ||
      command.keywords.some(keyword =>
        keyword.toLowerCase().includes(normalized),
      ),
  )
}
