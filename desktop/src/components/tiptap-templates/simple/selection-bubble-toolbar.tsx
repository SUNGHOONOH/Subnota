import { Fragment, useEffect, useRef, useState, type ReactNode } from "react"
import type { Editor } from "@tiptap/core"
import { Menu } from "@mantine/core"

import { Button } from "@/components/tiptap-ui-primitive/button/button"
import { MarkButton } from "@/components/tiptap-ui/mark-button/mark-button"
import { ListButton } from "@/components/tiptap-ui/list-button/list-button"
import { ColorHighlightPopover } from "@/components/tiptap-ui/color-highlight-popover/color-highlight-popover"
import { LinkPopover } from "@/components/tiptap-ui/link-popover/link-popover"
import { CalendarPlus, MoreHorizontal } from "@/components/icons"

type Range = { from: number; to: number }

interface FormattingItem {
  key: string
  label: string
  inline: ReactNode
  // 오버플로 메뉴에서 실행. 메뉴 클릭으로 풀린 선택을 range로 복원한 뒤 적용한다.
  run: (editor: Editor, range: Range) => void
}

// 왼쪽 = 고순위(오래 인라인 유지), 오른쪽 = 저순위(좁아지면 먼저 접힘).
// 팝오버 도구(형광펜·링크)는 오래 인라인에 남겨 리치 UI를 유지한다.
const FORMATTING_ITEMS: FormattingItem[] = [
  {
    key: "bold",
    label: "굵게",
    inline: <MarkButton aria-label="굵게" tooltip="굵게" type="bold" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleBold().run(),
  },
  {
    key: "italic",
    label: "기울임",
    inline: <MarkButton aria-label="기울임" tooltip="기울임" type="italic" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleItalic().run(),
  },
  {
    key: "underline",
    label: "밑줄",
    inline: <MarkButton aria-label="밑줄" tooltip="밑줄" type="underline" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleUnderline().run(),
  },
  {
    key: "highlight",
    label: "형광펜",
    inline: <ColorHighlightPopover aria-label="형광펜" tooltip="형광펜" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleHighlight().run(),
  },
  {
    key: "link",
    label: "링크",
    inline: <LinkPopover aria-label="링크" currentFilePath={null} tooltip="링크" />,
    run: (editor, range) => {
      const url = window.prompt("링크 URL")
      if (url) {
        editor.chain().focus().setTextSelection(range).setLink({ href: url }).run()
      }
    },
  },
  {
    key: "strike",
    label: "취소선",
    inline: <MarkButton aria-label="취소선" tooltip="취소선" type="strike" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleStrike().run(),
  },
  {
    key: "code",
    label: "인라인 코드",
    inline: <MarkButton aria-label="인라인 코드" tooltip="인라인 코드" type="code" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleCode().run(),
  },
  {
    key: "bulletList",
    label: "목록",
    inline: <ListButton aria-label="목록" tooltip="목록" type="bulletList" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleBulletList().run(),
  },
  {
    key: "taskList",
    label: "체크리스트",
    inline: <ListButton aria-label="체크리스트" tooltip="체크리스트" type="taskList" />,
    run: (editor, range) =>
      editor.chain().focus().setTextSelection(range).toggleTaskList().run(),
  },
]

// 폭 추정치(px). 실제보다 약간 넉넉히 잡아 버튼이 잘리기보다 ⋯로 먼저 접히게 한다.
// ponytail: 시각 튜닝 값 — 실제 창에서 어긋나면 이 숫자만 조정.
const ITEM_W = 32
const MORE_W = 34
const DIVIDER_W = 13
const SCHEDULE_W = 100
const PADDING = 16
const EDGE_MARGIN = 24

interface SelectionBubbleToolbarProps {
  editor: Editor
  onRegisterSchedule?: () => void
}

export function SelectionBubbleToolbar({
  editor,
  onRegisterSchedule,
}: SelectionBubbleToolbarProps) {
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

  const total = FORMATTING_ITEMS.length
  const budget =
    available - PADDING - DIVIDER_W - (onRegisterSchedule ? SCHEDULE_W : 0)
  const visible =
    total * ITEM_W <= budget
      ? total
      : Math.min(total, Math.max(0, Math.floor((budget - MORE_W) / ITEM_W)))

  const inlineItems = FORMATTING_ITEMS.slice(0, visible)
  const overflowItems = FORMATTING_ITEMS.slice(visible)

  return (
    <div
      aria-label="선택 텍스트 서식"
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
              aria-label="더보기"
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

      {onRegisterSchedule && (
        <>
          <span aria-hidden className="selection-bubble-divider" />
          <Button
            aria-label="일정 등록"
            className="selection-bubble-schedule"
            onClick={onRegisterSchedule}
            tooltip="일정 등록"
            type="button"
            variant="ghost"
          >
            <CalendarPlus className="tiptap-button-icon" size={15} />
            <span className="tiptap-button-text">일정 등록</span>
          </Button>
        </>
      )}
    </div>
  )
}

export default SelectionBubbleToolbar
