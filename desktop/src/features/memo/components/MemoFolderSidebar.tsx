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
import type { FolderRecommendation } from '../folderOrganization';
import {
  getFolderMemoRows,
  getMemoPreview,
  getMemoTitle,
} from '../memoWorkspaceUtils';
import MemoFolderActionsMenu from './MemoFolderActionsMenu';
import MemoFolderRecommendations, {
  type MemoFolderRecommendationDraft,
} from './MemoFolderRecommendations';

interface MemoFolderSidebarProps {
  activeMemoId: string | null;
  folderMemberships: MemoFolderMembership[];
  folderRecommendations: FolderRecommendation[];
  folders: MemoFolder[];
  language: 'en' | 'ko';
  memos: MemoRow[];
  normalMemos: MemoRow[];
  onCreateFolder: (draft: {
    description?: string;
    mode: MemoFolderMode;
    name: string;
  }) => Promise<MemoFolder | null>;
  onCreateFolderFromRecommendation: (draft: {
    description?: string;
    memoIds: string[];
    mode: MemoFolderMode;
    name: string;
    topicId: string;
  }) => Promise<MemoFolder | null>;
  onCreateMemoInFolder: (folderId: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onOpenMemoMenu: (memoId: string, x: number, y: number) => void;
  onSelectMemo: (memo: MemoRow) => void;
  onUpdateFolderDetails: (
    folderId: string,
    draft: { description: string; name: string },
  ) => Promise<void>;
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
  onUpdateFolderDetails,
  onUpdateFolderMode,
}: MemoFolderSidebarProps) {
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderDescription, setEditingFolderDescription] = useState('');
  const [editingFolderName, setEditingFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [recommendationDraft, setRecommendationDraft] =
    useState<MemoFolderRecommendationDraft | null>(null);
  const [newFolderMode, setNewFolderMode] = useState<MemoFolderMode>('manual');
  const [newFolderName, setNewFolderName] = useState('');

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

  const submitFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const folder = await onCreateFolder({
      description: newFolderDescription,
      mode: newFolderMode,
      name,
    });
    if (!folder) return;
    setExpandedFolderIds(current => new Set(current).add(folder.id));
    setNewFolderDescription('');
    setNewFolderName('');
    setNewFolderMode('manual');
    setIsCreatingFolder(false);
  };

  const submitFolderDetails = async (folderId: string) => {
    if (!editingFolderName.trim()) return;
    await onUpdateFolderDetails(folderId, {
      description: editingFolderDescription,
      name: editingFolderName,
    });
    setEditingFolderId(null);
  };

  const submitRecommendation = async () => {
    if (!recommendationDraft?.name.trim()) return;
    const folder = await onCreateFolderFromRecommendation({
      ...recommendationDraft,
      name: recommendationDraft.name.trim(),
    });
    if (!folder) return;
    setExpandedFolderIds(current => new Set(current).add(folder.id));
    setRecommendationDraft(null);
  };

  return (
    <>
      <div className="memo-folder-toolbar">
        <strong>{t('폴더', 'Folders')}</strong>
        <button
          aria-label={t('새 폴더', 'New folder')}
          className="memo-folder-add"
          onClick={() => setIsCreatingFolder(current => !current)}
          type="button"
        >
          <Plus size={15} />
        </button>
      </div>
      <MemoFolderRecommendations
        folderRecommendations={folderRecommendations}
        language={language}
        memos={memos}
        onBeginReview={recommendation => setRecommendationDraft({
          ...recommendation,
          mode: 'automatic',
        })}
        onCancel={() => setRecommendationDraft(null)}
        onDraftChange={patch => setRecommendationDraft(current =>
          current ? { ...current, ...patch } : current,
        )}
        onSubmit={submitRecommendation}
        recommendationDraft={recommendationDraft}
      />
      {isCreatingFolder && (
        <form
          className="memo-folder-create"
          onSubmit={event => {
            event.preventDefault();
            void submitFolder();
          }}
        >
          <input
            aria-label={t('폴더 이름', 'Folder name')}
            autoFocus
            maxLength={80}
            onChange={event => setNewFolderName(event.target.value)}
            placeholder={t('폴더 이름', 'Folder name')}
            value={newFolderName}
          />
          <input
            aria-label={t('폴더 설명', 'Folder description')}
            maxLength={500}
            onChange={event => setNewFolderDescription(event.target.value)}
            placeholder={t('한 줄 설명 (선택)', 'One-line description (optional)')}
            value={newFolderDescription}
          />
          <div className="memo-folder-mode-picker">
            <button
              aria-pressed={newFolderMode === 'manual'}
              onClick={() => setNewFolderMode('manual')}
              type="button"
            >
              {t('수동', 'Manual')}
            </button>
            <button
              aria-pressed={newFolderMode === 'automatic'}
              onClick={() => setNewFolderMode('automatic')}
              type="button"
            >
              <Sparkles size={12} />
              {t('자동', 'Automatic')}
            </button>
          </div>
          <p className="memo-folder-mode-help">
            {newFolderMode === 'manual'
              ? t('이 폴더는 사용자가 넣은 메모만 유지합니다.', 'Only notes you add stay in this folder.')
              : t('미분류 메모 중 어울리는 메모만 자동으로 추가합니다.', 'Matching unfiled notes are added automatically.')}
          </p>
          <button
            className="memo-folder-create-submit"
            disabled={!newFolderName.trim()}
            type="submit"
          >
            {t('만들기', 'Create')}
          </button>
        </form>
      )}
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
            const isEditing = editingFolderId === folder.id;

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
                    onEditFolder={() => {
                      setEditingFolderId(folder.id);
                      setEditingFolderName(folder.name);
                      setEditingFolderDescription(folder.description);
                    }}
                    onUpdateFolderMode={onUpdateFolderMode}
                    t={t}
                  />
                </div>
                {isEditing && (
                  <form
                    className="memo-folder-edit"
                    onSubmit={event => {
                      event.preventDefault();
                      void submitFolderDetails(folder.id);
                    }}
                  >
                    <input
                      aria-label={t('폴더 이름', 'Folder name')}
                      autoFocus
                      maxLength={80}
                      onChange={event => setEditingFolderName(event.target.value)}
                      value={editingFolderName}
                    />
                    <input
                      aria-label={t('폴더 설명', 'Folder description')}
                      maxLength={500}
                      onChange={event => setEditingFolderDescription(event.target.value)}
                      placeholder={t('한 줄 설명 (선택)', 'One-line description (optional)')}
                      value={editingFolderDescription}
                    />
                    <div>
                      <button
                        onClick={() => setEditingFolderId(null)}
                        type="button"
                      >
                        {t('취소', 'Cancel')}
                      </button>
                      <button disabled={!editingFolderName.trim()} type="submit">
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
                      {rows.map(({ memo }) => {
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
                            {isAlsoInOtherFolder && (
                              <small className="memo-folder-overlap">
                                {t('다른 폴더에도 있음', 'Also in another folder')}
                              </small>
                            )}
                          </button>
                        );
                      })}
                      {rows.length === 0 && (
                        <p className="memo-folder-empty">
                          {t('아직 메모가 없습니다.', 'No notes yet.')}
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
