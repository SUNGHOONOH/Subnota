import {
  ClipboardCopy,
  Cloud,
  Copy,
  Download,
  MoreHorizontal,
  Pin,
  PinSolid,
  Trash2,
} from '@/components/icons';
import TooltipIconButton from '../../../components/TooltipIconButton';
import { copyTextToClipboard } from '../../../lib/copy-code';
import type { MemoSavePresentation } from '../../../lib/memoSaveStatus';
import type { MemoRow } from '../../../types';
import type {
  MemoSplitEditorState,
  MemoSplitPaneState,
} from './MemoSplitWorkspace';

type Translate = (korean: string, english: string) => string;

export type NoteMenuFeedback = {
  message: string;
  tone: 'error' | 'success';
};

interface MemoSplitNoteMenuProps {
  editor: MemoSplitEditorState;
  isMemoSyncRetrying: boolean;
  isNoteMenuOpen: boolean;
  memo: MemoRow | null;
  noteMenuFeedback: NoteMenuFeedback | null;
  noteTitle: string;
  onClearFeedback: () => void;
  onCloseEditor: (pane: MemoSplitPaneState, editorId: string) => void;
  onCloseMenu: () => void;
  onCreateMemo: (content: string, category?: string) => MemoRow;
  onDeleteMemoById?: (memoId: string) => void;
  onOpenMemoInPane: (paneId: string, memo: MemoRow) => void;
  onRetryMemoSync?: (memoId: string) => void;
  onSetMenuButtonElement: (element: HTMLDivElement | null) => void;
  onSetMenuDropdownElement: (element: HTMLDivElement | null) => void;
  onSetFeedback: (feedback: NoteMenuFeedback | null) => void;
  onTogglePinMemo?: (memoId: string) => void;
  onToggleMenu: () => void;
  pane: MemoSplitPaneState;
  pinnedMemoIds: string[];
  savePresentation: MemoSavePresentation | null;
  value: string;
  translate: Translate;
}

const MemoSplitNoteMenu = ({
  editor,
  isMemoSyncRetrying,
  isNoteMenuOpen,
  memo,
  noteMenuFeedback,
  noteTitle,
  onClearFeedback,
  onCloseEditor,
  onCloseMenu,
  onCreateMemo,
  onDeleteMemoById,
  onOpenMemoInPane,
  onRetryMemoSync,
  onSetMenuButtonElement,
  onSetMenuDropdownElement,
  onSetFeedback,
  onTogglePinMemo,
  onToggleMenu,
  pane,
  pinnedMemoIds,
  savePresentation,
  value,
  translate: t,
}: MemoSplitNoteMenuProps) => (
  <div
    className="split-note-menu-anchor"
    ref={isNoteMenuOpen ? onSetMenuButtonElement : undefined}
  >
    <TooltipIconButton
      className={`split-action-btn split-note-menu-btn ${isNoteMenuOpen ? 'active' : ''}`}
      onClick={() => {
        onClearFeedback();
        onToggleMenu();
      }}
      tooltip={t('노트 메뉴', 'Note menu')}
    >
      <MoreHorizontal size={18} />
    </TooltipIconButton>
    {isNoteMenuOpen && (
      <div
        className="split-pane-menu-dropdown split-note-menu-dropdown"
        ref={onSetMenuDropdownElement}
      >
        {/* 목록 행의 구름 배지를 없앤 자리. 동기화 상태는 여기서만
            알린다 — 구름은 "클라우드에 있다"일 때만 붙인다. */}
        <div className="split-menu-title-row split-menu-sync-row">
          {memo?.local_sync_status === 'synced' ? (
            <Cloud aria-hidden="true" size={15} />
          ) : (
            // 구름이 없는 상태에서도 문구가 아래 항목들과 같은 줄에
            // 서도록 아이콘 자리를 비워 둔다.
            <span aria-hidden="true" className="split-menu-title-slot" />
          )}
          <span className="split-menu-title-label">
            {savePresentation?.label ??
              t('아직 저장되지 않은 새 노트', 'New note not yet saved')}
          </span>
          {memo?.local_sync_status === 'failed' && onRetryMemoSync && (
            <button
              aria-label={t('메모 동기화 재시도', 'Retry note sync')}
              className="split-menu-retry"
              disabled={isMemoSyncRetrying}
              onClick={() => onRetryMemoSync(memo.id)}
              type="button"
            >
              {isMemoSyncRetrying
                ? t('동기화 중...', 'Syncing...')
                : t('재시도', 'Retry')}
            </button>
          )}
        </div>
        {noteMenuFeedback && (
          <div
            className={`split-menu-feedback ${noteMenuFeedback.tone}`}
            role="status"
          >
            {noteMenuFeedback.message}
          </div>
        )}
        <div className="split-menu-separator" />
        <button
          className="split-menu-item"
          disabled={!memo || !onTogglePinMemo}
          onClick={() => {
            if (memo) {
              onTogglePinMemo?.(memo.id);
            }
            onCloseMenu();
          }}
          type="button"
        >
          {memo && pinnedMemoIds.includes(memo.id) ? (
            <PinSolid size={15} />
          ) : (
            <Pin size={15} />
          )}
          <span>
            {memo && pinnedMemoIds.includes(memo.id)
              ? t('메모 고정 해제', 'Unpin note')
              : t('메모 고정', 'Pin note')}
          </span>
        </button>
        <button
          className="split-menu-item"
          onClick={async () => {
            const copied = await copyTextToClipboard(value);
            onSetFeedback(
              copied
                ? {
                    message: t('Markdown을 복사했습니다.', 'Markdown copied.'),
                    tone: 'success',
                  }
                : {
                    message: t(
                      'Markdown을 복사하지 못했습니다.',
                      'Could not copy Markdown.',
                    ),
                    tone: 'error',
                  },
            );
          }}
          type="button"
        >
          <ClipboardCopy size={15} />
          <span>{t('Markdown 복사', 'Copy Markdown')}</span>
        </button>
        <button
          className="split-menu-item"
          onClick={async () => {
            try {
              const filePath = await window.electronAPI.exportMarkdown(
                noteTitle.trim() || t('제목 없음', 'Untitled note'),
                value,
              );
              if (filePath) {
                onSetFeedback({
                  message: t('Markdown을 내보냈습니다.', 'Markdown exported.'),
                  tone: 'success',
                });
              } else {
                onCloseMenu();
              }
            } catch {
              onSetFeedback({
                message: t(
                  'Markdown을 내보내지 못했습니다.',
                  'Could not export Markdown.',
                ),
                tone: 'error',
              });
            }
          }}
          type="button"
        >
          <Download size={15} />
          <span>{t('Markdown 내보내기', 'Export Markdown')}</span>
        </button>
        <button
          className="split-menu-item"
          disabled={!value.trim()}
          onClick={() => {
            const duplicated = onCreateMemo(
              value,
              memo?.category ?? editor.draftCategory,
            );
            onOpenMemoInPane(pane.id, duplicated);
            onCloseMenu();
          }}
          type="button"
        >
          <Copy size={15} />
          <span>{t('복제', 'Duplicate')}</span>
        </button>
        <div className="split-menu-separator" />
        <button
          className="split-menu-item split-menu-item-danger"
          disabled={!memo || !onDeleteMemoById}
          onClick={() => {
            if (
              memo &&
              window.confirm(t('노트를 삭제하시겠습니까?', 'Delete this note?'))
            ) {
              onDeleteMemoById?.(memo.id);
              onCloseEditor(pane, editor.id);
            }
            onCloseMenu();
          }}
          type="button"
        >
          <Trash2 size={15} />
          <span>{t('삭제', 'Delete')}</span>
        </button>
      </div>
    )}
  </div>
);

export default MemoSplitNoteMenu;
