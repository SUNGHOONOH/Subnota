"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import type { Editor } from "@tiptap/core"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
// moduleResolution:node은 exports 서브패스를 못 읽어 tsconfig paths로 매핑됨.
import { BubbleMenu } from "@tiptap/react/menus"
import { useHotkeys } from "react-hotkeys-hook"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table"
import { Markdown } from "@tiptap/markdown"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer/spacer"
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "@/components/tiptap-ui-primitive/toolbar/toolbar"

// --- Tiptap Node ---
import { attachAmbientIdle } from "@/lib/ambientIdle"
import { DateHighlight } from "@/components/tiptap-extension/date-highlight-extension"
import { FormattingShortcuts } from "@/components/tiptap-extension/formatting-shortcuts-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { CodeBlock } from "@/components/tiptap-node/code-block-node/code-block-node-extension"
import { Frontmatter } from "@/components/tiptap-node/frontmatter-node/frontmatter-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/frontmatter-node/frontmatter-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"
import "@/components/tiptap-node/table-node/table-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu/heading-dropdown-menu"
import { CopyMarkdownButton } from "@/components/tiptap-ui/copy-markdown-button/copy-markdown-button"
import { CopyFilePathButton } from "@/components/tiptap-ui/copy-file-path-button/copy-file-path-button"
import { SaveButton } from "@/components/tiptap-ui/save-button/save-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu/list-dropdown-menu"
import { ListButton } from "@/components/tiptap-ui/list-button/list-button"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button/code-block-button"
import { ColorHighlightPopover, ColorHighlightPopoverContent, ColorHighlightPopoverButton } from "@/components/tiptap-ui/color-highlight-popover/color-highlight-popover"
import { SlashCommandMenu } from "@/components/tiptap-ui/slash-command-menu/slash-command-menu"
import { LinkPopover, LinkContent, LinkButton } from "@/components/tiptap-ui/link-popover/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Selection bubble toolbar (responsive with overflow) ---
import { SelectionBubbleToolbar } from "@/components/tiptap-templates/simple/selection-bubble-toolbar"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

// --- Components ---

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"


const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
  onSave,
  canSave,
  currentFilePath,
}: {
  onHighlighterClick: () => void
  onLinkClick: () => void
  isMobile: boolean
  onSave: () => Promise<void>
  canSave: boolean
  currentFilePath: string | null
}) => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
        <ListDropdownMenu
          modal={false}
          types={["bulletList", "orderedList", "taskList"]}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover currentFilePath={currentFilePath} /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <SaveButton onSave={onSave} canSave={canSave} />
        <CopyMarkdownButton />
        <CopyFilePathButton filePath={currentFilePath} />
      </ToolbarGroup>

      <Spacer />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
  currentFilePath,
}: {
  type: "highlighter" | "link"
  onBack: () => void
  currentFilePath: string | null
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent currentFilePath={currentFilePath} />
    )}
  </>
)

// 이미지 업로드는 현재 비활성화 — 파일 드롭/붙여넣기를 조용히 무시한다.
// (기존 이미지 노드 렌더링은 Image 확장이 그대로 담당한다.)
const containsImageFile = (data: DataTransfer | null) =>
  Boolean(
    data && Array.from(data.files).some(file => file.type.startsWith("image/")),
  )

export interface SimpleEditorProps {
  hideToolbar?: boolean;
  insertTextRequest?: { id: string; text: string } | null;
  onAmbientIdle?: (chunkText: string) => void;
  onEditorFocus?: () => void;
  onEditorReady?: (editor: Editor | null) => void;
  onInsertTextRequestHandled?: (id: string) => void;
  // 제공되면 드래그 선택 팝업에 "일정 등록" 버튼이 나타난다.
  onRegisterSchedule?: () => void;
  value: string;
  onChange: (markdown: string) => void;
  onSelectionChange?: (selectedText: string, from: number, to: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showVersionLabel?: boolean;
}

// 노트 내부 고정 툴바: B / I / H1⌄ / 목록⌄ / 체크리스트 / 인용 / 코드.
// 기존 Tiptap UI 컴포넌트(command 포함)를 그대로 재사용한다.
// children은 오른쪽 끝 노트 도구 슬롯(날짜 선택·연관 문장·네트워크 검색 등).
export function NoteFixedToolbar({
  editor,
  children,
}: {
  editor: Editor | null
  children?: ReactNode
}) {
  return (
    <div
      aria-label="본문 서식 도구"
      className="note-fixed-toolbar"
      role="toolbar"
    >
      <EditorContext.Provider value={{ editor }}>
        <MarkButton aria-label="굵게" tooltip="굵게" type="bold" />
        <MarkButton aria-label="기울임" tooltip="기울임" type="italic" />
        <HeadingDropdownMenu
          aria-label="본문 제목"
          levels={[1, 2, 3, 4]}
          modal={false}
          tooltip="본문 제목"
        />
        <ListDropdownMenu
          aria-label="목록"
          modal={false}
          tooltip="목록"
          types={["bulletList", "orderedList"]}
        />
        <ListButton aria-label="체크리스트" tooltip="체크리스트" type="taskList" />
        <BlockquoteButton aria-label="인용" tooltip="인용" />
        <CodeBlockButton aria-label="코드 블록" tooltip="코드 블록" />
      </EditorContext.Provider>
      {children && (
        <div className="note-fixed-toolbar-trailing">{children}</div>
      )}
    </div>
  )
}

export function SimpleEditor({
  hideToolbar = false,
  insertTextRequest = null,
  onAmbientIdle,
  onEditorFocus,
  onEditorReady,
  onInsertTextRequestHandled,
  onRegisterSchedule,
  value,
  onChange,
  onSelectionChange,
  placeholder = "메모를 시작하세요",
  autoFocus = true,
  showVersionLabel = true,
}: SimpleEditorProps) {
  const isMobile = useIsBreakpoint()
  const { height } = useWindowSize()
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  )
  const toolbarRef = useRef<HTMLDivElement>(null)
  const lastInsertTextRequestIdRef = useRef<string | null>(null)
  const lastInjectedTextRef = useRef<string>("")
  const onAmbientIdleRef = useRef(onAmbientIdle)
  const onEditorReadyRef = useRef(onEditorReady)

  useEffect(() => {
    onAmbientIdleRef.current = onAmbientIdle
  }, [onAmbientIdle])

  useEffect(() => {
    onEditorReadyRef.current = onEditorReady
  }, [onEditorReady])

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
      handleDOMEvents: {
        focus: () => {
          onEditorFocus?.()
          return false
        },
      },
      // 이미지 파일 드롭/붙여넣기 차단 (이미지 업로드 비활성화 정책).
      handleDrop: (_view, event) => containsImageFile(event.dataTransfer),
      handlePaste: (_view, event) => containsImageFile(event.clipboardData),
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      CodeBlock,
      FormattingShortcuts,
      Frontmatter,
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      DateHighlight,
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      Table,
      TableRow,
      TableCell,
      TableHeader,
      Markdown,
    ],
    content: value,
    autofocus: autoFocus,
  })

  useEffect(() => {
    if (!editor) return undefined

    onEditorReadyRef.current?.(editor)
    return () => onEditorReadyRef.current?.(null)
  }, [editor])

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  // ── value prop 변경 시 에디터 동기화 (루프 방지) ──
  useEffect(() => {
    if (!editor) return

    if (value === lastInjectedTextRef.current) {
      return
    }

    // 한글 등 IME 조합 중에는 setContent가 조합을 깨뜨린다(예: "오늘"→"오느늘").
    // 들어온 값은 사용자가 방금 입력한 내용의 (지연된) 에코이므로, 조합 중이면
    // 재주입을 건너뛰고 조합이 끝난 뒤의 값 변경에서 다시 동기화한다.
    if (editor.view.composing) {
      return
    }

    lastInjectedTextRef.current = value
    editor.commands.setContent(value, { emitUpdate: false, contentType: 'markdown' })
  }, [value, editor])

  useEffect(() => {
    if (!editor || !insertTextRequest) return
    if (insertTextRequest.id === lastInsertTextRequestIdRef.current) return

    lastInsertTextRequestIdRef.current = insertTextRequest.id
    editor.chain().focus().insertContent(insertTextRequest.text).run()
    onInsertTextRequestHandled?.(insertTextRequest.id)
  }, [editor, insertTextRequest, onInsertTextRequestHandled])

  // ── 에디터 내용 수정 시 onChange 콜백 호출 (디바운스/업데이트) ──
  useEffect(() => {
    if (!editor) return

    const onUpdate = () => {
      const markdown = (editor as any).getMarkdown() as string
      lastInjectedTextRef.current = markdown
      onChange(markdown)
    }

    editor.on('update', onUpdate)
    return () => { editor.off('update', onUpdate) }
  }, [editor, onChange])

  // ── 드래그 셀렉션 및 커서 변경 트래킹 ──
  useEffect(() => {
    if (!editor || !onSelectionChange) return

    const onSelection = () => {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to, ' ')
      onSelectionChange(selectedText, from, to)
    }

    editor.on('selectionUpdate', onSelection)
    return () => { editor.off('selectionUpdate', onSelection) }
  }, [editor, onSelectionChange])

  useEffect(() => {
    if (!editor) return undefined
    // onAmbientIdle을 deps에 두면 인라인 콜백의 새 identity마다 cleanup이
    // 대기 중인 idle 타이머를 제거해 트리거가 영영 발화하지 않는다.
    // 핸들러는 ref로 읽고 effect는 editor에만 묶는다.
    return attachAmbientIdle(editor, () => onAmbientIdleRef.current)
  }, [editor])

  // Escape → 선택 해제(= 선택형 팝업 닫힘). 슬래시 메뉴가 열려 있으면 그쪽
  // capture 핸들러가 먼저 소비한다.
  useEffect(() => {
    if (!editor) return undefined

    const dom = editor.view.dom
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return
      const { empty, to } = editor.state.selection
      if (!empty) {
        event.preventDefault()
        editor.commands.setTextSelection(to)
      }
    }

    dom.addEventListener("keydown", onKeyDown)
    return () => dom.removeEventListener("keydown", onKeyDown)
  }, [editor])

  const handleSave = useCallback(async () => {
    // PWA 환경에서는 자동 저장이 동작하므로 수동 저장 단축키는 무시
    console.log("Saved automatically")
  }, [])

  useHotkeys('mod+s', (e) => {
    e.preventDefault()
    handleSave()
  }, { enableOnFormTags: true, enableOnContentEditable: true }, [handleSave])

  return (
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        {!hideToolbar && (
          <Toolbar
            ref={toolbarRef}
            style={{
              ...(isMobile
                ? {
                    bottom: `calc(100% - ${height - rect.y}px)`,
                  }
                : {}),
            }}
          >
            {mobileView === "main" ? (
              <MainToolbarContent
                onHighlighterClick={() => setMobileView("highlighter")}
                onLinkClick={() => setMobileView("link")}
                isMobile={isMobile}
                onSave={handleSave}
                canSave={false}
                currentFilePath={null}
              />
            ) : (
              <MobileToolbarContent
                type={mobileView === "highlighter" ? "highlighter" : "link"}
                onBack={() => setMobileView("main")}
                currentFilePath={null}
              />
            )}
          </Toolbar>
        )}

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />
        {editor && (
          <BubbleMenu
            className="selection-bubble-menu"
            editor={editor}
            options={{ flip: true, offset: 8, placement: "top", shift: true }}
            shouldShow={({ editor: current }: { editor: Editor }) => {
              if (!current || !current.isEditable) return false
              const { from, to } = current.state.selection
              if (from === to) return false
              return (
                current.state.doc.textBetween(from, to, " ").trim().length > 0
              )
            }}
            updateDelay={150}
          >
            <SelectionBubbleToolbar
              editor={editor}
              onRegisterSchedule={onRegisterSchedule}
            />
          </BubbleMenu>
        )}
        <SlashCommandMenu editor={editor} />
      </EditorContext.Provider>
      {showVersionLabel && <span className="version-label">v0.1.0</span>}
    </div>
  )
}
