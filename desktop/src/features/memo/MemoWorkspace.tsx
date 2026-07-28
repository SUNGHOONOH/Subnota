import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Menu } from '@mantine/core';
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Folder,
  FolderOpen,
  NotebookText,
  Pin,
  PinSolid,
  Plus,
  Trash2,
} from '@/components/icons';
import TooltipIconButton from '../../components/TooltipIconButton';

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

interface MemoWorkspaceProps {
  activeMemoId: string | null;
  memos: MemoRow[];
  isSessionCollapsed?: boolean;
  onToggleSession: () => void;
  onDeleteMemoById: (id: string) => void;
  onNewMemo: () => void;
  onSelectMemo: (memo: MemoRow) => void;
  onTogglePinMemo?: (memoId: string) => void;
  openMemoPaneNumbers?: Record<string, number>;
  pinnedMemoIds?: string[];
  topicClusters: TopicCluster[];
  topicInboxItems?: InboxSession[];
  topicInboxMemberships?: TopicInboxMembership[];
  topicMemberships: TopicMembership[];
  workspaceContent?: ReactNode;
}

interface TopicMemoRow {
  memo: MemoRow;
  score: number;
}

type SidebarMode = 'time' | 'network' | 'folders';

// 표시 방식(노트 목록 / 토픽 폴더)만 담는다. 미니 메모는 종류이지 방식이
// 아니라 노트 목록의 'Mini 노트' 섹션으로 들어간다.
const SIDEBAR_TABS: Array<{
  icon: typeof NotebookText;
  label: string;
  value: SidebarMode;
}> = [
  { icon: NotebookText, label: '노트', value: 'time' },
  { icon: Folder, label: '폴더', value: 'folders' },
];
const SESSION_RAIL_WIDTH = 284;

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

const getMemoTitle = (memo: MemoRow) => {
  const title = memo.content
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (!title) {
    return '새 메모';
  }

  return title.length > 22 ? `${title.slice(0, 22).trimEnd()}...` : title;
};

const getMemoPreview = (memo: MemoRow) => {
  const lines = memo.content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const preview = lines[1] ?? lines[0] ?? '내용 없음';

  return preview.length > 38 ? `${preview.slice(0, 38).trimEnd()}...` : preview;
};

const MemoSyncBadge = ({ memo }: { memo: MemoRow }) => {
  if (!memo.local_sync_status) return null;
  const isSynced = memo.local_sync_status === 'synced';
  const isFailed = memo.local_sync_status === 'failed';
  const label = isSynced
    ? '클라우드 동기화됨'
    : isFailed
      ? '클라우드 동기화 실패'
      : '로컬 저장됨';
  return (
    <span
      aria-label={label}
      className={`memo-sync-badge ${isFailed ? 'failed' : 'ok'}`}
      title={label}
    >
      {isSynced ? '☁︎' : isFailed ? '!' : '✓'}
    </span>
  );
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
  onToggleSession,
  onDeleteMemoById,
  onNewMemo,
  onSelectMemo,
  onTogglePinMemo,
  openMemoPaneNumbers,
  pinnedMemoIds = [],
  topicClusters,
  topicInboxItems = [],
  topicInboxMemberships = [],
  topicMemberships,
  workspaceContent,
}: MemoWorkspaceProps) => {
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [memoMenu, setMemoMenu] = useState<{ x: number; y: number; id: string } | null>(
    null,
  );
  const [selectedTopicMemoId, setSelectedTopicMemoId] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('time');
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(
    () => new Set(),
  );
  const topicMemoRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const { miniMemos, normalMemos } = useMemo(
    () => splitMemoCategories(memos),
    [memos],
  );
  // 미니는 별도 모드가 아니라 노트 목록의 한 섹션이다.
  const sections = getSections(normalMemos, pinnedMemoIds, miniMemos);
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
    setSidebarMode('folders');
    setActiveTopicId(topicId);
    setSelectedTopicMemoId(memoId ?? null);
    setExpandedTopicIds(previous => new Set(previous).add(topicId));
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


  return (
    <div className="memo-layout">
      <motion.aside
        className="session-rail"
        initial={false}
        animate={{ width: isSessionCollapsed ? 0 : SESSION_RAIL_WIDTH }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      >
       <div className="session-rail-inner">
        {/* 아이콘 세그먼트 대신 텍스트 탭. 바로 아래 h2가 같은 이름을
            반복하던 중복을 없애고, 탭 이름 자체가 제목 역할을 한다. */}
        <div className="session-tabs">
          {/* Mantine SegmentedControl의 FloatingIndicator는 target이 바뀔 때마다
              ResizeObserver를 새로 만들고, 그 최초 발화가 페인트 전에
              transition-duration을 0ms로 덮어써서 항상 순간이동한다.
              (transitionDuration prop을 올려도 무시된다.)
              인디케이터만 layoutId로 대체 — 겉모습은 그대로다. */}
          <div className="session-tabs-control" role="tablist">
            {SIDEBAR_TABS.map(tab => {
              const isActive = sidebarMode === tab.value;

              return (
                <button
                  aria-selected={isActive}
                  className={`session-tab ${isActive ? 'active' : ''}`}
                  key={tab.value}
                  onClick={() => {
                    // 노트 외 탭으로 갈 때는 토픽 필터를 푼다(기존 동작 유지).
                    if (tab.value !== 'time') {
                      setActiveTopicId(null);
                    }
                    setSidebarMode(tab.value);
                  }}
                  role="tab"
                  type="button"
                >
                  {isActive && (
                    <motion.span
                      className="session-tab-indicator"
                      layoutId="session-tab-indicator"
                      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    />
                  )}
                  <span className="session-tab-label">
                    <tab.icon size={12} />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
          <TooltipIconButton
            aria-label="새 메모"
            className="session-new-memo"
            onClick={onNewMemo}
            placement="bottom"
            tooltip="새 메모"
          >
            <Plus size={15} strokeWidth={2.4} />
          </TooltipIconButton>
        </div>

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
                      <strong>{getMemoTitle(memo)}</strong>
                      <span>
                        {formatMemoDate(memo.updated_at)} · {getMemoPreview(memo)}
                      </span>
                      <MemoSyncBadge memo={memo} />
                      {openMemoPaneNumbers?.[memo.id] && (
                        <CheckCircle2
                          aria-label="패널에서 열림"
                          className="memo-pane-badge"
                          size={15}
                        />
                      )}
                    </button>
                  ))}
                </section>
                );
              })}
              {sections.length === 0 && (
                <p className="empty-text">아직은 아무것도 없네요.</p>
              )}
            </div>
          </>
        ) : sidebarMode === 'folders' ? (
          <>
            {/* 부제 제거. 비어 있을 때의 안내는 아래 empty-text가 이미 한다. */}
            <div className="topic-folder-list">
              {topicFolders.length === 0 ? (
                <p className="empty-text">아직은 아무것도 없네요.</p>
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
                              <strong>{getMemoTitle(memo)}</strong>
                              <span>
                                {formatMemoDate(memo.updated_at)} ·{' '}
                                {getMemoPreview(memo)}
                              </span>
                              <MemoSyncBadge memo={memo} />
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
                                {item.title ?? item.domain ?? '저장한 링크'}
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
                {pinnedMemoIds.includes(memoMenu.id) ? '고정 해제' : '고정'}
              </Menu.Item>
            )}
            <Menu.Item
              color="red"
              leftSection={<Trash2 size={16} />}
              onClick={() => {
                const target = memoMenu.id;
                setMemoMenu(null);
                if (window.confirm('이 메모를 삭제하시겠습니까?')) {
                  onDeleteMemoById(target);
                }
              }}
            >
              삭제
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
};

export default MemoWorkspace;
