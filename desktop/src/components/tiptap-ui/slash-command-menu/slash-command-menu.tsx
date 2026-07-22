"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Editor } from "@tiptap/core"

import {
  filterSlashCommands,
  type SlashCommand,
} from "./slash-commands"

interface SlashMenuState {
  anchorPos: number
  query: string
}

const ITEM_HEIGHT_PX = 34
const MENU_PADDING_PX = 12

// "/" 입력 위치에 뜨는 블록 삽입 메뉴. @tiptap/suggestion 없이 에디터
// update/selectionUpdate 이벤트로 직접 감지한다(새 의존성 금지 정책).
export function SlashCommandMenu({ editor }: { editor: Editor | null }) {
  const [state, setState] = useState<SlashMenuState | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state
  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex

  useEffect(() => {
    if (!editor) return undefined

    const sync = (allowOpen: boolean) => {
      if (editor.isDestroyed || editor.view.composing) return
      const { $from, empty } = editor.state.selection
      if (!empty || !$from.parent.isTextblock || $from.parent.type.name === "codeBlock") {
        setState(null)
        return
      }
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\0", "\0")
      const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBefore)
      if (!match) {
        setState(null)
        return
      }
      const query = match[1]
      const anchorPos = $from.pos - query.length - 1
      setState(previous => {
        if (!previous && !allowOpen) return previous
        setActiveIndex(0)
        return { anchorPos, query }
      })
    }

    const onUpdate = () => sync(true)
    const onSelectionUpdate = () => sync(false)
    const onBlur = () => setState(null)

    editor.on("update", onUpdate)
    editor.on("selectionUpdate", onSelectionUpdate)
    editor.on("blur", onBlur)
    return () => {
      editor.off("update", onUpdate)
      editor.off("selectionUpdate", onSelectionUpdate)
      editor.off("blur", onBlur)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return undefined

    const runCommand = (command: SlashCommand) => {
      const current = stateRef.current
      if (!current) return
      const to = editor.state.selection.from
      editor.chain().focus().deleteRange({ from: current.anchorPos, to }).run()
      command.run(editor)
      setState(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current
      if (!current || event.isComposing) return
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        setState(null)
        return
      }
      const commands = filterSlashCommands(current.query)
      if (commands.length === 0) return
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        event.stopPropagation()
        const delta = event.key === "ArrowDown" ? 1 : commands.length - 1
        setActiveIndex(index => (index + delta) % commands.length)
        return
      }
      if (event.key === "Enter") {
        event.preventDefault()
        event.stopPropagation()
        runCommand(
          commands[Math.min(activeIndexRef.current, commands.length - 1)],
        )
      }
    }

    const dom = editor.view.dom
    dom.addEventListener("keydown", onKeyDown, true)
    return () => dom.removeEventListener("keydown", onKeyDown, true)
  }, [editor])

  if (!editor || editor.isDestroyed || !state) {
    return null
  }

  const commands = filterSlashCommands(state.query)
  if (commands.length === 0) {
    return null
  }

  let coords: { bottom: number; left: number; top: number }
  try {
    coords = editor.view.coordsAtPos(
      Math.min(state.anchorPos, editor.state.doc.content.size),
    )
  } catch {
    return null
  }

  const selectedIndex = Math.min(activeIndex, commands.length - 1)
  const menuHeight = commands.length * ITEM_HEIGHT_PX + MENU_PADDING_PX
  const openUpward = coords.bottom + 6 + menuHeight > window.innerHeight
  const top = openUpward ? coords.top - menuHeight - 6 : coords.bottom + 6
  const left = Math.min(Math.max(coords.left, 8), window.innerWidth - 190)

  const applyCommand = (command: SlashCommand) => {
    const to = editor.state.selection.from
    editor.chain().focus().deleteRange({ from: state.anchorPos, to }).run()
    command.run(editor)
    setState(null)
  }

  return createPortal(
    <div
      aria-label="블록 삽입 명령"
      className="slash-command-menu"
      role="listbox"
      style={{ left, top: Math.max(top, 8) }}
    >
      {commands.map((command, index) => (
        <button
          aria-selected={index === selectedIndex}
          className={`slash-command-item${index === selectedIndex ? " active" : ""}`}
          key={command.id}
          onClick={() => applyCommand(command)}
          onMouseDown={event => event.preventDefault()}
          onMouseEnter={() => setActiveIndex(index)}
          role="option"
          type="button"
        >
          {command.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
