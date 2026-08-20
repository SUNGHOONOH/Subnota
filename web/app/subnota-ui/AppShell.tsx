'use client';

/* 앱 셸 — 네비게이션 레일 + 메모 목록 + 전역 커맨드바.
   구조는 desktop/src/App.tsx 의 `.app-shell` 과 같다. */

import type { ReactNode } from 'react';
import {
  AppWindow,
  CalendarDays,
  Folder,
  List,
  NotebookText,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Topics,
  Redo,
  Undo,
} from './icons';

export interface MemoRow {
  id: string;
  title: string;
  preview: string;
}

type NavTab = 'memo' | 'calendar' | 'inbox' | 'topics';

const NAV_ITEMS: { id: NavTab; label: string; Icon: typeof NotebookText }[] = [
  { id: 'memo', label: '메모', Icon: NotebookText },
  { id: 'calendar', label: '캘린더', Icon: CalendarDays },
  { id: 'inbox', label: '링크', Icon: AppWindow },
  { id: 'topics', label: 'Topics', Icon: Topics },
];

export function NavRail({ active }: { active: NavTab }) {
  return (
    <aside className="nav-rail">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <span
          aria-label={label}
          className={id === active ? 'nav-item active' : 'nav-item'}
          key={id}
          role="img"
        >
          <Icon size={22} />
        </span>
      ))}
      <span aria-label="새 탭" className="nav-item" role="img">
        <Plus size={22} />
      </span>
      <span aria-hidden="true" className="nav-divider" />
      <div className="nav-mode-segment">
        <span className="nav-mode-segment-item active">
          <List size={22} />
        </span>
        <span className="nav-mode-segment-item">
          <Folder size={22} />
        </span>
      </div>
      <div className="nav-spacer" />
      <span aria-hidden="true" className="nav-divider" />
      <span aria-label="설정" className="nav-item" role="img">
        <Settings size={22} />
      </span>
    </aside>
  );
}

export function SessionRail({
  memos,
  activeId,
  sectionLabel = '오늘',
}: {
  memos: MemoRow[];
  activeId: string;
  sectionLabel?: string;
}) {
  return (
    <div className="session-rail-inner">
      <div className="session-header">
        <h2>메모</h2>
        <span>{memos.length}</span>
      </div>
      <div className="new-memo-row">
        <Plus size={14} />새 메모
      </div>
      <div className="session-list">
        <h3>{sectionLabel}</h3>
        {memos.map((memo) => (
          <div
            className={memo.id === activeId ? 'memo-row active' : 'memo-row'}
            key={memo.id}
          >
            <strong>{memo.title}</strong>
            <span>{memo.preview}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 전역 컨트롤만 사는 줄. 나머지 픽셀은 네이티브 창을 끄는 자리라 비어 있다. */
export function CommandBar({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={
        collapsed
          ? 'split-workspace-commandbar session-collapsed'
          : 'split-workspace-commandbar'
      }
    >
      <span className="split-command-button">
        <PanelLeft size={16} />
      </span>
      <span className="split-command-button">
        <Search size={16} />
      </span>
      <span aria-hidden="true" className="split-command-divider" />
      <span className="split-command-button">
        <Undo size={18} />
      </span>
      <span className="split-command-button">
        <Redo size={18} />
      </span>
    </div>
  );
}

export function AppShell({
  memos,
  activeMemoId,
  activeNav = 'memo',
  sectionLabel,
  children,
  sidePanel,
  collapsed = false,
}: {
  memos?: MemoRow[];
  activeMemoId?: string;
  activeNav?: NavTab;
  sectionLabel?: string;
  children: ReactNode;
  sidePanel?: ReactNode;
  /* 접으면 레일이 레이아웃 폭을 전혀 차지하지 않고 작업공간이 창 끝까지
     채워진다. 앱의 `.app-shell.session-collapsed` 와 같은 상태다. */
  collapsed?: boolean;
}) {
  return (
    <div className={collapsed ? 'subnota-app session-collapsed' : 'subnota-app'}>
      {!collapsed && <NavRail active={activeNav} />}
      {!collapsed && memos && (
        <SessionRail
          activeId={activeMemoId ?? memos[0]?.id ?? ''}
          memos={memos}
          sectionLabel={sectionLabel}
        />
      )}
      {/* 커맨드바는 창 왼쪽 끝에서 시작해 사이드바 위를 덮는다. 그래서 작업공간
          안이 아니라 셸 바로 아래에 둔다 — 패널 안에 넣으면 사이드바 폭만큼
          오른쪽으로 밀린다. */}
      <CommandBar collapsed={collapsed} />
      <section className="workspace">
        <div className="split-workspace-shell">
          <div className="split-workspace-container">{children}</div>
        </div>
        {sidePanel}
      </section>
    </div>
  );
}
