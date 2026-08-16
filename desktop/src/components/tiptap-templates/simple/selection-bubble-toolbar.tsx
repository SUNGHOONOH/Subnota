import { Fragment, useEffect, useRef, useState, type ReactNode } from "react"
import type { Editor } from "@tiptap/core"
import { Menu } from "@mantine/core"

import { Button } from "@/components/tiptap-ui-primitive/button/button"
import { MarkButton } from "@/components/tiptap-ui/mark-button/mark-button"
import { ListButton } from "@/components/tiptap-ui/list-button/list-button"
import { ColorHighlightPopover } from "@/components/tiptap-ui/color-highlight-popover/color-highlight-popover"
import { CalendarPlus, MoreHorizontal, Search } from "@/components/icons"
import { localize, useUiLanguage } from "@/lib/uiLanguage"

type Range = { from: number; to: number }

interface FormattingItem {
  key: string
  label: string
  inline: ReactNode
  // 오버플로 메뉴에서 실행. 메뉴 클릭으로 풀린 선택을 range로 복원한 뒤 적용한다.
  run: (editor: Editor, range: Range) => void
}

// 왼쪽 = 고순위(오래 인라인 유지), 오른쪽 = 저순위(좁아지면 먼저 접힘).
// 팝오버 도구(형광펜)는 오래 인라인에 남겨 리치 UI를 유지한다.
const getFormattingItems = (language: 'en' | 'ko'): FormattingItem[] => {
  const t = (korean: string, english: string) => localize(language, korean, english)
  return [
  {
    key: "bold",
    label: t("굵게", "Bold"),
    inline: <MarkButton aria-label={t("굵게", "Bold")} tooltip={t("굵게", "Bold")} type="bold" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleBold().run(),
  },
  {
    key: "italic",
    label: t("기울임", "Italic"),
    inline: <MarkButton aria-label={t("기울임", "Italic")} tooltip={t("기울임", "Italic")} type="italic" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleItalic().run(),
  },
  {
    key: "underline",
    label: t("밑줄", "Underline"),
    inline: <MarkButton aria-label={t("밑줄", "Underline")} tooltip={t("밑줄", "Underline")} type="underline" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleUnderline().run(),
  },
  {
    key: "highlight",
    label: t("형광펜", "Highlight"),
    inline: <ColorHighlightPopover aria-label={t("형광펜", "Highlight")} tooltip={t("형광펜", "Highlight")} />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleHighlight().run(),
  },
  {
    key: "strike",
    label: t("취소선", "Strikethrough"),
    inline: <MarkButton aria-label={t("취소선", "Strikethrough")} tooltip={t("취소선", "Strikethrough")} type="strike" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleStrike().run(),
  },
  {
    key: "code",
    label: t("인라인 코드", "Inline code"),
    inline: <MarkButton aria-label={t("인라인 코드", "Inline code")} tooltip={t("인라인 코드", "Inline code")} type="code" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleCode().run(),
  },
  {
    key: "bulletList",
    label: t("목록", "Bulleted list"),
    inline: <ListButton aria-label={t("목록", "Bulleted list")} tooltip={t("목록", "Bulleted list")} type="bulletList" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleBulletList().run(),
  },
  {
    key: "taskList",
    label: t("체크리스트", "Checklist"),
    inline: <ListButton aria-label={t("체크리스트", "Checklist")} tooltip={t("체크리스트", "Checklist")} type="taskList" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleTaskList().run(),
  },
  ]
}

// 폭 추정치(px). 실제보다 약간 넉넉히 잡아 버튼이 잘리기보다 ⋯로 먼저 접히게 한다.
// ponytail: 시각 튜닝 값 — 실제 창에서 어긋나면 이 숫자만 조정.
const ITEM_W = 32
const MORE_W = 34
const DIVIDER_W = 13
const SEARCH_W = 34
const SCHEDULE_W = 100
const PADDING = 16
const EDGE_MARGIN = 24

export interface SelectionBubbleAnchor {
  left: number
  top: number
  width: number
}

interface SelectionBubbleToolbarProps {
  editor: Editor
  onSearchSelection?: () => void
  onRegisterSchedule?: (anchor: SelectionBubbleAnchor) => void
}

export function SelectionBubbleToolbar({
  editor,
  onSearchSelection,
  onRegisterSchedule,
}: SelectionBubbleToolbarProps) {
  const language = useUiLanguage()
  const t = (korean: string, english: string) => localize(language, korean, english)
  const [available, setAvailable] = useState(9999)

  useEffect(() => {
    const dom = editor?.view?.dom as HTMLElement | undefined
    if (!dom) return
    const update = () => setAvailable(dom.clientWidth - EDGE_MARGIN)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(dom)
    return () => observer.disconnect()
  }, [editor])

  // 선택이 살아있을 때의 범위를 기억해, 오버플로 메뉴 클릭으로 선택이 풀려도 복원한다.
  const rangeRef = useRef<Range>({ from: 0, to: 0 })
  const { from, to } = editor.state.selection
  if (from !== to) {
    rangeRef.current = { from, to }
  }

  const formattingItems = getFormattingItems(language)
  const total = formattingItems.length
  const budget =
    available -
    PADDING -
    (onSearchSelection || onRegisterSchedule ? DIVIDER_W : 0) -
    (onSearchSelection ? SEARCH_W : 0) -
    (onRegisterSchedule ? SCHEDULE_W : 0)
  const visible =
    total * ITEM_W <= budget
      ? total
      : Math.min(total, Math.max(0, Math.floor((budget - MORE_W) / ITEM_W)))

  const inlineItems = formattingItems.slice(0, visible)
  const overflowItems = formattingItems.slice(visible)

  return (
    <div
      aria-label={t("선택 텍스트 서식", "Selected text formatting")}
      className="selection-bubble-toolbar"
      role="toolbar"
    >
      {inlineItems.map(item => (
        <Fragment key={item.key}>{item.inline}</Fragment>
      ))}

      {overflowItems.length > 0 && (
        <Menu position="top" withinPortal>
          <Menu.Target>
            <button
              aria-label={t("더보기", "More")}
              className="selection-bubble-more"
              type="button"
            >
              <MoreHorizontal size={15} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            {overflowItems.map(item => (
              <Menu.Item
                key={item.key}
                onClick={() => item.run(editor, rangeRef.current)}
              >
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}

      {(onSearchSelection || onRegisterSchedule) && (
        <span aria-hidden className="selection-bubble-divider" />
      )}

      {onSearchSelection && (
        <Button
          aria-label={t("선택한 문장 검색", "Search selected sentence")}
          className="selection-bubble-search"
          onClick={onSearchSelection}
          tooltip={t("선택한 문장 검색", "Search selected sentence")}
          type="button"
          variant="ghost"
        >
          <Search className="tiptap-button-icon" size={15} />
        </Button>
      )}

      {onRegisterSchedule && (
        <>
          <Button
            aria-label={t("일정 등록", "Add to calendar")}
            className="selection-bubble-schedule"
            onClick={event => {
              const { left, top, width } = event.currentTarget.getBoundingClientRect()
              onRegisterSchedule({ left, top, width })
            }}
            tooltip={t("일정 등록", "Add to calendar")}
            type="button"
            variant="ghost"
          >
            <CalendarPlus className="tiptap-button-icon" size={15} />
            <span className="tiptap-button-text">{t("일정 등록", "Add to calendar")}</span>
          </Button>
        </>
      )}
    </div>
  )
}

export default SelectionBubbleToolbar
