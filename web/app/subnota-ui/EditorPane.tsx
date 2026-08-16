'use client';

/* 메모 패널 — 탭 줄 + 노트 헤더 + 고정 툴바 + 본문 + 관련 기억 한 줄.
   구조는 desktop/src/features/memo/components/MemoSplitWorkspace.tsx 와 같다. */

import type { ReactNode } from 'react';
import {
  CalendarDays,
  Columns2,
  MoreHorizontal,
  Network,
  Plus,
  Search,
  X,
} from './icons';

/* 문장을 드래그해 선택하면 뜨는 팝오버. 서식 버튼 다음에 구분선을 두고,
   선택한 문장으로 바로 할 수 있는 두 가지 — 검색과 일정 등록 — 이 온다. */
export function SelectionBubble({ pressing = false }: { pressing?: boolean }) {
  return (
    <div aria-label="선택 텍스트 서식" className="selection-bubble-toolbar">
      <span className="tiptap-button" style={{ fontWeight: 700 }}>
        B
      </span>
      <span className="tiptap-button" style={{ fontStyle: 'italic' }}>
        I
      </span>
      <span className="tiptap-button" style={{ textDecoration: 'underline' }}>
        U
      </span>
      <span className="tiptap-button">
        <MoreHorizontal size={15} />
      </span>
      <span aria-hidden className="selection-bubble-divider" />
      <span className="tiptap-button">
        <Search size={15} />
      </span>
      <span
        className="tiptap-button selection-bubble-schedule"
        style={pressing ? { transform: 'scale(0.96)' } : undefined}
      >
        <CalendarDays size={15} />
        <span className="tiptap-button-text">일정 등록</span>
      </span>
    </div>
  );
}

export interface PaneTab {
  id: string;
  label: string;
}

export function PaneTabs({
  tabs,
  activeId,
}: {
  tabs: PaneTab[];
  activeId: string;
}) {
  return (
    <div className="split-pane-header">
      <div className="split-editor-tabs">
        {tabs.map((tab) => (
          <span
            className={
              tab.id === activeId ? 'split-editor-tab active' : 'split-editor-tab'
            }
            key={tab.id}
          >
            <span className="split-tab-label">{tab.label}</span>
            {tab.id === activeId && <X size={12} />}
          </span>
        ))}
        <span className="split-editor-tab-add">
          <Plus size={16} />
        </span>
      </div>
      <div className="split-pane-actions">
        <span className="split-action-btn">
          <Columns2 size={16} />
        </span>
        <span className="split-action-btn">
          <MoreHorizontal size={16} />
        </span>
      </div>
    </div>
  );
}

/* 툴바는 포커스가 에디터가 아닐 때도 자리를 지킨다 — 사라지면 공간이 흔들린다. */
export function NoteHeader({
  title,
  saveStatus = '저장됨',
  trailing,
}: {
  title: string;
  saveStatus?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="split-note-header">
      <span className="split-note-save-status">{saveStatus}</span>
      <div className="split-note-title-input">{title}</div>
      <div className="note-fixed-toolbar">
        <span className="tiptap-button" style={{ fontWeight: 700 }}>
          B
        </span>
        <span className="tiptap-button" style={{ fontStyle: 'italic' }}>
          I
        </span>
        <span className="tiptap-button" style={{ textDecoration: 'underline' }}>
          U
        </span>
        <div className="note-fixed-toolbar-trailing">
          <span className="tiptap-button">
            <CalendarDays size={15} />
          </span>
          <span className="tiptap-button">
            <Network size={15} />
          </span>
        </div>
      </div>
      {trailing}
    </div>
  );
}

/* 관련 기억 한 줄. 메타 접두는 뺄 수 없다 — 없으면 커서 옆 회색 글자가
   삽입 가능한 완성 제안처럼 읽히는데, 이건 참조지 제안이 아니다. */
export function AmbientGhost({
  meta,
  text,
  hint = '⌘⏎ 열기',
  hovered = false,
}: {
  meta: string;
  text: string;
  hint?: string;
  hovered?: boolean;
}) {
  return (
    <span className="ambient-ghost-widget">
      <span className={hovered ? 'ambient-ghost hovered' : 'ambient-ghost'}>
        <span className="ambient-ghost-meta">{meta}</span>
        <span className="ambient-ghost-text">{text}</span>
        <span className="ambient-ghost-hint">{hint}</span>
      </span>
    </span>
  );
}

export function MemoPane({
  tabs,
  activeTabId,
  focused = true,
  children,
}: {
  tabs: PaneTab[];
  activeTabId: string;
  focused?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={focused ? 'split-pane focused' : 'split-pane'}>
      <PaneTabs activeId={activeTabId} tabs={tabs} />
      <div className="split-memo-pane-body">{children}</div>
    </div>
  );
}
