"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/core"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
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
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
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
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { CopyMarkdownButton } from "@/components/tiptap-ui/copy-markdown-button"
import { CopyFilePathButton } from "@/components/tiptap-ui/copy-file-path-button"
import { SaveButton } from "@/components/tiptap-ui/save-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

// --- Components ---

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

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
        <ImageUploadButton text="Add" />
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

export interface SimpleEditorProps {
  hideToolbar?: boolean;
  insertTextRequest?: { id: string; text: string } | null;
  onAmbientIdle?: (chunkText: string) => void;
  onEditorFocus?: () => void;
  onEditorReady?: (editor: Editor | null) => void;
  onInsertTextRequestHandled?: (id: string) => void;
  value: string;
  onChange: (markdown: string) => void;
  onSelectionChange?: (selectedText: string, from: number, to: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showVersionLabel?: boolean;
}

export function SimpleEditorToolbar({ editor }: { editor: Editor | null }) {
  const [mobileView, setMobileView] = useState<"main" | "highlighter" | "link">(
    "main"
  )

  return (
    <div className="simple-editor-toolbar-host">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar>
          {mobileView === "main" ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView("highlighter")}
              onLinkClick={() => setMobileView("link")}
              isMobile={false}
              onSave={async () => undefined}
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
      </EditorContext.Provider>
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
  const ambientIdleTimerRef = useRef<number | null>(null)
  const onEditorReadyRef = useRef(onEditorReady)

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
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
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
    if (!editor || !onAmbientIdle) return undefined

    const scheduleAmbientIdle = () => {
      if (ambientIdleTimerRef.current) {
        window.clearTimeout(ambientIdleTimerRef.current)
      }
      ambientIdleTimerRef.current = window.setTimeout(() => {
        const { $from } = editor.state.selection
        const paragraph = $from.parent.textContent
        const start = Math.max(0, Math.min($from.parentOffset, paragraph.length) - 2000)
        const chunkText = paragraph.slice(start, start + 4000).trim()
        onAmbientIdle(chunkText)
      }, 900)
    }

    editor.on('update', scheduleAmbientIdle)
    editor.on('selectionUpdate', scheduleAmbientIdle)
    return () => {
      if (ambientIdleTimerRef.current) {
        window.clearTimeout(ambientIdleTimerRef.current)
      }
      editor.off('update', scheduleAmbientIdle)
      editor.off('selectionUpdate', scheduleAmbientIdle)
    }
  }, [editor, onAmbientIdle])

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
      </EditorContext.Provider>
      {showVersionLabel && <span className="version-label">v0.1.0</span>}
    </div>
  )
}
