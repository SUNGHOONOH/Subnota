import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Folder, FolderOpen, Plus, Sparkles } from '@/components/icons';

import EmptyState from '../../../components/EmptyState';
import { formatMemoDate } from '../../../lib/date';
import { localize } from '../../../lib/uiLanguage';
import {
  MemoFolder,
  MemoFolderMembership,
  MemoFolderMode,
  MemoRow,
} from '../../../types';
import {
  AUTOMATIC_FOLDER_MIN_SEEDS,
  type FolderRecommendation,
  getFolderSeedCount,
} from '../folderOrganization';
import {
  getFolderMemoRows,
  getMemoPreview,
  getMemoTitle,
} from '../memoWorkspaceUtils';
import MemoFolderActionsMenu from './MemoFolderActionsMenu';
import MemoFolderForm from './MemoFolderForm';
import MemoFolderRecommendations from './MemoFolderRecommendations';

type OpenFolderForm =
  | { kind: 'create' }
  | { kind: 'recommendation'; topicId: string }
  | { folderId: string; kind: 'rename' }
  | null;

interface MemoFolderSidebarProps {
  activeMemoId: string | null;
  folderMemberships: MemoFolderMembership[];
  folderRecommendations: FolderRecommendation[];
  folders: MemoFolder[];
  language: 'en' | 'ko';
  memos: MemoRow[];
  normalMemos: MemoRow[];
  onCreateFolder: (draft: {
    mode: MemoFolderMode;
    name: string;
  }) => Promise<MemoFolder | null>;
  onCreateFolderFromRecommendation: (draft: {
    memoIds: string[];
    mode: MemoFolderMode;
    name: string;
    topicId: string;
  }) => Promise<MemoFolder | null>;
  onCreateMemoInFolder: (folderId: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onOpenMemoMenu: (memoId: string, x: number, y: number) => void;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onSelectMemo: (memo: MemoRow) => void;
  onUpdateFolderMode: (folderId: string, mode: MemoFolderMode) => Promise<void>;
}

export default function MemoFolderSidebar({
  activeMemoId,
  folderMemberships,
  folderRecommendations,
  folders,
  language,
  memos,
  normalMemos,
  onCreateFolder,
  onCreateFolderFromRecommendation,
  onCreateMemoInFolder,
  onDeleteFolder,
  onOpenMemoMenu,
  onSelectMemo,
  onRenameFolder,
  onUpdateFolderMode,
}: MemoFolderSidebarProps) {
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  // 폼은 한 번에 하나만 연다. 새 폴더·제안 검토·이름 변경이 동시에 열리면
  // 모드 선택기가 두 개 보이고 어느 쪽이 무엇을 만드는지 흐려진다.
  const [openForm, setOpenForm] = useState<OpenFolderForm>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const visibleFolders = useMemo(() => {
    return folders
      .map(folder => ({
        folder,
        rows: getFolderMemoRows({
          folderId: folder.id,
          memberships: folderMemberships,
          memos: normalMemos,
        }),
      }))
      .sort((a, b) => b.folder.updatedAt.localeCompare(a.folder.updatedAt));
  }, [folderMemberships, folders, normalMemos]);

  const toggleFolder = (folderId: string) =>
    setExpandedFolderIds(previous => {
      const next = new Set(previous);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });

  const revealFolder = (folder: MemoFolder | null) => {
    if (!folder) return;
    setExpandedFolderIds(current => new Set(current).add(folder.id));
    setOpenForm(null);
  };

  const submitRename = async (folderId: string) => {
    if (!renameDraft.trim()) return;
    await onRenameFolder(folderId, renameDraft);
    setOpenForm(null);
  };

  return (
    <>
      <div className="memo-folder-toolbar">
        <strong>{t('폴더', 'Folders')}</strong>
        <button
          aria-expanded={openForm?.kind === 'create'}
          aria-label={t('새 폴더', 'New folder')}
          className="memo-folder-add"
          onClick={() =>
            setOpenForm(current => (current?.kind === 'create' ? null : { kind: 'create' }))
          }
          type="button"
        >
          <Plus size={15} />
        </button>
      </div>
      {openForm?.kind === 'create' && (
        <MemoFolderForm
          initialMode="manual"
          onCancel={() => setOpenForm(null)}
          onSubmit={async value => revealFolder(await onCreateFolder(value))}
          submitLabel={t('만들기', 'Create')}
          t={t}
        />
      )}
      <MemoFolderRecommendations
        folderRecommendations={folderRecommendations}
        language={language}
        memos={memos}
        onCancel={() => setOpenForm(null)}
        onOpen={topicId => setOpenForm({ kind: 'recommendation', topicId })}
        onSubmit={async (recommendation, value) =>
          revealFolder(
            await onCreateFolderFromRecommendation({
              ...value,
              memoIds: recommendation.memoIds,
              topicId: recommendation.topicId,
            }),
          )
        }
        openTopicId={openForm?.kind === 'recommendation' ? openForm.topicId : null}
      />
      <div className="topic-folder-list">
        {visibleFolders.length === 0 ? (
          <EmptyState
            size="inline"
            title={t(
              '폴더를 만들거나 Topics에서 가져오세요',
              'Create a folder or bring one in from Topics.',
            )}
            tone="start"
          />
        ) : (
          visibleFolders.map(({ folder, rows }) => {
            const isExpanded = expandedFolderIds.has(folder.id);
            const isRenaming =
              openForm?.kind === 'rename' && openForm.folderId === folder.id;
            const seedCount = getFolderSeedCount(folder.id, folderMemberships);

            return (
              <section className="topic-folder" key={folder.id}>
                <div className="memo-folder-head-row">
                  <button
                    aria-expanded={isExpanded}
                    className="topic-folder-head"
                    onClick={() => toggleFolder(folder.id)}
                    type="button"
                  >
                    <span className="topic-folder-chevron">
                      <ChevronRight size={14} />
                    </span>
                    {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                    <span className="topic-folder-label">{folder.name}</span>
                    {folder.mode === 'automatic' && (
                      <span
                        className="memo-folder-auto-mark"
                        title={t('자동 폴더', 'Automatic folder')}
                      >
                        <Sparkles size={12} />
                      </span>
                    )}
                    <em className="topic-folder-count">{rows.length}</em>
                  </button>
                  <MemoFolderActionsMenu
                    folder={folder}
                    onCreateMemoInFolder={onCreateMemoInFolder}
                    onDeleteFolder={onDeleteFolder}
                    onRenameFolder={() => {
                      setRenameDraft(folder.name);
                      setOpenForm({ folderId: folder.id, kind: 'rename' });
                    }}
                    onUpdateFolderMode={onUpdateFolderMode}
                    t={t}
                  />
                </div>
                {isRenaming && (
                  <form
                    className="memo-folder-form"
                    onKeyDown={event => {
                      if (event.key === 'Escape') setOpenForm(null);
                    }}
                    onSubmit={event => {
                      event.preventDefault();
                      void submitRename(folder.id);
                    }}
                  >
                    <input
                      aria-label={t('폴더 이름', 'Folder name')}
                      autoFocus
                      maxLength={80}
                      onChange={event => setRenameDraft(event.target.value)}
                      value={renameDraft}
                    />
                    <div className="memo-folder-form-actions">
                      <button
                        className="memo-folder-form-cancel"
                        onClick={() => setOpenForm(null)}
                        type="button"
                      >
                        {t('취소', 'Cancel')}
                      </button>
                      <button
                        className="memo-folder-form-submit"
                        disabled={!renameDraft.trim()}
                        type="submit"
                      >
                        {t('저장', 'Save')}
                      </button>
                    </div>
                  </form>
                )}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      animate={{ height: 'auto', opacity: 1 }}
                      className="topic-folder-memos"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      {folder.mode === 'automatic' && (
                        <p className="memo-folder-auto-status">
                          {seedCount < AUTOMATIC_FOLDER_MIN_SEEDS
                            ? t(
                                `메모를 ${AUTOMATIC_FOLDER_MIN_SEEDS}개 직접 넣으면 비슷한 메모를 모으기 시작해요 · ${seedCount}/${AUTOMATIC_FOLDER_MIN_SEEDS}`,
                                `Add ${AUTOMATIC_FOLDER_MIN_SEEDS} notes yourself to start gathering similar ones · ${seedCount}/${AUTOMATIC_FOLDER_MIN_SEEDS}`,
                              )
                            : t(
                                '넣어 둔 메모와 비슷한 미분류 메모를 모으는 중이에요.',
                                'Gathering unfiled notes similar to the ones you added.',
                              )}
                        </p>
                      )}
                      {rows.map(({ memo }) => {
                        const isAutomatic = folderMemberships.some(
                          membership =>
                            membership.memoId === memo.id &&
                            membership.folderId === folder.id &&
                            membership.source === 'automatic',
                        );
                        const isAlsoInOtherFolder = folderMemberships.some(
                          membership =>
                            membership.memoId === memo.id &&
                            membership.folderId !== folder.id,
                        );
                        return (
                          <button
                            className={memo.id === activeMemoId ? 'memo-row active' : 'memo-row'}
                            key={memo.id}
                            onClick={() => onSelectMemo(memo)}
                            onContextMenu={event => {
                              event.preventDefault();
                              onOpenMemoMenu(memo.id, event.clientX, event.clientY);
                            }}
                            type="button"
                          >
                            <strong>{getMemoTitle(memo, language)}</strong>
                            <span>
                              {formatMemoDate(memo.updated_at, language)} ·{' '}
                              {getMemoPreview(memo, language)}
                            </span>
                            {(isAutomatic || isAlsoInOtherFolder) && (
                              <small className="memo-folder-overlap">
                                {[
                                  isAutomatic && t('자동으로 들어옴', 'Added automatically'),
                                  isAlsoInOtherFolder && t('다른 폴더에도 있음', 'Also in another folder'),
                                ].filter(Boolean).join(' · ')}
                              </small>
                            )}
                          </button>
                        );
                      })}
                      {(rows.length === 0 ||
                        (folder.mode === 'automatic' &&
                          seedCount < AUTOMATIC_FOLDER_MIN_SEEDS)) && (
                        <p className="memo-folder-empty">
                          {t(
                            '노트의 ⋯ 메뉴나, 목록에서 메모를 우클릭해 넣을 수 있어요.',
                            "Add notes from a note's ⋯ menu, or right-click one in the list.",
                          )}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}
