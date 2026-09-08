import type { Editor } from '@tiptap/core';
import { EditorContext } from '@tiptap/react';
import {
  PanelLeft,
  PanelLeftClose,
  Search,
} from '@/components/icons';
import TooltipIconButton from '../../../components/TooltipIconButton';
import { UndoRedoButton } from '../../../components/tiptap-ui/undo-redo-button/undo-redo-button';
import {
  type AppShortcutSettings,
  formatHotkeyTooltip,
} from '../../../lib/shortcutSettings';
import { localize } from '../../../lib/uiLanguage';

interface SplitWorkspaceCommandBarProps {
  appShortcuts?: AppShortcutSettings;
  focusedToolbarEditor: Editor | null;
  isSessionCollapsed: boolean;
  language: 'en' | 'ko';
  onOpenGlobalSearch?: () => void;
  onToggleSession?: () => void;
  searchShortcut?: string;
}

const SplitWorkspaceCommandBar = ({
  appShortcuts,
  focusedToolbarEditor,
  isSessionCollapsed,
  language,
  onOpenGlobalSearch,
  onToggleSession,
  searchShortcut,
}: SplitWorkspaceCommandBarProps) => {
  const t = (korean: string, english: string) =>
    localize(language, korean, english);

  return (
    <div
      className={`split-workspace-commandbar ${
        isSessionCollapsed ? 'session-collapsed' : ''
      }`}
    >
      {onToggleSession && (
        <TooltipIconButton
          className="split-command-button session-toggle-button"
          onClick={onToggleSession}
          tooltip={formatHotkeyTooltip(
            isSessionCollapsed
              ? t('사이드바 열기', 'Show sidebar')
              : t('사이드바 접기', 'Hide sidebar'),
            appShortcuts?.toggleSidebar,
          )}
        >
          {isSessionCollapsed ? (
            <PanelLeft size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </TooltipIconButton>
      )}
      {onOpenGlobalSearch && (
        <TooltipIconButton
          aria-label={t('전역 검색', 'Global search')}
          className="split-command-button global-search-trigger"
          onClick={onOpenGlobalSearch}
          tooltip={formatHotkeyTooltip(t('전역 검색', 'Global search'), searchShortcut)}
        >
          <Search size={16} />
        </TooltipIconButton>
      )}
      {/* 접기·검색(사이드바)과 undo·redo(문서)는 성격이 달라 한 덩어리로
          읽히면 안 된다. */}
      <div aria-hidden className="split-command-divider" />
      <EditorContext.Provider value={{ editor: focusedToolbarEditor }}>
        <UndoRedoButton
          action="undo"
          aria-label={t('실행 취소', 'Undo')}
          tooltip={t('실행 취소', 'Undo')}
        />
        <UndoRedoButton
          action="redo"
          aria-label={t('다시 실행', 'Redo')}
          tooltip={t('다시 실행', 'Redo')}
        />
      </EditorContext.Provider>
      <div className="split-workspace-drag-spacer" />
      {/* 네트워크 검색·메모 고정은 노트 내부(툴바/⋯ 메뉴)로 이동했다.
          다크 모드 토글 복원 시 ThemeToggle을 이 자리에 되돌리면 된다. */}
    </div>
  );
};

export default SplitWorkspaceCommandBar;
