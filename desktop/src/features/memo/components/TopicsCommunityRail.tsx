import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, Folder, Topics } from '@/components/icons';

import { localize } from '../../../lib/uiLanguage';
import type {
  MemoRow,
  TopicCluster,
  TopicMembership,
} from '../../../types';
import { TOPIC_COLORS } from '../topicsGraphModel';

interface TopicsCommunityRailProps {
  activeMemoId?: string | null;
  focusedMemoId: string | null;
  folderSourceTopicIds: string[];
  language: 'en' | 'ko';
  memos: MemoRow[];
  onCreateFolderFromTopic?: (draft: {
    description?: string;
    mode: 'automatic' | 'manual';
    name: string;
    topicId: string;
  }) => Promise<unknown>;
  onFocusMemo: (memoId: string | null) => void;
  onFocusTopic: (topicId: string | null) => void;
  onOpenMemo: (memo: MemoRow) => void;
  topicFocusId: string | null;
  topicClusters: TopicCluster[];
  topicMemberships: TopicMembership[];
}

export default function TopicsCommunityRail({
  focusedMemoId,
  folderSourceTopicIds,
  language,
  memos,
  onCreateFolderFromTopic,
  onFocusMemo,
  onFocusTopic,
  onOpenMemo,
  topicFocusId,
  topicClusters,
  topicMemberships,
}: TopicsCommunityRailProps) {
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isTopicRailCollapsed, setIsTopicRailCollapsed] = useState(false);
  const [topicFolderDraft, setTopicFolderDraft] = useState<{
    description: string;
    mode: 'automatic' | 'manual';
    name: string;
    topicId: string;
  } | null>(null);

  return (
    <aside
      aria-label={t('감지된 주제', 'Detected topics')}
      className={`topics-community-rail${isTopicRailCollapsed ? ' collapsed' : ''}`}
    >
      <AnimatePresence initial={false}>
        {!isTopicRailCollapsed && (
          <motion.div
            animate={{ height: 'auto', opacity: 1 }}
            className="topics-community-list"
            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
            key="topic-list"
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {topicClusters.map((cluster, index) => {
              const isFocused = topicFocusId === cluster.id;
              const isFolder = folderSourceTopicIds.includes(cluster.id);
              const isExpanded = expandedTopicIds.has(cluster.id);
              const topicMemoIds = new Set(
                topicMemberships
                  .filter(membership => membership.topicId === cluster.id)
                  .map(membership => membership.memoId),
              );
              const topicMemos = memos.filter(memo => topicMemoIds.has(memo.id));
              return (
                <div
                  className={`topics-community-row${isFocused ? ' active' : ''}`}
                  key={cluster.id}
                >
                  <button
                    className="topics-community-select"
                    onClick={() => {
                      onFocusTopic(
                        topicFocusId === cluster.id ? null : cluster.id,
                      );
                      onFocusMemo(null);
                    }}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="topics-community-swatch"
                      style={{
                        backgroundColor: TOPIC_COLORS[index % TOPIC_COLORS.length],
                      }}
                    />
                    <span>{cluster.label}</span>
                    <em>{topicMemos.length}</em>
                  </button>
                  <button
                    aria-label={
                      isFolder
                        ? t('이미 폴더로 만들었습니다', 'Already made into a folder')
                        : t(
                            `${cluster.label} 주제로 폴더 만들기`,
                            `Make a folder from ${cluster.label}`,
                          )
                    }
                    className="topics-community-folder-action"
                    disabled={isFolder || !onCreateFolderFromTopic}
                    onClick={() =>
                      setTopicFolderDraft({
                        description: cluster.keywords.join(' · '),
                        mode: 'automatic',
                        name: cluster.label,
                        topicId: cluster.id,
                      })
                    }
                    title={
                      isFolder
                        ? t('폴더로 만들어짐', 'Made into a folder')
                        : t(
                            '이 주제와 메모를 폴더로 만들기',
                            'Make this topic and its notes into a folder',
                          )
                    }
                    type="button"
                  >
                    {isFolder ? <Check size={14} /> : <Folder size={14} />}
                  </button>
                  <button
                    aria-expanded={isExpanded}
                    aria-label={t(
                      `${cluster.label} 메모 ${isExpanded ? '접기' : '펼치기'}`,
                      `${isExpanded ? 'Collapse' : 'Expand'} notes in ${cluster.label}`,
                    )}
                    className="topics-community-expand"
                    onClick={() =>
                      setExpandedTopicIds(current => {
                        const next = new Set(current);
                        if (next.has(cluster.id)) next.delete(cluster.id);
                        else next.add(cluster.id);
                        return next;
                      })
                    }
                    type="button"
                  >
                    <ChevronRight size={13} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        animate={{ height: 'auto', opacity: 1 }}
                        className="topics-community-memos"
                        exit={{ height: 0, opacity: 0 }}
                        initial={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                      >
                        {topicMemos.map(memo => (
                          <button
                            className={focusedMemoId === memo.id ? 'active' : ''}
                            key={memo.id}
                            onClick={() => {
                              onFocusTopic(cluster.id);
                              onFocusMemo(memo.id);
                              onOpenMemo(memo);
                            }}
                            type="button"
                          >
                            {memo.content
                              .split('\n')
                              .map(line => line.trim())
                              .find(Boolean) ?? localize(language, '노트', 'Note')}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {topicFolderDraft?.topicId === cluster.id && (
                    <form
                      className="topics-community-folder-create"
                      onSubmit={event => {
                        event.preventDefault();
                        if (
                          !onCreateFolderFromTopic ||
                          !topicFolderDraft.name.trim()
                        )
                          return;
                        void onCreateFolderFromTopic({
                          ...topicFolderDraft,
                          name: topicFolderDraft.name.trim(),
                        })
                          .then(() => setTopicFolderDraft(null))
                          .catch(error => {
                            console.warn('Topic folder creation failed:', error);
                            window.alert(
                              t(
                                '폴더를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
                                'Could not create the folder. Please try again shortly.',
                              ),
                            );
                          });
                      }}
                    >
                      <input
                        aria-label={t('폴더 이름', 'Folder name')}
                        autoFocus
                        maxLength={80}
                        onChange={event =>
                          setTopicFolderDraft(current =>
                            current
                              ? { ...current, name: event.target.value }
                              : current,
                          )
                        }
                        value={topicFolderDraft.name}
                      />
                      <input
                        aria-label={t('폴더 설명', 'Folder description')}
                        maxLength={500}
                        onChange={event =>
                          setTopicFolderDraft(current =>
                            current
                              ? { ...current, description: event.target.value }
                              : current,
                          )
                        }
                        placeholder={t(
                          '한 줄 설명 (선택)',
                          'One-line description (optional)',
                        )}
                        value={topicFolderDraft.description}
                      />
                      <div className="topics-community-folder-mode">
                        <button
                          aria-pressed={topicFolderDraft.mode === 'automatic'}
                          onClick={() =>
                            setTopicFolderDraft(current =>
                              current
                                ? { ...current, mode: 'automatic' }
                                : current,
                            )
                          }
                          type="button"
                        >
                          {t('자동', 'Automatic')}
                        </button>
                        <button
                          aria-pressed={topicFolderDraft.mode === 'manual'}
                          onClick={() =>
                            setTopicFolderDraft(current =>
                              current ? { ...current, mode: 'manual' } : current,
                            )
                          }
                          type="button"
                        >
                          {t('수동', 'Manual')}
                        </button>
                      </div>
                      <p className="topics-community-folder-help">
                        {topicFolderDraft.mode === 'manual'
                          ? t(
                              '직접 넣은 메모만 유지합니다.',
                              'Keeps only notes you add yourself.',
                            )
                          : t(
                              '미분류 메모 중 어울리는 메모를 자동으로 추가합니다.',
                              'Automatically adds matching unfiled notes.',
                            )}
                      </p>
                      <div className="topics-community-folder-actions">
                        <button
                          onClick={() => setTopicFolderDraft(null)}
                          type="button"
                        >
                          {t('취소', 'Cancel')}
                        </button>
                        <button
                          disabled={!topicFolderDraft.name.trim()}
                          type="submit"
                        >
                          {t('폴더 만들기', 'Create folder')}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        aria-expanded={!isTopicRailCollapsed}
        className="topics-community-rail-head"
        onClick={() => setIsTopicRailCollapsed(current => !current)}
        type="button"
      >
        <Topics size={16} />
        <strong>{t('주제 영역', 'Topic areas')}</strong>
        <ChevronRight className="topics-community-rail-arrow" size={13} />
      </button>
    </aside>
  );
}
