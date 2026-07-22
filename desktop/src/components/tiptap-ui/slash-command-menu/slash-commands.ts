import type { Editor } from "@tiptap/core"

export interface SlashCommand {
  id: string
  keywords: string[]
  label: string
  run: (editor: Editor) => void
}

// 사용자가 스킴 없이 입력하면 https://를 붙이고, http(s) 외 스킴은 거부한다.
const normalizeUrl = (raw: string | null) => {
  const value = raw?.trim()
  if (!value) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value)
    ? value
    : `https://${value}`
  return /^https?:\/\//i.test(withScheme) ? withScheme : null
}

// 본문 블록 삽입/변환 전용. 노트 제목과 인라인 서식(형광펜 등)은 넣지 않는다.
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "heading",
    keywords: ["제목", "h1", "heading", "머리글"],
    label: "제목",
    run: editor => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "bullet-list",
    keywords: ["목록", "list", "bullet", "글머리"],
    label: "목록",
    run: editor => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered-list",
    keywords: ["번호", "ordered", "number", "숫자"],
    label: "번호 목록",
    run: editor => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "task-list",
    keywords: ["체크", "task", "todo", "할일"],
    label: "체크리스트",
    run: editor => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "blockquote",
    keywords: ["인용", "quote"],
    label: "인용",
    run: editor => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code-block",
    keywords: ["코드", "code"],
    label: "코드",
    run: editor => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "divider",
    keywords: ["구분선", "divider", "hr", "line"],
    label: "구분선",
    run: editor => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "table",
    keywords: ["표", "table"],
    label: "표",
    run: editor =>
      editor.chain().focus().insertTable({ cols: 3, rows: 3, withHeaderRow: true }).run(),
  },
  {
    id: "image",
    keywords: ["이미지", "image", "사진"],
    label: "이미지",
    run: editor => {
      // 이미지 업로드는 비활성화 정책이므로 URL 삽입만 지원한다.
      const url = normalizeUrl(window.prompt("이미지 URL을 입력하세요"))
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
    },
  },
  {
    id: "link",
    keywords: ["링크", "link", "url"],
    label: "링크",
    run: editor => {
      const url = normalizeUrl(window.prompt("링크 URL을 입력하세요"))
      if (url) {
        editor
          .chain()
          .focus()
          .insertContent({
            marks: [{ attrs: { href: url }, type: "link" }],
            text: url,
            type: "text",
          })
          .run()
      }
    },
  },
]

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
