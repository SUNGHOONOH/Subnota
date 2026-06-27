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
  Topics,
} from '@/components/icons';
import TooltipIconButton from './components/TooltipIconButton';

import AuthScreen from './features/auth/AuthScreen';
import { decideAuthEvent } from './features/auth/authEventDecision';
import BriefingWorkspace from './features/briefing/BriefingWorkspace';
import CalendarWorkspace from './features/calendar/CalendarWorkspace';
import InboxWorkspace from './features/inbox/InboxWorkspace';
import MemoWorkspace from './features/memo/MemoWorkspace';
import MemoSplitWorkspace, {
  MemoSplitEditorState,
  MemoSplitPaneState,
  MemoSplitPaneView,
} from './features/memo/components/MemoSplitWorkspace';
import SettingsModal from './features/settings/SettingsModal';
import { useAppHotkeys } from './hooks/useAppHotkeys';
import {
  AMBIENT_COOLDOWN_MS,
  AMBIENT_MAX_RESULT_COUNT,
  AMBIENT_MIN_CHARS,
  AMBIENT_MIN_SIMILARITY,
  NETWORK_MIN_SIMILARITY,
} from './lib/constants';
import { createUuid, hashText } from './lib/contentHash';
import { parseDates } from './lib/dateParser';
import { MemoChunk } from './lib/memoChunker';
import { registerReconnectSync } from './lib/reconnectSync';
import { useOnlineStatus } from './lib/useOnlineStatus';
import {
  AppSettings,
  applyEditorSettings,
  loadAppSettings,
  saveAppSettings,
} from './lib/appSettings';
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
  createLocalMemoRow,
  createLocalInboxSession,
  getLocalWorkspaceOwner,
  loadLocalActivityCompletions,
  loadLocalCalendarBlocks,
  loadLocalDailyCompletions,
  loadLocalInboxQueue,
  loadLocalMemos,
  loadLocalTrees,
  loadVisibleLocalCalendarBlocks,
  loadVisibleLocalMemos,
  markLocalCalendarBlockDeleted,
  markLocalMemoDeleted,
  persistLocalMemo,
  removeLocalCalendarBlock,
  removeLocalInboxSession,
  replaceSyncedCalendarBlocks,
  replaceSyncedMemos,
  setLocalWorkspaceOwner,
  upsertLocalActivityCompletion,
  upsertLocalCalendarBlock,
  upsertLocalDailyCompletion,
  upsertLocalMemo,
  upsertLocalTree,
} from './services/local/offlineStore';
import {
  NETWORK_SEARCH_EMPTY_MESSAGE,
  NetworkSearchResult,
  formatNetworkSearchErrorMessage,
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
  fetchTrees,
  getSession,
  recordActivityCompletion,
  recordDailyCompletion,
  recordPlantedTree,
  sendPasswordResetOtp,
  signOut,
  updateScheduleInboxStatus,
  upsertCalendarBlock,
  upsertMemo,
} from './services/supabase/data';
import { isSupabaseConfigured, supabase } from './services/supabase/client';
import {
  blockLocalDate,
  blocksForLocalDate,
  isDayComplete,
} from './features/tree/model/dayCompletion';
import { deriveGrowingTree } from './features/tree/model/deriveGrowingTree';
import {
  ActivityCompletion,
  DailyCompletion,
  ForestTree,
} from './features/tree/model/treeTypes';
import {
  BriefingRow,
  CalendarBlockRow,
  MemoRow,
  MemoSaveState,
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
const MAX_SPLIT_PANE_COUNT = 2;
const LAST_SYNC_STORAGE_KEY = 'subnota.lastSyncAt.v1';

const toLocalCalendarDate = (value: string) => {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

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

const waitForBootSync = async (syncPromise: Promise<void>) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      syncPromise,
      new Promise<void>(resolve => {
        timeoutId = setTimeout(resolve, BOOT_SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const App = () => {
  const [appSettings, setAppSettings] = useState(loadAppSettings);
  const [restoredWorkspace] = useState(() =>
    loadAppSettings().restoreWorkspace
      ? loadWorkspaceSession(getLocalWorkspaceOwner())
      : null,
  );
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
  const [ambientError, setAmbientError] = useState<string | null>(null);
  const [ambientRetrySignal, setAmbientRetrySignal] = useState(0);
  const [ambientTarget, setAmbientTarget] = useState<{
    editorId: string;
    memoId: string | null;
    queryText: string;
  } | null>(null);
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlockRow[]>([]);
  const [activityCompletions, setActivityCompletions] = useState<ActivityCompletion[]>([]);
  const [dailyCompletions, setDailyCompletions] = useState<DailyCompletion[]>([]);
  const [forestTrees, setForestTrees] = useState<ForestTree[]>([]);
  const [wateringSignal, setWateringSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setBooting] = useState(true);
  const [bootMessageIndex, setBootMessageIndex] = useState(
    () => Math.floor(Math.random() * BOOT_MESSAGES.length),
  );
  const [inboxItems, setInboxItems] = useState<InboxSession[]>([]);
  const [isInboxLoading, setInboxLoading] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
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
  const [saveState, setSaveState] = useState<MemoSaveState>('idle');
  const [session, setSession] = useState<Session | null>(null);
  const treeUserId = session?.user.id ?? 'local';
  const growingTree = useMemo(
    () => deriveGrowingTree(treeUserId, forestTrees, activityCompletions, dailyCompletions),
    [treeUserId, forestTrees, activityCompletions, dailyCompletions],
  );
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
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(
    restoredWorkspace?.focusedPaneId ?? null,
  );
  const [searchSignal, setSearchSignal] = useState(0);
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
  const [shortcuts, setShortcuts] = useState(loadShortcutSettings);
  const [desktopPreferences, setDesktopPreferences] = useState<{
    closeBehavior: 'quit' | 'tray';
    launchAtLogin: boolean;
  }>({ closeBehavior: 'tray', launchAtLogin: false });
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() =>
    window.localStorage?.getItem(LAST_SYNC_STORAGE_KEY) ?? null,
  );
  const [storageInfo, setStorageInfo] = useState<{
    databasePath: string;
    size: number;
  } | null>(null);
  const isOnline = useOnlineStatus();

  const activeMemoIdRef = useRef<string | null>(null);
  const hasHydratedActiveMemoRef = useRef(false);
  const ambientSuccessAtRef = useRef<Map<string, number>>(new Map());
  const memoSyncChainsRef = useRef<Map<string, Promise<void>>>(new Map());
  const memoLocalWriteRevisionsRef = useRef<Map<string, number>>(new Map());
  const deletingMemoIdsRef = useRef<Set<string>>(new Set());
  const memoSyncRevisionsRef = useRef<Map<string, number>>(new Map());
  const memoSyncTimersRef = useRef<Map<string, number>>(new Map());
  const networkControllerRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const sessionActivationIdRef = useRef(0);
  const workspaceLoadIdRef = useRef(0);

  const isCurrentSession = useCallback((expectedSession: Session) => {
    const currentSession = sessionRef.current;
    return (
      currentSession?.user.id === expectedSession.user.id &&
      currentSession.access_token === expectedSession.access_token
    );
  }, []);

  useEffect(() => {
    activeMemoIdRef.current = activeMemoId;
  }, [activeMemoId]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    applyEditorSettings(appSettings);
  }, [appSettings]);

  useEffect(() => {
    if (
      !window.electronAPI?.getDesktopPreferences ||
      !window.electronAPI?.getLocalStorageInfo
    ) {
      return;
    }
    void Promise.all([
      window.electronAPI.getDesktopPreferences(),
      window.electronAPI.getLocalStorageInfo(),
    ]).then(([preferences, info]) => {
      setDesktopPreferences(preferences);
      setStorageInfo(info);
    });
  }, []);

  useEffect(() => {
    if (appSettings.autoCheckUpdates && window.electronAPI?.checkForUpdate) {
      void window.electronAPI.checkForUpdate().catch(() => undefined);
    }
  }, [appSettings.autoCheckUpdates]);

  useEffect(() => () => {
    memoSyncTimersRef.current.forEach(timeout => window.clearTimeout(timeout));
    memoSyncTimersRef.current.clear();
  }, []);

  const enqueueMemoCloudSync = useCallback((
    currentSession: Session,
    memo: {
      baseHash?: string | null;
      category: string;
      content: string;
      contentUpdatedAt: string;
      createdAt: string;
      id: string;
    },
    revision: number,
  ) => {
    const previousSync = memoSyncChainsRef.current.get(memo.id) ?? Promise.resolve();
    const sync = previousSync
      .catch(() => undefined)
      .then(async () => {
        if (!isCurrentSession(currentSession)) {
          return;
        }

        if (
          activeMemoIdRef.current === memo.id &&
          memoSyncRevisionsRef.current.get(memo.id) === revision
        ) {
          setSaveState('syncing');
        }

        try {
          const result = await upsertMemo(currentSession, memo);
          if (
            !isCurrentSession(currentSession) ||
            memoSyncRevisionsRef.current.get(memo.id) !== revision
          ) {
            return;
          }

          if (result.status === 'deleted') {
            // Deleted on another device (delete-wins): drop it locally.
            await markLocalMemoDeleted(memo.id, 'synced', currentSession.user.id);
            if (memoSyncRevisionsRef.current.get(memo.id) !== revision) {
              return;
            }
            setMemos(previous => previous.filter(item => item.id !== memo.id));
            if (activeMemoIdRef.current === memo.id) {
              setSaveState('synced');
            }
            return;
          }

          // For 'conflict' savedMemo is the server's canonical version; our edit
          // was preserved server-side as a conflict copy that arrives on the next
          // fetchMemos.
          const savedMemo = result.memo;

          await upsertLocalMemo(
            {
              category: getMemoCategory(savedMemo.category),
              content: savedMemo.content,
              content_updated_at: savedMemo.content_updated_at,
              created_at: savedMemo.created_at,
              id: savedMemo.id,
              synced_content_hash: savedMemo.synced_content_hash,
              updated_at: savedMemo.updated_at,
            },
            'synced',
            currentSession.user.id,
          );
          if (
            !isCurrentSession(currentSession) ||
            memoSyncRevisionsRef.current.get(memo.id) !== revision
          ) {
            return;
          }
          setMemos(previous => {
            const exists = previous.some(item => item.id === savedMemo.id);
            const syncedMemo = { ...savedMemo, local_sync_status: 'synced' as const };
            const merged = exists
              ? previous.map(item => (item.id === savedMemo.id ? syncedMemo : item))
              : [syncedMemo, ...previous];
            return merged.sort(
              (a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            );
          });

          if (activeMemoIdRef.current === memo.id) {
            setActiveMemoCreatedAt(savedMemo.created_at);
            setSaveState('synced');
          }
        } catch {
          if (
            isCurrentSession(currentSession) &&
            memoSyncRevisionsRef.current.get(memo.id) === revision
          ) {
            try {
	              await upsertLocalMemo(
	                {
                  category: memo.category,
                  content: memo.content,
                  content_updated_at: memo.contentUpdatedAt,
                  created_at: memo.createdAt,
                  id: memo.id,
	                },
                'failed',
                currentSession.user.id,
              );
              setMemos(previous =>
                previous.map(item =>
                  item.id === memo.id ? { ...item, local_sync_status: 'failed' } : item,
                ),
              );
            } catch {
              // Keep the original local write; it remains retryable as pending.
            }
            if (activeMemoIdRef.current === memo.id) setSaveState('failed');
          }
        }
      });

    memoSyncChainsRef.current.set(memo.id, sync);
    void sync.finally(() => {
      if (memoSyncChainsRef.current.get(memo.id) === sync) {
        memoSyncChainsRef.current.delete(memo.id);
      }
    });
    return sync;
  }, [isCurrentSession]);

  const scheduleMemoCloudSync = useCallback((
    currentSession: Session,
    memo: {
      baseHash?: string | null;
      category: string;
      content: string;
      contentUpdatedAt: string;
      createdAt: string;
      id: string;
    },
  ) => {
    const previousTimeout = memoSyncTimersRef.current.get(memo.id);
    if (previousTimeout !== undefined) {
      window.clearTimeout(previousTimeout);
    }

    const revision = (memoSyncRevisionsRef.current.get(memo.id) ?? 0) + 1;
    memoSyncRevisionsRef.current.set(memo.id, revision);

    const timeout = window.setTimeout(() => {
      memoSyncTimersRef.current.delete(memo.id);
      void enqueueMemoCloudSync(currentSession, memo, revision);
    }, SAVE_DELAY_MS);

    memoSyncTimersRef.current.set(memo.id, timeout);
  }, [enqueueMemoCloudSync]);

  const syncMemoToCloudNow = useCallback(async (
    currentSession: Session,
    memo: {
      baseHash?: string | null;
      category: string;
      content: string;
      contentUpdatedAt: string;
      createdAt: string;
      id: string;
    },
  ) => {
    const timeout = memoSyncTimersRef.current.get(memo.id);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      memoSyncTimersRef.current.delete(memo.id);
    }
    const revision = (memoSyncRevisionsRef.current.get(memo.id) ?? 0) + 1;
    memoSyncRevisionsRef.current.set(memo.id, revision);
    await enqueueMemoCloudSync(currentSession, memo, revision);
  }, [enqueueMemoCloudSync]);

  const cancelMemoCloudSync = useCallback(async (memoId: string) => {
    const timeout = memoSyncTimersRef.current.get(memoId);
    if (timeout !== undefined) {
      window.clearTimeout(timeout);
      memoSyncTimersRef.current.delete(memoId);
    }
    memoSyncRevisionsRef.current.set(
      memoId,
      (memoSyncRevisionsRef.current.get(memoId) ?? 0) + 1,
    );
    await memoSyncChainsRef.current.get(memoId)?.catch(() => undefined);
  }, []);

  const persistWorkspace = useCallback(() => {
    saveWorkspaceSession(
      {
        activeMemoId,
        activeTab,
        focusedPaneId,
        isSessionCollapsed,
        isSplitWorkspaceEnabled,
        paneWidths: {},
        splitPanes,
      },
      session?.user.id ?? null,
    );
  }, [
    activeMemoId,
    activeTab,
    focusedPaneId,
    isSessionCollapsed,
    isSplitWorkspaceEnabled,
    session?.user.id,
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
        setSearchSignal(value => value + 1);
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

  const applyLocalWorkspace = useCallback(async (ownerId?: string) => {
    const [localMemos, localBlocks, localInbox, localActivities, localDailies, localTrees] =
      await Promise.all([
        loadVisibleLocalMemos(ownerId),
        loadVisibleLocalCalendarBlocks(ownerId),
        loadLocalInboxQueue(ownerId),
        loadLocalActivityCompletions(ownerId),
        loadLocalDailyCompletions(ownerId),
        loadLocalTrees(ownerId),
      ]);

    setMemos(localMemos);
    setCalendarBlocks(localBlocks);
    setInboxItems(localInbox);
    setActivityCompletions(localActivities);
    setDailyCompletions(localDailies);
    setForestTrees([...localTrees].sort((a, b) => a.generation - b.generation));
    setBriefings([]);
    setScheduleInbox([]);
    setTopicClusters([]);
    setTopicEdges([]);
    setTopicMemberships([]);

    hydrateActiveMemo(localMemos);
  }, [hydrateActiveMemo]);

  const syncPendingLocalWorkspace = useCallback(async (currentSession: Session) => {
    const ownerId = currentSession.user.id;

    for (const memo of await loadLocalMemos(ownerId)) {
      if (memo.local_sync_status === 'pending_delete') {
        await cancelMemoCloudSync(memo.id);
        await archiveMemo(currentSession, memo.id);
        await markLocalMemoDeleted(memo.id, 'synced', ownerId);
        continue;
      }

      if (memo.local_sync_status && memo.local_sync_status !== 'synced') {
        await syncMemoToCloudNow(currentSession, {
          baseHash: memo.synced_content_hash ?? null,
          category: getMemoCategory(memo.category),
          content: memo.content,
          contentUpdatedAt: memo.content_updated_at ?? memo.updated_at,
          createdAt: memo.created_at,
          id: memo.id,
        });
      }
    }

    for (const block of await loadLocalCalendarBlocks(ownerId)) {
      if (block.local_sync_status === 'pending_delete') {
        await deleteCalendarBlock(currentSession, block.id);
        await removeLocalCalendarBlock(block.id, ownerId);
        continue;
      }

      if (block.local_sync_status && block.local_sync_status !== 'synced') {
        const savedBlock = await upsertCalendarBlock(currentSession, {
          allDay: Boolean(block.all_day),
          color: block.color ?? '#66705A',
          completedAt: block.completed_at ?? null,
          id: block.id,
          isCompleted: Boolean(block.is_completed),
          note: block.note,
          order: block.order ?? 0,
          startDate: block.start_date,
          title: block.title,
        });
        await upsertLocalCalendarBlock(savedBlock, 'synced', ownerId);
      }
    }

    for (const item of await loadLocalInboxQueue(ownerId)) {
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
        await removeLocalInboxSession(item.clientId, ownerId);
      } catch {
        // Keep the item queued. A later manual refresh or app start can retry.
      }
    }
  }, [cancelMemoCloudSync, syncMemoToCloudNow]);

  const loadWorkspace = useCallback(
    async (
      targetSession?: Session | null,
      options: { quiet?: boolean } = {},
    ) => {
      const currentSession = targetSession ?? sessionRef.current;
      const loadId = ++workspaceLoadIdRef.current;

      if (!currentSession) {
        await applyLocalWorkspace();
        return;
      }

      const ownerId = currentSession.user.id;
      const isCurrentLoad = () =>
        loadId === workspaceLoadIdRef.current &&
        sessionRef.current?.user.id === ownerId;

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
        if (!isCurrentLoad()) {
          return;
        }
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

        if (!isCurrentLoad()) {
          return;
        }

        const [mergedMemos, mergedBlocks, localInbox] = await Promise.all([
          replaceSyncedMemos(nextMemos, ownerId),
          replaceSyncedCalendarBlocks(nextBlocks, ownerId),
          loadLocalInboxQueue(ownerId),
        ]);

        setMemos(mergedMemos);
        setCalendarBlocks(mergedBlocks);
        setScheduleInbox(nextInbox);
        setBriefings(nextBriefings);
        setInboxItems(
          mergeInboxItems(nextLinkInbox, localInbox),
        );
        setTopicClusters(nextTopicMap.clusters);
        setTopicEdges(nextTopicMap.edges);
        setTopicMemberships(nextTopicMap.memberships);

        // Forest = cloud trees ∪ any trees planted while offline (pushed now).
        const cloudTrees = await fetchTrees(currentSession).catch(() => [] as ForestTree[]);
        if (isCurrentLoad()) {
          const localTrees = await loadLocalTrees(ownerId);
          const byGeneration = new Map<number, ForestTree>();
          for (const tree of cloudTrees) {
            byGeneration.set(tree.generation, tree);
          }
          for (const tree of localTrees) {
            if (!byGeneration.has(tree.generation)) {
              byGeneration.set(tree.generation, tree);
              await recordPlantedTree(currentSession, tree).catch(() => undefined);
            }
          }
          const mergedTrees = [...byGeneration.values()].sort(
            (a, b) => a.generation - b.generation,
          );
          await Promise.all(
            mergedTrees.map(tree => upsertLocalTree(tree, 'synced', ownerId).catch(() => undefined)),
          );
          setForestTrees(mergedTrees);
        }

        hydrateActiveMemo(mergedMemos);
        const syncedAt = new Date().toISOString();
        setLastSyncAt(syncedAt);
        window.localStorage?.setItem(LAST_SYNC_STORAGE_KEY, syncedAt);
      } catch (caught) {
        if (!isCurrentLoad()) {
          return;
        }
        setError(caught instanceof Error ? caught.message : '데이터를 불러오지 못했습니다.');
        await applyLocalWorkspace(ownerId);
      } finally {
        if (loadId === workspaceLoadIdRef.current) {
          setRefreshing(false);
        }
      }
    },
    [applyLocalWorkspace, hydrateActiveMemo, syncPendingLocalWorkspace],
  );

  const restoreWorkspaceForAccount = useCallback((ownerId: string | null) => {
    const restored = loadWorkspaceSession(ownerId);
    hasHydratedActiveMemoRef.current = false;
    activeMemoIdRef.current = restored?.activeMemoId ?? null;
    setActiveMemoId(restored?.activeMemoId ?? null);
    setActiveTab(restored?.activeTab ?? 'memo');
    setMemoDraft('');
    setActiveMemoCreatedAt(new Date().toISOString());
    setActiveDraftCategory(DEFAULT_MEMO_CATEGORY);
    setSelectionStart(0);
    setSelectionEnd(0);
    setSelectedTextState('');
    setSplitPanes(restored?.splitPanes ?? []);
    setFocusedPaneId(restored?.focusedPaneId ?? null);
    setSessionCollapsed(restored?.isSessionCollapsed ?? false);
    setIsSplitWorkspaceEnabled(restored?.isSplitWorkspaceEnabled ?? false);
  }, []);

  const activateSession = useCallback(
    async (
      nextSession: Session,
      options: {
        migrateLegacy?: boolean;
        restoreWorkspace?: boolean;
        showBoot?: boolean;
      } = {},
    ) => {
      const activationId = ++sessionActivationIdRef.current;
      const ownerId = nextSession.user.id;

      workspaceLoadIdRef.current += 1;
      setLocalWorkspaceOwner(ownerId);
      if (options.restoreWorkspace || options.migrateLegacy) {
        restoreWorkspaceForAccount(ownerId);
      }
      sessionRef.current = nextSession;
      setSession(nextSession);
      setError(null);
      await applyLocalWorkspace(ownerId);

      if (options.showBoot) {
        setBooting(true);
      }

      try {
        await waitForBootSync(loadWorkspace(nextSession, { quiet: true }));
      } finally {
        if (
          options.showBoot &&
          activationId === sessionActivationIdRef.current &&
          sessionRef.current?.user.id === ownerId
        ) {
          setBooting(false);
        }
      }
    },
    [applyLocalWorkspace, loadWorkspace, restoreWorkspaceForAccount],
  );

  const deactivateSession = useCallback(() => {
    sessionActivationIdRef.current += 1;
    workspaceLoadIdRef.current += 1;
    sessionRef.current = null;
    setSession(null);
    setLocalWorkspaceOwner(null);
    restoreWorkspaceForAccount(null);
    void applyLocalWorkspace();
    setRefreshing(false);
    setInboxLoading(false);
  }, [applyLocalWorkspace, restoreWorkspaceForAccount]);

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

    void applyLocalWorkspace();

    if (!isSupabaseConfigured()) {
      setError('최초 로그인에는 온라인 연결과 Supabase 설정이 필요합니다.');
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
        if (nextSession) {
          // 첫 데이터 로드(로컬 + 서버 동기화)가 끝날 때까지 로딩화면을 유지한다.
          // 단, 느리거나 끊긴 네트워크에 갇히지 않도록 타임아웃을 두고 진입한다.
          await activateSession(nextSession, { migrateLegacy: true });
        } else {
          deactivateSession();
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

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const currentSession = sessionRef.current;
      const decision = decideAuthEvent({
        event,
        hasSession: Boolean(nextSession),
        isSameSession:
          currentSession?.user.id === nextSession?.user.id &&
          currentSession?.access_token === nextSession?.access_token,
      });

      if (decision.action === 'deactivate') {
        deactivateSession();
        return;
      }

      if (decision.action === 'ignore' || !nextSession) {
        return;
      }

      if (decision.action === 'update') {
        sessionRef.current = nextSession;
        setSession(nextSession);
        return;
      }

      if (decision.action === 'activate') {
        void activateSession(nextSession, {
          restoreWorkspace: true,
          showBoot: true,
        });
      }
    });

    return () => {
      mounted = false;
      sessionActivationIdRef.current += 1;
      workspaceLoadIdRef.current += 1;
      data.subscription.unsubscribe();
    };
  }, [activateSession, applyLocalWorkspace, deactivateSession]);

  // Sync pending offline writes when connectivity or focus returns.
  useEffect(
    () =>
      registerReconnectSync(() => {
        const currentSession = sessionRef.current;
        return currentSession
          ? syncPendingLocalWorkspace(currentSession)
          : Promise.resolve();
      }),
    [syncPendingLocalWorkspace],
  );

  useEffect(() => {
    setAmbientQueryChunk(null);
    setAmbientResult(null);
    setAmbientError(null);

    if (!session || !ambientTarget) {
      return;
    }

    const queryText = ambientTarget.queryText.trim();
    if (queryText.length < AMBIENT_MIN_CHARS) {
      return;
    }

    const chunkHash = hashText(
      `${ambientTarget.editorId}:${ambientTarget.memoId ?? 'draft'}:${queryText}`,
    );
    const lastSuccessAt = ambientSuccessAtRef.current.get(chunkHash) ?? 0;
    if (Date.now() - lastSuccessAt < AMBIENT_COOLDOWN_MS) {
      return;
    }

    const controller = new AbortController();
    let isCurrent = true;
    void searchCursorNetwork({
          limit: AMBIENT_MAX_RESULT_COUNT,
          minimumSimilarity: AMBIENT_MIN_SIMILARITY,
          memoId: ambientTarget.memoId,
          queryText,
          signal: controller.signal,
        })
        .then(result => {
          if (!isCurrent) {
            return;
          }
          ambientSuccessAtRef.current.set(chunkHash, Date.now());
          if (ambientSuccessAtRef.current.size > 200) {
            const oldestHash = ambientSuccessAtRef.current.keys().next().value;
            if (oldestHash) ambientSuccessAtRef.current.delete(oldestHash);
          }
          setAmbientQueryChunk(result.queryChunk);
          setAmbientResult(result.results[0] ?? null);
        })
        .catch(caught => {
          if (!isCurrent || (caught instanceof DOMException && caught.name === 'AbortError')) {
            return;
          }
          setAmbientQueryChunk(null);
          setAmbientResult(null);
          setAmbientError(formatNetworkSearchErrorMessage(caught, {
            isOnline: navigator.onLine,
          }));
        });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [ambientRetrySignal, ambientTarget, session]);

  const startNewMemo = useCallback((category = DEFAULT_MEMO_CATEGORY) => {
    const now = new Date().toISOString();
    setActiveMemoId(createUuid());
    setActiveMemoCreatedAt(now);
    setActiveDraftCategory(category);
    setMemoDraft('');
    setAmbientQueryChunk(null);
    setAmbientResult(null);
    setAmbientError(null);
    setNetworkError(null);
    setNetworkQueryChunk(null);
    setNetworkResults([]);
    setSelectionEnd(0);
    setSelectionStart(0);
    setSelectedTextState('');
    setActiveTab('memo');
    setSaveState('idle');
  }, []);

  const saveMemoContent = (
    id: string,
    content: string,
    fallback?: { category?: string; createdAt?: string },
  ) => {
    const existingMemo = memos.find(memo => memo.id === id);
    if (deletingMemoIdsRef.current.has(id)) {
      return existingMemo ?? null;
    }
    if (!existingMemo && !content.trim()) {
      return null;
    }
    if (existingMemo?.content === content) {
      return existingMemo;
    }

    const createdAt = existingMemo?.created_at ?? fallback?.createdAt ?? new Date().toISOString();
    const contentUpdatedAt = new Date().toISOString();
    const category = getMemoCategory(existingMemo?.category ?? fallback?.category);
    const currentSession = sessionRef.current;
    const ownerId = currentSession?.user.id;
    const localMemo = createLocalMemoRow(
      {
        category,
        content,
        content_updated_at: contentUpdatedAt,
        created_at: createdAt,
        id,
        synced_content_hash: existingMemo?.synced_content_hash ?? null,
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

    if (activeMemoIdRef.current === id) {
      setSaveState('saving-local');
    }

    const localRevision = (memoLocalWriteRevisionsRef.current.get(id) ?? 0) + 1;
    memoLocalWriteRevisionsRef.current.set(id, localRevision);
    memoSyncRevisionsRef.current.set(
      id,
      (memoSyncRevisionsRef.current.get(id) ?? 0) + 1,
    );
    void persistLocalMemo(localMemo, ownerId)
      .then(() => {
        if (memoLocalWriteRevisionsRef.current.get(id) !== localRevision) return;
        if (activeMemoIdRef.current === id) setSaveState('local');
        if (currentSession && isCurrentSession(currentSession)) {
          scheduleMemoCloudSync(currentSession, {
            baseHash: existingMemo?.synced_content_hash ?? null,
            category,
            content,
            contentUpdatedAt,
            createdAt,
            id,
          });
        }
      })
      .catch(() => {
        if (
          memoLocalWriteRevisionsRef.current.get(id) === localRevision &&
          activeMemoIdRef.current === id
        ) {
          setSaveState('local-failed');
        }
      });

    return localMemo;
  };

  const changeMemoDraft = (value: string) => {
    let memoId = activeMemoId;
    let createdAt = activeMemoCreatedAt;
    if (!memoId && value.trim()) {
      memoId = createUuid();
      createdAt = new Date().toISOString();
      activeMemoIdRef.current = memoId;
      setActiveMemoId(memoId);
      setActiveMemoCreatedAt(createdAt);
    }

    setMemoDraft(value);
    setAmbientQueryChunk(null);
    setAmbientResult(null);
    setNetworkError(null);
    setNetworkQueryChunk(null);
    setNetworkResults([]);

    if (memoId) {
      saveMemoContent(memoId, value, {
        category: activeDraftCategory,
        createdAt,
      });
    }
  };

  const createMemoFromContent = (
    content: string,
    category = DEFAULT_MEMO_CATEGORY,
  ) => {
    const createdAt = new Date().toISOString();
    const id = createUuid();
    const memo = saveMemoContent(id, content, { category, createdAt });
    if (!memo) {
      throw new Error('빈 메모는 생성할 수 없습니다.');
    }
    return memo;
  };

  const updateMemoContentById = (id: string, content: string) => {
    saveMemoContent(id, content);
  };

  const deleteMemoById = async (id: string) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;

    deletingMemoIdsRef.current.add(id);
    memoLocalWriteRevisionsRef.current.set(
      id,
      (memoLocalWriteRevisionsRef.current.get(id) ?? 0) + 1,
    );
    setMemos(previous => previous.filter(memo => memo.id !== id));

    if (id === activeMemoId) {
      const nextMemos = memos.filter(memo => memo.id !== id);
      const nextActive = nextMemos[0] ?? null;
      setActiveMemoId(nextActive?.id ?? null);
      setMemoDraft(nextActive?.content ?? '');
      setActiveMemoCreatedAt(nextActive?.created_at ?? new Date().toISOString());
      setActiveDraftCategory(getMemoCategory(nextActive?.category));
      setSaveState('idle');
    }

    await markLocalMemoDeleted(id, 'pending_delete', ownerId);
    if (!currentSession) {
      deletingMemoIdsRef.current.delete(id);
      return;
    }

    void (async () => {
      try {
        await cancelMemoCloudSync(id);
        await archiveMemo(currentSession, id);
        await markLocalMemoDeleted(id, 'synced', ownerId);
      } catch {
        await markLocalMemoDeleted(id, 'pending_delete', ownerId).catch(() => undefined);
      } finally {
        deletingMemoIdsRef.current.delete(id);
      }
    })();
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
    setSaveState(
      memo.local_sync_status === 'synced'
        ? 'synced'
        : memo.local_sync_status === 'failed'
          ? 'failed'
          : memo.local_sync_status
            ? 'local'
            : 'idle',
    );
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
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const id = draft.id ?? createUuid();
    const now = new Date().toISOString();
    const existingBlock = calendarBlocks.find(block => block.id === id);
    const localBlock: CalendarBlockRow = {
      all_day: draft.allDay,
      all_day_date: draft.allDay ? toLocalCalendarDate(draft.startDate) : null,
      color: draft.color,
      created_at: existingBlock?.created_at ?? now,
      end_date: null,
      id,
      is_completed: existingBlock?.is_completed ?? false,
      completed_at: existingBlock?.completed_at ?? null,
      local_sync_status: 'pending',
      note: draft.note,
      order: draft.order ?? 0,
      start_date: draft.startDate,
      title: draft.title.trim() || '새 일정',
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updated_at: now,
    };

    setCalendarBlocks(previous => {
      const exists = previous.some(item => item.id === localBlock.id);
      return exists
        ? previous.map(item => (item.id === localBlock.id ? localBlock : item))
        : [...previous, localBlock];
    });
    await upsertLocalCalendarBlock(localBlock, 'pending', ownerId);

    if (!currentSession) {
      return;
    }

    void (async () => {
      try {
        const block = await upsertCalendarBlock(currentSession, {
          ...draft,
          id,
          isCompleted: existingBlock?.is_completed ?? false,
          completedAt: existingBlock?.completed_at ?? null,
        });
        await upsertLocalCalendarBlock(block, 'synced', ownerId);
        if (!isCurrentSession(currentSession)) return;
        setCalendarBlocks(previous =>
          previous.map(item => (item.id === block.id ? block : item)),
        );
      } catch {
        await upsertLocalCalendarBlock(localBlock, 'failed', ownerId).catch(() => undefined);
        if (!isCurrentSession(currentSession)) return;
        setCalendarBlocks(previous =>
          previous.map(item =>
            item.id === id ? { ...item, local_sync_status: 'failed' } : item,
          ),
        );
      }
    })();
  };

  // Permanent growth events: recorded the first time a block is completed and
  // when a whole day becomes complete. Local-first (works offline); the cloud
  // insert is best-effort and idempotent. Never removed on uncomplete/delete.
  const recordGrowthOnComplete = async (
    block: CalendarBlockRow,
    nextBlocks: CalendarBlockRow[],
  ) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const now = new Date().toISOString();
    const localDate = blockLocalDate(block);

    const activity = await loadLocalActivityCompletions(ownerId);
    if (!activity.some(item => item.calendar_block_id === block.id)) {
      const record = {
        id: createUuid(),
        calendar_block_id: block.id,
        completed_at: now,
        local_date: localDate,
      };
      await upsertLocalActivityCompletion(record, 'pending', ownerId);
      setActivityCompletions(previous => [...previous, record]);
      if (currentSession) {
        try {
          await recordActivityCompletion(currentSession, record);
          await upsertLocalActivityCompletion(record, 'synced', ownerId);
        } catch {
          // Stays pending for a later sync.
        }
      }
    }

    const dayBlocks = blocksForLocalDate(nextBlocks, localDate);
    if (isDayComplete(dayBlocks)) {
      const daily = await loadLocalDailyCompletions(ownerId);
      if (!daily.some(item => item.local_date === localDate)) {
        const record = {
          id: createUuid(),
          local_date: localDate,
          completed_at: now,
          todo_count: dayBlocks.length,
        };
        await upsertLocalDailyCompletion(record, 'pending', ownerId);
        setDailyCompletions(previous => [...previous, record]);
        setWateringSignal(value => value + 1);
        if (currentSession) {
          try {
            await recordDailyCompletion(currentSession, record);
            await upsertLocalDailyCompletion(record, 'synced', ownerId);
          } catch {
            // Stays pending for a later sync.
          }
        }
      }
    }
  };

  const handlePlantTree = async () => {
    if (!growingTree.isMature) {
      return;
    }
    const ownerId = session?.user.id;
    const tree: ForestTree = {
      id: createUuid(),
      generation: growingTree.generation,
      planted_at: new Date().toISOString(),
      final_params: growingTree.params,
      completed_todo_count: growingTree.stats.totalCompleted,
      completed_day_count: growingTree.stats.completedDays,
    };
    setForestTrees(previous => [...previous, tree]);
    await upsertLocalTree(tree, 'pending', ownerId);
    if (session) {
      try {
        await recordPlantedTree(session, tree);
        await upsertLocalTree(tree, 'synced', ownerId);
      } catch {
        // Stays pending for a later sync.
      }
    }
  };

  const toggleCalendarBlockCompleted = async (blockId: string) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const existing = calendarBlocks.find(block => block.id === blockId);
    if (!existing) {
      return;
    }
    const nextCompleted = !existing.is_completed;
    const now = new Date().toISOString();
    const updated: CalendarBlockRow = {
      ...existing,
      is_completed: nextCompleted,
      completed_at: nextCompleted ? now : null,
      local_sync_status: 'pending',
      updated_at: now,
    };

    setCalendarBlocks(previous =>
      previous.map(block => (block.id === blockId ? updated : block)),
    );
    await upsertLocalCalendarBlock(updated, 'pending', ownerId);

    if (nextCompleted) {
      const nextBlocks = calendarBlocks.map(block =>
        block.id === blockId ? updated : block,
      );
      void recordGrowthOnComplete(updated, nextBlocks);
    }

    if (!currentSession) {
      return;
    }

    void (async () => {
      try {
        const block = await upsertCalendarBlock(currentSession, {
          allDay: Boolean(updated.all_day),
          color: updated.color ?? '#66705A',
          id: updated.id,
          isCompleted: nextCompleted,
          completedAt: updated.completed_at,
          note: updated.note,
          order: updated.order ?? 0,
          startDate: updated.start_date,
          title: updated.title,
        });
        await upsertLocalCalendarBlock(block, 'synced', ownerId);
        if (!isCurrentSession(currentSession)) return;
        setCalendarBlocks(previous =>
          previous.map(item => (item.id === block.id ? block : item)),
        );
      } catch {
        await upsertLocalCalendarBlock(updated, 'failed', ownerId).catch(() => undefined);
        if (!isCurrentSession(currentSession)) return;
        setCalendarBlocks(previous =>
          previous.map(item =>
            item.id === blockId ? { ...item, local_sync_status: 'failed' } : item,
          ),
        );
      }
    })();
  };

  const registerSelectionSchedule = async () => {
    if (!selectedText.trim()) {
      return;
    }

    const selectedMatch = parseDates(selectedText, Date.now())[0];
    const containedMatch = selectedMatch;

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

    const currentSession = session;
    const ownerId = currentSession?.user.id;
    setCalendarBlocks(previous => previous.filter(block => block.id !== blockId));
    await markLocalCalendarBlockDeleted(blockId, 'pending_delete', ownerId);
    if (currentSession) {
      void (async () => {
        try {
          await deleteCalendarBlock(currentSession, blockId);
          await removeLocalCalendarBlock(blockId, ownerId);
        } catch {
          await markLocalCalendarBlockDeleted(
            blockId,
            'pending_delete',
            ownerId,
          ).catch(() => undefined);
        }
      })();
    }
  };

  const acceptInboxItem = async (item: ScheduleInboxRow) => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    await saveCalendarBlock({
      allDay: Boolean(item.all_day),
      color: '#66705A',
      note: item.source_text,
      startDate: item.scheduled_at,
      title: item.title,
    });
    await updateScheduleInboxStatus(currentSession, item.id, 'accepted');
    if (!isCurrentSession(currentSession)) {
      return;
    }
    setScheduleInbox(previous => previous.filter(inbox => inbox.id !== item.id));
  };

  const dismissInboxItem = async (item: ScheduleInboxRow) => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    await updateScheduleInboxStatus(currentSession, item.id, 'dismissed');
    if (!isCurrentSession(currentSession)) {
      return;
    }
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
    setFocusedPaneId(null);
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

  const handleAddSplitPane = () => {
    if (splitPanes.length >= MAX_SPLIT_PANE_COUNT) return;
    const nextEditor = createEditorHelper('memo');
    const nextPane: MemoSplitPaneState = {
      id: `pane-${Date.now()}`,
      activeEditorId: nextEditor.id,
      editors: [nextEditor],
      ...mirrorEditorPatchHelper(nextEditor),
      view: nextEditor.view,
    };
    setIsSplitWorkspaceEnabled(true);
    setSplitPanes(previous => [...previous, nextPane]);
    setFocusedPaneId(nextPane.id);
  };

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
    networkControllerRef.current?.abort();
    const networkController = new AbortController();
    networkControllerRef.current = networkController;
    const queryText = (
      ambientTarget?.memoId === activeMemoId
        ? ambientTarget.queryText
        : selectedTextState || memoDraft.split(/\n+/).find(line => line.trim()) || ''
    ).trim().slice(0, 4000);
    if (!queryText) {
      networkController.abort();
      setNetworkError('검색할 문단을 먼저 선택하거나 작성해 주세요.');
      return;
    }
    const initialQueryChunk: MemoChunk | null = queryText
      ? { end: queryText.length, id: networkRequestId, index: 0, start: 0, text: queryText }
      : null;

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
        limit: 5,
        minimumSimilarity: NETWORK_MIN_SIMILARITY,
        memoId: activeMemoId,
        queryText,
        signal: networkController.signal,
      });
      if (networkControllerRef.current !== networkController) {
        return;
      }
      const message =
        result.results.length === 0
          ? result.message ?? NETWORK_SEARCH_EMPTY_MESSAGE
          : null;
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
      if (networkController.signal.aborted) {
        return;
      }
      const message = formatNetworkSearchErrorMessage(caught, {
        isOnline: navigator.onLine,
      });
      setNetworkError(message);
      patchNetworkSplitEditor(networkRequestId, {
        networkErrorMessage: message,
        networkIsLoading: false,
        networkQueryChunk: initialQueryChunk,
        networkResults: [],
      });
    } finally {
      if (networkControllerRef.current === networkController) {
        networkControllerRef.current = null;
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // The in-memory session is still cleared below.
      }
      deactivateSession();
    }
  };

  const applyShortcutSettings = async (nextSettings: ShortcutSettings) => {
    const normalized = normalizeShortcutSettings(nextSettings);
    const accepted = saveShortcutSettings(normalized);

    setShortcuts(accepted);
  };

  const resetShortcutSettings = () => applyShortcutSettings(DEFAULT_SHORTCUT_SETTINGS);

  const refreshInbox = async () => {
    const currentSession = session;
    if (!currentSession) {
      setInboxItems(await loadLocalInboxQueue());
      return;
    }
    const ownerId = currentSession.user.id;

    setInboxLoading(true);
    setError(null);
    try {
      await syncPendingLocalWorkspace(currentSession);
      const nextItems = await fetchInboxSessions();
      if (!isCurrentSession(currentSession)) {
        return;
      }
      setInboxItems(
        mergeInboxItems(nextItems, await loadLocalInboxQueue(ownerId)),
      );
    } catch (caught) {
      if (!isCurrentSession(currentSession)) {
        return;
      }
      setError(caught instanceof Error ? caught.message : '수집함을 불러오지 못했습니다.');
    } finally {
      if (isCurrentSession(currentSession)) {
        setInboxLoading(false);
      }
    }
  };

  const saveInboxUrl = async (url: string) => {
    const currentSession = session;
    setError(null);
    if (!currentSession) {
      setError('링크를 저장하려면 먼저 로그인해 주세요.');
      return;
    }
    const ownerId = currentSession.user.id;
    const localItem = await createLocalInboxSession(url, ownerId);
    setInboxItems(previous => [localItem, ...previous]);

    try {
      const item = await createInboxSession({
        clientId: localItem.clientId,
        url,
      });
      await removeLocalInboxSession(localItem.clientId, ownerId);
      if (!isCurrentSession(currentSession)) {
        return;
      }
      setInboxItems(previous => [
        item,
        ...previous.filter(previousItem => previousItem.id !== localItem.id),
      ]);
      window.setTimeout(() => {
        void refreshInbox();
      }, 2500);
    } catch (caught) {
      if (!isCurrentSession(currentSession)) {
        return;
      }
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

  // The Mini Subnota panel writes to the same local store in a separate window;
  // refresh the visible memo list when it notifies us of a save.
  useEffect(() => {
    return window.electronAPI?.onMemosUpdated?.(() => {
      void loadVisibleLocalMemos().then(setMemos);
    });
  }, []);

  const focusRelativePane = (offset: number) => {
    if (splitPanes.length < 2) return;
    const currentIndex = Math.max(
      0,
      splitPanes.findIndex(pane => pane.id === focusedPaneId),
    );
    const nextIndex =
      (currentIndex + offset + splitPanes.length) % splitPanes.length;
    setFocusedPaneId(splitPanes[nextIndex].id);
  };

  useAppHotkeys({
    createMemo: () => startNewMemo(),
    createSplitPane: handleAddSplitPane,
    focusNextPane: () => focusRelativePane(1),
    focusPreviousPane: () => focusRelativePane(-1),
    openCalendar: () => setActiveTab('calendar'),
    openInbox: () => setActiveTab('inbox'),
    openMemos: () => setActiveTab('memo'),
    openSettings: () => setSettingsOpen(true),
  });

  useEffect(
    () =>
      window.electronAPI?.onNewMemo?.(() => startNewMemo()) ??
      (() => undefined),
    [startNewMemo],
  );

  const pendingSyncCount = useMemo(
    () =>
      memos.filter(item => item.local_sync_status?.startsWith('pending')).length +
      calendarBlocks.filter(item =>
        item.local_sync_status?.startsWith('pending'),
      ).length +
      inboxItems.filter(
        item =>
          (item as InboxSession & { local_sync_status?: string })
            .local_sync_status === 'pending',
      ).length,
    [calendarBlocks, inboxItems, memos],
  );

  const failedSyncCount = useMemo(
    () =>
      memos.filter(item => item.local_sync_status === 'failed').length +
      calendarBlocks.filter(item => item.local_sync_status === 'failed').length +
      inboxItems.filter(
        item =>
          (item as InboxSession & { local_sync_status?: string })
            .local_sync_status === 'failed',
      ).length,
    [calendarBlocks, inboxItems, memos],
  );

  const updateAppSettings = (next: AppSettings) => {
    setAppSettings(saveAppSettings(next));
  };

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
            <svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor" aria-hidden="true">
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

  if (!session) {
    return <AuthScreen initialError={error} />;
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
          aria-label="웹 inbox"
          className={activeTab === 'inbox' ? 'nav-item active' : 'nav-item'}
          delay={300}
          onClick={() => setActiveTab('inbox')}
          placement="right"
          tooltip="웹 inbox"
        >
          <Inbox size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="일정 inbox"
          className={activeTab === 'briefing' ? 'nav-item active' : 'nav-item'}
          delay={300}
          disabled={!session}
          onClick={() => setActiveTab('briefing')}
          placement="right"
          tooltip="일정 inbox"
        >
          <Sparkles size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="Topics"
          className="nav-item"
          delay={300}
          onClick={() => {
            setActiveTab('memo');
            handleOpenSplitPane('topics');
          }}
          placement="right"
          tooltip="Topics"
        >
          <Topics size={22} />
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
            <button className="ghost-button" onClick={handleSignOut} type="button">
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        </header>

        {activeTab === 'memo' && (
          <div className={`memo-workspace-split-layout ${isSplitWorkspaceEnabled ? 'split-active' : ''}`} style={{ display: 'flex', flexDirection: 'row', flex: 1, minWidth: 0, width: '100%', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
            <MemoWorkspace
              activeMemoId={activeMemoId}
              ambientError={ambientError}
              isSessionCollapsed={isSessionCollapsed}
              openMemoPaneNumbers={openMemoPaneNumbers}
              openSearchSignal={searchSignal}
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
              onAmbientQuery={queryText =>
                setAmbientTarget({
                  editorId: 'legacy-editor',
                  memoId: activeMemoId,
                  queryText,
                })
              }
              onDeleteMemo={() => void removeActiveMemo()}
              onNewMemo={() => startNewMemo()}
              onOpenNetwork={() => {
                void openNetwork();
              }}
              onRetryAmbient={() => setAmbientRetrySignal(value => value + 1)}
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
              workspaceContent={isSplitWorkspaceEnabled ? (
                <MemoSplitWorkspace
                ambientEditorId={ambientTarget?.editorId ?? null}
                ambientError={ambientError}
                ambientResult={ambientResult}
                focusedPaneId={focusedPaneId}
                onAmbientQuery={(editorId, memoId, queryText) =>
                  setAmbientTarget({ editorId, memoId, queryText })
                }
                onRetryAmbient={() => setAmbientRetrySignal(value => value + 1)}
                activeMemoId={activeMemoId}
                isSessionCollapsed={isSessionCollapsed}
                panes={splitPanes}
                onChangePane={handleChangePane}
                onCloseAllPanes={handleCloseAllPanes}
                onFocusPane={setFocusedPaneId}
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
                onToggleCalendarBlockCompleted={toggleCalendarBlockCompleted}
                calendarTreePanel={{
                  forest: forestTrees,
                  onPlant: () => void handlePlantTree(),
                  tree: growingTree,
                  userId: treeUserId,
                  wateringSignal,
                }}
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
              ) : undefined}
            />
          </div>
        )}

        {activeTab === 'calendar' && (
          <CalendarWorkspace
            blocks={calendarBlocks}
            onDeleteBlock={blockId => void removeCalendarBlock(blockId)}
            onSaveBlock={draft => void saveCalendarBlock(draft)}
            onToggleCompleted={blockId => void toggleCalendarBlockCompleted(blockId)}
            treePanel={{
              forest: forestTrees,
              onPlant: () => void handlePlantTree(),
              tree: growingTree,
              userId: treeUserId,
              wateringSignal,
            }}
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
      <SettingsModal
        appSettings={appSettings}
        desktopPreferences={desktopPreferences}
        email={session?.user?.email}
        failedSyncCount={failedSyncCount}
        inboxData={inboxItems}
        isOnline={isOnline}
        isOpen={isSettingsOpen}
        isSignedIn={Boolean(session)}
        isSyncing={isRefreshing}
        lastSyncAt={lastSyncAt}
        pendingSyncCount={pendingSyncCount}
        provider={session?.user?.app_metadata?.provider}
        scheduleData={calendarBlocks}
        shortcuts={shortcuts}
        storageInfo={storageInfo}
        onAppSettingsChange={updateAppSettings}
        onBackup={() => window.electronAPI.backupLocalData()}
        onCheckUpdates={async () => {
          const update = await window.electronAPI.checkForUpdate();
          return update
            ? `새 버전 ${update.version}을 사용할 수 있습니다.`
            : '현재 최신 버전입니다.';
        }}
        onChooseStorage={async () => {
          const info = await window.electronAPI.chooseLocalStorage();
          if (info) setStorageInfo(info);
        }}
        onClose={() => setSettingsOpen(false)}
        onDesktopPreferencesChange={async preferences => {
          setDesktopPreferences(
            await window.electronAPI.setDesktopPreferences(preferences),
          );
        }}
        onExportJson={(name, value) =>
          window.electronAPI.exportJson(name, value)
        }
        onOpenStorage={() => window.electronAPI.openLocalStorage()}
        onPasswordReset={async () => {
          if (!session?.user.email) {
            throw new Error('비밀번호 재설정 이메일을 확인할 수 없습니다.');
          }
          await sendPasswordResetOtp(session.user.email);
        }}
        onResetShortcuts={resetShortcutSettings}
        onRestore={file =>
          window.electronAPI.restoreLocalData(
            window.electronAPI.getFilePath(file),
          )
        }
        onSaveShortcuts={applyShortcutSettings}
        onSignOut={() => {
          setSettingsOpen(false);
          void handleSignOut();
        }}
        onSync={() => void loadWorkspace()}
      />
    </div>
  );
};

export default App;
