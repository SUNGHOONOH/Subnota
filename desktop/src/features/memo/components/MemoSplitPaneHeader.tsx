import { Tooltip } from '@mantine/core';
import type { DragEvent } from 'react';

import { ChevronDown, Columns2, Plus, X } from '@/components/icons';
import TooltipIconButton from '../../../components/TooltipIconButton';
import {
  type AppShortcutSettings,
  formatHotkeyTooltip,
} from '../../../lib/shortcutSettings';
import {
  getActiveEditor,
  getMemoTabLabel,
  mirrorEditorPatch,
  type TabDropTarget,
  viewLabel,
} from '../memoSplitWorkspaceUtils';
import type { MemoRow } from '../../../types';
import type {
  MemoSplitEditorState,
  MemoSplitPaneState,
  MemoSplitPaneView,
} from './MemoSplitWorkspace';
import MemoSplitPaneMenu from './MemoSplitPaneMenu';

type Translate = (korean: string, english: string) => string;

interface MemoSplitPaneHeaderProps {
  appShortcuts?: AppShortcutSettings;
  canAddPane?: boolean;
  draggedTab: { editorId: string; paneId: string } | null;
  editors: MemoSplitEditorState[];
  isMenuOpen: boolean;
  language: 'en' | 'ko';
  onAddPane?: () => void;
  onAddEditor: (pane: MemoSplitPaneState) => void;
  onChangePane: (
    id: string,
    patch: Partial<MemoSplitPaneState>,
  ) => void;
  onCloseAllEditors: (pane: MemoSplitPaneState) => void;
  onCloseEditor: (pane: MemoSplitPaneState, editorId: string) => void;
  onClosePane: (pane: MemoSplitPaneState) => void;
  onClearTabDrag: () => void;
  onFocusPane?: (id: string) => void;
  onHandleTabDragLeave: (event: DragEvent<HTMLElement>) => void;
  onHandleTabDragOver: (
    event: DragEvent<HTMLElement>,
    paneId: string,
    target?: Omit<TabDropTarget, 'paneId'>,
  ) => void;
  onHandleTabDrop: (
    event: DragEvent<HTMLElement>,
    targetPaneId: string,
    targetIndex: number,
  ) => void;
  onHandleTabDragStart: (
    event: DragEvent<HTMLButtonElement>,
    paneId: string,
    editorId: string,
  ) => void;
  onSelectEditorView: (
    pane: MemoSplitPaneState,
    view: MemoSplitPaneView,
  ) => void;
  onSelectMemoById: (memoId: string) => void;
  onSetMenuActionsElement: (element: HTMLDivElement | null) => void;
  onSetMenuDropdownElement: (element: HTMLDivElement | null) => void;
  onToggleMenu: () => void;
  pane: MemoSplitPaneState;
  dropTarget: TabDropTarget | null;
  isLastPane: boolean;
  memoById: ReadonlyMap<string, MemoRow>;
  translate: Translate;
}

const MemoSplitPaneHeader = ({
  appShortcuts,
  canAddPane,
  draggedTab,
  editors,
  isMenuOpen,
  language,
  onAddPane,
  onAddEditor,
  onChangePane,
  onCloseAllEditors,
  onCloseEditor,
  onClosePane,
  onClearTabDrag,
  onFocusPane,
  onHandleTabDragLeave,
  onHandleTabDragOver,
  onHandleTabDrop,
  onHandleTabDragStart,
  onSelectEditorView,
  onSelectMemoById,
  onSetMenuActionsElement,
  onSetMenuDropdownElement,
  onToggleMenu,
  pane,
  dropTarget,
  isLastPane,
  memoById,
  translate: t,
}: MemoSplitPaneHeaderProps) => {
  const activeEditor = getActiveEditor(pane);

  return (
    <div className="split-pane-header">
      <div aria-hidden className="split-pane-titlebar-drag" />
      <div
        className="split-editor-tabs-scroll"
        onDragLeave={onHandleTabDragLeave}
        onDragOver={(event) => onHandleTabDragOver(event, pane.id)}
        onDrop={(event) => onHandleTabDrop(event, pane.id, editors.length)}
      >
        <div className="split-editor-tabs">
          {editors.map((editor) => {
            const tabLabel = editor.isViewPicker
              ? t('새 탭', 'New tab')
              : editor.view === 'memo'
                ? getMemoTabLabel(
                    editor.draftText ??
                      (editor.memoId
                        ? memoById.get(editor.memoId)?.content
                        : '') ??
                      '',
                    language,
                  )
                : viewLabel(editor.view, language);

            return (
              <button
                aria-label={tabLabel}
                draggable
                key={editor.id}
                onDragEnd={onClearTabDrag}
                onDragStart={(event) =>
                  onHandleTabDragStart(event, pane.id, editor.id)
                }
                onDragOver={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  onHandleTabDragOver(event, pane.id, {
                    editorId: editor.id,
                    position:
                      event.clientX > rect.left + rect.width / 2
                        ? 'after'
                        : 'before',
                  });
                }}
                onDrop={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const editorIndex = editors.findIndex(
                    (candidate) => candidate.id === editor.id,
                  );
                  onHandleTabDrop(
                    event,
                    pane.id,
                    editorIndex +
                      (event.clientX > rect.left + rect.width / 2 ? 1 : 0),
                  );
                }}
                onClick={() => {
                  onChangePane(pane.id, {
                    ...mirrorEditorPatch(editor),
                    activeEditorId: editor.id,
                    editors,
                  });
                  onFocusPane?.(pane.id);
                  if (editor.memoId) {
                    onSelectMemoById(editor.memoId);
                  }
                }}
                className={`split-editor-tab ${editor.id === activeEditor.id ? 'active' : ''}${draggedTab?.editorId === editor.id && draggedTab.paneId === pane.id ? ' dragging' : ''}${dropTarget?.paneId === pane.id && dropTarget.editorId === editor.id ? ` drop-${dropTarget.position}` : ''}`}
                title={tabLabel}
              >
                <span className="split-tab-label">{tabLabel}</span>
                <Tooltip
                  label={formatHotkeyTooltip(
                    t('탭 닫기', 'Close tab'),
                    editor.id === activeEditor.id
                      ? appShortcuts?.closeActiveTab
                      : null,
                  )}
                  openDelay={300}
                  position="bottom"
                >
                  <span
                    aria-label={t('탭 닫기', 'Close tab')}
                    className="split-tab-close"
                    draggable={false}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseEditor(pane, editor.id);
                    }}
                    onDragStart={(event) => event.preventDefault()}
                    onPointerDown={(event) => event.stopPropagation()}
                    role="button"
                  >
                    <X size={13} />
                  </span>
                </Tooltip>
              </button>
            );
          })}
          {dropTarget?.paneId === pane.id && !dropTarget.editorId && (
            <span aria-hidden className="split-tab-drop-indicator" />
          )}
          <div aria-hidden className="split-editor-tabs-drag-spacer" />
        </div>
      </div>
      <TooltipIconButton
        className="split-editor-tab-add"
        onClick={() => onAddEditor(pane)}
        tooltip={formatHotkeyTooltip(
          t('새 탭', 'New tab'),
          appShortcuts?.createTab,
        )}
      >
        <Plus size={15} />
      </TooltipIconButton>
      <div
        className="split-pane-actions"
        ref={isMenuOpen ? onSetMenuActionsElement : undefined}
      >
        <TooltipIconButton
          onClick={onAddPane}
          className="split-action-btn"
          disabled={!canAddPane}
          tooltip={
            canAddPane
              ? formatHotkeyTooltip(
                  t('두 패널로 나누기', 'Split into two panes'),
                  appShortcuts?.createSplitPane,
                )
              : t(
                  'split 패널은 최대 2개까지 열 수 있습니다',
                  'You can open up to two split panes.',
                )
          }
        >
          <Columns2 size={14} />
        </TooltipIconButton>
        <TooltipIconButton
          onClick={onToggleMenu}
          className={`split-action-btn ${isMenuOpen ? 'active' : ''}`}
          tooltip={t('탭 메뉴', 'Tab menu')}
        >
          <ChevronDown size={15} />
        </TooltipIconButton>
        <TooltipIconButton
          disabled={isLastPane}
          onClick={() => onClosePane(pane)}
          className="split-action-btn"
          tooltip={
            isLastPane
              ? t(
                  '마지막 패널은 닫을 수 없습니다',
                  'The last pane cannot be closed.',
                )
              : t('패널 닫기', 'Close pane')
          }
        >
          ×
        </TooltipIconButton>
      </div>
      {isMenuOpen && (
        <MemoSplitPaneMenu
          activeView={activeEditor.view}
          editorCount={editors.length}
          language={language}
          onCloseAllEditors={() => onCloseAllEditors(pane)}
          onDropdownElementChange={onSetMenuDropdownElement}
          onSelectView={(view) => onSelectEditorView(pane, view)}
        />
      )}
    </div>
  );
};

export default MemoSplitPaneHeader;
