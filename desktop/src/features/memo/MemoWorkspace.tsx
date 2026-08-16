import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { Menu } from '@mantine/core';
import {
  ChevronRight,
  ExternalLink,
  Folder,
  FolderOpen,
  Pin,
  PinSolid,
  Trash2,
} from '@/components/icons';

import { formatMemoDate } from '../../lib/date';
import { getSections } from '../../lib/memoSections';
import { splitMemoCategories } from '../../lib/memoCategory';
import {
  MemoRow,
  TopicCluster,
  TopicInboxMembership,
  TopicMembership,
} from '../../types';
import { InboxSession } from '../../services/backend/inboxService';
import EmptyState from '../../components/EmptyState';
import { localize, useUiLanguage } from '../../lib/uiLanguage';

interface MemoWorkspaceProps {
  activeMemoId: string | null;
  memos: MemoRow[];
  isSessionCollapsed?: boolean;
  sessionRailWidth: number;
  onSessionRailWidthChange: (width: number) => void;
  isSessionRailResizing: boolean;
  onSessionRailResizeStateChange: (isResizing: boolean) => void;
  onToggleSession: () => void;
  onDeleteMemoById: (id: string) => void;
  onSidebarModeChange: (mode: MemoSidebarMode) => void;
  onSelectMemo: (memo: MemoRow) => void;
  onTogglePinMemo?: (memoId: string) => void;
  pinnedMemoIds?: string[];
  topicClusters: TopicCluster[];
  topicInboxItems?: InboxSession[];
  topicInboxMemberships?: TopicInboxMembership[];
  topicMemberships: TopicMembership[];
  sidebarMode: MemoSidebarMode;
  workspaceContent?: ReactNode;
}

interface TopicMemoRow {
  memo: MemoRow;
  score: number;
}

export type MemoSidebarMode = 'time' | 'folders';

export const SESSION_RAIL_MIN_WIDTH = 200;
export const SESSION_RAIL_WIDTH = 200;
export const SESSION_RAIL_MAX_WIDTH = 300;

export const clampSessionRailWidth = (width: number) =>
  Math.min(SESSION_RAIL_MAX_WIDTH, Math.max(SESSION_RAIL_MIN_WIDTH, width));

// 접어둔 상태가 앱을 껐다 켜면 풀리면 접는 의미가 없다. 섹션 제목이 곧 키다.
const COLLAPSED_SECTIONS_KEY = 'subnota.sidebar.collapsedSections';

const readCollapsedSections = () => {
  try {
    const raw = window.localStorage?.getItem(COLLAPSED_SECTIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((title): title is string => typeof title === 'string')
        : [],
    );
  } catch {
    return new Set<string>();
  }
};

const getMemoTitle = (memo: MemoRow, language: 'en' | 'ko') => {
  const title = memo.content
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (!title) {
    return localize(language, '새 메모', 'New note');
  }

  return title.length > 22 ? `${title.slice(0, 22).trimEnd()}...` : title;
};

const getMemoPreview = (memo: MemoRow, language: 'en' | 'ko') => {
  const lines = memo.content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const preview =
    lines[1] ?? lines[0] ?? localize(language, '내용 없음', 'No content');

  return preview.length > 38 ? `${preview.slice(0, 38).trimEnd()}...` : preview;
};

const getTopicMemoRows = ({
  memberships,
  memos,
  topicId,
}: {
  memberships: TopicMembership[];
  memos: MemoRow[];
  topicId: string;
}) => {
  const memoById = new Map(memos.map(memo => [memo.id, memo]));

  return memberships
    .filter(membership => membership.topicId === topicId)
    .map(membership => {
      const memo = memoById.get(membership.memoId);

      return memo ? { memo, score: membership.score ?? 0.5 } : null;
    })
    .filter((item): item is TopicMemoRow => Boolean(item))
    .sort((a, b) => b.score - a.score);
};

const MemoWorkspace = ({
  activeMemoId,
  memos,
  isSessionCollapsed = false,
  sessionRailWidth,
  onSessionRailWidthChange,
  isSessionRailResizing,
  onSessionRailResizeStateChange,
  onToggleSession,
  onDeleteMemoById,
  onSidebarModeChange,
  onSelectMemo,
  onTogglePinMemo,
  pinnedMemoIds = [],
  topicClusters,
  topicInboxItems = [],
  topicInboxMemberships = [],
  topicMemberships,
  sidebarMode,
  workspaceContent,
}: MemoWorkspaceProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [memoMenu, setMemoMenu] = useState<{ x: number; y: number; id: string } | null>(
    null,
  );
  const [selectedTopicMemoId, setSelectedTopicMemoId] = useState<string | null>(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(
    () => new Set(),
  );
  const topicMemoRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const { miniMemos, normalMemos } = useMemo(
    () => splitMemoCategories(memos),
    [memos],
  );
  // 미니는 별도 모드가 아니라 노트 목록의 한 섹션이다.
  const sections = getSections(normalMemos, pinnedMemoIds, miniMemos, language);
  const [collapsedSections, setCollapsedSections] = useState(readCollapsedSections);
  const toggleSection = (title: string) => {
    const next = new Set(collapsedSections);
    if (next.has(title)) {
      next.delete(title);
    } else {
      next.add(title);
    }
    setCollapsedSections(next);
    window.localStorage?.setItem(
      COLLAPSED_SECTIONS_KEY,
      JSON.stringify([...next]),
    );
  };
  // Topic clusters (State A) rendered as collapsible folders in the session
  // rail. Reuses getTopicMemoRows so a folder lists the same member memos the
  // topic detail view would, sorted by membership score then folder size.
  const topicFolders = useMemo(() => {
    const inboxById = new Map(topicInboxItems.map(item => [item.id, item]));
    return topicClusters
      .map(cluster => ({
        cluster,
        rows: getTopicMemoRows({
          memberships: topicMemberships,
          memos: normalMemos,
          topicId: cluster.id,
        }),
        // Saved web-inbox summaries attached to this topic (State A decoration).
        linkRows: topicInboxMemberships
          .filter(membership => membership.topicId === cluster.id)
          .map(membership => ({
            item: inboxById.get(membership.inboxSessionId),
            score: membership.score ?? 0,
          }))
          .filter((row): row is { item: InboxSession; score: number } =>
            Boolean(row.item),
          )
          .sort((a, b) => b.score - a.score),
      }))
      .filter(folder => folder.rows.length > 0 || folder.linkRows.length > 0)
      .sort((a, b) => b.rows.length - a.rows.length);
  }, [normalMemos, topicClusters, topicInboxItems, topicInboxMemberships, topicMemberships]);
  const showTopicFolder = (topicId: string, memoId?: string) => {
    if (isSessionCollapsed) {
      onToggleSession();
    }
    onSidebarModeChange('folders');
    setActiveTopicId(topicId);
    setSelectedTopicMemoId(memoId ?? null);
    setExpandedTopicIds(new Set([topicId]));
  };

  useEffect(() => {
    if (sidebarMode !== 'folders' || !selectedTopicMemoId) {
      return;
    }

    const timer = window.setTimeout(() => {
      topicMemoRowRefs.current
        .get(selectedTopicMemoId)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    activeTopicId,
    expandedTopicIds,
    isSessionCollapsed,
    selectedTopicMemoId,
    sidebarMode,
  ]);

  useEffect(() => {
    const handleShowTopicFolder = (event: Event) => {
      const detail = (event as CustomEvent<{ memoId?: string; topicId?: string }>).detail;
      if (detail?.topicId) {
        showTopicFolder(detail.topicId, detail.memoId);
      }
    };

    window.addEventListener('subnota:show-topic-folder', handleShowTopicFolder);
    return () => {
      window.removeEventListener('subnota:show-topic-folder', handleShowTopicFolder);
    };
  });

  const toggleTopicFolder = (topicId: string) =>
    setExpandedTopicIds(previous => {
      const next = new Set(previous);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });

  const handleSessionRailResizeStart = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (isSessionCollapsed) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const startX = event.clientX;
    const startWidth = sessionRailWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let isCleanedUp = false;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    onSessionRailResizeStateChange(true);

    const handleMove = (moveEvent: PointerEvent) => {
      onSessionRailWidthChange(
        clampSessionRailWidth(startWidth + moveEvent.clientX - startX),
      );
    };

    const cleanup = () => {
      if (isCleanedUp) {
        return;
      }

      isCleanedUp = true;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('blur', cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      onSessionRailResizeStateChange(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
    window.addEventListener('blur', cleanup);
  };

  const handleSessionRailResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }

    event.preventDefault();
    const nextWidth =
      event.key === 'Home'
        ? SESSION_RAIL_MIN_WIDTH
        : event.key === 'End'
          ? SESSION_RAIL_MAX_WIDTH
          : sessionRailWidth + (event.key === 'ArrowRight' ? 8 : -8);
    onSessionRailWidthChange(clampSessionRailWidth(nextWidth));
  };


  return (
    <div className="memo-layout">
      <motion.aside
        className="session-rail"
        initial={false}
        animate={{ width: isSessionCollapsed ? 0 : sessionRailWidth }}
        transition={{
          duration: isSessionRailResizing ? 0 : 0.28,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
       <div
         className="session-rail-inner"
         style={{ '--session-rail-width': `${sessionRailWidth}px` } as CSSProperties}
       >
        {sidebarMode === 'time' ? (
          <>
            <div className="session-list">
              {sections.map(section => {
                const isCollapsed = collapsedSections.has(section.title);

                return (
                <section key={section.title}>
                  <button
                    aria-expanded={!isCollapsed}
                    className={`session-section-toggle ${isCollapsed ? 'collapsed' : ''}`}
                    onClick={() => toggleSection(section.title)}
                    type="button"
                  >
                    <ChevronRight size={13} />
                    {section.title}
                    <span className="session-section-count">
                      {section.data.length}
                    </span>
                  </button>
                  {!isCollapsed && section.data.map(memo => (
                    <button
                      className={memo.id === activeMemoId ? 'memo-row active' : 'memo-row'}
                      key={memo.id}
                      onClick={() => onSelectMemo(memo)}
                      onContextMenu={event => {
                        event.preventDefault();
                        setMemoMenu({ id: memo.id, x: event.clientX, y: event.clientY });
                      }}
                      type="button"
                    >
                      <strong>{getMemoTitle(memo, language)}</strong>
                      <span>
                        {formatMemoDate(memo.updated_at, language)} ·{' '}
                        {getMemoPreview(memo, language)}
                      </span>
                    </button>
                  ))}
                </section>
                );
              })}
              {sections.length === 0 && (
                <EmptyState
                  size="inline"
                  title={t('첫 메모를 시작해 보세요', 'Start your first note')}
                  tone="start"
                />
              )}
            </div>
          </>
        ) : sidebarMode === 'folders' ? (
          <>
            {/* 부제 제거. 비어 있을 때의 안내는 아래 EmptyState가 이미 한다. */}
            <div className="topic-folder-list">
              {topicFolders.length === 0 ? (
                <EmptyState
                  size="inline"
                  title={t(
                    '메모가 쌓이면 주제별로 묶입니다',
                    'Notes are grouped by topic as they accumulate.',
                  )}
                  tone="start"
                />
              ) : (
                topicFolders.map(({ cluster, rows, linkRows }) => {
                  const isExpanded = expandedTopicIds.has(cluster.id);

                  return (
                    <section className="topic-folder" key={cluster.id}>
                      <button
                        aria-expanded={isExpanded}
                        className="topic-folder-head"
                        onClick={() => toggleTopicFolder(cluster.id)}
                        type="button"
                      >
                        <span className="topic-folder-chevron">
                          <ChevronRight size={14} />
                        </span>
                        {isExpanded ? (
                          <FolderOpen size={16} />
                        ) : (
                          <Folder size={16} />
                        )}
                        <span className="topic-folder-label">
                          {cluster.label}
                        </span>
                        <em className="topic-folder-count">
                          {rows.length + linkRows.length}
                        </em>
                      </button>
                      {isExpanded && (
                        <div className="topic-folder-memos">
                          {rows.map(({ memo }) => (
                            <button
                              className={
                                memo.id === activeMemoId || memo.id === selectedTopicMemoId
                                  ? 'memo-row active'
                                  : 'memo-row'
                              }
                              key={memo.id}
                              ref={element => {
                                if (element) {
                                  topicMemoRowRefs.current.set(memo.id, element);
                                } else {
                                  topicMemoRowRefs.current.delete(memo.id);
                                }
                              }}
                              aria-current={
                                memo.id === selectedTopicMemoId ? 'true' : undefined
                              }
                              onClick={() => {
                                setSelectedTopicMemoId(memo.id);
                                onSelectMemo(memo);
                              }}
                              onContextMenu={event => {
                                event.preventDefault();
                                setMemoMenu({
                                  id: memo.id,
                                  x: event.clientX,
                                  y: event.clientY,
                                });
                              }}
                              type="button"
                            >
                              <strong>{getMemoTitle(memo, language)}</strong>
                              <span>
                                {formatMemoDate(memo.updated_at, language)} ·{' '}
                                {getMemoPreview(memo, language)}
                              </span>
                            </button>
                          ))}
                          {linkRows.map(({ item }) => (
                            <button
                              className="memo-row topic-folder-link-row"
                              key={item.id}
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent('subnota:open-inbox-source', {
                                    detail: { inboxSessionId: item.id },
                                  }),
                                );
                              }}
                              type="button"
                            >
                              <strong>
                                <ExternalLink size={12} />{' '}
                                {item.title ?? item.domain ?? t('저장한 링크', 'Saved link')}
                              </strong>
                              <span>
                                {item.summaryOneLiner ??
                                  item.summary ??
                                  item.canonicalUrl ??
                                  ''}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })
              )}
            </div>
          </>
        ) : null}
       </div>
        <div
          aria-hidden={isSessionCollapsed}
          aria-label={t('메모 목록 너비 조절', 'Resize note list')}
          aria-orientation="vertical"
          aria-valuemax={SESSION_RAIL_MAX_WIDTH}
          aria-valuemin={SESSION_RAIL_MIN_WIDTH}
          aria-valuenow={Math.round(sessionRailWidth)}
          className="session-rail-resizer"
          onKeyDown={handleSessionRailResizeKeyDown}
          onPointerDown={handleSessionRailResizeStart}
          role="separator"
          tabIndex={isSessionCollapsed ? -1 : 0}
        />
      </motion.aside>

      {workspaceContent}

      {memoMenu && (
        <Menu
          opened
          onClose={() => setMemoMenu(null)}
          position="bottom-start"
          offset={2}
          width={160}
          shadow="md"
        >
          <Menu.Target>
            <div
              style={{
                position: 'fixed',
                left: memoMenu.x,
                top: memoMenu.y,
                width: 0,
                height: 0,
              }}
            />
          </Menu.Target>
          <Menu.Dropdown>
            {onTogglePinMemo && (
              <Menu.Item
                leftSection={
                  pinnedMemoIds.includes(memoMenu.id) ? (
                    <PinSolid size={16} />
                  ) : (
                    <Pin size={16} />
                  )
                }
                onClick={() => {
                  const target = memoMenu.id;
                  setMemoMenu(null);
                  onTogglePinMemo(target);
                }}
              >
                {pinnedMemoIds.includes(memoMenu.id)
                  ? t('고정 해제', 'Unpin')
                  : t('고정', 'Pin')}
              </Menu.Item>
            )}
            <Menu.Item
              color="red"
              leftSection={<Trash2 size={16} />}
              onClick={() => {
                const target = memoMenu.id;
                setMemoMenu(null);
                if (window.confirm(t('이 메모를 삭제하시겠습니까?', 'Delete this note?'))) {
                  onDeleteMemoById(target);
                }
              }}
            >
              {t('삭제', 'Delete')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
};

export default MemoWorkspace;
