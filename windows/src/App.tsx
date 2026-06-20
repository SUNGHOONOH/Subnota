import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Session } from '@supabase/supabase-js';
import {
  CalendarDays,
  Inbox,
  LogOut,
  NotebookText,
  RefreshCw,
  Settings,
  Sparkles,
} from '@/components/icons';
import TooltipIconButton from './components/TooltipIconButton';

import AuthScreen from './features/auth/AuthScreen';
import BriefingWorkspace from './features/briefing/BriefingWorkspace';
import CalendarWorkspace from './features/calendar/TuiCalendarWorkspace';
import InboxWorkspace from './features/inbox/InboxWorkspace';
import MemoWorkspace from './features/memo/MemoWorkspace';
import MemoSplitWorkspace, {
  MemoSplitEditorState,
  MemoSplitPaneState,
  MemoSplitPaneView,
} from './features/memo/components/MemoSplitWorkspace';
import MemoSearchModal from './features/search/MemoSearchModal';
import SettingsModal from './features/settings/SettingsModal';
import {
  AMBIENT_COOLDOWN_MS,
  AMBIENT_IDLE_DELAY_MS,
  AMBIENT_MAX_RESULT_COUNT,
  AMBIENT_MIN_CHARS,
} from './lib/constants';
import { createUuid, hashText } from './lib/contentHash';
import { parseDates } from './lib/dateParser';
import { getCursorChunkWindow, MemoChunk } from './lib/memoChunker';
import {
  DEFAULT_SHORTCUT_SETTINGS,
  ShortcutSettings,
  loadShortcutSettings,
  matchesKeyboardShortcut,
  normalizeShortcutSettings,
  saveShortcutSettings,
} from './lib/shortcutSettings';
import {
  DEFAULT_MEMO_CATEGORY,
  getMemoCategory,
} from './lib/memoCategory';
import {
  loadWorkspaceSession,
  saveWorkspaceSession,
} from './lib/workspaceSession';
import {
  InboxSession,
  createInboxSession,
  fetchInboxSessions,
} from './services/backend/inboxService';
import {
  createLocalInboxSession,
  loadLocalCalendarBlocks,
  loadLocalInboxQueue,
  loadLocalMemos,
  loadVisibleLocalCalendarBlocks,
  loadVisibleLocalMemos,
  markLocalCalendarBlockDeleted,
  markLocalMemoDeleted,
  removeLocalCalendarBlock,
  removeLocalInboxSession,
  replaceSyncedCalendarBlocks,
  replaceSyncedMemos,
  upsertLocalCalendarBlock,
  upsertLocalMemo,
} from './services/local/offlineStore';
import {
  NetworkSearchResult,
  searchCursorNetwork,
} from './services/backend/networkService';
import {
  archiveMemo,
  deleteCalendarBlock,
  ensureProfile,
  fetchBriefings,
  fetchCalendarBlocks,
  fetchMemos,
  fetchScheduleInbox,
  fetchTopicMap,
  getSession,
  signOut,
  updateScheduleInboxStatus,
  upsertCalendarBlock,
  upsertMemo,
} from './services/supabase/data';
import { isSupabaseConfigured, supabase } from './services/supabase/client';
import {
  BriefingRow,
  CalendarBlockRow,
  MemoRow,
  ScheduleInboxRow,
  TabKey,
  TopicCluster,
  TopicMemoEdge,
  TopicMembership,
} from './types';

const SAVE_DELAY_MS = 900;
// 첫 부팅 동기화가 느리거나 끊겨도 로딩화면에 갇히지 않도록 하는 상한.
// 초과하면 로컬 데이터로 진입하고 동기화는 백그라운드에서 계속된다(local-first).
const BOOT_SYNC_TIMEOUT_MS = 8000;

const BOOT_MESSAGES = [
  '생각의 결을 잇는 중',
  '흩어진 메모를 불러오는 중',
  '오늘의 기록을 깨우는 중',
  '책상 위 종이를 정리하는 중',
];

const SUBNOTA_MARK_PATH =
  'M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4zm0 20a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4 4 4 0 0 1 4 4v2a4 4 0 0 1-4 4zm-8-8a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4 4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zm16 0a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4 4 4 0 0 1 4-4h2a4 4 0 0 1 4 4z';

const getMemoTitle = (content: string) => {
  const firstLine = content
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return '새 메모';
  }

  return firstLine.length > 28 ? `${firstLine.slice(0, 28).trimEnd()}...` : firstLine;
};

const mergeInboxItems = (
  remoteItems: InboxSession[],
  localItems: InboxSession[],
) => {
  const remoteClientIds = new Set(
    remoteItems.map(item => item.clientId).filter(Boolean),
  );
  const pendingItems = localItems.filter(
    item => !item.clientId || !remoteClientIds.has(item.clientId),
  );

  return [...pendingItems, ...remoteItems].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

const App = () => {
  const [restoredWorkspace] = useState(loadWorkspaceSession);
  const [activeMemoCreatedAt, setActiveMemoCreatedAt] = useState(
    new Date().toISOString(),
  );
  const [activeDraftCategory, setActiveDraftCategory] = useState(
    DEFAULT_MEMO_CATEGORY,
  );
  const [activeMemoId, setActiveMemoId] = useState<string | null>(
    restoredWorkspace?.activeMemoId ?? null,
  );
  const [activeTab, setActiveTab] = useState<TabKey>(
    restoredWorkspace?.activeTab ?? 'memo',
  );
  const [ambientQueryChunk, setAmbientQueryChunk] = useState<MemoChunk | null>(
    null,
  );
  const [ambientResult, setAmbientResult] = useState<NetworkSearchResult | null>(
    null,
  );
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlockRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setBooting] = useState(true);
  const [bootMessageIndex, setBootMessageIndex] = useState(
    () => Math.floor(Math.random() * BOOT_MESSAGES.length),
  );
  const [inboxItems, setInboxItems] = useState<InboxSession[]>([]);
  const [isInboxLoading, setInboxLoading] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
  const [isOfflineMode, setOfflineMode] = useState(false);
  const [memos, setMemos] = useState<MemoRow[]>([]);
  const [memoDraft, setMemoDraft] = useState('');
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [networkQueryChunk, setNetworkQueryChunk] = useState<MemoChunk | null>(
    null,
  );
  const [networkResults, setNetworkResults] = useState<NetworkSearchResult[]>(
    [],
  );
  const [scheduleInbox, setScheduleInbox] = useState<ScheduleInboxRow[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>(
    'idle',
  );
  const [session, setSession] = useState<Session | null>(null);
  const [selectedTextState, setSelectedTextState] = useState('');
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [selectionStart, setSelectionStart] = useState(0);
  const [topicClusters, setTopicClusters] = useState<TopicCluster[]>([]);
  const [topicEdges, setTopicEdges] = useState<TopicMemoEdge[]>([]);
  const [topicMemberships, setTopicMemberships] = useState<TopicMembership[]>(
    [],
  );
  const [isSplitWorkspaceEnabled, setIsSplitWorkspaceEnabled] = useState(
    restoredWorkspace?.isSplitWorkspaceEnabled ?? false,
  );
  const [splitPanes, setSplitPanes] = useState<MemoSplitPaneState[]>(
    restoredWorkspace?.splitPanes ?? [],
  );
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isSessionCollapsed, setSessionCollapsed] = useState(
    restoredWorkspace?.isSessionCollapsed ?? false,
  );
  const openMemoPaneNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    splitPanes.forEach((pane, index) => {
      const editors = pane.editors ?? [];
      const activeEditor =
        editors.find(editor => editor.id === pane.activeEditorId) ??
        editors[0] ??
        pane;
      if (
        activeEditor?.view === 'memo' &&
        activeEditor.memoId &&
        map[activeEditor.memoId] === undefined
      ) {
        map[activeEditor.memoId] = index + 1;
      }
    });
    return map;
  }, [splitPanes]);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shortcuts, setShortcuts] = useState(loadShortcutSettings);

  const activeMemoIdRef = useRef<string | null>(null);
  const hasHydratedActiveMemoRef = useRef(false);
  const lastAmbientHashRef = useRef<string | null>(null);
  const lastAmbientRequestAtRef = useRef(0);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    activeMemoIdRef.current = activeMemoId;
  }, [activeMemoId]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const persistWorkspace = useCallback(() => {
    saveWorkspaceSession({
      activeMemoId,
      activeTab,
      focusedPaneId: null,
      isSessionCollapsed,
      isSplitWorkspaceEnabled,
      paneWidths: {},
      splitPanes,
    });
  }, [
    activeMemoId,
    activeTab,
    isSessionCollapsed,
    isSplitWorkspaceEnabled,
    splitPanes,
  ]);

  useEffect(() => {
    if (isBooting) {
      return undefined;
    }

    const timeout = window.setTimeout(persistWorkspace, 250);
    return () => window.clearTimeout(timeout);
  }, [isBooting, persistWorkspace]);

  useEffect(() => {
    window.addEventListener('beforeunload', persistWorkspace);
    return () => window.removeEventListener('beforeunload', persistWorkspace);
  }, [persistWorkspace]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (matchesKeyboardShortcut(event, shortcuts.openSearch)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts.openSearch]);

  useEffect(() => {
    return window.electronAPI?.onOpenSettings?.(() => {
      setSettingsOpen(true);
    });
  }, []);

  const activeMemo = useMemo(
    () => memos.find(memo => memo.id === activeMemoId) ?? null,
    [activeMemoId, memos],
  );
  const dateMatches = useMemo(() => {
    const baseTimestamp = activeMemo?.created_at
      ? new Date(activeMemo.created_at).getTime()
      : new Date(activeMemoCreatedAt).getTime();

    return parseDates(memoDraft, baseTimestamp);
  }, [activeMemo?.created_at, activeMemoCreatedAt, memoDraft]);
  const selectedText = useMemo(() => {
    if (selectedTextState) {
      return selectedTextState.trim();
    }
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);

    return memoDraft.slice(start, end).trim();
  }, [memoDraft, selectionEnd, selectionStart, selectedTextState]);

  const hydrateActiveMemo = useCallback((nextMemos: MemoRow[]) => {
    if (hasHydratedActiveMemoRef.current) {
      return;
    }

    const selectedMemo =
      nextMemos.find(memo => memo.id === activeMemoIdRef.current) ??
      nextMemos[0];
    if (!selectedMemo) {
      return;
    }

    hasHydratedActiveMemoRef.current = true;
    setActiveMemoId(selectedMemo.id);
    setMemoDraft(selectedMemo.content);
    setActiveMemoCreatedAt(selectedMemo.created_at);
    setActiveDraftCategory(getMemoCategory(selectedMemo.category));
  }, []);

  const applyLocalWorkspace = useCallback(() => {
    const localMemos = loadVisibleLocalMemos();
    const localBlocks = loadVisibleLocalCalendarBlocks();

    setMemos(localMemos);
    setCalendarBlocks(localBlocks);
    setInboxItems(loadLocalInboxQueue());
    setBriefings([]);
    setScheduleInbox([]);
    setTopicClusters([]);
    setTopicEdges([]);
    setTopicMemberships([]);

    hydrateActiveMemo(localMemos);
  }, [hydrateActiveMemo]);

  const syncPendingLocalWorkspace = useCallback(async (currentSession: Session) => {
    for (const memo of loadLocalMemos()) {
      if (memo.local_sync_status === 'pending_delete') {
        await archiveMemo(currentSession, memo.id);
        markLocalMemoDeleted(memo.id, 'synced');
        continue;
      }

      if (memo.local_sync_status && memo.local_sync_status !== 'synced') {
        const savedMemo = await upsertMemo(currentSession, {
          category: getMemoCategory(memo.category),
          content: memo.content,
          createdAt: memo.created_at,
          id: memo.id,
        });

        if (savedMemo) {
          upsertLocalMemo(
            {
              category: getMemoCategory(savedMemo.category),
              content: savedMemo.content,
              created_at: savedMemo.created_at,
              id: savedMemo.id,
              updated_at: savedMemo.updated_at,
            },
            'synced',
          );
        }
      }
    }

    for (const block of loadLocalCalendarBlocks()) {
      if (block.local_sync_status === 'pending_delete') {
        await deleteCalendarBlock(currentSession, block.id);
        removeLocalCalendarBlock(block.id);
        continue;
      }

      if (block.local_sync_status && block.local_sync_status !== 'synced') {
        const savedBlock = await upsertCalendarBlock(currentSession, {
          allDay: Boolean(block.all_day),
          color: block.color ?? '#66705A',
          id: block.id,
          note: block.note,
          order: block.order ?? 0,
          startDate: block.start_date,
          title: block.title,
        });
        upsertLocalCalendarBlock(savedBlock, 'synced');
      }
    }

    for (const item of loadLocalInboxQueue()) {
      if (!item.originalUrl) {
        continue;
      }

      try {
        await createInboxSession({
          clientId: item.clientId,
          selectedText: item.selectedText,
          url: item.originalUrl,
          userNote: item.userNote,
        });
        removeLocalInboxSession(item.clientId);
      } catch {
        // Keep the item queued. A later manual refresh or app start can retry.
      }
    }
  }, []);

  const loadWorkspace = useCallback(
    async (
      targetSession?: Session | null,
      options: { quiet?: boolean } = {},
    ) => {
      const currentSession = targetSession ?? sessionRef.current;

      if (!currentSession) {
        applyLocalWorkspace();
        return;
      }

      if (!options.quiet) {
        setRefreshing(true);
      }
      setError(null);

      try {
        // Profile upsert is non-critical and can transiently 401 while the
        // Supabase session is still hydrating on startup. Don't let it abort
        // the data sync below — it self-heals on the next sync.
        try {
          await ensureProfile(currentSession.user.id);
        } catch (profileError) {
          console.warn(
            'ensureProfile skipped (will retry on next sync):',
            profileError,
          );
        }
        await syncPendingLocalWorkspace(currentSession);
        const [nextMemos, nextBlocks, nextInbox, nextBriefings, nextLinkInbox] =
          await Promise.all([
            fetchMemos(currentSession),
            fetchCalendarBlocks(currentSession),
            fetchScheduleInbox(currentSession),
            fetchBriefings(currentSession),
            fetchInboxSessions().catch(() => []),
          ]);
        const nextTopicMap = await fetchTopicMap(currentSession).catch(() => ({
          clusters: [],
          edges: [],
          memberships: [],
        }));

        const mergedMemos = replaceSyncedMemos(nextMemos);
        const mergedBlocks = replaceSyncedCalendarBlocks(nextBlocks);

        setMemos(mergedMemos);
        setCalendarBlocks(mergedBlocks);
        setScheduleInbox(nextInbox);
        setBriefings(nextBriefings);
        setInboxItems(mergeInboxItems(nextLinkInbox, loadLocalInboxQueue()));
        setTopicClusters(nextTopicMap.clusters);
        setTopicEdges(nextTopicMap.edges);
        setTopicMemberships(nextTopicMap.memberships);

        hydrateActiveMemo(mergedMemos);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '데이터를 불러오지 못했습니다.');
        applyLocalWorkspace();
      } finally {
        setRefreshing(false);
      }
    },
    [applyLocalWorkspace, hydrateActiveMemo, syncPendingLocalWorkspace],
  );

  // 부팅 중에는 로딩 멘트를 일정 간격으로 순환시킨다.
  useEffect(() => {
    if (!isBooting) return undefined;
    const intervalId = window.setInterval(() => {
      setBootMessageIndex(index => (index + 1) % BOOT_MESSAGES.length);
    }, 2200);
    return () => window.clearInterval(intervalId);
  }, [isBooting]);

  useEffect(() => {
    let mounted = true;

    applyLocalWorkspace();

    if (!isSupabaseConfigured()) {
      setError('온라인 동기화 환경변수가 없어 오프라인 모드만 사용할 수 있습니다.');
      setBooting(false);
      return () => {
        mounted = false;
      };
    }

    getSession()
      .then(async nextSession => {
        if (!mounted) {
          return;
        }
        setSession(nextSession);
        sessionRef.current = nextSession;
        if (nextSession) {
          setOfflineMode(false);
          // 첫 데이터 로드(로컬 + 서버 동기화)가 끝날 때까지 로딩화면을 유지한다.
          // 단, 느리거나 끊긴 네트워크에 갇히지 않도록 타임아웃을 두고 진입한다.
          await Promise.race([
            loadWorkspace(nextSession, { quiet: true }),
            new Promise<void>(resolve =>
              setTimeout(resolve, BOOT_SYNC_TIMEOUT_MS),
            ),
          ]);
        }
      })
      .catch(caught => {
        setError(caught instanceof Error ? caught.message : '세션 확인에 실패했습니다.');
      })
      .finally(() => {
        if (mounted) {
          setBooting(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      sessionRef.current = nextSession;
      if (nextSession) {
        setOfflineMode(false);
        void loadWorkspace(nextSession, { quiet: true });
      } else {
        applyLocalWorkspace();
        setScheduleInbox([]);
        setBriefings([]);
        setTopicClusters([]);
        setTopicEdges([]);
        setTopicMemberships([]);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [applyLocalWorkspace, loadWorkspace]);

  useEffect(() => {
    if (!activeMemoId || !memoDraft.trim()) {
      setSaveState('idle');
      return;
    }

    if (activeMemo?.content === memoDraft) {
      setSaveState('saved');
      return;
    }

    setSaveState('saving');
    const timeout = window.setTimeout(() => {
      const localMemo = upsertLocalMemo(
        {
          category: activeMemo?.category ?? activeDraftCategory,
          content: memoDraft,
          created_at: activeMemo?.created_at ?? activeMemoCreatedAt,
          id: activeMemoId,
        },
        session ? 'pending' : 'pending',
      );

      setMemos(previous => {
        const exists = previous.some(memo => memo.id === localMemo.id);
        const merged = exists
          ? previous.map(memo => (memo.id === localMemo.id ? localMemo : memo))
          : [localMemo, ...previous];

        return merged.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
      });

      if (!session) {
        setSaveState('saved');
        return;
      }

      upsertMemo(session, {
        category: activeMemo?.category ?? activeDraftCategory,
        content: memoDraft,
        createdAt: activeMemo?.created_at ?? activeMemoCreatedAt,
        id: activeMemoId,
      })
        .then(savedMemo => {
          if (!savedMemo) {
            return;
          }

          upsertLocalMemo(
            {
              category: getMemoCategory(savedMemo.category),
              content: savedMemo.content,
              created_at: savedMemo.created_at,
              id: savedMemo.id,
              updated_at: savedMemo.updated_at,
            },
            'synced',
          );
          setMemos(previous => {
            const exists = previous.some(memo => memo.id === savedMemo.id);
            const merged = exists
              ? previous.map(memo => (memo.id === savedMemo.id ? savedMemo : memo))
              : [savedMemo, ...previous];

            return merged.sort(
              (a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            );
          });
          setActiveMemoCreatedAt(savedMemo.created_at);
          setSaveState('saved');
        })
        .catch(() => {
          setSaveState('failed');
        });
    }, SAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [activeDraftCategory, activeMemo, activeMemoCreatedAt, activeMemoId, memoDraft, session]);

  useEffect(() => {
    setAmbientQueryChunk(null);
    setAmbientResult(null);

    if (!session || memoDraft.trim().length < AMBIENT_MIN_CHARS) {
      return;
    }

    const queryChunk = getCursorChunkWindow(memoDraft, selectionStart, 0).center;

    if (!queryChunk || queryChunk.text.trim().length < AMBIENT_MIN_CHARS) {
      return;
    }

    const chunkHash = hashText(`${activeMemoId ?? 'draft'}:${queryChunk.text}`);
    const now = Date.now();

    if (
      lastAmbientHashRef.current === chunkHash ||
      now - lastAmbientRequestAtRef.current < AMBIENT_COOLDOWN_MS
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      lastAmbientHashRef.current = chunkHash;
      lastAmbientRequestAtRef.current = Date.now();

      searchCursorNetwork({
        cursorIndex: selectionStart,
        limit: AMBIENT_MAX_RESULT_COUNT,
        memoId: activeMemoId,
        text: memoDraft,
      })
        .then(result => {
          if (result.results[0]) {
            setAmbientQueryChunk(result.queryChunk);
            setAmbientResult(result.results[0]);
          }
        })
        .catch(() => {
          setAmbientQueryChunk(null);
          setAmbientResult(null);
        });
    }, AMBIENT_IDLE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [activeMemoId, memoDraft, selectionStart, session]);

  const startNewMemo = useCallback((category = DEFAULT_MEMO_CATEGORY) => {
    const now = new Date().toISOString();
    setActiveMemoId(createUuid());
    setActiveMemoCreatedAt(now);
    setActiveDraftCategory(category);
    setMemoDraft('');
    setAmbientQueryChunk(null);
    setAmbientResult(null);
    setNetworkError(null);
    setNetworkQueryChunk(null);
    setNetworkResults([]);
    setSelectionEnd(0);
    setSelectionStart(0);
    setSelectedTextState('');
    setActiveTab('memo');
    setSaveState('idle');
  }, []);

  const changeMemoDraft = (value: string) => {
    if (!activeMemoId && value.trim()) {
      setActiveMemoId(createUuid());
      setActiveMemoCreatedAt(new Date().toISOString());
    }

    setMemoDraft(value);
    setAmbientQueryChunk(null);
    setAmbientResult(null);
    setNetworkError(null);
    setNetworkQueryChunk(null);
    setNetworkResults([]);
  };

  const createMemoFromContent = (
    content: string,
    category = DEFAULT_MEMO_CATEGORY,
  ) => {
    const createdAt = new Date().toISOString();
    const id = createUuid();
    const localMemo = upsertLocalMemo(
      {
        category,
        content,
        created_at: createdAt,
        id,
      },
      'pending',
    );

    setMemos(previous =>
      [localMemo, ...previous].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    );

    if (sessionRef.current) {
      upsertMemo(sessionRef.current, {
        category,
        content,
        createdAt,
        id,
      })
        .then(savedMemo => {
          if (!savedMemo) {
            return;
          }

          upsertLocalMemo(
            {
              category: savedMemo.category ?? category,
              content: savedMemo.content,
              created_at: savedMemo.created_at,
              id: savedMemo.id,
              updated_at: savedMemo.updated_at,
            },
            'synced',
          );
          setMemos(previous =>
            previous.map(memo => (memo.id === savedMemo.id ? savedMemo : memo)),
          );
        })
        .catch(() => {
          // Keep the local pending memo; the next sync pass can retry.
        });
    }

    return localMemo;
  };

  const updateMemoContentById = async (id: string, content: string) => {
    const existingMemo = memos.find(memo => memo.id === id);
    const createdAt = existingMemo?.created_at ?? new Date().toISOString();
    const localMemo = upsertLocalMemo(
      {
        category: getMemoCategory(existingMemo?.category),
        content,
        created_at: createdAt,
        id,
      },
      'pending',
    );

    setMemos(previous => {
      const exists = previous.some(memo => memo.id === id);
      const merged = exists
        ? previous.map(memo => (memo.id === id ? localMemo : memo))
        : [localMemo, ...previous];

      return merged.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    });

    if (!session) {
      return;
    }

    const savedMemo = await upsertMemo(session, {
      category: getMemoCategory(existingMemo?.category),
      content,
      createdAt,
      id,
    });

    if (savedMemo) {
      upsertLocalMemo(
        {
          category: getMemoCategory(savedMemo.category),
          content: savedMemo.content,
          created_at: savedMemo.created_at,
          id: savedMemo.id,
          updated_at: savedMemo.updated_at,
        },
        'synced',
      );
      setMemos(previous =>
        previous.map(memo => (memo.id === savedMemo.id ? savedMemo : memo)),
      );
    }
  };

  const deleteMemoById = async (id: string) => {
    const syncStatus = session ? 'synced' : 'pending_delete';

    if (session) {
      await archiveMemo(session, id);
    }

    markLocalMemoDeleted(id, syncStatus);
    setMemos(previous => previous.filter(memo => memo.id !== id));

    if (id === activeMemoId) {
      const nextMemos = memos.filter(memo => memo.id !== id);
      const nextActive = nextMemos[0] ?? null;
      setActiveMemoId(nextActive?.id ?? null);
      setMemoDraft(nextActive?.content ?? '');
      setActiveMemoCreatedAt(nextActive?.created_at ?? new Date().toISOString());
      setActiveDraftCategory(getMemoCategory(nextActive?.category));
    }
  };

  const selectMemo = (memo: MemoRow) => {
    setActiveMemoId(memo.id);
    setActiveMemoCreatedAt(memo.created_at);
    setActiveDraftCategory(getMemoCategory(memo.category));
    setMemoDraft(memo.content);
    setAmbientQueryChunk(null);
    setAmbientResult(null);
    setNetworkError(null);
    setNetworkQueryChunk(null);
    setNetworkResults([]);
    setSelectionEnd(0);
    setSelectionStart(0);
    setSelectedTextState('');
    setActiveTab('memo');
  };

  const selectMemoById = (memoId: string) => {
    const targetMemo = memos.find(memo => memo.id === memoId);

    if (targetMemo) {
      selectMemo(targetMemo);
    }
  };

  const selectTextRange = (start: number, end: number, text?: string) => {
    setSelectionStart(start);
    setSelectionEnd(end);
    if (text !== undefined) {
      setSelectedTextState(text);
    }
  };

  const removeActiveMemo = async () => {
    if (!activeMemoId) {
      return;
    }

    const shouldRemove = window.confirm('이 메모를 삭제하시겠습니까?');
    if (!shouldRemove) {
      return;
    }

    if (activeMemo) {
      await deleteMemoById(activeMemo.id);
      const nextMemos = memos.filter(memo => memo.id !== activeMemo.id);
      setMemos(nextMemos);
      const nextActive = nextMemos[0] ?? null;
      setActiveMemoId(nextActive?.id ?? null);
      setMemoDraft(nextActive?.content ?? '');
      setActiveMemoCreatedAt(nextActive?.created_at ?? new Date().toISOString());
      setActiveDraftCategory(getMemoCategory(nextActive?.category));
    } else {
      setActiveMemoId(null);
      setMemoDraft('');
      setActiveDraftCategory(DEFAULT_MEMO_CATEGORY);
    }
  };

  const saveCalendarBlock = async (draft: {
    allDay: boolean;
    color: string;
    id?: string;
    note: string | null;
    order?: number;
    startDate: string;
    title: string;
  }) => {
    const id = draft.id ?? createUuid();
    const now = new Date().toISOString();
    const existingBlock = calendarBlocks.find(block => block.id === id);
    const localBlock: CalendarBlockRow = {
      all_day: draft.allDay,
      color: draft.color,
      created_at: existingBlock?.created_at ?? now,
      end_date: null,
      id,
      is_completed: existingBlock?.is_completed ?? false,
      local_sync_status: 'pending',
      note: draft.note,
      order: draft.order ?? 0,
      start_date: draft.startDate,
      title: draft.title.trim() || '새 일정',
      updated_at: now,
    };

    upsertLocalCalendarBlock(localBlock, 'pending');
    setCalendarBlocks(previous => {
      const exists = previous.some(item => item.id === localBlock.id);
      return exists
        ? previous.map(item => (item.id === localBlock.id ? localBlock : item))
        : [...previous, localBlock];
    });

    if (!session) {
      return;
    }

    const block = await upsertCalendarBlock(session, {
      ...draft,
      id,
    });
    upsertLocalCalendarBlock(block, 'synced');
    setCalendarBlocks(previous =>
      previous.map(item => (item.id === block.id ? block : item)),
    );
  };

  const registerSelectionSchedule = async () => {
    if (!selectedText.trim()) {
      return;
    }

    const selectedMatch = parseDates(selectedText, Date.now())[0];
    const containedMatch =
      selectedMatch ??
      dateMatches.find(match => {
        const start = Math.min(selectionStart, selectionEnd);
        const end = Math.max(selectionStart, selectionEnd);

        return match.index >= start && match.index + match.length <= end;
      });

    if (!containedMatch) {
      window.alert('선택한 문장 안에 날짜 표현이 필요합니다.');
      return;
    }

    await saveCalendarBlock({
      allDay:
        containedMatch.date.getHours() === 0 &&
        containedMatch.date.getMinutes() === 0,
      color: '#66705A',
      note: selectedText,
      startDate: containedMatch.date.toISOString(),
      title: selectedText,
    });
    window.alert('일정이 등록되었습니다.');
  };

  const registerSelectionScheduleAt = async (date: Date, allDay: boolean) => {
    const content = selectedText.trim();
    if (!content) {
      return;
    }

    await saveCalendarBlock({
      allDay,
      color: '#66705A',
      note: content,
      startDate: date.toISOString(),
      title: content,
    });
    window.alert('일정이 등록되었습니다.');
  };

  const removeCalendarBlock = async (blockId: string) => {
    if (!window.confirm('블럭을 삭제하시겠습니까?')) {
      return;
    }

    if (session) {
      await deleteCalendarBlock(session, blockId);
      removeLocalCalendarBlock(blockId);
    } else {
      markLocalCalendarBlockDeleted(blockId, 'pending_delete');
    }
    setCalendarBlocks(previous => previous.filter(block => block.id !== blockId));
  };

  const acceptInboxItem = async (item: ScheduleInboxRow) => {
    if (!session) {
      return;
    }

    await saveCalendarBlock({
      allDay: Boolean(item.all_day),
      color: '#66705A',
      note: item.source_text,
      startDate: item.scheduled_at,
      title: item.title,
    });
    await updateScheduleInboxStatus(session, item.id, 'accepted');
    setScheduleInbox(previous => previous.filter(inbox => inbox.id !== item.id));
  };

  const dismissInboxItem = async (item: ScheduleInboxRow) => {
    if (!session) {
      return;
    }

    await updateScheduleInboxStatus(session, item.id, 'dismissed');
    setScheduleInbox(previous => previous.filter(inbox => inbox.id !== item.id));
  };

  const handleChangePane = (id: string, patch: Partial<MemoSplitPaneState>) => {
    setSplitPanes(prev =>
      prev.map(p => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const handleCloseAllPanes = () => {
    setIsSplitWorkspaceEnabled(false);
    setSplitPanes([]);
  };

  const createEditorHelper = (
    view: MemoSplitPaneView = 'memo',
    patch: Partial<MemoSplitEditorState> = {},
  ): MemoSplitEditorState => ({
    id: `editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode: view === 'memo' ? (patch.memoId ? 'existing' : 'draft') : undefined,
    view,
    ...patch,
  });

  const mirrorEditorPatchHelper = (
    editor: MemoSplitEditorState,
  ): Partial<MemoSplitPaneState> => ({
    draftText: editor.draftText,
    highlight: editor.highlight,
    memoId: editor.memoId,
    mode: editor.mode,
    networkErrorMessage: editor.networkErrorMessage,
    networkIsLoading: editor.networkIsLoading,
    networkQueryChunk: editor.networkQueryChunk,
    networkRequestId: editor.networkRequestId,
    networkResults: editor.networkResults,
    selectedText: editor.selectedText,
    sourceResult: editor.sourceResult,
    view: editor.view,
  });

  const handleOpenSplitPane = (
    view: MemoSplitPaneView,
    memoId?: string,
    patch: Partial<MemoSplitEditorState> = {},
  ) => {
    setIsSplitWorkspaceEnabled(true);
    setSplitPanes(prev => {
      if (prev.length > 0) {
        const first = prev[0];
        const editors: MemoSplitEditorState[] = first.editors || [
          {
            id: first.activeEditorId || 'editor-default',
            view: first.view,
            memoId: first.memoId,
            mode: first.mode,
            draftText: first.draftText,
            highlight: first.highlight,
            networkErrorMessage: first.networkErrorMessage,
            networkIsLoading: first.networkIsLoading,
            networkQueryChunk: first.networkQueryChunk,
            networkRequestId: first.networkRequestId,
            networkResults: first.networkResults,
            selectedText: first.selectedText,
            sourceResult: first.sourceResult,
          }
        ];
        const nextEditor = createEditorHelper(view, { memoId, ...patch });
        
        return [{
          ...first,
          ...mirrorEditorPatchHelper(nextEditor),
          activeEditorId: nextEditor.id,
          editors: [...editors, nextEditor],
          view: nextEditor.view,
        }];
      } else {
        const newPaneId = `pane-${Date.now()}`;
        const nextEditor = createEditorHelper(view, { memoId, ...patch });
        return [{
          id: newPaneId,
          activeEditorId: nextEditor.id,
          editors: [nextEditor],
          ...mirrorEditorPatchHelper(nextEditor),
          view: nextEditor.view,
        }];
      }
    });
  };

  const patchNetworkSplitEditor = (
    networkRequestId: string,
    patch: Partial<MemoSplitEditorState>,
  ) => {
    setSplitPanes(prev =>
      prev.map(pane => {
        const editors = pane.editors || [
          {
            draftText: pane.draftText,
            highlight: pane.highlight,
            id: pane.activeEditorId || `${pane.id}-editor`,
            memoId: pane.memoId,
            mode: pane.mode,
            networkErrorMessage: pane.networkErrorMessage,
            networkIsLoading: pane.networkIsLoading,
            networkQueryChunk: pane.networkQueryChunk,
            networkRequestId: pane.networkRequestId,
            networkResults: pane.networkResults,
            selectedText: pane.selectedText,
            sourceResult: pane.sourceResult,
            view: pane.view,
          },
        ];
        const nextEditors = editors.map(editor =>
          editor.networkRequestId === networkRequestId
            ? { ...editor, ...patch }
            : editor,
        );
        const activeEditor =
          nextEditors.find(editor => editor.id === pane.activeEditorId) ||
          nextEditors[0];

        return {
          ...pane,
          ...(activeEditor ? mirrorEditorPatchHelper(activeEditor) : {}),
          editors: nextEditors,
        };
      }),
    );
  };

  const openNetwork = async () => {
    if (!session) {
      return;
    }

    const networkRequestId = `network-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const initialQueryChunk = getCursorChunkWindow(
      memoDraft,
      selectionStart,
      0,
    ).center;

    setNetworkError(null);
    setNetworkQueryChunk(initialQueryChunk);
    setNetworkResults([]);
    handleOpenSplitPane('network', undefined, {
      networkErrorMessage: null,
      networkIsLoading: true,
      networkQueryChunk: initialQueryChunk,
      networkRequestId,
      networkResults: [],
    });

    try {
      const result = await searchCursorNetwork({
        cursorIndex: selectionStart,
        limit: 5,
        memoId: activeMemoId,
        text: memoDraft,
      });
      const message =
        result.message && result.results.length === 0 ? result.message : null;
      setNetworkError(message);
      setNetworkQueryChunk(result.queryChunk);
      setNetworkResults(result.results);
      patchNetworkSplitEditor(networkRequestId, {
        networkErrorMessage: message,
        networkIsLoading: false,
        networkQueryChunk: result.queryChunk,
        networkResults: result.results,
      });
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : '네트워크 검색에 실패했습니다.';
      setNetworkError(message);
      patchNetworkSplitEditor(networkRequestId, {
        networkErrorMessage: message,
        networkIsLoading: false,
        networkQueryChunk: initialQueryChunk,
        networkResults: [],
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const applyShortcutSettings = async (nextSettings: ShortcutSettings) => {
    const normalized = normalizeShortcutSettings(nextSettings);
    const accepted = saveShortcutSettings(normalized);

    setShortcuts(accepted);
  };

  const resetShortcutSettings = () => applyShortcutSettings(DEFAULT_SHORTCUT_SETTINGS);

  const refreshInbox = async () => {
    if (!session) {
      setInboxItems(loadLocalInboxQueue());
      return;
    }

    setInboxLoading(true);
    setError(null);
    try {
      await syncPendingLocalWorkspace(session);
      setInboxItems(mergeInboxItems(await fetchInboxSessions(), loadLocalInboxQueue()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '수집함을 불러오지 못했습니다.');
    } finally {
      setInboxLoading(false);
    }
  };

  const saveInboxUrl = async (url: string) => {
    setError(null);
    const localItem = createLocalInboxSession(url);
    setInboxItems(previous => [localItem, ...previous]);

    if (!session) {
      return;
    }

    try {
      const item = await createInboxSession({
        clientId: localItem.clientId,
        url,
      });
      removeLocalInboxSession(localItem.clientId);
      setInboxItems(previous => [
        item,
        ...previous.filter(previousItem => previousItem.id !== localItem.id),
      ]);
      window.setTimeout(() => {
        void refreshInbox();
      }, 2500);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `${caught.message} 오프라인 큐에 저장했습니다.`
          : '오프라인 큐에 저장했습니다.',
      );
    }
  };

  const saveInboxUrlRef = useRef(saveInboxUrl);
  saveInboxUrlRef.current = saveInboxUrl;

  // subnota://capture links can arrive from the future Chrome extension and
  // flow into the inbox queue. Windows does not perform app-side web clipping.
  useEffect(() => {
    return window.electronAPI?.onInboxCapture?.((payload) => {
      if (payload.error) {
        setError(payload.error);
        return;
      }
      if (payload.url) {
        void saveInboxUrlRef.current(payload.url);
      }
    });
  }, []);

  if (isBooting) {
    return (
      <main className="loading-screen">
        <span className="auth-bg-orb orb-1" />
        <span className="auth-bg-orb orb-2" />
        <motion.div
          className="boot-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <motion.div
            className="boot-mark"
            animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
              <path d={SUBNOTA_MARK_PATH} />
            </svg>
          </motion.div>
          <p className="boot-message">{BOOT_MESSAGES[bootMessageIndex]}</p>
          <div className="boot-dots">
            {[0, 1, 2].map(index => (
              <motion.span
                key={index}
                animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: index * 0.18,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>
      </main>
    );
  }

  if (!session && !isOfflineMode) {
    return (
      <AuthScreen
        onContinueOffline={() => {
          setOfflineMode(true);
          applyLocalWorkspace();
        }}
        onSignedIn={async () => {
          // 로그인 직후 첫 동기화 동안에도 로딩화면을 유지한다(신규 사용자 경험 일관).
          // 마운트 경로와 동일하게 타임아웃을 둬 느린/끊긴 네트워크에 갇히지 않는다.
          setOfflineMode(false);
          setBooting(true);
          try {
            const freshSession = await getSession();
            setSession(freshSession);
            sessionRef.current = freshSession;
            if (freshSession) {
              await Promise.race([
                loadWorkspace(freshSession, { quiet: true }),
                new Promise<void>(resolve =>
                  setTimeout(resolve, BOOT_SYNC_TIMEOUT_MS),
                ),
              ]);
            }
          } finally {
            setBooting(false);
          }
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="nav-rail">
        <TooltipIconButton
          aria-label="메모"
          className={activeTab === 'memo' ? 'nav-item active' : 'nav-item'}
          delay={300}
          onClick={() => setActiveTab('memo')}
          placement="right"
          tooltip="메모"
        >
          <NotebookText size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="캘린더"
          className={activeTab === 'calendar' ? 'nav-item active' : 'nav-item'}
          delay={300}
          onClick={() => setActiveTab('calendar')}
          placement="right"
          tooltip="캘린더"
        >
          <CalendarDays size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="수집함"
          className={activeTab === 'inbox' ? 'nav-item active' : 'nav-item'}
          delay={300}
          onClick={() => setActiveTab('inbox')}
          placement="right"
          tooltip="수집함"
        >
          <Inbox size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="브리핑"
          className={activeTab === 'briefing' ? 'nav-item active' : 'nav-item'}
          delay={300}
          disabled={!session}
          onClick={() => setActiveTab('briefing')}
          placement="right"
          tooltip="브리핑"
        >
          <Sparkles size={22} />
        </TooltipIconButton>
        <div className="nav-spacer" />
        <TooltipIconButton
          aria-label="설정"
          className="nav-item nav-utility"
          delay={300}
          onClick={() => setSettingsOpen(true)}
          placement="right"
          tooltip="설정"
        >
          <Settings size={22} />
        </TooltipIconButton>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Desktop App</p>
            <h1>
              {activeTab === 'memo'
                ? '메모'
                : activeTab === 'calendar'
                  ? '캘린더'
                  : activeTab === 'inbox'
                    ? '수집함'
                    : '브리핑'}
            </h1>
            {!session && <p className="eyebrow">오프라인 모드 · 메모, 캘린더, 수집 큐만 사용 가능</p>}
          </div>
          <div className="topbar-actions">
            {error && <span className="topbar-error">{error}</span>}
            <button
              className="ghost-button"
              disabled={!session || isRefreshing}
              onClick={() => void loadWorkspace()}
              type="button"
            >
              <RefreshCw size={16} />
              {!session ? '로그인 필요' : isRefreshing ? '동기화 중' : '동기화'}
            </button>
            {session ? (
              <button className="ghost-button" onClick={handleSignOut} type="button">
                <LogOut size={16} />
                로그아웃
              </button>
            ) : (
              <button
                className="ghost-button"
                onClick={() => setOfflineMode(false)}
                type="button"
              >
                로그인
              </button>
            )}
          </div>
        </header>

        {activeTab === 'memo' && (
          <div className={`memo-workspace-split-layout ${isSplitWorkspaceEnabled ? 'split-active' : ''}`} style={{ display: 'flex', flexDirection: 'row', flex: 1, minWidth: 0, width: '100%', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
            <MemoWorkspace
              activeMemoId={activeMemoId}
              isSessionCollapsed={isSessionCollapsed}
              openMemoPaneNumbers={openMemoPaneNumbers}
              onOpenSearch={() => setSearchOpen(true)}
              onToggleSession={() => setSessionCollapsed(value => !value)}
              ambientQueryChunk={ambientQueryChunk}
              ambientResult={ambientResult}
              dateMatches={dateMatches}
              memoDraft={memoDraft}
              memos={memos}
              networkError={networkError}
              networkQueryChunk={networkQueryChunk}
              networkResults={networkResults}
              onChangeDraft={changeMemoDraft}
              onDeleteMemo={() => void removeActiveMemo()}
              onNewMemo={() => startNewMemo()}
              onOpenNetwork={() => {
                void openNetwork();
              }}
              onRegisterSelectionSchedule={() => void registerSelectionSchedule()}
              onRegisterSelectionScheduleAt={(date, allDay) => {
                void registerSelectionScheduleAt(date, allDay);
              }}
              onSelectMemo={selectMemo}
              onSelectMemoById={selectMemoById}
              onSelectRange={selectTextRange}
              saveState={saveState}
              selectedText={selectedText}
              title={getMemoTitle(memoDraft)}
              topicClusters={topicClusters}
              topicEdges={topicEdges}
              topicMemberships={topicMemberships}
            />
            {isSplitWorkspaceEnabled && (
              <MemoSplitWorkspace
                activeMemoId={activeMemoId}
                isSessionCollapsed={isSessionCollapsed}
                panes={splitPanes}
                onChangePane={handleChangePane}
                onCloseAllPanes={handleCloseAllPanes}
                onToggleSession={() => setSessionCollapsed(value => !value)}
                memos={memos}
                onCreateMemo={createMemoFromContent}
                onDeleteMemo={id => {
                  void deleteMemoById(id);
                }}
                onUpdateMemo={(id, nextText) => {
                  if (id === activeMemoId) {
                    changeMemoDraft(nextText);
                  } else {
                    void updateMemoContentById(id, nextText);
                  }
                }}
                onSelectMemoById={selectMemoById}
                calendarBlocks={calendarBlocks}
                onDeleteCalendarBlock={removeCalendarBlock}
                onSaveCalendarBlock={saveCalendarBlock}
                inboxItems={inboxItems}
                isInboxLoading={isInboxLoading}
                onRefreshInbox={refreshInbox}
                onSaveInboxUrl={saveInboxUrl}
                briefings={briefings}
                scheduleInbox={scheduleInbox}
                onAcceptInbox={acceptInboxItem}
                onDismissInbox={dismissInboxItem}
                topicClusters={topicClusters}
                topicEdges={topicEdges}
                topicMemberships={topicMemberships}
              />
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <CalendarWorkspace
            blocks={calendarBlocks}
            onDeleteBlock={blockId => void removeCalendarBlock(blockId)}
            onSaveBlock={draft => void saveCalendarBlock(draft)}
          />
        )}

        {activeTab === 'inbox' && (
          <InboxWorkspace
            inboxItems={inboxItems}
            isLoading={isInboxLoading}
            onRefresh={() => void refreshInbox()}
            onSaveUrl={saveInboxUrl}
          />
        )}

        {activeTab === 'briefing' && (
          <BriefingWorkspace
            briefings={briefings}
            inboxItems={scheduleInbox}
            onAcceptInbox={item => void acceptInboxItem(item)}
            onDismissInbox={item => void dismissInboxItem(item)}
          />
        )}
      </section>
      <MemoSearchModal
        isOpen={isSearchOpen}
        memos={memos}
        onChangeQuery={setSearchQuery}
        onClose={() => setSearchOpen(false)}
        onSelectMemo={selectMemo}
        query={searchQuery}
      />
      <SettingsModal
        email={session?.user?.email}
        isOfflineMode={isOfflineMode}
        isOpen={isSettingsOpen}
        isSignedIn={Boolean(session)}
        onClose={() => setSettingsOpen(false)}
        onLogin={() => {
          setSettingsOpen(false);
          setOfflineMode(false);
        }}
        onResetShortcuts={resetShortcutSettings}
        onSaveShortcuts={applyShortcutSettings}
        onSignOut={() => {
          setSettingsOpen(false);
          void handleSignOut();
        }}
        shortcuts={shortcuts}
      />
    </div>
  );
};

export default App;
