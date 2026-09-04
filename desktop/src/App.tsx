import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SegmentedControl, Tooltip, VisuallyHidden } from '@mantine/core';
import { Session } from '@supabase/supabase-js';
import {
  AppWindow,
  CalendarDays,
  Download,
  Folder,
  List,
  NotebookText,
  PanelRight,
  PanelRightClose,
  Plus,
  Settings,
  Topics,
  X,
} from '@/components/icons';
import TooltipIconButton from './components/TooltipIconButton';
import BootBrandMark from './components/BootBrandMark';
import SubnotaSpinner from './components/SubnotaSpinner';
import WorkspaceBootSkeleton from './components/WorkspaceBootSkeleton';
import {
  BOOT_BRAND_PHASE_MS,
  BOOT_FULLSCREEN_MAX_MS,
  isReloadNavigation,
  resolveBootCloseDelayMs,
  resolveBootMarkVariant,
  resolveBootPhase,
} from './lib/bootPhase';

import AuthScreen from './features/auth/AuthScreen';
import { decideAuthEvent } from './features/auth/authEventDecision';
import GlobalSearchOverlay from './features/search/GlobalSearchOverlay';
import EmbeddingModelGate from './features/search/EmbeddingModelGate';
import LocalIndexProgress, {
  isEmptyLocalIndexCompletion,
  shouldShowLocalIndexProgress,
} from './features/search/LocalIndexProgress';
import MemoWorkspace, {
  SESSION_RAIL_WIDTH,
  type MemoSidebarMode,
} from './features/memo/MemoWorkspace';
import MemoSplitWorkspace, {
  MemoSplitEditorState,
  MemoSplitPaneState,
  MemoSplitPaneView,
} from './features/memo/components/MemoSplitWorkspace';
import SettingsModal from './features/settings/SettingsModal';
import UpdatePopover, {
  type UpdatePopoverStatus,
} from './features/update/UpdatePopover';
import { useAppHotkeys } from './hooks/useAppHotkeys';
import {
  AMBIENT_EMPTY_NOTICE_MS,
  AMBIENT_LIST_MIN_SIMILARITY,
  AMBIENT_MAX_RESULT_COUNT,
  AMBIENT_MIN_CHARS,
  AMBIENT_MIN_SIMILARITY,
} from './lib/constants';
import {
  AmbientSearchMode,
  AmbientSearchTarget,
  canRunAmbientAutoSearch,
  createAmbientSearchRunner,
} from './lib/ambientSearch';
import { notifyClipFailed, notifyClipSaved } from './lib/clipNotification';
import { createUuid } from './lib/contentHash';
import { normalizeWebUrl } from './lib/url-policy';
import {
  loadPinnedMemoIds,
  savePinnedMemoIds,
  togglePinnedMemoId,
} from './lib/pinnedMemos';
import { MemoChunk } from './lib/memoChunker';
import { decideMemoNavAction } from './lib/memoNavAction';
import {
  mergeLoadedMemosPreservingLocalWrites,
  partitionRemoteMemoConflictCopies,
  pendingMemoIdsForOwner,
  shouldDeferMemoSync,
} from './lib/memoLoadMerge';
import {
  buildGlobalSearchItems,
  type GlobalSearchItem,
} from './lib/globalSearch';
import { registerReconnectSync } from './lib/reconnectSync';
import { memoSyncRetryDelay } from './lib/memoSyncRetry';
import { rebaseEditorChangeOntoCanonical } from './lib/mergeMemo';
import {
  activeMemoIdsInPanes,
  editorAtRelativeTab,
  editorsAfterCloseTab,
  editorsAfterMove,
  editorsAfterNewTab,
  editorsAfterOpenTab,
  editorsAfterTransfer,
} from './lib/splitPaneTabs';
import { createKeyedMutationQueue } from './lib/keyedMutationQueue';
import { useOnlineStatus } from './lib/useOnlineStatus';
import {
  AppSettings,
  applyEditorSettings,
  loadAppSettings,
  saveAppSettings,
} from './lib/appSettings';
import { localize } from './lib/uiLanguage';
import {
  AppShortcutSettings,
  DEFAULT_APP_SHORTCUT_SETTINGS,
  DEFAULT_SHORTCUT_SETTINGS,
  formatHotkeyTooltip,
  ShortcutSettings,
  loadAppShortcutSettings,
  loadShortcutSettings,
  matchesKeyboardShortcut,
  saveAppShortcutSettings,
  normalizeShortcutSettings,
  saveShortcutSettings,
} from './lib/shortcutSettings';
import { DEFAULT_MEMO_CATEGORY, getMemoCategory } from './lib/memoCategory';
import {
  loadWorkspaceSession,
  saveWorkspaceSession,
} from './lib/workspaceSession';
import {
  InboxSession,
  createInboxSession,
  deleteInboxSession,
  deleteInboxSessionByClientId,
  fetchInboxSessions,
  retryInboxSessionSummary,
  setInboxLiked,
  type InboxSummaryStatus,
} from './services/backend/inboxService';
import { deleteAccount } from './services/backend/accountService';
import {
  applyLocalMemoSyncResult,
  createLocalMemoRow,
  createLocalInboxSession,
  getLocalWorkspaceOwner,
  isLocalInboxSessionDeleted,
  loadLocalActivityCompletions,
  loadLocalCalendarBlocks,
  getLocalMemo,
  loadLocalDailyCompletions,
  cacheLocalInboxItem,
  clearLocalWorkspaceOwner,
  loadLocalInboxItems,
  loadLocalInboxQueue,
  loadLocalScheduleInbox,
  loadLocalScheduleInboxActions,
  loadLocalTopicMap,
  removeLocalScheduleInboxAction,
  removeLocalScheduleInboxItem,
  replaceLocalInboxCache,
  replaceLocalScheduleInbox,
  saveLocalTopicMap,
  loadLocalMemos,
  loadVisibleLocalCalendarBlocks,
  loadVisibleLocalMemos,
  markLocalCalendarBlockDeleted,
  markLocalInboxSessionDeleted,
  markLocalMemoDeleted,
  flushPendingLocalGrowthWrites,
  flushPendingLocalMemoWrites,
  persistLocalMemoEventually,
  preserveLocalMemoRecovery,
  removeLocalCalendarBlock,
  removeLocalInboxSession,
  removeLocalInboxSessionIfNotDeleted,
  replaceSyncedCalendarBlocks,
  replaceSyncedMemos,
  restoreLocalMemoSnapshotAfterPull,
  setLocalWorkspaceOwner,
  upsertLocalActivityCompletion,
  upsertLocalActivityCompletionEventually,
  upsertLocalCalendarBlock,
  upsertLocalDailyCompletion,
  upsertLocalDailyCompletionEventually,
  upsertLocalMemo,
  upsertLocalScheduleInboxAction,
} from './services/local/offlineStore';
import {
  cancelLocalMemoIndexing,
  reconcileLocalMemoIndex,
  scheduleLocalMemoIndexReconcile,
  subscribeLocalMemoIndexProgress,
  type LocalMemoIndexProgress,
} from './services/local/localMemoIndexer';
import {
  cancelLocalInboxIndexing,
  scheduleLocalInboxIndexReconcile,
} from './services/local/localInboxIndexer';
import { type NetworkSearchResult } from './services/backend/networkService';
import {
  formatLocalMemoSearchErrorMessage,
  searchLocalMemoChunks,
} from './services/local/localMemoSearch';
import {
  archiveMemo,
  deleteCalendarBlock,
  ensureProfile,
  fetchCalendarBlocks,
  fetchMemos,
  fetchScheduleInbox,
  fetchTopicMap,
  getSession,
  recordActivityCompletion,
  recordDailyCompletion,
  sendPasswordResetOtp,
  signOut,
  updateScheduleInboxStatus,
  upsertCalendarBlock,
} from './services/supabase/data';
import { pushMemoMerging } from './services/supabase/memoSync';
import { isSupabaseConfigured, supabase } from './services/supabase/client';
import {
  blockLocalDate,
  blocksForLocalDate,
  isDayComplete,
} from './features/report/dayCompletion';
import MonthlyReportModal from './features/report/MonthlyReportModal';
import {
  MIN_MEMOS_FOR_REPORT,
  buildMonthlyReport,
  loadSeenReportMonth,
  monthKeyOf,
  reportMonthKey,
  saveSeenReportMonth,
  shiftMonthKey,
} from './features/report/monthlyReport';
import PreviewPanel, {
  type PreviewPanelState,
} from './features/preview/PreviewPanel';
import ScheduleInboxWorkspace from './features/schedule/ScheduleInboxWorkspace';
import {
  hasScheduledDate,
  mergePendingScheduleInbox,
  partitionScheduleInbox,
} from './features/schedule/scheduleInboxUtils';
import { defaultCalendarEndDate } from './features/calendar/calendarUtils';
import {
  DEFAULT_CALENDAR_COLOR,
  loadCalendarCategories,
  saveCalendarCategories,
} from './features/calendar/calendarCategories';
import {
  canPushSidePanel,
  clampPreviewPanelWidth,
  effectiveSidePanelWidth,
  loadPreviewPanelWidth,
  savePreviewPanelWidth,
} from './lib/previewPanelWidth';
import {
  ActivityCompletion,
  DailyCompletion,
} from './features/report/growthTypes';
import {
  CalendarBlockDraft,
  CalendarBlockRow,
  CalendarCategoryDraft,
  CalendarCategoryRow,
  MemoRow,
  MemoSaveState,
  ScheduleInboxRow,
  TabKey,
  TopicCluster,
  MemoSimilarityEdge,
  TopicMemoInboxEdge,
  TopicInboxMembership,
  TopicMembership,
} from './types';
import { toValidDate } from './lib/viewCrashGuards';

// Local SQLite writes remain immediate. Only coalesce cloud uploads so brief
// pauses while writing do not produce a server round-trip for every draft.
const SAVE_DELAY_MS = 2500;
type AppSidePanelKind = 'preview' | 'schedule-inbox';
type AvailableUpdate = { downloadUrl: string; version: string };
type UpdateState =
  | { status: 'idle' }
  | { status: Exclude<UpdatePopoverStatus, 'error'>; update: AvailableUpdate }
  | { message: string; status: 'error'; update: AvailableUpdate };
type MemoCloudSyncInput = {
  baseHash?: string | null;
  category: string;
  content: string;
  contentUpdatedAt: string;
  createdAt: string;
  id: string;
};
// 첫 부팅 동기화가 느리거나 끊겨도 로딩화면에 갇히지 않도록 하는 상한.
// 초과하면 로컬 데이터로 진입하고 동기화는 백그라운드에서 계속된다(local-first).
const BOOT_SYNC_TIMEOUT_MS = 8000;
const MAX_SPLIT_PANE_COUNT = 2;
const LAST_SYNC_STORAGE_KEY = 'subnota.lastSyncAt.v1';
const SIDEBAR_COLLAPSE_DURATION_MS = 280;
// Main cancels quit after 15s. Reject first so the renderer can unlock itself
// before main reports that cancellation.
const LOCAL_WRITE_FLUSH_TIMEOUT_MS = 14_000;

const toLocalCalendarDate = (value: string) => {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const createSplitPaneId = () =>
  `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const memoCloudSyncInput = (memo: MemoRow): MemoCloudSyncInput => ({
  baseHash: memo.synced_content_hash ?? null,
  category: getMemoCategory(memo.category),
  content: memo.content,
  contentUpdatedAt: memo.content_updated_at ?? memo.updated_at,
  createdAt: memo.created_at,
  id: memo.id,
});

const getAppPaneEditors = (pane: MemoSplitPaneState) =>
  pane.editors && pane.editors.length > 0 ? pane.editors : [pane];

const getAppActiveEditor = (pane: MemoSplitPaneState) => {
  const editors = getAppPaneEditors(pane);
  return (
    editors.find((editor) => editor.id === pane.activeEditorId) ?? editors[0]
  );
};

const mergeInboxItems = (
  remoteItems: InboxSession[],
  localItems: InboxSession[],
) => {
  const remoteClientIds = new Set(
    remoteItems.map((item) => item.clientId).filter(Boolean),
  );
  const pendingItems = localItems.filter(
    (item) => !item.clientId || !remoteClientIds.has(item.clientId),
  );

  return [...pendingItems, ...remoteItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

const withoutDeletedPendingInboxItems = (
  items: InboxSession[],
  deletedClientIds: Set<string>,
  deletedIds: Set<string> = new Set(),
) =>
  items.filter(
    (item) =>
      !deletedIds.has(item.id) &&
      (!item.clientId || !deletedClientIds.has(item.clientId)),
  );

const collectPendingInboxDeletes = (
  items: Array<InboxSession & { local_sync_status?: string }>,
) => {
  const clientIds = new Set<string>();
  const ids = new Set<string>();
  for (const item of items) {
    if (item.local_sync_status !== 'pending_delete') continue;
    ids.add(item.id);
    if (item.clientId) clientIds.add(item.clientId);
  }
  return { clientIds, ids };
};

const waitForBootSync = async (syncPromise: Promise<void>) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      syncPromise,
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, BOOT_SYNC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const getInitialSession = async () => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    // Auth storage/네트워크가 지연돼도 로컬 우선 화면 진입을 막지 않는다.
    return await Promise.race([
      getSession(),
      new Promise<Session | null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), BOOT_SYNC_TIMEOUT_MS);
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
  const t = (korean: string, english: string) =>
    localize(appSettings.uiLanguage, korean, english);
  const isMasDistribution = window.electronAPI?.isMasBuild === true;
  const isWindowsDistribution =
    window.electronAPI?.getPlatformFeatures?.().platform === 'windows';
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
  const [ambientResult, setAmbientResult] =
    useState<NetworkSearchResult | null>(null);
  const [ambientError, setAmbientError] = useState<string | null>(null);
  const [ambientDisplayEditorId, setAmbientDisplayEditorId] = useState<
    string | null
  >(null);
  const [ambientEmptyEditorId, setAmbientEmptyEditorId] = useState<
    string | null
  >(null);
  const [ambientTarget, setAmbientTarget] =
    useState<AmbientSearchTarget | null>(null);
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlockRow[]>([]);
  const [calendarCategories, setCalendarCategories] = useState<
    CalendarCategoryRow[]
  >(() => loadCalendarCategories(getLocalWorkspaceOwner()));
  const [activityCompletions, setActivityCompletions] = useState<
    ActivityCompletion[]
  >([]);
  // 이 값은 **로그인 화면에서만** 그려진다(`<AuthScreen initialError={error} />`).
  // 로그인한 뒤의 실패를 여기에 넣으면 사용자에게 아무것도 보이지 않는다.
  // 사용자가 방금 누른 것이 실패했으면 `window.alert`로 알리고, 배경에서 알아서
  // 복구되는 실패라면 아무것도 하지 말 것.
  const [error, setError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  // 설정에서 비밀번호 재설정을 시작하면 로그아웃 후 이 값으로 로그인 화면을
  // 재설정 단계에 바로 세운다.
  const [pendingResetEmail, setPendingResetEmail] = useState<string | null>(
    null,
  );
  const [isBooting, setBooting] = useState(true);
  // 전체 화면 로딩은 "로컬 작업 공간이 붙었는가"만 기다린다. 서버 동기화는
  // 뒤에서 계속 돌며 화면을 가리지 않는다.
  const [isLocalWorkspaceReady, setLocalWorkspaceReady] = useState(false);
  // 같은 계정의 stale-while-revalidate는 화면을 유지한다. 계정 소유자가
  // 바뀌는 짧은 구간만 별도 게이트로 가려 이전 계정 데이터 노출을 막는다.
  const [isWorkspaceOwnerTransition, setWorkspaceOwnerTransition] =
    useState(false);
  const [bootElapsedMs, setBootElapsedMs] = useState(0);
  // 브랜드 모션이 얼마나 재생됐는지 재려면 첫 렌더 시각이 필요하다.
  const bootStartedAtRef = useRef(Date.now());
  // 조립 모션이냐 스피너냐. 창 수명 동안 바뀌지 않으니 한 번만 정한다.
  const bootMarkVariantRef = useRef(
    resolveBootMarkVariant({
      isColdStartWindow: window.electronAPI?.isColdStart === true,
      isReloadNavigation: isReloadNavigation(),
    }),
  );
  const [inboxItems, setInboxItems] = useState<InboxSession[]>([]);
  const [isInboxLoading, setInboxLoading] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
  const [memos, setMemos] = useState<MemoRow[]>([]);
  const [memoSaveStates, setMemoSaveStates] = useState<
    Record<string, MemoSaveState>
  >({});
  const [pinnedMemoIds, setPinnedMemoIds] = useState<string[]>(() =>
    loadPinnedMemoIds(getLocalWorkspaceOwner()),
  );
  const [scheduleInbox, setScheduleInbox] = useState<ScheduleInboxRow[]>([]);
  const {
    calendarSuggestions: calendarScheduleSuggestions,
    inboxItems: incompleteScheduleInbox,
  } = useMemo(() => partitionScheduleInbox(scheduleInbox), [scheduleInbox]);

  const [session, setSession] = useState<Session | null>(null);
  const [topicClusters, setTopicClusters] = useState<TopicCluster[]>([]);
  const [topicUpdatedAt, setTopicUpdatedAt] = useState<string | null>(null);
  const [topicGlobalEdges, setTopicGlobalEdges] = useState<
    MemoSimilarityEdge[]
  >([]);
  const [topicInboxEdges, setTopicInboxEdges] = useState<TopicMemoInboxEdge[]>(
    [],
  );
  const [topicMemberships, setTopicMemberships] = useState<TopicMembership[]>(
    [],
  );
  const [topicInboxMemberships, setTopicInboxMemberships] = useState<
    TopicInboxMembership[]
  >([]);
  const [isSplitWorkspaceEnabled, setIsSplitWorkspaceEnabled] = useState(
    restoredWorkspace?.isSplitWorkspaceEnabled ?? true,
  );
  const [splitPanes, setSplitPanes] = useState<MemoSplitPaneState[]>(
    restoredWorkspace?.splitPanes ?? [],
  );
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(
    restoredWorkspace?.focusedPaneId ?? null,
  );
  const [paneWidths, setPaneWidths] = useState<Record<string, number>>(
    restoredWorkspace?.paneWidths ?? {},
  );
  const [isGlobalSearchOpen, setGlobalSearchOpen] = useState(false);
  // 미리보기 패널 — 참조 성격의 열기(ambient 추천, Topics/주변메모 그래프,
  // 캘린더 원본 노트)가 여기로 들어온다. 이동 성격의 열기는 지금처럼
  // 포커스 패널의 새 탭을 쓴다.
  const [previewPanel, setPreviewPanel] = useState<PreviewPanelState | null>(
    null,
  );
  const [previewPanelWidth, setPreviewPanelWidth] = useState(
    loadPreviewPanelWidth,
  );
  // 사이드 패널을 밀어낼지(push) 덮을지(overlay) 결정하려면 창 폭이 필요하다.
  // 워크스페이스가 아니라 창을 재는 이유: push하면 워크스페이스가 줄어들어
  // 측정값이 다시 조건을 바꾸는 피드백 루프가 생긴다.
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );
  const hadSessionRef = useRef(false);
  useEffect(() => {
    const hasSession = Boolean(session);
    const justSignedIn = hasSession && !hadSessionRef.current;
    hadSessionRef.current = hasSession;
    if (!hasSession) return;

    // 재설정을 마쳤거나 그냥 다시 로그인했으면 대기 상태를 지운다. 남겨 두면
    // 다음에 로그아웃할 때 엉뚱하게 재설정 화면으로 떨어진다.
    setPendingResetEmail(null);

    // 로그인 화면에서 작업 공간으로 들어오는 모든 경로(로그인·가입·비밀번호
    // 재설정)에서 브랜드 로딩을 끝까지 한 번 보여 준다. 이 순간 새 계정의
    // 첫 동기화와 준비가 시작되는데, 그 시간을 빈 화면으로 두면 앱이 멈춘
    // 것처럼 보인다. 콜드 스타트는 이미 그 게이트 안이라 건드리지 않는다.
    if (justSignedIn && !isBooting) {
      bootStartedAtRef.current = Date.now();
      bootMarkVariantRef.current = 'assemble';
      setBooting(true);
    }
  }, [isBooting, session]);

  // 창 크기를 바꾸는 동안에는 그리드 트랜지션을 꺼야 한다. 켜두면 resize
  // 이벤트마다 280ms 보간이 새로 걸려 레이아웃이 창을 뒤늦게 따라온다.
  const [isWindowResizing, setWindowResizing] = useState(false);
  useEffect(() => {
    let idleTimer = 0;
    const update = () => {
      setWindowWidth(window.innerWidth);
      setWindowResizing(true);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setWindowResizing(false), 180);
    };
    setWindowWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener('resize', update);
    };
  }, []);
  const [activeSidePanel, setActiveSidePanel] =
    useState<AppSidePanelKind | null>(null);
  const [isSidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [isSidePanelResizing, setSidePanelResizing] = useState(false);
  // 검색 모델이 없을 때만 관문을 띄운다. 상태는 물어볼 때 확인한다 —
  // 앱 시작마다 확인하면 모델이 이미 있는 사용자에게 불필요한 IPC가 된다.
  const [isEmbeddingGateOpen, setEmbeddingGateOpen] = useState(false);
  // 관문에서 시작한 다운로드는 색인기를 거치지 않아 구독으로는 진행률이
  // 오지 않는다. 상태를 직접 폴링해 같은 진행 표시에 흘려보낸다.
  const [modelDownload, setModelDownload] =
    useState<LocalMemoIndexProgress | null>(null);
  const startModelDownload = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.localEmbedDownloadModel) return;
    const toProgress = (
      state: 'downloading' | 'loading' | 'failed',
      downloadedBytes: number,
      totalBytes: number,
      error?: string,
    ): LocalMemoIndexProgress => ({
      completedChunks: 0,
      downloadedBytes,
      error,
      isInitialIndex: false,
      // 사용자가 [다운로드]를 누른 결과다. 항상 보여 준다.
      isVisible: true,
      ownerId: sessionRef.current?.user.id ?? null,
      stage: state,
      totalBytes,
      totalChunks: 0,
    });

    setModelDownload(toProgress('downloading', 0, 0));
    const timer = window.setInterval(() => {
      void api.localEmbedStatus?.().then((next) => {
        if (!next || next.state === 'ready') return;
        setModelDownload(
          toProgress(
            next.state === 'failed'
              ? 'failed'
              : next.state === 'loading'
                ? 'loading'
                : 'downloading',
            next.downloadedBytes,
            next.totalBytes,
            next.error,
          ),
        );
      });
    }, 500);

    try {
      const result = await api.localEmbedDownloadModel();
      if (!result.ready) {
        setModelDownload(
          toProgress(
            'failed',
            result.downloadedBytes,
            result.totalBytes,
            result.error ??
              t(
                '검색 준비 파일을 받지 못했습니다.',
                'Could not download the files needed for search.',
              ),
          ),
        );
      } else {
        // 관문 때문에 미뤄 둔 첫 색인을 이어서 돌린다.
        setModelDownload(null);
        scheduleLocalMemoIndexReconcile(
          memosRef.current,
          localIndexOwnerIdRef.current,
          true,
        );
        scheduleLocalInboxIndexReconcile(
          inboxItemsRef.current,
          localIndexOwnerIdRef.current,
        );
      }
    } finally {
      window.clearInterval(timer);
    }
  }, []);
  const [isSessionCollapsed, setSessionCollapsed] = useState(
    restoredWorkspace?.isSessionCollapsed ?? false,
  );
  const [sessionRailWidth, setSessionRailWidth] = useState(SESSION_RAIL_WIDTH);
  const [isSessionRailResizing, setSessionRailResizing] = useState(false);
  const [memoSidebarMode, setMemoSidebarMode] =
    useState<MemoSidebarMode>('time');
  const [isSidebarCollapseReady, setSidebarCollapseReady] = useState(
    restoredWorkspace?.isSessionCollapsed ?? false,
  );
  const [isFloatingNavDismissed, setFloatingNavDismissed] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isUpdatePopoverOpen, setUpdatePopoverOpen] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
  });
  const [isReportOpen, setReportOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => reportMonthKey());
  const [seenReportMonth, setSeenReportMonth] = useState<string | null>(() =>
    loadSeenReportMonth(getLocalWorkspaceOwner()),
  );
  const shouldReduceMotion = useReducedMotion();
  const [shortcuts, setShortcuts] = useState(loadShortcutSettings);
  const [appShortcuts, setAppShortcuts] = useState(loadAppShortcutSettings);
  const [desktopPreferences, setDesktopPreferences] = useState<{
    closeBehavior: 'quit' | 'tray';
    launchAtLogin: boolean;
  }>({ closeBehavior: 'tray', launchAtLogin: false });
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(
    () => window.localStorage?.getItem(LAST_SYNC_STORAGE_KEY) ?? null,
  );
  const [storageInfo, setStorageInfo] = useState<{
    databasePath: string;
    size: number;
  } | null>(null);
  const [localIndexProgress, setLocalIndexProgress] =
    useState<LocalMemoIndexProgress | null>(null);
  const visibleLocalIndexProgress = modelDownload ?? localIndexProgress;
  const globalSearchItems = useMemo(
    () =>
      buildGlobalSearchItems({
        calendarBlocks,
        inboxItems,
        memos,
        scheduleInbox,
        topicClusters,
      }),
    [calendarBlocks, inboxItems, memos, scheduleInbox, topicClusters],
  );
  const isOnline = useOnlineStatus();

  const activeMemoIdRef = useRef<string | null>(null);
  const activeMemoCreatedAtRef = useRef(activeMemoCreatedAt);
  const memosRef = useRef<MemoRow[]>([]);
  const inboxItemsRef = useRef<InboxSession[]>([]);
  const ambientTargetRef = useRef<AmbientSearchTarget | null>(null);
  const manualAmbientTargetRef = useRef<AmbientSearchTarget | null>(null);
  const hasHydratedActiveMemoRef = useRef(false);
  const ambientEmptyNoticeTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const sidebarCollapseTimerRef = useRef<number | null>(null);
  const ambientRunnerRef = useRef(
    createAmbientSearchRunner({
      search: async (target, signal) => {
        const ownerId = getLocalWorkspaceOwner();
        try {
          const response = await searchLocalMemoChunks({
            limit: AMBIENT_MAX_RESULT_COUNT,
            memoId: target.memoId,
            minimumSimilarity: AMBIENT_MIN_SIMILARITY,
            ownerId,
            queryText: target.queryText,
            signal,
          });
          if (getLocalWorkspaceOwner() !== ownerId) {
            throw new DOMException('Local workspace changed.', 'AbortError');
          }
          return response;
        } catch (error) {
          if (getLocalWorkspaceOwner() !== ownerId) {
            throw new DOMException('Local workspace changed.', 'AbortError');
          }
          throw error;
        }
      },
    }),
  );
  const memoSyncChainsRef = useRef<Map<string, Promise<void>>>(new Map());
  const splitPanesRef = useRef(splitPanes);
  splitPanesRef.current = splitPanes;
  const calendarMutationQueueRef = useRef(createKeyedMutationQueue());
  const memoLocalWriteRevisionsRef = useRef<Map<string, number>>(new Map());
  const pendingLocalMemoWriteOwnersRef = useRef<Map<string, string | null>>(
    new Map(),
  );
  const deletingMemoIdsRef = useRef<Set<string>>(new Set());
  const memoSyncRevisionsRef = useRef<Map<string, number>>(new Map());
  const memoSyncTimersRef = useRef<Map<string, number>>(new Map());
  const memoSyncRetryTimersRef = useRef<Map<string, number>>(new Map());
  const memoSyncRetryAttemptsRef = useRef<Map<string, number>>(new Map());
  const memoSyncRetryRunnerRef = useRef<
    | ((currentSession: Session, memo: MemoCloudSyncInput) => Promise<void>)
    | null
  >(null);
  const pendingLocalMemoWritePromisesRef = useRef<Map<string, Promise<void>>>(
    new Map(),
  );
  const [manualMemoSyncRetryIds, setManualMemoSyncRetryIds] = useState<
    string[]
  >([]);
  const localIndexStartupOwnerRef = useRef<string | null | undefined>(
    undefined,
  );
  const embeddingGateOwnerRef = useRef<string | null | undefined>(undefined);
  const sessionRef = useRef<Session | null>(null);
  const sessionActivationIdRef = useRef(0);
  const workspaceLoadIdRef = useRef(0);
  const deletedPendingInboxClientIdsRef = useRef<Set<string>>(new Set());
  const pendingInboxDeleteIdsRef = useRef<Set<string>>(new Set());
  const pendingInboxTombstoneWritesRef = useRef<Map<string, Promise<void>>>(
    new Map(),
  );
  const pendingCalendarLocalWritesRef = useRef<Set<Promise<unknown>>>(
    new Set(),
  );
  const inboxServerIdsByClientIdRef = useRef<Map<string, string>>(new Map());
  const inboxLikeRevisionsRef = useRef<Map<string, number>>(new Map());
  const inboxLikePendingCountsRef = useRef<Map<string, number>>(new Map());
  const inboxConfirmedLikesRef = useRef<Map<string, boolean>>(new Map());
  const inboxLatestLikesRef = useRef<Map<string, boolean>>(new Map());
  const inboxLikeRefreshFloorRef = useRef<Map<string, number>>(new Map());
  const inboxRefreshSequenceRef = useRef(0);
  const isPreparingToQuitRef = useRef(false);
  const activeLocalWriteGuardRef = useRef<(() => void) | null>(null);
  const confirmedRestoreMaintenanceRef = useRef(false);
  const localWriteGuardAcquirePromiseRef = useRef<Promise<() => void> | null>(
    null,
  );
  const localWriteGuardUnlockRef = useRef<() => void>(() => undefined);

  const isCurrentSession = useCallback((expectedSession: Session) => {
    const currentSession = sessionRef.current;
    return (
      currentSession?.user.id === expectedSession.user.id &&
      currentSession.access_token === expectedSession.access_token
    );
  }, []);

  const acquireLocalWriteGuard = useCallback(() => {
    if (activeLocalWriteGuardRef.current) {
      return Promise.resolve(activeLocalWriteGuardRef.current);
    }
    if (localWriteGuardAcquirePromiseRef.current) {
      return localWriteGuardAcquirePromiseRef.current;
    }

    const acquire = (async () => {
      const shell = document.querySelector<HTMLElement>('.app-shell');
      const shellWasInert = shell?.inert ?? false;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (shell) shell.inert = true;
      // Let blur/composition-end work caused by `inert` enter the queue before
      // closing the write gate.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      isPreparingToQuitRef.current = true;
      const unlock = () => {
        if (activeLocalWriteGuardRef.current !== unlock) return;
        activeLocalWriteGuardRef.current = null;
        isPreparingToQuitRef.current = false;
        if (shell && !shellWasInert) shell.inert = false;
      };
      activeLocalWriteGuardRef.current = unlock;
      localWriteGuardUnlockRef.current = unlock;
      return unlock;
    })();
    localWriteGuardAcquirePromiseRef.current = acquire;
    const clearAcquire = () => {
      if (localWriteGuardAcquirePromiseRef.current === acquire) {
        localWriteGuardAcquirePromiseRef.current = null;
      }
    };
    void acquire.then(clearAcquire, clearAcquire);
    return acquire;
  }, []);

  const flushRendererLocalWrites = useCallback(async () => {
    let hasPendingWrites = true;
    while (hasPendingWrites) {
      const pendingLocalWrites = [
        ...pendingCalendarLocalWritesRef.current,
        ...pendingInboxTombstoneWritesRef.current.values(),
      ];
      await Promise.all([
        flushPendingLocalGrowthWrites(),
        flushPendingLocalMemoWrites(),
        ...pendingLocalWrites,
      ]);
      hasPendingWrites =
        pendingCalendarLocalWritesRef.current.size > 0 ||
        pendingInboxTombstoneWritesRef.current.size > 0;
    }
  }, []);

  useEffect(() => {
    return window.electronAPI?.onFlushPendingLocalWrites?.(async (reason) => {
      const unlock = await acquireLocalWriteGuard();
      let timer = 0;
      try {
        // A confirmed restore intentionally replaces this renderer's current
        // workspace. It already attempted a normal drain before invoking main;
        // retained terminal failures must survive a failed restore, but must
        // not make a valid replacement impossible. Shutdown/window-close never
        // take this bypass.
        if (
          reason !== 'database-maintenance' ||
          !confirmedRestoreMaintenanceRef.current
        ) {
          await Promise.race([
            flushRendererLocalWrites(),
            new Promise<never>((_resolve, reject) => {
              timer = window.setTimeout(
                () => reject(new Error('Timed out flushing local writes.')),
                LOCAL_WRITE_FLUSH_TIMEOUT_MS,
              );
            }),
          ]);
        }
        // Keep the renderer read-only until main finishes the lifecycle. It
        // either closes/reloads the window or sends cancellation to release a
        // non-destructive backup/aborted operation.
      } catch (caught) {
        unlock();
        throw caught;
      } finally {
        window.clearTimeout(timer);
      }
    });
  }, [acquireLocalWriteGuard, flushRendererLocalWrites]);

  useEffect(() => {
    return window.electronAPI?.onLocalWriteFlushCancelled?.(() => {
      localWriteGuardUnlockRef.current();
    });
  }, []);

  const discardDeletedPendingInboxItem = useCallback(
    async (
      currentSession: Session,
      item: InboxSession,
      clientId: string,
      ownerId: string,
    ) => {
      // The client-id tombstone survives until the server UUID is confirmed
      // deleted. This also closes the renderer-exit gap after a pending delete.
      await pendingInboxTombstoneWritesRef.current.get(
        `${ownerId}:${clientId}`,
      );
      const deleted = await deleteInboxSessionByClientId(
        currentSession,
        clientId,
      );
      if (!deleted) return;
      if (item.id !== clientId) {
        await removeLocalInboxSession(item.id, ownerId);
      }
      await removeLocalInboxSession(clientId, ownerId);
      inboxServerIdsByClientIdRef.current.delete(clientId);
      deletedPendingInboxClientIdsRef.current.delete(clientId);
      pendingInboxDeleteIdsRef.current.delete(clientId);
      pendingInboxDeleteIdsRef.current.delete(item.id);
    },
    [],
  );

  const retryDeletedPendingInboxItems = useCallback(
    (currentSession: Session, items: InboxSession[], ownerId: string) => {
      for (const item of items) {
        const clientId = item.clientId;
        if (
          !clientId ||
          !deletedPendingInboxClientIdsRef.current.has(clientId)
        ) {
          continue;
        }
        inboxServerIdsByClientIdRef.current.set(clientId, item.id);
        void discardDeletedPendingInboxItem(
          currentSession,
          item,
          clientId,
          ownerId,
        ).catch(() => undefined);
      }
    },
    [discardDeletedPendingInboxItem],
  );

  const reconcileRemoteInboxLikes = useCallback(
    (items: InboxSession[], requestSequence: number) =>
      items.map((item) => {
        const minimumFreshSequence =
          inboxLikeRefreshFloorRef.current.get(item.id) ?? 0;
        const latestLocalLike = inboxLatestLikesRef.current.get(item.id);
        if (
          latestLocalLike !== undefined &&
          ((inboxLikePendingCountsRef.current.get(item.id) ?? 0) > 0 ||
            requestSequence < minimumFreshSequence)
        ) {
          return { ...item, liked: latestLocalLike };
        }
        inboxConfirmedLikesRef.current.set(item.id, item.liked);
        inboxLatestLikesRef.current.set(item.id, item.liked);
        if (requestSequence >= minimumFreshSequence) {
          inboxLikeRefreshFloorRef.current.delete(item.id);
        }
        return item;
      }),
    [],
  );

  useEffect(() => {
    activeMemoIdRef.current = activeMemoId;
  }, [activeMemoId]);

  useEffect(() => {
    activeMemoCreatedAtRef.current = activeMemoCreatedAt;
  }, [activeMemoCreatedAt]);

  useEffect(() => {
    memosRef.current = memos;
  }, [memos]);

  useEffect(() => {
    inboxItemsRef.current = inboxItems;
  }, [inboxItems]);

  useEffect(() => {
    ambientTargetRef.current = ambientTarget;
  }, [ambientTarget]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    applyEditorSettings(appSettings);
    void window.electronAPI?.setUiLanguage?.(appSettings.uiLanguage);
  }, [appSettings]);

  useEffect(() => {
    const unsubscribe = subscribeLocalMemoIndexProgress((progress) => {
      const ownerId = sessionRef.current?.user.id ?? null;
      if (progress.ownerId !== ownerId) return;

      if (isEmptyLocalIndexCompletion(progress)) {
        setLocalIndexProgress(null);
        return;
      }
      if (!shouldShowLocalIndexProgress(progress)) {
        setLocalIndexProgress(null);
        return;
      }
      // 완료도 자동으로 사라지지 않는다 — 570MB를 기다린 사용자에게는
      // 끝났다는 사실이 결과이고, 닫는 시점은 사용자가 정한다.
      setLocalIndexProgress(progress);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const localIndexOwnerId = session?.user.id ?? null;
  // 다운로드 완료 후 보류했던 색인을 이어서 돌릴 때 최신 소유자가 필요하다.
  const localIndexOwnerIdRef = useRef(localIndexOwnerId);
  localIndexOwnerIdRef.current = localIndexOwnerId;

  useEffect(() => {
    localIndexStartupOwnerRef.current = undefined;
    cancelLocalMemoIndexing();
    cancelLocalInboxIndexing();
    setLocalIndexProgress(null);
    return () => {
      cancelLocalMemoIndexing();
      cancelLocalInboxIndexing();
    };
  }, [localIndexOwnerId]);

  // 모델 다운로드 안내는 로그인 직후에 띄운다. 메모 수를 보지 않는다 —
  // 신규 사용자는 로그인 시점에 메모가 0개라, memos를 기다리면 안내가
  // "첫 글자를 입력하는 순간"으로 밀려난다. 아무도 고르지 않은 시점이다.
  useEffect(() => {
    if (isBooting) return;
    const owner = localIndexOwnerId ?? 'guest';
    if (embeddingGateOwnerRef.current === owner) return;
    embeddingGateOwnerRef.current = owner;
    void (async () => {
      const status = await window.electronAPI?.localEmbedStatus?.();
      // 이미 받는 중이면 안내할 것이 없다.
      if (status && !status.ready && status.state !== 'downloading') {
        setEmbeddingGateOpen(true);
      }
    })();
  }, [isBooting, localIndexOwnerId]);

  // 로그인 뒤의 첫 전체 색인. 색인은 색인할 메모가 생긴 뒤에만 의미가 있으므로
  // 안내와 달리 memos를 기다린다. 모델이 없으면 시작하지 않는다 — 시작하면
  // 색인기가 임베딩을 부르면서 안내를 건너뛰고 570MB를 조용히 받아 버린다.
  // 이 자동 정리는 사용자가 요청한 작업이 아니므로 진행 토스트를 띄우지 않는다.
  useEffect(() => {
    if (isBooting || memos.length === 0) return;
    const startupOwner = localIndexOwnerId ?? 'guest';
    if (localIndexStartupOwnerRef.current === startupOwner) return;
    localIndexStartupOwnerRef.current = startupOwner;
    void (async () => {
      const status = await window.electronAPI?.localEmbedStatus?.();
      if (!status?.ready) return;
      scheduleLocalMemoIndexReconcile(memos, localIndexOwnerId);
    })();
  }, [isBooting, localIndexOwnerId, memos]);

  useEffect(() => {
    if (isBooting) return;
    const ownerId = localIndexOwnerId;
    void window.electronAPI?.localEmbedStatus?.().then((status) => {
      if (!status?.ready || localIndexOwnerIdRef.current !== ownerId) return;
      scheduleLocalInboxIndexReconcile(inboxItems, ownerId);
    });
  }, [inboxItems, isBooting, localIndexOwnerId]);

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

  const checkForAvailableUpdate = useCallback(async () => {
    if (isMasDistribution) return null;
    const update = await window.electronAPI?.checkForUpdate?.();
    if (!update) return null;

    setUpdateState({ status: 'available', update });
    setUpdatePopoverOpen(false);
    return update;
  }, [isMasDistribution]);

  useEffect(() => {
    if (!isMasDistribution && appSettings.autoCheckUpdates) {
      void checkForAvailableUpdate().catch(() => undefined);
    }
  }, [appSettings.autoCheckUpdates, checkForAvailableUpdate, isMasDistribution]);

  useEffect(() => {
    const unsubscribeDownloaded = window.electronAPI?.onUpdateDownloaded?.(
      (info) => {
        setUpdateState((current) => {
          const update =
            current.status === 'idle'
              ? {
                  downloadUrl: info.updateUrl,
                  version:
                    info.releaseName.replace(/^Subnota\s*/i, '') ||
                    info.releaseName,
                }
              : current.update;
          return { status: 'installing', update };
        });
        setUpdatePopoverOpen(true);
        void window.electronAPI.installUpdate().catch(() => {
          setUpdateState((current) =>
            current.status === 'idle'
              ? current
              : {
                  message: t(
                    '업데이트를 적용하지 못했습니다. 다시 시도해주세요.',
                    'Could not apply the update. Please try again.',
                  ),
                  status: 'error',
                  update: current.update,
                },
          );
        });
      },
    );
    const unsubscribeError = window.electronAPI?.onUpdateError?.((info) => {
      setUpdateState((current) =>
        current.status === 'idle'
          ? current
          : { message: info.message, status: 'error', update: current.update },
      );
      setUpdatePopoverOpen(true);
    });
    const unsubscribeNotAvailable = window.electronAPI?.onUpdateNotAvailable?.(
      () => {
        setUpdateState({ status: 'idle' });
        setUpdatePopoverOpen(false);
      },
    );

    return () => {
      unsubscribeDownloaded?.();
      unsubscribeError?.();
      unsubscribeNotAvailable?.();
    };
  }, []);

  const startAvailableUpdate = useCallback(async () => {
    if (updateState.status !== 'available' && updateState.status !== 'error')
      return;

    const update = updateState.update;
    setUpdateState({ status: 'downloading', update });
    setUpdatePopoverOpen(true);

    try {
      const started = await window.electronAPI?.downloadUpdate?.();
      if (started) return;
      setUpdateState({
        message:
          isWindowsDistribution
            ? t(
                '이 설치본에서는 자동 업데이트를 시작할 수 없습니다. 최신 Windows 설치 파일을 다시 설치해주세요.',
                'Automatic updates are unavailable in this installation. Please install the latest Windows installer.',
              )
            : t(
                '이 설치본에서는 자동 업데이트를 시작할 수 없습니다. 최신 DMG를 다시 설치해주세요.',
                'Automatic updates are unavailable in this installation. Please install the latest DMG.',
              ),
        status: 'error',
        update,
      });
    } catch {
      setUpdateState({
        message:
          t(
            '업데이트 다운로드를 시작하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해주세요.',
            'Could not start the update download. Check your network and try again.',
          ),
        status: 'error',
        update,
      });
    }
  }, [isWindowsDistribution, updateState]);

  useEffect(
    () => () => {
      memoSyncTimersRef.current.forEach((timeout) =>
        window.clearTimeout(timeout),
      );
      memoSyncTimersRef.current.clear();
      memoSyncRetryTimersRef.current.forEach((timeout) =>
        window.clearTimeout(timeout),
      );
      memoSyncRetryTimersRef.current.clear();
      if (sidebarCollapseTimerRef.current !== null) {
        window.clearTimeout(sidebarCollapseTimerRef.current);
      }
    },
    [],
  );

  const cancelMemoCloudRetry = useCallback(
    (memoId: string, resetAttempts = true) => {
      const timeout = memoSyncRetryTimersRef.current.get(memoId);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
        memoSyncRetryTimersRef.current.delete(memoId);
      }
      if (resetAttempts) {
        memoSyncRetryAttemptsRef.current.delete(memoId);
      }
    },
    [],
  );

  const scheduleMemoCloudRetry = useCallback(
    (currentSession: Session, memo: MemoCloudSyncInput) => {
      if (!navigator.onLine || memoSyncRetryTimersRef.current.has(memo.id)) {
        return;
      }

      const attempt = (memoSyncRetryAttemptsRef.current.get(memo.id) ?? 0) + 1;
      memoSyncRetryAttemptsRef.current.set(memo.id, attempt);
      const timeout = window.setTimeout(() => {
        memoSyncRetryTimersRef.current.delete(memo.id);
        if (!navigator.onLine || !isCurrentSession(currentSession)) {
          return;
        }
        const latestMemo = memosRef.current.find((item) => item.id === memo.id);
        if (latestMemo?.local_sync_status !== 'failed') {
          return;
        }
        void memoSyncRetryRunnerRef.current?.(
          currentSession,
          memoCloudSyncInput(latestMemo),
        );
      }, memoSyncRetryDelay(attempt));

      memoSyncRetryTimersRef.current.set(memo.id, timeout);
    },
    [isCurrentSession],
  );

  const toggleSession = useCallback(() => {
    const nextCollapsed = !isSessionCollapsed;
    if (sidebarCollapseTimerRef.current !== null) {
      window.clearTimeout(sidebarCollapseTimerRef.current);
      sidebarCollapseTimerRef.current = null;
    }

    setFloatingNavDismissed(false);
    setSidebarCollapseReady(false);
    setSessionCollapsed(nextCollapsed);

    if (nextCollapsed) {
      sidebarCollapseTimerRef.current = window.setTimeout(() => {
        setSidebarCollapseReady(true);
        sidebarCollapseTimerRef.current = null;
      }, SIDEBAR_COLLAPSE_DURATION_MS);
    }
  }, [isSessionCollapsed]);

  const enqueueMemoCloudSync = useCallback(
    (currentSession: Session, memo: MemoCloudSyncInput, revision: number) => {
      const previousSync =
        memoSyncChainsRef.current.get(memo.id) ?? Promise.resolve();
      const sync = previousSync
        .catch(() => undefined)
        .then(async () => {
          if (!isCurrentSession(currentSession)) {
            return;
          }
          if (memoSyncRevisionsRef.current.get(memo.id) !== revision) {
            return;
          }
          const latestMemoAtPush = memosRef.current.find(
            (item) => item.id === memo.id,
          );
          const memoToPush = latestMemoAtPush
            ? memoCloudSyncInput(latestMemoAtPush)
            : memo;
          try {
            // Resolve the concurrency base at push time from the local DB: the
            // values captured when this sync was scheduled can already be stale
            // (an earlier push may have acked while the user kept typing).
            const localRow = await getLocalMemo(
              memoToPush.id,
              currentSession.user.id,
            );
            const result = await pushMemoMerging(currentSession, {
              ...memoToPush,
              baseContent:
                localRow?.synced_content ??
                (localRow?.local_sync_status === 'synced'
                  ? localRow.content
                  : null),
              baseHash:
                localRow?.synced_content_hash ?? memoToPush.baseHash ?? null,
            });
            if (!isCurrentSession(currentSession)) {
              return;
            }

            if (result.status === 'deleted') {
              if (memoSyncRevisionsRef.current.get(memo.id) !== revision) {
                return;
              }
              // Deleted on another device (delete-wins): drop it locally.
              cancelMemoCloudRetry(memo.id);
              await markLocalMemoDeleted(
                memo.id,
                'synced',
                currentSession.user.id,
              );
              if (memoSyncRevisionsRef.current.get(memo.id) !== revision) {
                return;
              }
              setMemos((previous) =>
                previous.filter((item) => item.id !== memo.id),
              );
              return;
            }

            // savedMemo is the server-acked canonical version: ours, the 3-way
            // merge, or the newest side of an unmergeable conflict. The losing
            // side is kept in hidden local recovery history, never as a new note.
            const savedMemo = result.memo;

            // The live Tiptap document is deliberately not replaced here: doing
            // that broke Korean IME composition and selection. Instead, rebase
            // any input made while the request was in flight onto the canonical
            // server result, then advance content and sync base as one SQLite
            // compare-and-apply operation.
            const pendingLocalWrite =
              pendingLocalMemoWritePromisesRef.current.get(memo.id);
            if (pendingLocalWrite) {
              try {
                await pendingLocalWrite;
              } catch {
                // Do not overwrite a local value whose durable write failed. A
                // later retry will push it against the still-old base safely.
                return;
              }
            }
            if (!isCurrentSession(currentSession)) return;

            const currentMemo = memosRef.current.find(
              (item) => item.id === memo.id,
            );
            if (!currentMemo || deletingMemoIdsRef.current.has(memo.id)) return;
            const hasNewerLocalEdit =
              memoSyncRevisionsRef.current.get(memo.id) !== revision ||
              currentMemo.content !== memoToPush.content;
            const rebased = hasNewerLocalEdit
              ? rebaseEditorChangeOntoCanonical(
                  memoToPush.content,
                  currentMemo.content,
                  savedMemo.content,
                )
              : { ok: true, text: savedMemo.content };
            if (!rebased.ok) {
              await preserveLocalMemoRecovery(
                {
                  content: savedMemo.content,
                  memoId: memo.id,
                  source: 'server',
                  sourceUpdatedAt:
                    savedMemo.content_updated_at ?? savedMemo.updated_at,
                },
                currentSession.user.id,
              );
              setError(
                t(
                  '동기화된 변경과 편집 중 입력을 자동 병합하지 못해 복구 기록을 보관했습니다.',
                  'We could not merge synced changes with your edits, so a recovery copy was kept.',
                ),
              );
              return;
            }

            const acknowledgedHash =
              savedMemo.synced_content_hash ?? savedMemo.content_hash;
            const canonicalMemo = createLocalMemoRow(
              {
                category: hasNewerLocalEdit
                  ? getMemoCategory(currentMemo.category)
                  : getMemoCategory(savedMemo.category),
                content: rebased.text,
                content_updated_at: hasNewerLocalEdit
                  ? (currentMemo.content_updated_at ?? currentMemo.updated_at)
                  : (savedMemo.content_updated_at ?? savedMemo.updated_at),
                created_at: currentMemo.created_at,
                id: savedMemo.id,
                synced_content: savedMemo.content,
                synced_content_hash: acknowledgedHash,
                updated_at: hasNewerLocalEdit
                  ? currentMemo.updated_at
                  : savedMemo.updated_at,
              },
              hasNewerLocalEdit ? 'pending' : 'synced',
            );
            const installCanonicalIfCurrent = (items: MemoRow[]) => {
              if (
                !items.some(
                  (item) =>
                    item.id === memo.id && item.content === currentMemo.content,
                )
              ) {
                return items;
              }
              return items.map((item) =>
                item.id === memo.id && item.content === currentMemo.content
                  ? canonicalMemo
                  : item,
              );
            };

            // Move the renderer's canonical snapshot synchronously before the
            // IPC await. A keystroke during that await is then rebased by
            // saveMemoContent without ever mutating the Tiptap document itself.
            memosRef.current = installCanonicalIfCurrent(memosRef.current);
            setMemos(installCanonicalIfCurrent);
            const applied = await applyLocalMemoSyncResult(
              canonicalMemo,
              currentMemo.content,
              currentSession.user.id,
            );
            if (!applied || !isCurrentSession(currentSession)) return;
            if (!hasNewerLocalEdit) {
              cancelMemoCloudRetry(memo.id);
            }

            if (activeMemoIdRef.current === memo.id) {
              setActiveMemoCreatedAt(savedMemo.created_at);
            }
          } catch (error) {
            if (
              isCurrentSession(currentSession) &&
              memoSyncRevisionsRef.current.get(memo.id) === revision
            ) {
              try {
                // Preserve the last-acked sync base — nulling it here would make
                // the retry push read as a cross-device conflict.
                const failedRow = await getLocalMemo(
                  memo.id,
                  currentSession.user.id,
                );
                await upsertLocalMemo(
                  {
                    category: memoToPush.category,
                    content: memoToPush.content,
                    content_updated_at: memoToPush.contentUpdatedAt,
                    created_at: memoToPush.createdAt,
                    id: memoToPush.id,
                    synced_content: failedRow?.synced_content ?? null,
                    synced_content_hash: failedRow?.synced_content_hash ?? null,
                  },
                  'failed',
                  currentSession.user.id,
                );
                setMemos((previous) =>
                  previous.map((item) =>
                    item.id === memo.id
                      ? { ...item, local_sync_status: 'failed' }
                      : item,
                  ),
                );
                console.warn('Memo cloud sync failed; retry scheduled.', error);
                scheduleMemoCloudRetry(currentSession, memoToPush);
              } catch {
                // Keep the original local write; it remains retryable as pending.
              }
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
    },
    [cancelMemoCloudRetry, isCurrentSession, scheduleMemoCloudRetry],
  );

  const scheduleMemoCloudSync = useCallback(
    (currentSession: Session, memo: MemoCloudSyncInput) => {
      cancelMemoCloudRetry(memo.id);
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
    },
    [cancelMemoCloudRetry, enqueueMemoCloudSync],
  );

  const runMemoCloudRetry = useCallback(
    async (currentSession: Session, memo: MemoCloudSyncInput) => {
      const revision = (memoSyncRevisionsRef.current.get(memo.id) ?? 0) + 1;
      memoSyncRevisionsRef.current.set(memo.id, revision);
      await enqueueMemoCloudSync(currentSession, memo, revision);
    },
    [enqueueMemoCloudSync],
  );

  useEffect(() => {
    memoSyncRetryRunnerRef.current = runMemoCloudRetry;
    return () => {
      memoSyncRetryRunnerRef.current = null;
    };
  }, [runMemoCloudRetry]);

  const syncMemoToCloudNow = useCallback(
    async (currentSession: Session, memo: MemoCloudSyncInput) => {
      const timeout = memoSyncTimersRef.current.get(memo.id);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
        memoSyncTimersRef.current.delete(memo.id);
      }
      cancelMemoCloudRetry(memo.id);
      await runMemoCloudRetry(currentSession, memo);
    },
    [cancelMemoCloudRetry, runMemoCloudRetry],
  );

  const retryFailedMemoCloudSync = useCallback(
    async (memoId: string) => {
      const currentSession = sessionRef.current;
      const memo = memosRef.current.find((item) => item.id === memoId);
      if (!currentSession || memo?.local_sync_status !== 'failed') {
        return;
      }

      setManualMemoSyncRetryIds((previous) => [
        ...new Set([...previous, memoId]),
      ]);
      try {
        await syncMemoToCloudNow(currentSession, memoCloudSyncInput(memo));
      } finally {
        setManualMemoSyncRetryIds((previous) =>
          previous.filter((id) => id !== memoId),
        );
      }
    },
    [syncMemoToCloudNow],
  );

  const cancelMemoCloudSync = useCallback(
    async (memoId: string) => {
      const timeout = memoSyncTimersRef.current.get(memoId);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
        memoSyncTimersRef.current.delete(memoId);
      }
      cancelMemoCloudRetry(memoId);
      memoSyncRevisionsRef.current.set(
        memoId,
        (memoSyncRevisionsRef.current.get(memoId) ?? 0) + 1,
      );
      await memoSyncChainsRef.current.get(memoId)?.catch(() => undefined);
    },
    [cancelMemoCloudRetry],
  );

  const persistWorkspace = useCallback(() => {
    saveWorkspaceSession(
      {
        activeMemoId,
        activeTab,
        focusedPaneId,
        isSessionCollapsed,
        isSplitWorkspaceEnabled,
        paneWidths,
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
    paneWidths,
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
    void window.electronAPI?.setGlobalShortcuts?.(shortcuts).then((result) => {
      if (!result) {
        return;
      }
      const accepted = saveShortcutSettings(result.settings);
      setShortcuts(accepted);
    });
  }, []);

  useEffect(() => {
    return window.electronAPI?.onShortcutSettingsChanged?.((nextSettings) => {
      setShortcuts(saveShortcutSettings(nextSettings));
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (matchesKeyboardShortcut(event, shortcuts.openSearch)) {
        event.preventDefault();
        setGlobalSearchOpen(true);
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
    () => memos.find((memo) => memo.id === activeMemoId) ?? null,
    [activeMemoId, memos],
  );
  // 포커스된 탭이 있으면 그 탭이 곧 정답이다. 새 초안(memoId 없음)이나
  // 캘린더·Topics 탭이면 "선택된 메모 없음"이 맞고, 여기서 activeMemoId로
  // 폴백하면 사이드바가 직전 메모를 계속 선택된 것처럼 표시한다.
  const focusedSplitMemoId = useMemo(() => {
    const focusedPane =
      splitPanes.find((pane) => pane.id === focusedPaneId) ?? splitPanes[0];
    const focusedEditor =
      focusedPane?.editors?.find(
        (editor) => editor.id === focusedPane.activeEditorId,
      ) ??
      focusedPane?.editors?.[0] ??
      focusedPane;

    if (!focusedEditor) {
      return undefined;
    }

    return focusedEditor.view === 'memo'
      ? (focusedEditor.memoId ?? null)
      : null;
  }, [focusedPaneId, splitPanes]);
  // undefined = 참고할 탭 자체가 없음(split 미사용) → 기존 activeMemoId 사용.
  const sidebarActiveMemoId = focusedSplitMemoId ?? activeMemoId;
  const hydrateActiveMemo = useCallback((nextMemos: MemoRow[]) => {
    if (hasHydratedActiveMemoRef.current) {
      return;
    }

    const selectedMemo =
      nextMemos.find((memo) => memo.id === activeMemoIdRef.current) ??
      nextMemos[0];
    if (!selectedMemo) {
      return;
    }

    hasHydratedActiveMemoRef.current = true;
    setActiveMemoId(selectedMemo.id);
    setActiveMemoCreatedAt(selectedMemo.created_at);
    setActiveDraftCategory(getMemoCategory(selectedMemo.category));
  }, []);

  const applyLocalWorkspace = useCallback(
    async (ownerId?: string) => {
      const effectiveOwnerId = ownerId ?? getLocalWorkspaceOwner() ?? undefined;
      const expectedWorkspaceLoadId = workspaceLoadIdRef.current;
      const [
        localMemos,
        localBlocks,
        localInbox,
        localActivities,
        localSchedule,
        localScheduleActions,
        localTopicMap,
      ] = await Promise.all([
        loadVisibleLocalMemos(effectiveOwnerId),
        loadVisibleLocalCalendarBlocks(effectiveOwnerId),
        // 캐시 + 대기 큐 — 네트워크 없이도 웹 인박스가 즉시 보인다.
        loadLocalInboxItems(effectiveOwnerId),
        loadLocalActivityCompletions(effectiveOwnerId),
        // 일정 저장함 / Topics 지도도 마지막 서버 결과를 즉시 보여준다.
        loadLocalScheduleInbox(effectiveOwnerId),
        loadLocalScheduleInboxActions(effectiveOwnerId),
        loadLocalTopicMap(effectiveOwnerId),
      ]);

      if (
        expectedWorkspaceLoadId !== workspaceLoadIdRef.current ||
        getLocalWorkspaceOwner() !== (effectiveOwnerId ?? null)
      ) {
        return;
      }

      for (const item of localInbox) {
        if (item.local_sync_status === 'pending_delete') {
          pendingInboxDeleteIdsRef.current.add(item.id);
          if (item.clientId) {
            deletedPendingInboxClientIdsRef.current.add(item.clientId);
          }
        }
      }

      const pendingLocalWriteIds = pendingMemoIdsForOwner(
        pendingLocalMemoWriteOwnersRef.current,
        effectiveOwnerId,
      );
      const activeEditorMemoIds = activeMemoIdsInPanes(splitPanesRef.current);
      const visibleMemos = mergeLoadedMemosPreservingLocalWrites(
        localMemos,
        memosRef.current,
        pendingLocalWriteIds,
        activeEditorMemoIds,
      );
      setMemos(visibleMemos);
      setCalendarBlocks(localBlocks);
      setCalendarCategories(loadCalendarCategories(effectiveOwnerId ?? null));
      setInboxItems(
        mergeInboxItems(
          [],
          withoutDeletedPendingInboxItems(
            localInbox,
            deletedPendingInboxClientIdsRef.current,
            pendingInboxDeleteIdsRef.current,
          ),
        ),
      );
      setActivityCompletions(localActivities);
      const handledScheduleIds = new Set(
        localScheduleActions.map((action) => action.id),
      );
      setScheduleInbox(
        localSchedule.filter((item) => !handledScheduleIds.has(item.id)),
      );
      setTopicClusters(localTopicMap?.clusters ?? []);
      setTopicUpdatedAt(localTopicMap?.updatedAt ?? null);
      setTopicGlobalEdges(localTopicMap?.globalEdges ?? []);
      setTopicInboxEdges(localTopicMap?.inboxEdges ?? []);
      setTopicMemberships(localTopicMap?.memberships ?? []);
      setTopicInboxMemberships(localTopicMap?.inboxMemberships ?? []);

      hydrateActiveMemo(visibleMemos);
      setLocalWorkspaceReady(true);
    },
    [hydrateActiveMemo],
  );

  const syncPendingLocalWorkspace = useCallback(
    async (currentSession: Session) => {
      const ownerId = currentSession.user.id;

      await flushPendingLocalGrowthWrites().catch(() => undefined);

      for (const completion of await loadLocalActivityCompletions(ownerId)) {
        if (
          !completion.local_sync_status ||
          completion.local_sync_status === 'synced'
        ) {
          continue;
        }
        try {
          await recordActivityCompletion(currentSession, completion);
          await upsertLocalActivityCompletion(completion, 'synced', ownerId);
        } catch {
          // Keep the append-only completion pending for the next reconnect.
        }
      }
      for (const completion of await loadLocalDailyCompletions(ownerId)) {
        if (
          !completion.local_sync_status ||
          completion.local_sync_status === 'synced'
        ) {
          continue;
        }
        try {
          await recordDailyCompletion(currentSession, completion);
          await upsertLocalDailyCompletion(completion, 'synced', ownerId);
        } catch {
          // Keep the append-only completion pending for the next reconnect.
        }
      }

      for (const memo of await loadLocalMemos(ownerId)) {
        try {
          if (memo.local_sync_status === 'pending_delete') {
            await cancelMemoCloudSync(memo.id);
            await archiveMemo(currentSession, memo.id);
            await markLocalMemoDeleted(memo.id, 'synced', ownerId);
            continue;
          }

          // A scheduled debounce sync means this memo is being edited right now and
          // our DB snapshot may already be stale. Pushing it would cancel the fresher
          // pending sync and write the stale server echo back over the local row
          // (typed text silently reverts on restart). Let the debounce push instead.
          if (
            shouldDeferMemoSync(
              memo.id,
              pendingMemoIdsForOwner(
                pendingLocalMemoWriteOwnersRef.current,
                ownerId,
              ),
              memoSyncTimersRef.current,
            )
          ) {
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
        } catch (error) {
          // One unreachable row must not starve calendar, inbox, or the remote
          // refresh. Its pending/failed local record remains retryable.
          console.warn('Pending memo sync failed; keeping it for retry.', error);
        }
      }

      const pendingCalendarBlocks = (
        await loadLocalCalendarBlocks(ownerId)
      ).filter(
        (block) =>
          block.local_sync_status && block.local_sync_status !== 'synced',
      );
      // Register every startup mutation synchronously. If another block takes a
      // long time to sync, a later user edit must still enqueue after (and win
      // over) this startup work for its own id.
      await Promise.all(
        pendingCalendarBlocks.map((block) =>
          calendarMutationQueueRef.current.enqueue(
            block.id,
            async ({ isLatest }) => {
              if (!isLatest()) return;
              if (block.local_sync_status === 'pending_delete') {
                await deleteCalendarBlock(currentSession, block.id);
                if (!isLatest()) return;
                await removeLocalCalendarBlock(block.id, ownerId);
                return;
              }

              if (
                block.local_sync_status &&
                block.local_sync_status !== 'synced'
              ) {
                const savedBlock = await upsertCalendarBlock(currentSession, {
                  allDay: Boolean(block.all_day),
                  categoryId: block.category_id ?? null,
                  color: block.color ?? DEFAULT_CALENDAR_COLOR,
                  completedAt: block.completed_at ?? null,
                  endDate: block.end_date,
                  id: block.id,
                  isCompleted: Boolean(block.is_completed),
                  note: block.note,
                  order: block.order ?? 0,
                  startDate: block.start_date,
                  title: block.title,
                });
                if (!isLatest()) return;
                await upsertLocalCalendarBlock(savedBlock, 'synced', ownerId);
              }
            },
          ).catch((error) => {
            // Keep this row pending while allowing unrelated records and the
            // rest of the workspace to finish syncing.
            console.warn(
              'Pending calendar sync failed; keeping it for retry.',
              error,
            );
          }),
        ),
      );

      // Schedule inbox actions are local-first: the candidate is removed from
      // the UI immediately, then this outbox retries the server status update
      // on the next sync if the first attempt was offline or failed.
      for (const action of await loadLocalScheduleInboxActions(ownerId)) {
        try {
          await updateScheduleInboxStatus(
            currentSession,
            action.id,
            action.status,
          );
          await removeLocalScheduleInboxAction(action.id, ownerId);
        } catch {
          // Keep the action queued for the next reconnect or app start.
        }
      }

      // client_id lets a tombstone delete a server row without depending on the
      // limited Inbox list. If a slow POST has not committed yet, keep the
      // tombstone and retry instead of treating an empty delete as completion.
      for (const tombstone of (await loadLocalInboxItems(ownerId)).filter(
        (item) => item.local_sync_status === 'pending_delete',
      )) {
        try {
          const deleted = tombstone.clientId
            ? await deleteInboxSessionByClientId(
                currentSession,
                tombstone.clientId,
              )
            : (await deleteInboxSession(currentSession, tombstone.id), true);
          if (!deleted) continue;
          await removeLocalInboxSession(tombstone.id, ownerId);
          pendingInboxDeleteIdsRef.current.delete(tombstone.id);
          if (tombstone.clientId) {
            if (tombstone.id !== tombstone.clientId) {
              await removeLocalInboxSession(tombstone.clientId, ownerId);
            }
            deletedPendingInboxClientIdsRef.current.delete(tombstone.clientId);
          }
        } catch {
          // Keep the tombstone hidden and retry on reconnect/app start.
        }
      }

      for (const item of await loadLocalInboxQueue(ownerId)) {
        if (deletedPendingInboxClientIdsRef.current.has(item.clientId)) {
          continue;
        }
        if (!item.originalUrl) {
          continue;
        }

        try {
          const created = await createInboxSession(currentSession, {
            clientId: item.clientId,
            selectedText: item.selectedText,
            url: item.originalUrl,
            userNote: item.userNote,
          });
          inboxServerIdsByClientIdRef.current.set(item.clientId, created.id);
          const pendingItemWasDeleted = async () =>
            deletedPendingInboxClientIdsRef.current.has(item.clientId) ||
            (await isLocalInboxSessionDeleted(item.clientId, ownerId));
          if (await pendingItemWasDeleted()) {
            deletedPendingInboxClientIdsRef.current.add(item.clientId);
            pendingInboxDeleteIdsRef.current.add(item.clientId);
            await discardDeletedPendingInboxItem(
              currentSession,
              created,
              item.clientId,
              ownerId,
            );
            continue;
          }
          // 캐시에 먼저 쓰고 큐에서 뺀다 — 다음 fetch 전에 재시작해도 보인다.
          await cacheLocalInboxItem(created, ownerId);
          if (await pendingItemWasDeleted()) {
            deletedPendingInboxClientIdsRef.current.add(item.clientId);
            pendingInboxDeleteIdsRef.current.add(item.clientId);
            await discardDeletedPendingInboxItem(
              currentSession,
              created,
              item.clientId,
              ownerId,
            );
            continue;
          }
          const removedPendingItem = await removeLocalInboxSessionIfNotDeleted(
            item.clientId,
            ownerId,
          );
          if (!removedPendingItem || (await pendingItemWasDeleted())) {
            deletedPendingInboxClientIdsRef.current.add(item.clientId);
            pendingInboxDeleteIdsRef.current.add(item.clientId);
            await discardDeletedPendingInboxItem(
              currentSession,
              created,
              item.clientId,
              ownerId,
            );
          }
        } catch {
          // Keep the item queued. Reconnect or a later app start retries it.
        }
      }
    },
    [cancelMemoCloudSync, discardDeletedPendingInboxItem, syncMemoToCloudNow],
  );

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

        const inboxRequestSequence = ++inboxRefreshSequenceRef.current;
        const [nextMemos, nextBlocks, nextInbox, nextLinkInbox] =
          await Promise.all([
            fetchMemos(currentSession),
            fetchCalendarBlocks(currentSession),
            fetchScheduleInbox(currentSession),
            // 실패는 null — 빈 목록으로 로컬 캐시 표시를 덮어쓰지 않는다
            // (부팅 직후 토큰 하이드레이션/백엔드 콜드스타트로 잘 실패한다).
            fetchInboxSessions(currentSession).catch(() => null),
          ]);
        // 실패는 null — 빈 지도로 로컬 캐시 표시를 덮어쓰지 않는다.
        const nextTopicMap = await fetchTopicMap(currentSession).catch(
          () => null,
        );

        if (!isCurrentLoad()) {
          return;
        }

        const { conflictCopies, visibleMemos: visibleRemoteMemos } =
          partitionRemoteMemoConflictCopies(nextMemos);
        await Promise.all(
          conflictCopies.map((memo) => {
            const originalMemoId = memo.conflict_of;
            if (!originalMemoId) return Promise.resolve();
            return preserveLocalMemoRecovery(
              {
                content: memo.content,
                memoId: originalMemoId,
                source: 'local',
                sourceUpdatedAt: memo.content_updated_at ?? memo.updated_at,
              },
              ownerId,
            );
          }),
        );
        // Snapshot protection at response time, not request time: a pane may
        // have opened or received input while the network request was pending.
        // Skipping the same ids in SQLite and React keeps the acknowledged
        // sync base intact, so the next edit conflicts/merges with the remote
        // value instead of overwriting it as if that value had been seen.
        const pendingLocalWriteIds = pendingMemoIdsForOwner(
          pendingLocalMemoWriteOwnersRef.current,
          ownerId,
        );
        const activeEditorMemoIds = activeMemoIdsInPanes(splitPanesRef.current);
        const protectedMemoIds = new Set([
          ...pendingLocalWriteIds,
          ...activeEditorMemoIds,
        ]);
        const [mergedMemos, mergedBlocks] = await Promise.all([
          replaceSyncedMemos(visibleRemoteMemos, ownerId, protectedMemoIds),
          replaceSyncedCalendarBlocks(nextBlocks, ownerId),
        ]);
        const scheduleActions = await loadLocalScheduleInboxActions(ownerId);
        const handledScheduleIds = new Set(
          scheduleActions.map((action) => action.id),
        );
        const visibleScheduleInbox = mergePendingScheduleInbox(
          nextInbox,
          await loadLocalScheduleInbox(ownerId),
          handledScheduleIds,
        );
        let mergedMemosForView = mergedMemos;
        const restoredLateSnapshotIds = new Set<string>();
        let latestPendingLocalWriteIds = pendingLocalWriteIds;
        let latestActiveEditorMemoIds = activeEditorMemoIds;
        let shouldCheckLateSnapshots = true;
        while (shouldCheckLateSnapshots) {
          latestPendingLocalWriteIds = pendingMemoIdsForOwner(
            pendingLocalMemoWriteOwnersRef.current,
            ownerId,
          );
          latestActiveEditorMemoIds = activeMemoIdsInPanes(
            splitPanesRef.current,
          );
          const latestProtectedMemoIds = new Set([
            ...latestPendingLocalWriteIds,
            ...latestActiveEditorMemoIds,
          ]);
          const lateSnapshots = memosRef.current.filter((memo) => {
            if (
              protectedMemoIds.has(memo.id) ||
              !latestProtectedMemoIds.has(memo.id) ||
              restoredLateSnapshotIds.has(memo.id)
            ) {
              return false;
            }
            return true;
          });
          if (lateSnapshots.length === 0) {
            shouldCheckLateSnapshots = false;
            continue;
          }

          for (const memo of lateSnapshots) {
            restoredLateSnapshotIds.add(memo.id);
          }
          await Promise.all(
            lateSnapshots.map((memo) =>
              restoreLocalMemoSnapshotAfterPull(memo, ownerId),
            ),
          );
          const lateById = new Map(
            lateSnapshots.map((memo) => [memo.id, memo]),
          );
          const existingIds = new Set(
            mergedMemosForView.map((memo) => memo.id),
          );
          mergedMemosForView = [
            ...mergedMemosForView.map((memo) => lateById.get(memo.id) ?? memo),
            ...lateSnapshots.filter((memo) => !existingIds.has(memo.id)),
          ];
        }
        if (!isCurrentLoad()) return;

        setMemos(
          mergeLoadedMemosPreservingLocalWrites(
            mergedMemosForView,
            memosRef.current,
            latestPendingLocalWriteIds,
            latestActiveEditorMemoIds,
          ),
        );
        setCalendarBlocks(mergedBlocks);
        setScheduleInbox(visibleScheduleInbox);
        await replaceLocalScheduleInbox(visibleScheduleInbox, ownerId);
        if (!isCurrentLoad()) return;
        if (nextLinkInbox) {
          const latestLocalInbox = await loadLocalInboxItems(ownerId);
          if (!isCurrentLoad()) return;
          const localDeletes = collectPendingInboxDeletes(latestLocalInbox);
          localDeletes.ids.forEach((id) =>
            pendingInboxDeleteIdsRef.current.add(id),
          );
          localDeletes.clientIds.forEach((clientId) =>
            deletedPendingInboxClientIdsRef.current.add(clientId),
          );
          const currentLinkInbox = reconcileRemoteInboxLikes(
            nextLinkInbox,
            inboxRequestSequence,
          );
          retryDeletedPendingInboxItems(
            currentSession,
            currentLinkInbox,
            ownerId,
          );
          const visibleLinkInbox = withoutDeletedPendingInboxItems(
            currentLinkInbox,
            deletedPendingInboxClientIdsRef.current,
            pendingInboxDeleteIdsRef.current,
          );
          const visibleLocalInbox = withoutDeletedPendingInboxItems(
            latestLocalInbox,
            deletedPendingInboxClientIdsRef.current,
            pendingInboxDeleteIdsRef.current,
          );
          await replaceLocalInboxCache(visibleLinkInbox, ownerId);
          if (!isCurrentLoad()) return;
          setInboxItems(mergeInboxItems(visibleLinkInbox, visibleLocalInbox));
        }
        if (nextTopicMap) {
          await saveLocalTopicMap(nextTopicMap, ownerId);
          if (!isCurrentLoad()) return;
          setTopicClusters(nextTopicMap.clusters);
          setTopicUpdatedAt(nextTopicMap.updatedAt ?? null);
          setTopicGlobalEdges(nextTopicMap.globalEdges);
          setTopicInboxEdges(nextTopicMap.inboxEdges);
          setTopicMemberships(nextTopicMap.memberships);
          setTopicInboxMemberships(nextTopicMap.inboxMemberships);
        }
        // 실패(null) 시: applyLocalWorkspace가 깔아둔 캐시를 그대로 둔다.

        hydrateActiveMemo(mergedMemosForView);
        const syncedAt = new Date().toISOString();
        setLastSyncAt(syncedAt);
        window.localStorage?.setItem(LAST_SYNC_STORAGE_KEY, syncedAt);
      } catch (caught) {
        if (!isCurrentLoad()) {
          return;
        }
        // 로컬 데이터는 이미 화면에 있고 다음 동기화가 알아서 따라잡는다.
        // 사용자가 할 수 있는 일이 없어 조용히 넘긴다.
        setError(
          caught instanceof Error
            ? caught.message
            : t('데이터를 불러오지 못했습니다.', 'Could not load your data.'),
        );
        await applyLocalWorkspace(ownerId);
      } finally {
        if (loadId === workspaceLoadIdRef.current) {
          setRefreshing(false);
        }
      }
    },
    [
      applyLocalWorkspace,
      hydrateActiveMemo,
      retryDeletedPendingInboxItems,
      reconcileRemoteInboxLikes,
      syncPendingLocalWorkspace,
    ],
  );

  const restoreWorkspaceForAccount = useCallback((ownerId: string | null) => {
    const restored = loadWorkspaceSession(ownerId);
    setPinnedMemoIds(loadPinnedMemoIds(ownerId));
    setCalendarCategories(loadCalendarCategories(ownerId));
    setSeenReportMonth(loadSeenReportMonth(ownerId));
    hasHydratedActiveMemoRef.current = false;
    activeMemoIdRef.current = restored?.activeMemoId ?? null;
    setActiveMemoId(restored?.activeMemoId ?? null);
    setActiveTab(restored?.activeTab ?? 'memo');
    setActiveMemoCreatedAt(new Date().toISOString());
    setActiveDraftCategory(DEFAULT_MEMO_CATEGORY);
    setSplitPanes(restored?.splitPanes ?? []);
    setFocusedPaneId(restored?.focusedPaneId ?? null);
    setPaneWidths(restored?.paneWidths ?? {});
    if (sidebarCollapseTimerRef.current !== null) {
      window.clearTimeout(sidebarCollapseTimerRef.current);
      sidebarCollapseTimerRef.current = null;
    }
    const restoredSessionCollapsed = restored?.isSessionCollapsed ?? false;
    setSessionCollapsed(restoredSessionCollapsed);
    setSidebarCollapseReady(restoredSessionCollapsed);
    setFloatingNavDismissed(false);
    setIsSplitWorkspaceEnabled(restored?.isSplitWorkspaceEnabled ?? true);
  }, []);

  const activateSession = useCallback(
    async (
      nextSession: Session,
      options: {
        migrateLegacy?: boolean;
        resetWorkspace?: boolean;
      } = {},
    ) => {
      const activationId = ++sessionActivationIdRef.current;
      const ownerId = nextSession.user.id;
      const previousOwnerId =
        sessionRef.current?.user.id ?? getLocalWorkspaceOwner();
      const ownerChanged = previousOwnerId !== ownerId;

      workspaceLoadIdRef.current += 1;
      if (ownerChanged) {
        setWorkspaceOwnerTransition(true);
        setInboxLoading(false);
        setMemoSaveStates({});
        deletedPendingInboxClientIdsRef.current.clear();
        pendingInboxDeleteIdsRef.current.clear();
        inboxServerIdsByClientIdRef.current.clear();
        inboxLikeRevisionsRef.current.clear();
        inboxLikePendingCountsRef.current.clear();
        inboxConfirmedLikesRef.current.clear();
        inboxLatestLikesRef.current.clear();
        inboxLikeRefreshFloorRef.current.clear();
      }
      setLocalWorkspaceOwner(ownerId);
      await window.electronAPI
        ?.setActiveWorkspaceOwner?.(ownerId)
        .catch(() => undefined);
      if (options.resetWorkspace || options.migrateLegacy) {
        restoreWorkspaceForAccount(ownerId);
      }
      sessionRef.current = nextSession;
      setSession(nextSession);
      setError(null);
      setAuthNotice(null);
      try {
        await applyLocalWorkspace(ownerId);
      } catch (caught) {
        if (sessionActivationIdRef.current !== activationId) return;
        if (ownerChanged) {
          // Fail closed on an owner boundary. Showing an empty B workspace is
          // preferable to uncovering any still-mounted A records.
          memosRef.current = [];
          setMemos([]);
          setCalendarBlocks([]);
          setInboxItems([]);
          setActivityCompletions([]);
          setScheduleInbox([]);
          setTopicClusters([]);
          setTopicUpdatedAt(null);
          setTopicGlobalEdges([]);
          setTopicInboxEdges([]);
          setTopicMemberships([]);
          setTopicInboxMemberships([]);
          setLocalWorkspaceReady(true);
        }
        setError(
          caught instanceof Error
            ? caught.message
            : t('로컬 작업 공간을 불러오지 못했습니다.', 'Could not load the local workspace.'),
        );
        setWorkspaceOwnerTransition(false);
        return;
      }
      if (sessionActivationIdRef.current === activationId) {
        setWorkspaceOwnerTransition(false);
      }

      // 첫 서버 동기화는 여기서 기다리지만 화면을 가리지는 않는다. 부팅
      // 게이트는 로컬 준비만 보고 이미 닫혔다(Phase C).
      await waitForBootSync(loadWorkspace(nextSession, { quiet: true }));
    },
    [applyLocalWorkspace, loadWorkspace, restoreWorkspaceForAccount],
  );

  const deactivateSession = useCallback(() => {
    sessionActivationIdRef.current += 1;
    workspaceLoadIdRef.current += 1;
    sessionRef.current = null;
    setSession(null);
    setWorkspaceOwnerTransition(false);
    memoSyncRetryTimersRef.current.forEach((timeout) =>
      window.clearTimeout(timeout),
    );
    memoSyncRetryTimersRef.current.clear();
    memoSyncRetryAttemptsRef.current.clear();
    setManualMemoSyncRetryIds([]);
    setLocalWorkspaceOwner(null);
    void window.electronAPI
      ?.setActiveWorkspaceOwner?.(null)
      .catch(() => undefined);
    restoreWorkspaceForAccount(null);
    void applyLocalWorkspace();
    setRefreshing(false);
    setInboxLoading(false);
  }, [applyLocalWorkspace, restoreWorkspaceForAccount]);

  // Phase A(브랜드 목업) → Phase B(앱 셸 스켈레톤), 그리고 어떤 경우에도
  // 전체 화면 로딩을 끝내는 상한. 상한은 안전망일 뿐 정상 경로가 아니다.
  useEffect(() => {
    if (!isBooting) return undefined;
    const startedAt = Date.now();
    setBootElapsedMs(0);
    const toShell = window.setTimeout(
      () => setBootElapsedMs(Date.now() - startedAt),
      BOOT_BRAND_PHASE_MS,
    );
    const cap = window.setTimeout(
      () => setBooting(false),
      BOOT_FULLSCREEN_MAX_MS,
    );
    return () => {
      window.clearTimeout(toShell);
      window.clearTimeout(cap);
    };
  }, [isBooting]);

  // Phase C — 로컬 작업 공간이 준비되면 서버 동기화 완료를 기다리지 않고
  // 실제 화면으로 넘어간다. 다만 브랜드 모션이 이미 보이기 시작했다면
  // 끝까지 재생한다 — 중간에 잘린 모션은 고장으로 보인다.
  // isBooting도 의존성이다. 로그인 직후 게이트를 다시 열 때 로컬은 이미
  // 준비돼 있어서, isLocalWorkspaceReady만 보면 이 효과가 다시 돌지 않아
  // 4초 상한이 닫을 때까지 브랜드 화면이 남는다.
  useEffect(() => {
    if (!isBooting || !isLocalWorkspaceReady) return undefined;
    const delay = resolveBootCloseDelayMs(
      Date.now() - bootStartedAtRef.current,
      { isAssemble: bootMarkVariantRef.current === 'assemble' },
    );
    if (delay === 0) {
      setBooting(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setBooting(false), delay);
    return () => window.clearTimeout(timer);
  }, [isBooting, isLocalWorkspaceReady]);

  useEffect(() => {
    let mounted = true;
    let passwordRecoveryActive = false;

    void applyLocalWorkspace();

    if (!isSupabaseConfigured()) {
      setError(
        t(
          '최초 로그인에는 온라인 연결과 Supabase 설정이 필요합니다.',
          'Your first sign-in requires an internet connection and Supabase setup.',
        ),
      );
      setBooting(false);
      return () => {
        mounted = false;
      };
    }

    getInitialSession()
      .then(async (nextSession) => {
        if (!mounted) {
          return;
        }
        if (nextSession) {
          // 로딩 화면은 로컬 작업 공간이 붙는 즉시 닫힌다. 첫 서버 동기화는
          // 콜드 스타트/네트워크 지연으로 오래 걸릴 수 있어 화면을 걸어 두지
          // 않고 뒤에서 이어 돌린다(local-first).
          await activateSession(nextSession, { migrateLegacy: true });
        } else {
          deactivateSession();
        }
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : t('세션 확인에 실패했습니다.', 'Could not verify your session.'),
        );
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
        isSameUser:
          Boolean(currentSession && nextSession) &&
          currentSession?.user.id === nextSession?.user.id,
        recoveryActive: passwordRecoveryActive,
      });
      passwordRecoveryActive = decision.recoveryActive;

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
        void activateSession(nextSession, { resetWorkspace: true });
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

  // idle 후에는 pending query만 준비한다. 자동 추천은 12자 이상인 문맥에서만
  // 허용하고, 짧은 구절은 사용자가 드래그해 명시적으로 검색할 때만 실행한다.
  const updateAmbientTarget = (
    editorId: string,
    memoId: string | null,
    queryText: string,
  ) => {
    const trimmedQueryText = queryText.trim();
    if (trimmedQueryText.length < AMBIENT_MIN_CHARS) {
      setAmbientTarget((previous) =>
        previous && previous.editorId === editorId ? null : previous,
      );
      return;
    }
    setAmbientTarget((previous) =>
      previous &&
      previous.editorId === editorId &&
      previous.memoId === memoId &&
      previous.queryText === trimmedQueryText
        ? previous
        : { editorId, memoId, queryText: trimmedQueryText },
    );
  };

  const showAmbientEmptyNotice = (editorId: string) => {
    if (ambientEmptyNoticeTimerRef.current) {
      clearTimeout(ambientEmptyNoticeTimerRef.current);
    }
    setAmbientEmptyEditorId(editorId);
    ambientEmptyNoticeTimerRef.current = setTimeout(() => {
      setAmbientEmptyEditorId(null);
    }, AMBIENT_EMPTY_NOTICE_MS);
  };

  const isCurrentAmbientTarget = (target: AmbientSearchTarget) => {
    const current = ambientTargetRef.current;
    return Boolean(
      current &&
      current.editorId === target.editorId &&
      current.memoId === target.memoId &&
      current.queryText === target.queryText,
    );
  };

  const dismissAmbient = (editorId: string) => {
    const target = ambientTargetRef.current;
    const belongsToEditor =
      target?.editorId === editorId ||
      ambientDisplayEditorId === editorId ||
      ambientEmptyEditorId === editorId;
    if (!belongsToEditor) return;

    // 검색이 끝난 뒤 돌아오는 오래된 응답도 화면에 되살아나지 않게 한다.
    ambientRunnerRef.current.cancel();
    ambientTargetRef.current = null;
    manualAmbientTargetRef.current = null;
    setAmbientTarget(null);
    setAmbientResult(null);
    setAmbientError(null);
    setAmbientDisplayEditorId(null);
    setAmbientEmptyEditorId(null);
    if (ambientEmptyNoticeTimerRef.current) {
      clearTimeout(ambientEmptyNoticeTimerRef.current);
      ambientEmptyNoticeTimerRef.current = null;
    }
  };

  // 결과·오류는 검색을 시작한 편집기(snapshot의 editorId)에만 바인딩한다.
  // 계정 전환 뒤 도착한 응답은 search wrapper에서 취소한다.
  const ambientSearchHandlers = {
    // 자동 검색의 "없음"·"오류"는 그리지 않는다. 사용자가 요청한 적이 없어
    // 알릴 것도 없고, 글 쓰는 중에 실패가 튀어나오면 방해만 된다. 다만
    // 이전 결과는 지워야 하므로 상태 정리는 그대로 한다.
    onEmpty: (target: AmbientSearchTarget, mode: AmbientSearchMode) => {
      if (!isCurrentAmbientTarget(target)) return;
      setAmbientResult(null);
      setAmbientError(null);
      if (mode !== 'manual') {
        setAmbientDisplayEditorId(null);
        setAmbientEmptyEditorId(null);
        return;
      }
      // 수동 검색에서 아무 반응이 없으면 "눌리긴 했나?"가 된다. 항상 알린다.
      setAmbientDisplayEditorId(target.editorId);
      showAmbientEmptyNotice(target.editorId);
    },
    onError: (
      target: AmbientSearchTarget,
      error: unknown,
      mode: AmbientSearchMode,
    ) => {
      if (!isCurrentAmbientTarget(target)) return;
      // 취소는 오류가 아니다 — 다음 입력이 이전 요청을 끊은 것뿐이다.
      const message = formatLocalMemoSearchErrorMessage(error);
      if (!message) return;
      setAmbientResult(null);
      setAmbientEmptyEditorId(null);
      if (mode !== 'manual') {
        setAmbientError(null);
        setAmbientDisplayEditorId(null);
        return;
      }
      setAmbientDisplayEditorId(target.editorId);
      setAmbientError(message);
    },
    onResult: (
      target: AmbientSearchTarget,
      queryChunk: MemoChunk | null,
      result: NetworkSearchResult,
    ) => {
      if (!isCurrentAmbientTarget(target)) return;
      setAmbientResult(result);
      setAmbientError(null);
      setAmbientDisplayEditorId(target.editorId);
    },
  };

  const runAmbientSearchNow = (manualTarget?: AmbientSearchTarget) => {
    const target = manualTarget ?? ambientTargetRef.current;
    if (!target) return;
    // 사용자가 직접 검색을 누른 경우에만 관문을 띄운다. 자동 검색까지
    // 관문을 띄우면 글을 쓰다가 모달이 튀어나온다.
    if (manualTarget) {
      ambientTargetRef.current = manualTarget;
      manualAmbientTargetRef.current = manualTarget;
      setAmbientTarget(manualTarget);
      setAmbientResult(null);
      setAmbientError(null);
      setAmbientDisplayEditorId(null);
      setAmbientEmptyEditorId(null);
    } else {
      manualAmbientTargetRef.current = null;
    }
    // 자동 검색은 사용자가 시킨 적 없으므로 색인도 조용히 돈다.
    void flushLocalMemoIndex(undefined, Boolean(manualTarget)).then(
      (indexed) => {
        if (!indexed || !isCurrentAmbientTarget(target)) return;
        ambientRunnerRef.current.run(target, ambientSearchHandlers, {
          mode: manualTarget ? 'manual' : 'auto',
        });
      },
    );
  };

  // 더보기는 에디터 아래 인라인 목록이 아니라 미리보기 패널의 목록 모드로
  // 연다. 고스트 줄 옆에 목록이 펼쳐지면 무크롬 원칙이 깨지고, 여러 결과를
  // 연달아 확인하는 흐름에는 재사용되는 패널이 더 맞다.
  const openAmbientListInPreview = async () => {
    const target = ambientTarget;
    if (!target) return;
    const ownerId = getLocalWorkspaceOwner();
    try {
      const indexed = await flushLocalMemoIndexForUser();
      if (!indexed) return;
      const response = await searchLocalMemoChunks({
        limit: 8,
        memoId: target.memoId,
        minimumSimilarity: AMBIENT_LIST_MIN_SIMILARITY,
        ownerId,
        queryText: target.queryText,
      });
      if (
        getLocalWorkspaceOwner() !== ownerId ||
        ambientTargetRef.current?.editorId !== target.editorId ||
        ambientTargetRef.current?.queryText !== target.queryText
      ) {
        return;
      }
      setAmbientError(null);
      // 목록 열기는 ghost가 떠 있을 때만 도달한다 — openAmbientList가
      // ambientResult로 막는다. 방금 같은 질의가 결과를 냈다는 뜻이라 0건은
      // 원본이 그사이 지워진 정도로만 나온다. 그때 "없습니다"를 띄우면 방금
      // 본 추천과 모순되므로 조용히 아무것도 열지 않는다.
      if (response.results.length > 0) {
        handleOpenPreview(response.results, 'list', {
          isAmbientList: true,
          promotionTooltip: t('새 메모 탭으로 열기', 'Open in a new note tab'),
        });
      }
    } catch (caught) {
      const message = formatLocalMemoSearchErrorMessage(caught);
      if (!message) return;
      // ⌘⏎는 "패널을 열어 달라"는 요청이다. 실패를 편집기 쪽 고스트로
      // 되돌리면 사용자는 열리지 않은 패널을 기다리게 된다. 패널을 열고
      // 그 안에서 알린다.
      setSidePanelCollapsed(false);
      setActiveSidePanel('preview');
      setPreviewPanel({
        error: message,
        isAmbientList: true,
        mode: 'list',
        result: null,
        results: [],
      });
    }
  };

  useEffect(() => {
    if (
      !canRunAmbientAutoSearch({
        autoSearchEnabled: appSettings.ambientAutoSearchEnabled,
        documentHasFocus: document.hasFocus(),
        documentHidden: document.hidden,
        hasSession: Boolean(session),
      })
    ) {
      return;
    }
    const manualTarget = manualAmbientTargetRef.current;
    if (
      manualTarget &&
      ambientTarget &&
      manualTarget.editorId === ambientTarget.editorId &&
      manualTarget.memoId === ambientTarget.memoId &&
      manualTarget.queryText === ambientTarget.queryText
    ) {
      return;
    }
    ambientRunnerRef.current.run(ambientTarget, ambientSearchHandlers);
  }, [ambientTarget, appSettings.ambientAutoSearchEnabled, session]);

  const saveMemoContent = (
    id: string,
    content: string,
    fallback?: { category?: string; createdAt?: string },
    previousEditorContent?: string,
  ) => {
    const existingMemo = memosRef.current.find((memo) => memo.id === id);
    if (isPreparingToQuitRef.current) {
      return existingMemo ?? null;
    }
    if (deletingMemoIdsRef.current.has(id)) {
      return existingMemo ?? null;
    }
    if (!existingMemo && !content.trim()) {
      return null;
    }
    let contentToSave = content;
    if (
      existingMemo &&
      previousEditorContent !== undefined &&
      existingMemo.content !== previousEditorContent
    ) {
      const rebased = rebaseEditorChangeOntoCanonical(
        previousEditorContent,
        content,
        existingMemo.content,
      );
      contentToSave = rebased.text;
      if (!rebased.ok) {
        void preserveLocalMemoRecovery(
          {
            content: existingMemo.content,
            memoId: id,
            source: 'server',
            sourceUpdatedAt:
              existingMemo.content_updated_at ?? existingMemo.updated_at,
          },
          sessionRef.current?.user.id,
        );
        setError(
          t(
            '동기화된 변경과 현재 입력을 자동 병합하지 못해 복구 기록을 보관했습니다.',
            'We could not merge synced changes with your edits, so a recovery copy was kept.',
          ),
        );
      }
    }
    if (existingMemo?.content === contentToSave) {
      return existingMemo;
    }

    const createdAt =
      existingMemo?.created_at ??
      fallback?.createdAt ??
      new Date().toISOString();
    const contentUpdatedAt = new Date().toISOString();
    const category = getMemoCategory(
      existingMemo?.category ?? fallback?.category,
    );
    const currentSession = sessionRef.current;
    const ownerId = currentSession?.user.id;
    const localMemo = createLocalMemoRow(
      {
        category,
        content: contentToSave,
        content_updated_at: contentUpdatedAt,
        created_at: createdAt,
        id,
        synced_content: existingMemo?.synced_content ?? null,
        synced_content_hash: existingMemo?.synced_content_hash ?? null,
      },
      'pending',
    );

    const mergeLocalMemo = (previous: MemoRow[]) => {
      const exists = previous.some((memo) => memo.id === id);
      const merged = exists
        ? previous.map((memo) => (memo.id === id ? localMemo : memo))
        : [localMemo, ...previous];
      return merged.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    };
    // React render가 반영되기 전에 Tiptap update가 연달아 와도 두 번째 입력은
    // 첫 번째 입력을 최신값으로 본다. 오래된 render closure로 최종 입력을
    // "변경 없음" 처리하면 DB에 중간 상태가 남을 수 있다.
    memosRef.current = mergeLocalMemo(memosRef.current);
    setMemos((previous) => mergeLocalMemo(previous));

    const localRevision = (memoLocalWriteRevisionsRef.current.get(id) ?? 0) + 1;
    memoLocalWriteRevisionsRef.current.set(id, localRevision);
    pendingLocalMemoWriteOwnersRef.current.set(id, ownerId ?? null);
    memoSyncRevisionsRef.current.set(
      id,
      (memoSyncRevisionsRef.current.get(id) ?? 0) + 1,
    );
    cancelMemoCloudRetry(id);
    setMemoSaveStates((previous) => ({
      ...previous,
      [id]: 'saving-local',
    }));
    // SQLite transient failures get a bounded retry budget. Only the latest
    // revision may schedule cloud sync or change the visible save state.
    const localWritePromise = persistLocalMemoEventually(localMemo, ownerId);
    pendingLocalMemoWritePromisesRef.current.set(id, localWritePromise);
    void localWritePromise
      .then(() => {
        if (memoLocalWriteRevisionsRef.current.get(id) !== localRevision)
          return;
        pendingLocalMemoWriteOwnersRef.current.delete(id);
        if (getLocalWorkspaceOwner() !== (ownerId ?? null)) return;
        setMemoSaveStates((previous) => {
          if (!(id in previous)) return previous;
          const next = { ...previous };
          delete next[id];
          return next;
        });
        if (currentSession && isCurrentSession(currentSession)) {
          scheduleMemoCloudSync(currentSession, {
            baseHash: existingMemo?.synced_content_hash ?? null,
            category,
            content: contentToSave,
            contentUpdatedAt,
            createdAt,
            id,
          });
        }
      })
      .catch(() => {
        if (memoLocalWriteRevisionsRef.current.get(id) !== localRevision)
          return;
        if (getLocalWorkspaceOwner() !== (ownerId ?? null)) return;
        setMemoSaveStates((previous) => ({
          ...previous,
          [id]: 'local-failed',
        }));
      })
      .finally(() => {
        if (
          pendingLocalMemoWritePromisesRef.current.get(id) === localWritePromise
        ) {
          pendingLocalMemoWritePromisesRef.current.delete(id);
        }
      });

    return localMemo;
  };

  // 벡터 색인은 입력 중이 아니라 명시적인 경계에서만 실행한다. 먼저 현재
  // 메모의 로컬 저장이 끝난 뒤 최신 React 스냅샷을 넘기므로, blur 직후의
  // 저장 레이스가 색인 snapshot 거절로 끝나지 않게 한다.
  const flushLocalMemoIndex = useCallback(
    async (memoIds?: string[], isVisible = false) => {
      const selectedIds = memoIds ? new Set(memoIds) : null;
      const pendingWrites = [...pendingLocalMemoWritePromisesRef.current]
        .filter(([memoId]) => !selectedIds || selectedIds.has(memoId))
        .map(([, promise]) => promise.catch(() => undefined));
      await Promise.all(pendingWrites);

      const candidates = memosRef.current.filter(
        (memo) => !selectedIds || selectedIds.has(memo.id),
      );
      if (candidates.length === 0) return true;
      const modelStatus = await window.electronAPI?.localEmbedStatus?.();
      if (!modelStatus?.ready) {
        if (isVisible) setEmbeddingGateOpen(true);
        return false;
      }
      await reconcileLocalMemoIndex(
        candidates,
        getLocalWorkspaceOwner(),
        isVisible,
      );
      return true;
    },
    [],
  );

  // 버튼을 눌러 일어나는 색인. 진행 상황을 보여 준다.
  const flushLocalMemoIndexForUser = useCallback(
    () => flushLocalMemoIndex(undefined, true),
    [flushLocalMemoIndex],
  );

  // blur는 사용자가 요청한 적 없는 정리다 — 조용히 처리한다.
  const handleMemoEditorBlur = useCallback(
    (memoId: string) => {
      void flushLocalMemoIndex([memoId]);
    },
    [flushLocalMemoIndex],
  );

  const changeMemoDraft = (value: string, previousEditorContent?: string) => {
    let memoId = activeMemoIdRef.current;
    let createdAt = activeMemoCreatedAtRef.current;
    if (!memoId && value.trim()) {
      memoId = createUuid();
      createdAt = new Date().toISOString();
      activeMemoIdRef.current = memoId;
      activeMemoCreatedAtRef.current = createdAt;
      setActiveMemoId(memoId);
      setActiveMemoCreatedAt(createdAt);
    }

    ambientTargetRef.current = null;
    setAmbientTarget(null);
    setAmbientResult(null);
    setAmbientError(null);

    if (memoId) {
      saveMemoContent(
        memoId,
        value,
        {
          category: activeDraftCategory,
          createdAt,
        },
        previousEditorContent,
      );
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
      throw new Error(t('빈 메모는 생성할 수 없습니다.', 'Cannot create an empty note.'));
    }
    return memo;
  };

  const updateMemoContentById = (
    id: string,
    content: string,
    previousEditorContent?: string,
  ) => {
    saveMemoContent(id, content, undefined, previousEditorContent);
  };

  const deleteMemoById = async (id: string) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const existingMemo = memosRef.current.find((memo) => memo.id === id);

    deletingMemoIdsRef.current.add(id);
    setManualMemoSyncRetryIds((previous) =>
      previous.filter((memoId) => memoId !== id),
    );
    memoLocalWriteRevisionsRef.current.set(
      id,
      (memoLocalWriteRevisionsRef.current.get(id) ?? 0) + 1,
    );
    setMemos((previous) => previous.filter((memo) => memo.id !== id));

    if (id === activeMemoId) {
      const nextMemos = memos.filter((memo) => memo.id !== id);
      const nextActive = nextMemos[0] ?? null;
      setActiveMemoId(nextActive?.id ?? null);
      setActiveMemoCreatedAt(
        nextActive?.created_at ?? new Date().toISOString(),
      );
      setActiveDraftCategory(getMemoCategory(nextActive?.category));
    }

    try {
      await markLocalMemoDeleted(id, 'pending_delete', ownerId);
      setMemoSaveStates((previous) => {
        if (!(id in previous)) return previous;
        const next = { ...previous };
        delete next[id];
        return next;
      });
    } catch {
      deletingMemoIdsRef.current.delete(id);
      setMemoSaveStates((previous) => ({
        ...previous,
        [id]: 'local-failed',
      }));
      if (existingMemo) {
        const restoreMemo = (previous: MemoRow[]) => {
          if (previous.some((memo) => memo.id === id)) return previous;
          return [existingMemo, ...previous].sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          );
        };
        memosRef.current = restoreMemo(memosRef.current);
        setMemos(restoreMemo);
      }
      window.alert(
        t(
          '메모를 삭제하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
          'Could not delete the note.\nCheck that this device has enough storage, then try again.',
        ),
      );
      return;
    }
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
        await markLocalMemoDeleted(id, 'pending_delete', ownerId).catch(
          () => undefined,
        );
      } finally {
        deletingMemoIdsRef.current.delete(id);
      }
    })();
  };

  const selectMemo = (memo: MemoRow) => {
    const isDifferentMemo = memo.id !== activeMemoId;
    setActiveMemoId(memo.id);
    setActiveMemoCreatedAt(memo.created_at);
    setActiveDraftCategory(getMemoCategory(memo.category));
    if (isDifferentMemo) {
      ambientTargetRef.current = null;
      setAmbientTarget(null);
      setAmbientResult(null);
      setAmbientError(null);
      setAmbientDisplayEditorId(null);
      setAmbientEmptyEditorId(null);
    }
    setActiveTab('memo');
  };

  const selectMemoById = (memoId: string) => {
    const targetMemo = memos.find((memo) => memo.id === memoId);

    if (targetMemo) {
      selectMemo(targetMemo);
    }
  };

  const monthlyReport = useMemo(
    () =>
      buildMonthlyReport(
        {
          memos,
          activities: activityCompletions,
          clusters: topicClusters,
          memberships: topicMemberships,
          edges: topicGlobalEdges,
        },
        reportMonth,
      ),
    [
      memos,
      activityCompletions,
      topicClusters,
      topicMemberships,
      topicGlobalEdges,
      reportMonth,
    ],
  );

  // 배지는 지난 달 기록이 기준을 넘고 아직 안 봤을 때만. 리포트 전체를
  // 만들 필요 없이 메모 수만 세면 된다.
  const latestReportMonth = reportMonthKey();
  const hasNewReport =
    seenReportMonth !== latestReportMonth &&
    memos.filter(
      (memo) => monthKeyOf(new Date(memo.created_at)) === latestReportMonth,
    ).length >= MIN_MEMOS_FOR_REPORT;

  const openReport = () => {
    setReportMonth(latestReportMonth);
    setReportOpen(true);
    setSeenReportMonth(latestReportMonth);
    saveSeenReportMonth(session?.user.id ?? null, latestReportMonth);
  };

  const trackCalendarLocalWrite = <T,>(promise: Promise<T>) => {
    pendingCalendarLocalWritesRef.current.add(promise);
    void promise.then(
      () => pendingCalendarLocalWritesRef.current.delete(promise),
      () => pendingCalendarLocalWritesRef.current.delete(promise),
    );
    return promise;
  };

  const togglePinnedMemo = (memoId: string) => {
    const next = togglePinnedMemoId(pinnedMemoIds, memoId);
    setPinnedMemoIds(next);
    savePinnedMemoIds(session?.user.id ?? null, next);
  };

  const saveCalendarBlock = async (draft: CalendarBlockDraft) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const id = draft.id ?? createUuid();
    const now = new Date().toISOString();
    const existingBlock = calendarBlocks.find((block) => block.id === id);
    const startMs = new Date(draft.startDate).getTime();
    const fallbackEndDate = new Date(startMs + 60 * 60 * 1000).toISOString();
    const candidateEndDate =
      draft.endDate ?? existingBlock?.end_date ?? fallbackEndDate;
    const endDate =
      !draft.allDay && new Date(candidateEndDate).getTime() > startMs
        ? candidateEndDate
        : draft.allDay
          ? null
          : fallbackEndDate;
    const localBlock: CalendarBlockRow = {
      all_day: draft.allDay,
      all_day_date: draft.allDay ? toLocalCalendarDate(draft.startDate) : null,
      category_id: draft.categoryId ?? null,
      color: draft.color,
      created_at: existingBlock?.created_at ?? now,
      end_date: endDate,
      id,
      is_completed: existingBlock?.is_completed ?? false,
      completed_at: existingBlock?.completed_at ?? null,
      local_sync_status: 'pending',
      note: draft.note,
      order: draft.order ?? 0,
      start_date: draft.startDate,
      title: draft.title.trim() || t('새 일정', 'New event'),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      updated_at: now,
    };

    setCalendarBlocks((previous) => {
      const exists = previous.some((item) => item.id === localBlock.id);
      return exists
        ? previous.map((item) =>
            item.id === localBlock.id ? localBlock : item,
          )
        : [...previous, localBlock];
    });
    const localPersistPromise = trackCalendarLocalWrite(
      upsertLocalCalendarBlock(localBlock, 'pending', ownerId),
    );

    if (!currentSession) {
      try {
        await localPersistPromise;
        return true;
      } catch {
        setCalendarBlocks((previous) =>
          existingBlock
            ? previous.map((item) =>
                item.id === existingBlock.id ? existingBlock : item,
              )
            : previous.filter((item) => item.id !== id),
        );
        window.alert(
          t(
            '일정을 저장하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
            'Could not save the event.\nCheck that this device has enough storage, then try again.',
          ),
        );
        return false;
      }
    }

    void calendarMutationQueueRef.current.enqueue(id, async ({ isLatest }) => {
      try {
        await localPersistPromise;
        if (!isLatest()) return;
        const block = await upsertCalendarBlock(currentSession, {
          ...draft,
          categoryId: localBlock.category_id ?? null,
          endDate: localBlock.end_date,
          id,
          isCompleted: existingBlock?.is_completed ?? false,
          completedAt: existingBlock?.completed_at ?? null,
        });
        if (!isLatest()) return;
        await upsertLocalCalendarBlock(block, 'synced', ownerId);
        if (!isLatest()) return;
        if (!isCurrentSession(currentSession)) return;
        setCalendarBlocks((previous) =>
          previous.map((item) => (item.id === block.id ? block : item)),
        );
      } catch {
        if (!isLatest()) return;
        await upsertLocalCalendarBlock(localBlock, 'failed', ownerId).catch(
          () => undefined,
        );
        if (!isLatest()) return;
        if (!isCurrentSession(currentSession)) return;
        setCalendarBlocks((previous) =>
          previous.map((item) =>
            item.id === id ? { ...item, local_sync_status: 'failed' } : item,
          ),
        );
      }
    });
    try {
      await localPersistPromise;
      return true;
    } catch {
      window.alert(
        t(
          '일정을 저장하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
          'Could not save the event.\nCheck that this device has enough storage, then try again.',
        ),
      );
      return false;
    }
  };

  const saveCalendarCategory = async (draft: CalendarCategoryDraft) => {
    const name = draft.name.trim();
    if (!name) return null;

    const category: CalendarCategoryRow = {
      color: draft.color,
      id: createUuid(),
      name,
    };
    const nextCategories = [...calendarCategories, category].sort((a, b) =>
      a.name.localeCompare(b.name, 'ko'),
    );
    setCalendarCategories(nextCategories);
    saveCalendarCategories(session?.user.id ?? null, nextCategories);
    return category;
  };

  const deleteCalendarCategory = async (categoryId: string) => {
    if (!calendarCategories.some((category) => category.id === categoryId)) {
      return false;
    }
    const saved = await Promise.all(
      calendarBlocks
        .filter((block) => block.category_id === categoryId)
        .map((block) =>
          saveCalendarBlock({
            allDay: Boolean(block.all_day),
            categoryId: null,
            color: DEFAULT_CALENDAR_COLOR,
            endDate: block.end_date,
            id: block.id,
            note: block.note,
            order: block.order ?? 0,
            startDate: block.start_date,
            title: block.title,
          }),
        ),
    );
    if (saved.some((result) => !result)) return false;

    const nextCategories = calendarCategories.filter(
      (category) => category.id !== categoryId,
    );
    setCalendarCategories(nextCategories);
    saveCalendarCategories(session?.user.id ?? null, nextCategories);
    return true;
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

    let pendingActivity: ActivityCompletion | null = null;
    const activity = await loadLocalActivityCompletions(ownerId);
    if (!activity.some((item) => item.calendar_block_id === block.id)) {
      const record = {
        id: createUuid(),
        calendar_block_id: block.id,
        completed_at: now,
        local_date: localDate,
      };
      await upsertLocalActivityCompletionEventually(record, 'pending', ownerId);
      pendingActivity = record;
      if ((sessionRef.current?.user.id ?? null) === (ownerId ?? null)) {
        setActivityCompletions((previous) =>
          previous.some(
            (item) => item.calendar_block_id === record.calendar_block_id,
          )
            ? previous
            : [...previous, record],
        );
      }
    }

    let pendingDaily: DailyCompletion | null = null;
    const dayBlocks = blocksForLocalDate(nextBlocks, localDate);
    if (isDayComplete(dayBlocks)) {
      const daily = await loadLocalDailyCompletions(ownerId);
      if (!daily.some((item) => item.local_date === localDate)) {
        const record = {
          id: createUuid(),
          local_date: localDate,
          completed_at: now,
          todo_count: dayBlocks.length,
        };
        await upsertLocalDailyCompletionEventually(record, 'pending', ownerId);
        pendingDaily = record;
      }
    }

    // The returned promise covers every durable local growth write. Cloud
    // delivery continues as an idempotent outbox and must not hold app quit.
    if (currentSession && pendingActivity) {
      const activityToSync = pendingActivity;
      void recordActivityCompletion(currentSession, activityToSync)
        .then(() =>
          upsertLocalActivityCompletion(activityToSync, 'synced', ownerId),
        )
        .catch(() => undefined);
    }
    if (currentSession && pendingDaily) {
      const dailyToSync = pendingDaily;
      void recordDailyCompletion(currentSession, dailyToSync)
        .then(() => upsertLocalDailyCompletion(dailyToSync, 'synced', ownerId))
        .catch(() => undefined);
    }
  };

  const toggleCalendarBlockCompleted = async (blockId: string) => {
    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const existing = calendarBlocks.find((block) => block.id === blockId);
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

    setCalendarBlocks((previous) =>
      previous.map((block) => (block.id === blockId ? updated : block)),
    );
    const localPersistPromise = trackCalendarLocalWrite(
      upsertLocalCalendarBlock(updated, 'pending', ownerId),
    );

    const nextBlocks = calendarBlocks.map((block) =>
      block.id === blockId ? updated : block,
    );
    if (nextCompleted) {
      const growthPersistPromise = trackCalendarLocalWrite(
        localPersistPromise.then(() =>
          recordGrowthOnComplete(updated, nextBlocks),
        ),
      );
      void growthPersistPromise.catch(() => {
        if ((sessionRef.current?.user.id ?? null) !== (ownerId ?? null)) return;
        window.alert(
          t(
            '완료 표시를 저장하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
            'Could not save the completion.\nCheck that this device has enough storage, then try again.',
          ),
        );
      });
    }
    void calendarMutationQueueRef.current.enqueue(
      blockId,
      async ({ isLatest }) => {
        try {
          await localPersistPromise;
        } catch {
          if (!isLatest()) return;
          if ((sessionRef.current?.user.id ?? null) !== (ownerId ?? null)) {
            return;
          }
          setCalendarBlocks((previous) =>
            previous.map((item) =>
              item.id === blockId && item === updated ? existing : item,
            ),
          );
          window.alert(
            t(
              '일정을 저장하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
              'Could not save the event.\nCheck that this device has enough storage, then try again.',
            ),
          );
          return;
        }
        if (!isLatest()) return;
        if (!currentSession) return;
        try {
          const block = await upsertCalendarBlock(currentSession, {
            allDay: Boolean(updated.all_day),
            categoryId: updated.category_id ?? null,
            color: updated.color ?? DEFAULT_CALENDAR_COLOR,
            id: updated.id,
            isCompleted: nextCompleted,
            completedAt: updated.completed_at,
            endDate: updated.end_date,
            note: updated.note,
            order: updated.order ?? 0,
            startDate: updated.start_date,
            title: updated.title,
          });
          if (!isLatest()) return;
          await upsertLocalCalendarBlock(block, 'synced', ownerId);
          if (!isLatest()) return;
          if (!isCurrentSession(currentSession)) return;
          setCalendarBlocks((previous) =>
            previous.map((item) => (item.id === block.id ? block : item)),
          );
        } catch {
          if (!isLatest()) return;
          await upsertLocalCalendarBlock(updated, 'failed', ownerId).catch(
            () => undefined,
          );
          if (!isLatest()) return;
          if (!isCurrentSession(currentSession)) return;
          setCalendarBlocks((previous) =>
            previous.map((item) =>
              item.id === blockId
                ? { ...item, local_sync_status: 'failed' }
                : item,
            ),
          );
        }
      },
    );
    await localPersistPromise.catch(() => undefined);
  };

  const removeCalendarBlock = async (blockId: string) => {
    if (!window.confirm(t('블럭을 삭제하시겠습니까?', 'Delete this event?'))) {
      return;
    }

    const currentSession = session;
    const ownerId = currentSession?.user.id;
    const existingBlock = calendarBlocks.find((block) => block.id === blockId);
    setCalendarBlocks((previous) =>
      previous.filter((block) => block.id !== blockId),
    );
    let localDeletePersisted = false;
    const localDeletePromise = trackCalendarLocalWrite(
      markLocalCalendarBlockDeleted(blockId, 'pending_delete', ownerId),
    ).then(() => {
      localDeletePersisted = true;
    });
    const restoreAfterLocalDeleteFailure = () => {
      if (existingBlock && currentSession && isCurrentSession(currentSession)) {
        setCalendarBlocks((previous) =>
          previous.some((block) => block.id === blockId)
            ? previous
            : [...previous, existingBlock],
        );
      }
      window.alert(
        t(
          '일정을 삭제하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
          'Could not delete the event.\nCheck that this device has enough storage, then try again.',
        ),
      );
    };

    if (!currentSession) {
      try {
        await localDeletePromise;
      } catch {
        if (existingBlock) {
          setCalendarBlocks((previous) =>
            previous.some((block) => block.id === blockId)
              ? previous
              : [...previous, existingBlock],
          );
        }
        window.alert(
          t(
            '일정을 삭제하지 못했습니다.\n기기 저장 공간이 부족하지 않은지 확인한 뒤 다시 시도해 주세요.',
            'Could not delete the event.\nCheck that this device has enough storage, then try again.',
          ),
        );
      }
      return;
    }

    void calendarMutationQueueRef.current.enqueue(
      blockId,
      async ({ isLatest }) => {
        try {
          await localDeletePromise;
          if (!isLatest()) return;
          await deleteCalendarBlock(currentSession, blockId);
          if (!isLatest()) return;
          await removeLocalCalendarBlock(blockId, ownerId);
        } catch {
          if (!isLatest()) return;
          if (!localDeletePersisted) {
            restoreAfterLocalDeleteFailure();
            return;
          }
          await markLocalCalendarBlockDeleted(
            blockId,
            'pending_delete',
            ownerId,
          ).catch(() => undefined);
          if (!isLatest()) return;
        }
      },
    );
    await localDeletePromise.catch(() => undefined);
  };

  const placeScheduleInboxItem = async (
    item: ScheduleInboxRow,
    overrides: {
      allDay?: boolean;
      note?: string | null;
      startDate?: Date;
      title?: string;
    } = {},
  ) => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    const start = overrides.startDate ?? toValidDate(item.scheduled_at);
    if (!start) {
      return;
    }
    const allDay = overrides.allDay ?? Boolean(item.all_day);

    const saved = await saveCalendarBlock({
      allDay,
      color: DEFAULT_CALENDAR_COLOR,
      endDate: allDay ? null : defaultCalendarEndDate(start).toISOString(),
      note: overrides.note ?? item.source_text,
      startDate: start.toISOString(),
      title: overrides.title ?? item.title,
    });
    if (!saved) return;
    await upsertLocalScheduleInboxAction(
      item.id,
      'accepted',
      currentSession.user.id,
    );
    await removeLocalScheduleInboxItem(item.id, currentSession.user.id);
    if (!isCurrentSession(currentSession)) {
      return;
    }
    setScheduleInbox((previous) =>
      previous.filter((inbox) => inbox.id !== item.id),
    );
    void updateScheduleInboxStatus(currentSession, item.id, 'accepted')
      .then(() =>
        removeLocalScheduleInboxAction(item.id, currentSession.user.id),
      )
      .catch(() => undefined);
  };

  const deleteScheduleInboxItem = async (item: ScheduleInboxRow) => {
    const currentSession = session;
    if (!currentSession) {
      return;
    }

    await upsertLocalScheduleInboxAction(
      item.id,
      'dismissed',
      currentSession.user.id,
    );
    await removeLocalScheduleInboxItem(item.id, currentSession.user.id);
    if (!isCurrentSession(currentSession)) {
      return;
    }
    setScheduleInbox((previous) =>
      previous.filter((inbox) => inbox.id !== item.id),
    );
    void updateScheduleInboxStatus(currentSession, item.id, 'dismissed')
      .then(() =>
        removeLocalScheduleInboxAction(item.id, currentSession.user.id),
      )
      .catch(() => undefined);
  };

  const handleChangePane = (id: string, patch: Partial<MemoSplitPaneState>) => {
    setSplitPanes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  };

  const handleMoveEditor = (
    sourcePaneId: string,
    targetPaneId: string,
    editorId: string,
    targetIndex: number,
  ) => {
    setSplitPanes((previous) => {
      const sourcePane = previous.find((pane) => pane.id === sourcePaneId);
      const targetPane = previous.find((pane) => pane.id === targetPaneId);
      if (!sourcePane || !targetPane) {
        return previous;
      }

      const sourceEditors = getAppPaneEditors(sourcePane);
      if (sourcePaneId === targetPaneId) {
        return previous.map((pane) =>
          pane.id === sourcePaneId
            ? {
                ...pane,
                editors: editorsAfterMove(sourceEditors, editorId, targetIndex),
              }
            : pane,
        );
      }

      const movedEditor = sourceEditors.find(
        (editor) => editor.id === editorId,
      );
      if (!movedEditor) {
        return previous;
      }

      const {
        sourceEditors: nextSourceEditors,
        targetEditors: nextTargetEditors,
      } = editorsAfterTransfer(
        sourceEditors,
        getAppPaneEditors(targetPane),
        editorId,
        targetIndex,
      );
      const { activeEditor: nextSourceEditor } = editorsAfterCloseTab(
        sourceEditors,
        sourcePane.activeEditorId,
        editorId,
      );

      return previous
        .filter(
          (pane) => pane.id !== sourcePaneId || nextSourceEditors.length > 0,
        )
        .map((pane) => {
          if (pane.id === targetPaneId) {
            return {
              ...pane,
              ...mirrorEditorPatchHelper(movedEditor),
              activeEditorId: movedEditor.id,
              editors: nextTargetEditors,
            };
          }

          if (pane.id === sourcePaneId && nextSourceEditor) {
            return {
              ...pane,
              ...mirrorEditorPatchHelper(nextSourceEditor),
              activeEditorId: nextSourceEditor.id,
              editors: nextSourceEditors,
            };
          }

          return pane;
        });
    });
    setFocusedPaneId(targetPaneId);
  };

  const handleAddSplitPane = () => {
    if (splitPanes.length >= MAX_SPLIT_PANE_COUNT) {
      return;
    }

    const nextEditor = createEditorHelper('memo', { isViewPicker: true });
    const nextPane: MemoSplitPaneState = {
      id: createSplitPaneId(),
      activeEditorId: nextEditor.id,
      editors: [nextEditor],
      ...mirrorEditorPatchHelper(nextEditor),
      view: nextEditor.view,
    };

    setIsSplitWorkspaceEnabled(true);
    setFocusedPaneId(nextPane.id);
    setSplitPanes((prev) => {
      if (prev.length >= MAX_SPLIT_PANE_COUNT) {
        return prev;
      }

      return [...prev, nextPane];
    });
  };

  const handleClosePane = (id: string) => {
    const next = splitPanes.filter((pane) => pane.id !== id);

    if (next.length === 0) {
      const nextEditor = createEditorHelper('memo', { isViewPicker: true });
      const nextPane: MemoSplitPaneState = {
        id: createSplitPaneId(),
        activeEditorId: nextEditor.id,
        editors: [nextEditor],
        ...mirrorEditorPatchHelper(nextEditor),
        view: nextEditor.view,
      };
      setSplitPanes([nextPane]);
      setIsSplitWorkspaceEnabled(true);
      setFocusedPaneId(nextPane.id);
      return;
    }

    setSplitPanes(next);
    if (focusedPaneId === id) {
      setFocusedPaneId(next[next.length - 1].id);
    }
  };

  const handleCloseAllPanes = () => {
    const nextEditor = createEditorHelper('memo', { isViewPicker: true });
    const nextPane: MemoSplitPaneState = {
      id: createSplitPaneId(),
      activeEditorId: nextEditor.id,
      editors: [nextEditor],
      ...mirrorEditorPatchHelper(nextEditor),
      view: nextEditor.view,
    };
    setIsSplitWorkspaceEnabled(true);
    setSplitPanes([nextPane]);
    setFocusedPaneId(nextPane.id);
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
    draftCategory: editor.draftCategory,
    draftText: editor.draftText,
    highlight: editor.highlight,
    isViewPicker: editor.isViewPicker,
    memoId: editor.memoId,
    mode: editor.mode,
    networkErrorMessage: editor.networkErrorMessage,
    networkIsLoading: editor.networkIsLoading,
    networkQueryChunk: editor.networkQueryChunk,
    networkRequestId: editor.networkRequestId,
    networkResults: editor.networkResults,
    selectionEnd: editor.selectionEnd,
    selectionStart: editor.selectionStart,
    selectedText: editor.selectedText,
    sourceResult: editor.sourceResult,
    view: editor.view,
  });

  const openNewTabInFocusedSplitPane = () => {
    const nextEditor = createEditorHelper('memo', { isViewPicker: true });

    setActiveTab('memo');
    setIsSplitWorkspaceEnabled(true);

    if (splitPanes.length === 0) {
      const paneId = createSplitPaneId();
      setSplitPanes([
        {
          id: paneId,
          activeEditorId: nextEditor.id,
          editors: [nextEditor],
          ...mirrorEditorPatchHelper(nextEditor),
          view: nextEditor.view,
        },
      ]);
      setFocusedPaneId(paneId);
      return;
    }

    const targetPaneId =
      focusedPaneId && splitPanes.some((pane) => pane.id === focusedPaneId)
        ? focusedPaneId
        : splitPanes[0].id;

    setSplitPanes((previous) =>
      previous.map((pane) =>
        pane.id === targetPaneId
          ? {
              ...pane,
              ...mirrorEditorPatchHelper(nextEditor),
              activeEditorId: nextEditor.id,
              editors: editorsAfterNewTab(getAppPaneEditors(pane), nextEditor),
              view: nextEditor.view,
            }
          : pane,
      ),
    );
    setFocusedPaneId(targetPaneId);
  };

  // Open a view (calendar/inbox/briefing/network/...) as a new editor TAB in the
  // focused split pane — the Obsidian-style behaviour for the left ribbon icons.
  const openViewAsTab = (view: MemoSplitPaneView) => {
    setIsSplitWorkspaceEnabled(true);
    setActiveTab('memo');
    if (view === 'inbox') {
      // stale-while-revalidate: 로컬 캐시가 먼저 그려지고, 열 때마다
      // 백그라운드에서 서버 목록으로 조용히 갱신한다.
      void refreshInbox();
    }
    const newEditor = createEditorHelper(view);

    if (splitPanes.length === 0) {
      const paneId = createSplitPaneId();
      setSplitPanes([
        {
          id: paneId,
          activeEditorId: newEditor.id,
          editors: [newEditor],
          ...mirrorEditorPatchHelper(newEditor),
          view: newEditor.view,
        },
      ]);
      setFocusedPaneId(paneId);
      return;
    }

    const targetId =
      focusedPaneId && splitPanes.some((pane) => pane.id === focusedPaneId)
        ? focusedPaneId
        : splitPanes[splitPanes.length - 1].id;

    setSplitPanes((prev) =>
      prev.map((pane) => {
        if (pane.id !== targetId) {
          return pane;
        }

        // Same view already open in this pane → focus its tab instead of
        // stacking duplicate Topics/캘린더/... tabs on every ribbon click.
        const existingEditor = (pane.editors ?? []).find(
          (editor) => editor.view === view,
        );
        if (existingEditor) {
          return {
            ...pane,
            ...mirrorEditorPatchHelper(existingEditor),
            activeEditorId: existingEditor.id,
            view: existingEditor.view,
          };
        }

        return {
          ...pane,
          ...mirrorEditorPatchHelper(newEditor),
          activeEditorId: newEditor.id,
          editors: [...(pane.editors ?? []), newEditor],
          view: newEditor.view,
        };
      }),
    );
    setFocusedPaneId(targetId);
  };

  const openMemoInFocusedSplitPane = (memo: MemoRow) => {
    const nextEditor = createEditorHelper('memo', {
      memoId: memo.id,
      mode: 'existing',
    });

    setIsSplitWorkspaceEnabled(true);
    setSplitPanes((prev) => {
      if (prev.length === 0) {
        const nextPane: MemoSplitPaneState = {
          id: createSplitPaneId(),
          activeEditorId: nextEditor.id,
          editors: [nextEditor],
          ...mirrorEditorPatchHelper(nextEditor),
          view: nextEditor.view,
        };
        setFocusedPaneId(nextPane.id);
        return [nextPane];
      }

      const targetPaneId =
        focusedPaneId && prev.some((pane) => pane.id === focusedPaneId)
          ? focusedPaneId
          : prev[0].id;

      setFocusedPaneId(targetPaneId);
      return prev.map((pane) => {
        if (pane.id !== targetPaneId) {
          return pane;
        }

        const editors =
          pane.editors && pane.editors.length > 0 ? pane.editors : [pane];

        // Already open in this pane → focus that tab instead of a duplicate.
        // The same memo may still be open once in the OTHER pane.
        const existingEditor = editors.find(
          (editor) => editor.view === 'memo' && editor.memoId === memo.id,
        );
        if (existingEditor) {
          return {
            ...pane,
            ...mirrorEditorPatchHelper(existingEditor),
            activeEditorId: existingEditor.id,
            editors,
            view: existingEditor.view,
          };
        }

        return {
          ...pane,
          ...mirrorEditorPatchHelper(nextEditor),
          activeEditorId: nextEditor.id,
          editors: editorsAfterOpenTab(
            editors,
            pane.activeEditorId,
            nextEditor,
          ),
          view: nextEditor.view,
        };
      });
    });
  };

  // 왼쪽 가장자리를 끌면 폭이 커지므로 delta 부호를 뒤집는다.
  const handlePreviewResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const startX = event.clientX;
      const startWidth = previewPanelWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      setSidePanelResizing(true);

      const handleMove = (moveEvent: PointerEvent) => {
        setPreviewPanelWidth(
          clampPreviewPanelWidth(startWidth - (moveEvent.clientX - startX)),
        );
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', cleanup);
        window.removeEventListener('pointercancel', cleanup);
        window.removeEventListener('blur', cleanup);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setSidePanelResizing(false);
        setPreviewPanelWidth((current) => {
          savePreviewPanelWidth(current);
          return current;
        });
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', cleanup);
      window.addEventListener('pointercancel', cleanup);
      window.addEventListener('blur', cleanup);
    },
    [previewPanelWidth],
  );

  // 참조 열기: 패널이 닫혀 있으면 열고, 열려 있으면 내용만 갈아끼운다.
  // 패널이 늘어나지 않으므로 그래프 노드를 연달아 눌러도 누적되지 않는다.
  const handleOpenPreview = useCallback(
    (
      results: NetworkSearchResult[],
      mode: 'detail' | 'list' = 'detail',
      options: Pick<
        PreviewPanelState,
        'isAmbientList' | 'promotionTooltip' | 'showMoreResults'
      > = {},
    ) => {
      if (results.length === 0) return;
      setSidePanelCollapsed(false);
      setActiveSidePanel('preview');
      setPreviewPanel({
        mode,
        ...options,
        result: mode === 'detail' ? results[0] : null,
        results,
      });
    },
    [],
  );

  /**
   * 미리보기 → 실물 탭 승격.
   *
   * 패널이 2개면 포커스되지 않은 쪽에 연다. 포커스 패널에 열면 쓰던
   * 초안이 배경 탭으로 밀려 동시 작업이 깨지기 때문이다. 패널이 1개면
   * 그 패널에 새 탭으로 연다 — 사용자가 단일 패널을 선택한 것이므로
   * 앱이 멋대로 split을 만들지 않는다.
   *
   * 포커스는 옮기지 않는다. 승격 버튼을 누를 때 손은 키보드에 있어서,
   * 포커스가 넘어가면 다음 타이핑이 엉뚱한 곳으로 들어간다.
   */
  const promotePreviewResult = useCallback(
    (result: NetworkSearchResult) => {
      const beside =
        splitPanes.length > 1 &&
        splitPanes.some((pane) => pane.id !== focusedPaneId);
      const detail = { target: beside ? 'beside' : 'focused' } as const;

      if (result.sourceKind === 'inbox' && result.inboxSessionId) {
        window.dispatchEvent(
          new CustomEvent('subnota:open-inbox-source', {
            detail: { ...detail, inboxSessionId: result.inboxSessionId },
          }),
        );
      } else if (result.memoId) {
        window.dispatchEvent(
          new CustomEvent('subnota:open-memo', {
            detail: { ...detail, memoId: result.memoId },
          }),
        );
      }
      setActiveSidePanel(null);
      setPreviewPanel(null);
    },
    [focusedPaneId, splitPanes],
  );

  const toggleScheduleInboxPanel = useCallback(() => {
    setSidePanelCollapsed(false);
    setPreviewPanel(null);
    setActiveSidePanel((current) =>
      current === 'schedule-inbox' ? null : 'schedule-inbox',
    );
  }, []);

  const openScheduleInboxPanel = useCallback(() => {
    setSidePanelCollapsed(false);
    setPreviewPanel(null);
    setActiveSidePanel('schedule-inbox');
  }, []);

  const dropScheduleInboxItem = (itemId: string, startDate: Date) => {
    const item = scheduleInbox.find((candidate) => candidate.id === itemId);
    if (item) {
      void placeScheduleInboxItem(item, { allDay: false, startDate });
    }
  };

  const openGlobalSearchResult = (item: GlobalSearchItem) => {
    if (item.kind === 'memo') {
      const memo = memos.find((candidate) => candidate.id === item.id);
      if (memo) {
        selectMemo(memo);
        openMemoInFocusedSplitPane(memo);
      }
      return;
    }

    if (item.kind === 'topic') {
      openViewAsTab('topics');
      window.requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent('subnota:show-topic-folder', {
            detail: { topicId: item.id },
          }),
        );
      });
      return;
    }

    if (item.kind === 'inbox') {
      // 전역 검색의 링크 결과는 현재 작업을 유지한 채 참고로 연다.
      // Inbox 자체를 탐색할 때만 네비게이션에서 Inbox 탭을 연다.
      window.dispatchEvent(
        new CustomEvent('subnota:open-inbox-source', {
          detail: { inboxSessionId: item.id },
        }),
      );
      return;
    }

    if (item.kind === 'calendar') {
      openViewAsTab('calendar');
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('subnota:open-calendar-block', {
            detail: { blockId: item.id },
          }),
        );
      }, 0);
      return;
    }

    const suggestion = scheduleInbox.find(
      (candidate) => candidate.id === item.id,
    );
    openViewAsTab('calendar');
    if (suggestion && hasScheduledDate(suggestion)) {
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('subnota:open-schedule-suggestion', {
            detail: { itemId: item.id },
          }),
        );
      }, 0);
      return;
    }

    openScheduleInboxPanel();
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('subnota:open-schedule-inbox-item', {
          detail: { itemId: item.id },
        }),
      );
    }, 0);
  };

  const openDraftInFocusedSplitPane = (
    category = DEFAULT_MEMO_CATEGORY,
    forceNewTab = false,
  ) => {
    const nextEditor = createEditorHelper('memo', {
      draftCategory: category,
      draftText: '',
      mode: 'draft',
    });

    setActiveTab('memo');
    setActiveMemoId(null);
    setActiveMemoCreatedAt(new Date().toISOString());
    setActiveDraftCategory(category);
    setAmbientResult(null);
    setIsSplitWorkspaceEnabled(true);
    setSplitPanes((prev) => {
      if (prev.length === 0) {
        const nextPane: MemoSplitPaneState = {
          id: createSplitPaneId(),
          activeEditorId: nextEditor.id,
          editors: [nextEditor],
          ...mirrorEditorPatchHelper(nextEditor),
          view: nextEditor.view,
        };
        setFocusedPaneId(nextPane.id);
        return [nextPane];
      }

      const targetPaneId =
        focusedPaneId && prev.some((pane) => pane.id === focusedPaneId)
          ? focusedPaneId
          : prev[0].id;

      setFocusedPaneId(targetPaneId);
      return prev.map((pane) => {
        if (pane.id !== targetPaneId) {
          return pane;
        }

        const editors =
          pane.editors && pane.editors.length > 0 ? pane.editors : [pane];

        return {
          ...pane,
          ...mirrorEditorPatchHelper(nextEditor),
          activeEditorId: nextEditor.id,
          editors: forceNewTab
            ? editorsAfterNewTab(editors, nextEditor)
            : editorsAfterOpenTab(editors, pane.activeEditorId, nextEditor),
          view: nextEditor.view,
        };
      });
    });
  };

  const handleMemoNavClick = () => {
    const focusedPane = splitPanes.find((pane) => pane.id === focusedPaneId);
    const memoTabs = splitPanes.flatMap((pane) =>
      getAppPaneEditors(pane)
        .filter((editor) => editor.view === 'memo')
        .map((editor) => ({ editor, pane })),
    );
    const focusedEditor = focusedPane
      ? getAppActiveEditor(focusedPane)
      : undefined;
    const action = decideMemoNavAction({
      hasMemoTab: memoTabs.length > 0,
      isMemoTabFocused: activeTab === 'memo' && focusedEditor?.view === 'memo',
    });

    if (action === 'create-new') {
      openDraftInFocusedSplitPane(DEFAULT_MEMO_CATEGORY, true);
      return;
    }

    // Prefer a memo tab in the currently focused panel; otherwise use the
    // first memo tab in panel order so the rail always has a deterministic
    // target to focus.
    const target =
      (focusedPane
        ? memoTabs.find((item) => item.pane.id === focusedPane.id)
        : undefined) ?? memoTabs[0];
    if (!target) {
      openDraftInFocusedSplitPane(DEFAULT_MEMO_CATEGORY, true);
      return;
    }

    setActiveTab('memo');
    setFocusedPaneId(target.pane.id);
    if (target.editor.memoId) {
      selectMemoById(target.editor.memoId);
    } else {
      setActiveMemoId(null);
      setActiveMemoCreatedAt(new Date().toISOString());
      setActiveDraftCategory(
        target.editor.draftCategory ?? DEFAULT_MEMO_CATEGORY,
      );
    }
    setSplitPanes((prev) =>
      prev.map((pane) => {
        if (pane.id !== target.pane.id) {
          return pane;
        }
        return {
          ...pane,
          ...mirrorEditorPatchHelper(target.editor),
          activeEditorId: target.editor.id,
          editors: getAppPaneEditors(pane),
          view: target.editor.view,
        };
      }),
    );
  };

  const focusRelativePane = (offset: number) => {
    if (splitPanes.length < 2) return;
    const currentIndex = Math.max(
      0,
      splitPanes.findIndex((pane) => pane.id === focusedPaneId),
    );
    const nextIndex =
      (currentIndex + offset + splitPanes.length) % splitPanes.length;
    setFocusedPaneId(splitPanes[nextIndex].id);
  };

  const focusRelativeTab = (offset: number) => {
    const pane =
      splitPanes.find((candidate) => candidate.id === focusedPaneId) ??
      splitPanes[0];
    if (!pane) return;

    const editors = getAppPaneEditors(pane);
    const nextEditor = editorAtRelativeTab(
      editors,
      pane.activeEditorId,
      offset,
    );
    if (!nextEditor) return;

    setActiveTab('memo');
    setFocusedPaneId(pane.id);
    if (nextEditor.memoId) {
      selectMemoById(nextEditor.memoId);
    }
    setSplitPanes((previous) =>
      previous.map((candidate) =>
        candidate.id === pane.id
          ? {
              ...candidate,
              ...mirrorEditorPatchHelper(nextEditor),
              activeEditorId: nextEditor.id,
              editors: getAppPaneEditors(candidate),
              view: nextEditor.view,
            }
          : candidate,
      ),
    );
  };

  const closeActiveTab = () => {
    const pane =
      splitPanes.find((candidate) => candidate.id === focusedPaneId) ??
      splitPanes[0];
    if (!pane) return;

    const editors = getAppPaneEditors(pane);
    const activeEditor = getAppActiveEditor(pane);
    if (editors.length <= 1) {
      handleClosePane(pane.id);
      return;
    }

    const { activeEditor: nextEditor, editors: nextEditors } =
      editorsAfterCloseTab(editors, activeEditor.id, activeEditor.id);
    if (!nextEditor) return;

    setFocusedPaneId(pane.id);
    if (nextEditor.memoId) {
      selectMemoById(nextEditor.memoId);
    }
    setSplitPanes((previous) =>
      previous.map((candidate) =>
        candidate.id === pane.id
          ? {
              ...candidate,
              ...mirrorEditorPatchHelper(nextEditor),
              activeEditorId: nextEditor.id,
              editors: nextEditors,
              view: nextEditor.view,
            }
          : candidate,
      ),
    );
  };

  useAppHotkeys(
    {
      createMemo: () => openDraftInFocusedSplitPane(),
      createTab: openNewTabInFocusedSplitPane,
      closeActiveTab,
      createSplitPane: handleAddSplitPane,
      focusNextPane: () => focusRelativePane(1),
      focusPreviousPane: () => focusRelativePane(-1),
      focusNextTab: () => focusRelativeTab(1),
      focusPreviousTab: () => focusRelativeTab(-1),
      openCalendar: () => openViewAsTab('calendar'),
      openInbox: () => openViewAsTab('inbox'),
      openMemos: () => setActiveTab('memo'),
      openTopics: () => openViewAsTab('topics'),
      // 추천이 떠 있을 때만 반응한다. 안 떠 있으면 조용히 무시해서
      // 다른 곳에서 누른 Mod+Enter를 삼키지 않는다.
      openAmbientDetail: () => {
        if (ambientResult) {
          handleOpenPreview([ambientResult], 'detail', {
            promotionTooltip: t('새 메모 탭으로 열기', 'Open in a new note tab'),
            showMoreResults: true,
          });
        }
      },
      openAmbientList: () => {
        if (ambientResult) void openAmbientListInPreview();
      },
      openSettings: () => setSettingsOpen(true),
      toggleSidebar: toggleSession,
    },
    appShortcuts,
  );

  useEffect(
    () =>
      window.electronAPI?.onNewMemo?.(() => {
        openDraftInFocusedSplitPane();
      }) ?? (() => undefined),
    [focusedPaneId, splitPanes],
  );

  const pendingSyncCount = useMemo(
    () =>
      memos.filter((item) => item.local_sync_status?.startsWith('pending'))
        .length +
      calendarBlocks.filter((item) =>
        item.local_sync_status?.startsWith('pending'),
      ).length +
      inboxItems.filter(
        (item) =>
          (item as InboxSession & { local_sync_status?: string })
            .local_sync_status === 'pending',
      ).length,
    [calendarBlocks, inboxItems, memos],
  );

  const failedSyncCount = useMemo(
    () =>
      memos.filter((item) => item.local_sync_status === 'failed').length +
      calendarBlocks.filter((item) => item.local_sync_status === 'failed')
        .length +
      inboxItems.filter(
        (item) =>
          (item as InboxSession & { local_sync_status?: string })
            .local_sync_status === 'failed',
      ).length,
    [calendarBlocks, inboxItems, memos],
  );

  const updateAppSettings = (next: AppSettings) => {
    setAppSettings(saveAppSettings(next));
  };

  useEffect(() => {
    if (activeTab !== 'memo' || splitPanes.length > 0) {
      return;
    }

    const seedMemo = activeMemo ?? memos[0] ?? null;
    const nextEditor = createEditorHelper(
      'memo',
      seedMemo
        ? {
            memoId: seedMemo.id,
            mode: 'existing',
          }
        : {},
    );
    const nextPane: MemoSplitPaneState = {
      id: createSplitPaneId(),
      activeEditorId: nextEditor.id,
      editors: [nextEditor],
      ...mirrorEditorPatchHelper(nextEditor),
      view: nextEditor.view,
    };

    setIsSplitWorkspaceEnabled(true);
    setSplitPanes([nextPane]);
    setFocusedPaneId(nextPane.id);
  }, [activeMemo, activeTab, memos, splitPanes.length]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // A global sign-out revokes the refresh token on the server and can fail
      // while offline. Fall back to a local sign-out so the persisted session is
      // cleared and the app returns to (and stays on) the auth screen — even
      // after a restart.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignore — we still force-clear the in-memory session below
      }
      deactivateSession();
    }
  };

  const handleDeleteAccount = async () => {
    const ownerId = sessionRef.current?.user.id ?? session?.user.id;
    if (!ownerId) {
      throw new Error(t('계정 삭제를 위해 다시 로그인해 주세요.', 'Sign in again to delete your account.'));
    }

    cancelLocalMemoIndexing();
    cancelLocalInboxIndexing();
    await deleteAccount();
    let localCleanupFailed = false;
    try {
      await clearLocalWorkspaceOwner(ownerId);
    } catch {
      localCleanupFailed = true;
    }
    setAuthNotice(
      localCleanupFailed
        ? t(
            '계정은 삭제되었지만 이 기기의 일부 데이터 정리에 문제가 있습니다. 앱을 다시 시작해 주세요.',
            'Your account was deleted, but some data on this device could not be cleaned up. Please restart the app.',
          )
        : t('계정과 데이터가 삭제되었습니다.', 'Your account and data were deleted.'),
    );
    setSettingsOpen(false);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      deactivateSession();
    }
  };

  const applyShortcutSettings = async (nextSettings: ShortcutSettings) => {
    const normalized = normalizeShortcutSettings(nextSettings);
    const result = await window.electronAPI?.setGlobalShortcuts?.(normalized);
    const accepted = saveShortcutSettings(result?.settings ?? normalized);

    setShortcuts(accepted);
    return result?.registered ?? { capture: true, toggle: true };
  };

  const resetShortcutSettings = () =>
    applyShortcutSettings(DEFAULT_SHORTCUT_SETTINGS);

  const applyAppShortcutSettings = async (
    nextSettings: AppShortcutSettings,
  ) => {
    const accepted = saveAppShortcutSettings(nextSettings);
    setAppShortcuts(accepted);
    return accepted;
  };

  const refreshInbox = async () => {
    const currentSession = session;
    if (!currentSession) {
      const localItems = await loadLocalInboxItems();
      if (sessionRef.current) return;
      const localDeletes = collectPendingInboxDeletes(localItems);
      setInboxItems(
        mergeInboxItems(
          [],
          withoutDeletedPendingInboxItems(
            localItems,
            localDeletes.clientIds,
            localDeletes.ids,
          ),
        ),
      );
      return;
    }
    const ownerId = currentSession.user.id;
    const requestSequence = ++inboxRefreshSequenceRef.current;
    const isCurrentInboxRequest = () =>
      sessionRef.current?.user.id === ownerId &&
      inboxRefreshSequenceRef.current === requestSequence;

    setInboxLoading(true);
    setError(null);
    try {
      // 큐 스냅샷을 먼저 떠 두고, 대기 항목 재전송은 병렬로 돌린다 —
      // 밀린 메모/캘린더 푸시가 목록 표시를 막던 직렬 구조를 푼 것.
      // 재전송으로 큐에서 빠진 항목은 스냅샷으로 계속 표시되고, 서버
      // 반영분은 다음 새로고침에서 합류한다.
      const queuedItems = await loadLocalInboxQueue(ownerId);
      void syncPendingLocalWorkspace(currentSession).catch((error) => {
        console.warn('pending sync skipped (retries on next sync):', error);
      });
      const nextItems = await fetchInboxSessions(currentSession);
      if (!isCurrentInboxRequest()) {
        return;
      }
      const latestLocalInbox = await loadLocalInboxItems(ownerId);
      if (!isCurrentInboxRequest()) return;
      const localDeletes = collectPendingInboxDeletes(latestLocalInbox);
      localDeletes.ids.forEach((id) =>
        pendingInboxDeleteIdsRef.current.add(id),
      );
      localDeletes.clientIds.forEach((clientId) =>
        deletedPendingInboxClientIdsRef.current.add(clientId),
      );
      const currentItems = reconcileRemoteInboxLikes(
        nextItems,
        requestSequence,
      );
      retryDeletedPendingInboxItems(currentSession, currentItems, ownerId);
      const visibleNextItems = withoutDeletedPendingInboxItems(
        currentItems,
        deletedPendingInboxClientIdsRef.current,
        pendingInboxDeleteIdsRef.current,
      );
      const visibleQueuedItems = withoutDeletedPendingInboxItems(
        queuedItems,
        deletedPendingInboxClientIdsRef.current,
        pendingInboxDeleteIdsRef.current,
      );
      await replaceLocalInboxCache(visibleNextItems, ownerId);
      if (!isCurrentInboxRequest()) return;
      setInboxItems(mergeInboxItems(visibleNextItems, visibleQueuedItems));
    } catch (caught) {
      if (!isCurrentInboxRequest()) {
        return;
      }
      // 캐시가 그대로 보이고 탭을 다시 열면 재조회된다. 조용히 넘긴다.
      setError(
        caught instanceof Error
          ? caught.message
          : t('수집함을 불러오지 못했습니다.', 'Could not load saved links.'),
      );
    } finally {
      if (isCurrentInboxRequest()) {
        setInboxLoading(false);
      }
    }
  };

  const inboxSourceLabel = (sourceType: InboxSession['sourceType']) => {
    if (sourceType === 'youtube') return 'YouTube';
    if (sourceType === 'instagram') return 'Instagram';
    return t('링크', 'Link');
  };

  const retryInboxSummary = async (item: InboxSession) => {
    const currentSession = session;
    if (!currentSession) {
      throw new Error(t('요약을 다시 만들려면 로그인해 주세요.', 'Sign in to create the summary again.'));
    }

    const ownerId = currentSession.user.id;
    const updated = await retryInboxSessionSummary(currentSession, item.id);
    if (!isCurrentSession(currentSession)) return;

    await cacheLocalInboxItem(updated, ownerId);
    if (!isCurrentSession(currentSession)) return;
    setInboxItems((previous) =>
      previous.map((previousItem) =>
        previousItem.id === updated.id ? updated : previousItem,
      ),
    );
  };

  // 반환값은 웹 클리핑 알림이 성공/실패를 가리는 데 쓴다. 로컬 우선 저장이라
  // 백엔드 호출이 실패해도(오프라인 큐) 저장 자체는 성공으로 본다.
  /**
   * 수집함의 수동 저장과 웹 클리핑이 같이 쓴다. 실패를 알리는 방법이 서로
   * 달라서 호출자를 받는다 — 수동은 방금 누른 사람이 앞에 있으니 다이얼로그로
   * 알리고, 클리핑은 사용자가 브라우저에 있으므로 창을 띄우지 않는다
   * (메뉴바 표시와 트레이 메뉴가 대신 알린다).
   */
  const saveInboxUrl = async (
    url: string,
    { source = 'clip' }: { source?: 'clip' | 'manual' } = {},
  ): Promise<{ error?: string; summaryStatus?: InboxSummaryStatus }> => {
    const failManually = (message: string) => {
      if (source === 'manual') window.alert(message);
      return { error: message };
    };
    const currentSession = session;
    setError(null);
    const normalizedUrl = normalizeWebUrl(url);
    if (!normalizedUrl) {
      return failManually(
        t(
          'http 또는 https 웹페이지 주소만 저장할 수 있습니다.',
          'Only http or https web addresses can be saved.',
        ),
      );
    }
    if (!currentSession) {
      return failManually(t('링크를 저장하려면 먼저 로그인해 주세요.', 'Sign in before saving a link.'));
    }
    const ownerId = currentSession.user.id;
    const localItem = await createLocalInboxSession(normalizedUrl, ownerId);
    setInboxItems((previous) => [localItem, ...previous]);
    window.electronAPI?.recordInboxSave?.({
      sourceLabel: inboxSourceLabel(localItem.sourceType),
      summaryStatus: localItem.summaryStatus,
      title: localItem.title ?? normalizedUrl,
      url: normalizedUrl,
    });

    try {
      const item = await createInboxSession(currentSession, {
        clientId: localItem.clientId,
        url: normalizedUrl,
      });
      inboxServerIdsByClientIdRef.current.set(localItem.clientId, item.id);
      const discardIfDeleted = async () => {
        const isDeleted =
          deletedPendingInboxClientIdsRef.current.has(localItem.clientId) ||
          (await isLocalInboxSessionDeleted(localItem.clientId, ownerId));
        if (!isDeleted) {
          return false;
        }
        deletedPendingInboxClientIdsRef.current.add(localItem.clientId);
        pendingInboxDeleteIdsRef.current.add(localItem.clientId);
        try {
          await discardDeletedPendingInboxItem(
            currentSession,
            item,
            localItem.clientId,
            ownerId,
          );
        } catch (caught) {
          if (isCurrentSession(currentSession)) {
            setError(
              caught instanceof Error
                ? caught.message
                : t(
                    '수집 항목 삭제를 서버에 반영하지 못했습니다.',
                    'Could not sync the saved-link deletion to the server.',
                  ),
            );
          }
        }
        return true;
      };
      if (await discardIfDeleted()) {
        return {};
      }
      // 캐시에 먼저 쓰고 큐에서 뺀다 — 2.5초 재조회 전에 재시작해도 보인다.
      await cacheLocalInboxItem(item, ownerId);
      if (await discardIfDeleted()) {
        return {};
      }
      const removedPendingItem = await removeLocalInboxSessionIfNotDeleted(
        localItem.clientId,
        ownerId,
      );
      if (!removedPendingItem || (await discardIfDeleted())) {
        if (!removedPendingItem) {
          deletedPendingInboxClientIdsRef.current.add(localItem.clientId);
          pendingInboxDeleteIdsRef.current.add(localItem.clientId);
          await discardDeletedPendingInboxItem(
            currentSession,
            item,
            localItem.clientId,
            ownerId,
          );
        }
        return {};
      }
      if (!isCurrentSession(currentSession)) {
        return {};
      }
      inboxServerIdsByClientIdRef.current.delete(localItem.clientId);
      setInboxItems((previous) => [
        item,
        ...previous.filter(
          (previousItem) =>
            previousItem.id !== localItem.id && previousItem.id !== item.id,
        ),
      ]);
      window.electronAPI?.recordInboxSave?.({
        sourceLabel: inboxSourceLabel(item.sourceType),
        summaryStatus: item.summaryStatus,
        title:
          item.title ?? item.originalUrl ?? item.canonicalUrl ?? normalizedUrl,
        url: item.originalUrl ?? item.canonicalUrl ?? normalizedUrl,
      });
      window.setTimeout(() => {
        void refreshInbox();
      }, 2500);
      // 알림 문구가 "저장은 됐지만 요약은 실패"를 구분할 수 있게 실어 보낸다.
      return { summaryStatus: item.summaryStatus };
    } catch (caught) {
      if (!isCurrentSession(currentSession)) {
        return {};
      }
      if (deletedPendingInboxClientIdsRef.current.has(localItem.clientId)) {
        return {};
      }
      setError(
        caught instanceof Error
          ? appSettings.uiLanguage === 'en'
            ? `${caught.message} Saved to the offline queue.`
            : `${caught.message} 오프라인 큐에 저장했습니다.`
          : t('오프라인 큐에 저장했습니다.', 'Saved to the offline queue.'),
      );
    }
    return {};
  };

  // Optimistic like toggle; roll back and surface the error if the write fails.
  const toggleInboxLike = (id: string, liked: boolean) => {
    const currentSession = session;
    if (!currentSession) return;
    const ownerId = currentSession.user.id;
    const revision = (inboxLikeRevisionsRef.current.get(id) ?? 0) + 1;
    inboxLikeRevisionsRef.current.set(id, revision);
    const pendingCount = inboxLikePendingCountsRef.current.get(id) ?? 0;
    if (pendingCount === 0) {
      inboxConfirmedLikesRef.current.set(id, !liked);
    }
    inboxLikePendingCountsRef.current.set(id, pendingCount + 1);
    const settleMutation = (confirmedLiked?: boolean) => {
      if (confirmedLiked !== undefined) {
        inboxConfirmedLikesRef.current.set(id, confirmedLiked);
      }
      const remaining = Math.max(
        0,
        (inboxLikePendingCountsRef.current.get(id) ?? 1) - 1,
      );
      if (remaining === 0) {
        inboxLikePendingCountsRef.current.delete(id);
      } else {
        inboxLikePendingCountsRef.current.set(id, remaining);
      }
    };
    const isLatest = () => inboxLikeRevisionsRef.current.get(id) === revision;

    inboxLatestLikesRef.current.set(id, liked);
    inboxLikeRefreshFloorRef.current.set(
      id,
      inboxRefreshSequenceRef.current + 1,
    );
    setInboxItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, liked } : item)),
    );
    void setInboxLiked(currentSession, id, liked).then(
      async () => {
        if (sessionRef.current?.user.id !== ownerId) return;
        // Requests are serialized per item, so each success advances the last
        // confirmed server value even when a newer optimistic click exists.
        settleMutation(liked);
        if (!isLatest()) {
          return;
        }
        inboxLatestLikesRef.current.set(id, liked);
        inboxLikeRefreshFloorRef.current.set(
          id,
          inboxRefreshSequenceRef.current + 1,
        );
        // A GET that started before this PATCH may finish later. Reassert the
        // confirmed latest value now and let only a later refresh replace it.
        setInboxItems((previous) =>
          previous.map((item) => (item.id === id ? { ...item, liked } : item)),
        );
        // 로컬 캐시에도 반영 — 다음 fetch 전에 재시작해도 하트가 유지된다.
        try {
          const cached = (await loadLocalInboxItems(ownerId)).find(
            (item) => item.id === id,
          );
          if (cached && isLatest()) {
            await cacheLocalInboxItem({ ...cached, liked }, ownerId);
          }
        } catch {
          // 캐시 반영 실패는 무시 — 서버가 진실이고 다음 fetch가 맞춘다.
        }
      },
      () => {
        if (sessionRef.current?.user.id !== ownerId) return;
        settleMutation();
        if (!isLatest()) {
          return;
        }
        const confirmedLiked = inboxConfirmedLikesRef.current.get(id) ?? !liked;
        inboxLatestLikesRef.current.set(id, confirmedLiked);
        inboxLikeRefreshFloorRef.current.set(
          id,
          inboxRefreshSequenceRef.current + 1,
        );
        setInboxItems((previous) =>
          previous.map((item) =>
            item.id === id ? { ...item, liked: confirmedLiked } : item,
          ),
        );
        window.alert(
          t(
            '좋아요를 저장하지 못했습니다.\n잠시 뒤 다시 눌러 주세요.',
            'Could not save your like.\nPlease try again shortly.',
          ),
        );
      },
    );
  };

  const deleteInboxItem = (id: string) => {
    if (!window.confirm(t('수집한 링크를 삭제하시겠습니까?', 'Delete this saved link?'))) {
      return;
    }

    const currentSession = session;
    const deletedItem = inboxItems.find((item) => item.id === id);
    if (!currentSession || !deletedItem) return;
    const ownerId = currentSession.user.id;
    const pendingClientId =
      deletedItem?.clientId && deletedItem.id === deletedItem.clientId
        ? deletedItem.clientId
        : null;
    inboxLikeRevisionsRef.current.set(
      id,
      (inboxLikeRevisionsRef.current.get(id) ?? 0) + 1,
    );
    pendingInboxDeleteIdsRef.current.add(id);
    if (deletedItem.clientId) {
      deletedPendingInboxClientIdsRef.current.add(deletedItem.clientId);
    }
    setInboxItems((previous) => previous.filter((item) => item.id !== id));

    // Every delete, including a known server row, is durable before the remote
    // request. This keeps a concurrent refresh or another renderer from
    // resurrecting the card while DELETE/POST is still in flight.
    const tombstoneWrite = markLocalInboxSessionDeleted(
      deletedItem,
      ownerId,
    ).then(() => undefined);
    const tombstoneKey = `${ownerId}:${id}`;
    pendingInboxTombstoneWritesRef.current.set(tombstoneKey, tombstoneWrite);
    void (async () => {
      try {
        await tombstoneWrite;
      } catch (caught) {
        pendingInboxDeleteIdsRef.current.delete(id);
        if (deletedItem.clientId) {
          deletedPendingInboxClientIdsRef.current.delete(deletedItem.clientId);
        }
        if (sessionRef.current?.user.id === ownerId) {
          setInboxItems((previous) =>
            previous.some((item) => item.id === id)
              ? previous
              : [deletedItem, ...previous],
          );
          window.alert(
            t(
              '링크를 삭제하지 못했습니다.\n잠시 뒤 다시 시도해 주세요.',
              'Could not delete the link.\nPlease try again shortly.',
            ),
          );
        }
        if (
          pendingInboxTombstoneWritesRef.current.get(tombstoneKey) ===
          tombstoneWrite
        ) {
          pendingInboxTombstoneWritesRef.current.delete(tombstoneKey);
        }
        return;
      }

      try {
        if (pendingClientId) {
          const serverId =
            inboxServerIdsByClientIdRef.current.get(pendingClientId);
          if (serverId) {
            await discardDeletedPendingInboxItem(
              currentSession,
              { ...deletedItem, id: serverId },
              pendingClientId,
              ownerId,
            );
          } else {
            const deleted = await deleteInboxSessionByClientId(
              currentSession,
              pendingClientId,
            );
            if (deleted) {
              await removeLocalInboxSession(pendingClientId, ownerId);
              deletedPendingInboxClientIdsRef.current.delete(pendingClientId);
              pendingInboxDeleteIdsRef.current.delete(pendingClientId);
            }
          }
          return;
        }

        await deleteInboxSession(currentSession, id);
        await removeLocalInboxSession(id, ownerId);
        pendingInboxDeleteIdsRef.current.delete(id);
        if (deletedItem.clientId) {
          deletedPendingInboxClientIdsRef.current.delete(deletedItem.clientId);
        }
      } catch (caught) {
        if (sessionRef.current?.user.id === ownerId) {
          setError(
            caught instanceof Error
              ? caught.message
              : t(
                  '수집 항목 삭제를 서버에 반영하지 못했습니다.',
                  'Could not sync the saved-link deletion to the server.',
                ),
          );
        }
      } finally {
        if (
          pendingInboxTombstoneWritesRef.current.get(tombstoneKey) ===
          tombstoneWrite
        ) {
          pendingInboxTombstoneWritesRef.current.delete(tombstoneKey);
        }
      }
    })();
  };

  const saveInboxUrlRef = useRef(saveInboxUrl);
  saveInboxUrlRef.current = saveInboxUrl;
  // 알림 클릭은 등록 시점이 아니라 클릭 시점의 최신 함수를 써야 한다.
  const openViewAsTabRef = useRef(openViewAsTab);
  openViewAsTabRef.current = openViewAsTab;

  // Menu-bar / global-hotkey browser capture and subnota://capture deep links
  // arrive from the main process and flow into the inbox queue.
  useEffect(() => {
    return window.electronAPI?.onInboxCapture?.((payload) => {
      if (payload.error) {
        setError(payload.error);
        notifyClipFailed(payload.error);
        return;
      }
      if (!payload.url) {
        return;
      }
      const url = payload.url;
      void saveInboxUrlRef.current(url).then((result) => {
        if (result.error) {
          notifyClipFailed(result.error);
          return;
        }
        notifyClipSaved(
          payload.title || url,
          () => {
            window.electronAPI?.showMainWindow?.();
            openViewAsTabRef.current('inbox');
          },
          result.summaryStatus,
        );
      });
    });
  }, []);

  const restoreLocalDataFromFile = useCallback(
    async (file: File) => {
      const unlock = await acquireLocalWriteGuard();
      try {
        try {
          await flushRendererLocalWrites();
        } catch {
          // The user explicitly confirmed replacement, so a settled failed
          // write need not block restore. Keep it retained until the swap
          // succeeds, though: if restore rolls back, the next quit must retry
          // or block instead of silently forgetting that content.
        }
        confirmedRestoreMaintenanceRef.current = true;
        try {
          await window.electronAPI.restoreLocalData(
            window.electronAPI.getFilePath(file),
          );
        } finally {
          confirmedRestoreMaintenanceRef.current = false;
        }
        // Main reloads every app window after the atomic swap. A renderer that
        // fails to reload must stay guarded: letting its stale pre-restore
        // state write into the restored database would mix both workspaces.
      } catch (caught) {
        unlock();
        throw caught;
      }
    },
    [acquireLocalWriteGuard, flushRendererLocalWrites],
  );

  // The Quick Subnota panel writes to the same local store in a separate window;
  // refresh the visible memo list when it notifies us of a save.
  useEffect(() => {
    return window.electronAPI?.onMemosUpdated?.(() => {
      void loadVisibleLocalMemos().then(setMemos);
    });
  }, []);

  const bootPhase = resolveBootPhase({ elapsedMs: bootElapsedMs, isBooting });

  if (isBooting) {
    // Phase B — 로컬이 아직이면 실제 셸 모양의 스켈레톤으로 넘어간다.
    if (bootPhase === 'shell') {
      return <WorkspaceBootSkeleton />;
    }

    // Phase A — 브랜드 모션. 흩어진 메모가 모여 로고가 된다(BootBrandMark).
    // 전부 CSS다. 부팅 화면에 JS 모션 라이브러리를 다시 끌어들이지 말 것 —
    // 가장 먼저 그려져야 하는 화면이 번들 평가를 기다리게 된다.
    return (
      <main className="loading-screen">
        <span className="auth-bg-orb orb-1" />
        <span className="auth-bg-orb orb-2" />
        <div className="boot-card">
          <BootBrandMark variant={bootMarkVariantRef.current} />
          <VisuallyHidden role="status">
            {t('Subnota를 여는 중', 'Opening Subnota')}
          </VisuallyHidden>
        </div>
      </main>
    );
  }

  if (session && isWorkspaceOwnerTransition) {
    return <WorkspaceBootSkeleton />;
  }

  if (!session) {
    return (
      <AuthScreen
        initialError={error}
        initialNotice={authNotice}
        initialResetEmail={pendingResetEmail}
      />
    );
  }

  const hasOpenSidePanel =
    activeSidePanel === 'schedule-inbox' ||
    (activeSidePanel === 'preview' && previewPanel !== null);
  // 남는 워크스페이스가 읽을 만하고(≥ WORKSPACE_MIN_WIDTH) 패널보다 작지
  // 않을 때만 밀어낸다. max(...) 한 줄이 두 조건을 함께 만족시킨다.
  const isSidePanelPushed =
    hasOpenSidePanel &&
    !isSidePanelCollapsed &&
    canPushSidePanel(windowWidth, previewPanelWidth);
  const appShellClassName = [
    'app-shell',
    isSidePanelPushed ? 'side-panel-push' : '',
    isSidePanelResizing || isWindowResizing ? 'side-panel-resizing' : '',
    isSessionRailResizing ? 'session-rail-resizing' : '',
    isSessionCollapsed ? 'session-collapsed' : '',
    isSessionCollapsed && isSidebarCollapseReady
      ? 'sidebar-collapse-ready'
      : '',
    isFloatingNavDismissed ? 'floating-nav-dismissed' : '',
    hasOpenSidePanel ? 'side-panel-open' : '',
    hasOpenSidePanel && isSidePanelCollapsed ? 'side-panel-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const hasPendingUpdate = updateState.status !== 'idle';
  const isUpdateWorking =
    updateState.status === 'downloading' || updateState.status === 'installing';
  const updateActionLabel = isUpdateWorking
    ? t('업데이트 진행 중', 'Updating')
    : updateState.status === 'error'
      ? t('업데이트 다시 시도', 'Retry update')
      : updateState.status === 'available'
        ? t(
            `Subnota ${updateState.update.version} 업데이트 시작`,
            `Update Subnota ${updateState.update.version}`,
          )
        : '';
  const updateActionTooltip = isUpdateWorking
    ? updateState.status === 'downloading'
      ? t('업데이트 다운로드 중', 'Downloading update')
      : t('새 버전 적용 준비 중', 'Preparing update')
    : updateState.status === 'error'
      ? t('업데이트 다시 시도', 'Retry update')
      : updateState.status === 'available'
        ? t(
            `Subnota ${updateState.update.version} 업데이트`,
            `Update Subnota ${updateState.update.version}`,
          )
        : '';

  return (
    <div
      className={appShellClassName}
      style={
        {
          '--app-side-panel-width': `${effectiveSidePanelWidth(
            windowWidth,
            previewPanelWidth,
          )}px`,
          '--session-rail-width': `${sessionRailWidth}px`,
        } as React.CSSProperties
      }
    >
      <div aria-hidden="true" className="app-window-drag" />
      <div
        aria-hidden="true"
        className="nav-rail-reveal-zone"
        onMouseEnter={() => setFloatingNavDismissed(false)}
      />
      <aside
        className="nav-rail"
        onClickCapture={(event) => {
          if (isSessionCollapsed) {
            const button = (event.target as HTMLElement).closest('button');
            if (button instanceof HTMLElement) {
              button.blur();
            }
            setFloatingNavDismissed(true);
          }
        }}
      >
        <TooltipIconButton
          aria-label={t('메모', 'Memos')}
          className={activeTab === 'memo' ? 'nav-item active' : 'nav-item'}
          delay={300}
          onClick={handleMemoNavClick}
          placement="right"
          tooltip={formatHotkeyTooltip(t('메모', 'Memos'), appShortcuts.openMemos)}
        >
          <NotebookText size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label={t('캘린더', 'Calendar')}
          className={`nav-item${hasNewReport ? ' has-badge' : ''}`}
          delay={300}
          onClick={() => openViewAsTab('calendar')}
          placement="right"
          tooltip={formatHotkeyTooltip(
            hasNewReport
              ? t('캘린더 · 새 월간 기록', 'Calendar · new monthly report')
              : t('캘린더', 'Calendar'),
            appShortcuts.openCalendar,
          )}
        >
          <CalendarDays size={22} />
          {hasNewReport && (
            <VisuallyHidden>{t('새 월간 기록', 'New monthly report')}</VisuallyHidden>
          )}
        </TooltipIconButton>
        <TooltipIconButton
          aria-label={t('링크', 'Inbox')}
          className="nav-item"
          delay={300}
          onClick={() => openViewAsTab('inbox')}
          placement="right"
          tooltip={formatHotkeyTooltip(t('링크', 'Inbox'), appShortcuts.openInbox)}
        >
          <AppWindow size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="Topics"
          className="nav-item"
          delay={300}
          onClick={() => openViewAsTab('topics')}
          placement="right"
          tooltip={formatHotkeyTooltip('Topics', appShortcuts.openTopics)}
        >
          <Topics size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label={t('새 탭', 'New tab')}
          className="nav-item nav-new-tab"
          delay={300}
          onClick={openNewTabInFocusedSplitPane}
          placement="right"
          tooltip={formatHotkeyTooltip(t('새 탭', 'New tab'), appShortcuts.createTab)}
        >
          <Plus size={22} />
        </TooltipIconButton>
        <div aria-hidden="true" className="nav-divider nav-mode-divider" />
        <SegmentedControl<MemoSidebarMode>
          aria-label={t('메모 보기 방식', 'Memo view')}
          classNames={{
            control: 'nav-mode-segment-control',
            innerLabel: 'nav-mode-segment-inner-label',
            label: 'nav-mode-segment-label',
            root: 'nav-mode-segment nav-context-item',
          }}
          data={[
            {
              label: (
                <Tooltip label={t('목록', 'List')} openDelay={300} position="right">
                  <span className="nav-mode-segment-icon">
                    {memoSidebarMode === 'time' && (
                      <motion.span
                        animate={{ opacity: 1, scale: 1 }}
                        aria-hidden="true"
                        className="nav-mode-segment-motion-indicator"
                        initial={{ opacity: 0, scale: 0.92 }}
                        transition={{
                          duration: 0.14,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                      />
                    )}
                    <List size={22} />
                    <VisuallyHidden>{t('목록', 'List')}</VisuallyHidden>
                  </span>
                </Tooltip>
              ),
              value: 'time',
            },
            {
              label: (
                <Tooltip label={t('폴더', 'Folders')} openDelay={300} position="right">
                  <span className="nav-mode-segment-icon">
                    {memoSidebarMode === 'folders' && (
                      <motion.span
                        animate={{ opacity: 1, scale: 1 }}
                        aria-hidden="true"
                        className="nav-mode-segment-motion-indicator"
                        initial={{ opacity: 0, scale: 0.92 }}
                        transition={{
                          duration: 0.14,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                      />
                    )}
                    <Folder size={22} />
                    <VisuallyHidden>{t('폴더', 'Folders')}</VisuallyHidden>
                  </span>
                </Tooltip>
              ),
              value: 'folders',
            },
          ]}
          onChange={(mode) => {
            setActiveTab('memo');
            setMemoSidebarMode(mode);
          }}
          orientation="vertical"
          styles={{
            indicator: { display: 'none' },
            root: { background: 'var(--app-color-bg-muted)' },
          }}
          transitionDuration={200}
          transitionTimingFunction="cubic-bezier(0.4, 0, 0.2, 1)"
          value={memoSidebarMode}
          withItemsBorders={false}
        />
        <div className="nav-spacer" />
        <div aria-hidden="true" className="nav-divider nav-utility-divider" />
        {hasPendingUpdate && (
          <TooltipIconButton
            aria-controls={
              isUpdatePopoverOpen ? 'subnota-update-popover' : undefined
            }
            aria-expanded={isUpdatePopoverOpen || undefined}
            aria-label={updateActionLabel}
            className="nav-item nav-utility nav-update-action"
            delay={300}
            disabled={isUpdateWorking}
            onClick={() => void startAvailableUpdate()}
            placement="right"
            tooltip={updateActionTooltip}
          >
            {isUpdateWorking ? (
              <SubnotaSpinner size={22} />
            ) : (
              <Download size={22} />
            )}
            <VisuallyHidden>{updateActionLabel}</VisuallyHidden>
          </TooltipIconButton>
        )}
        <TooltipIconButton
          aria-label={t('설정', 'Settings')}
          className="nav-item nav-utility"
          delay={300}
          onClick={() => setSettingsOpen(true)}
          placement="right"
          tooltip={formatHotkeyTooltip(
            t('설정', 'Settings'),
            DEFAULT_APP_SHORTCUT_SETTINGS.openSettings,
          )}
        >
          <Settings size={22} />
        </TooltipIconButton>
      </aside>

      <AnimatePresence>
        {isUpdatePopoverOpen && updateState.status !== 'idle' && (
          <UpdatePopover
            errorMessage={
              updateState.status === 'error' ? updateState.message : undefined
            }
            key="subnota-update-popover"
            onDismiss={() => setUpdatePopoverOpen(false)}
            onOpenSettings={() => {
              setUpdatePopoverOpen(false);
              setSettingsOpen(true);
            }}
            onStartUpdate={() => void startAvailableUpdate()}
            status={updateState.status}
            version={updateState.update.version}
          />
        )}
      </AnimatePresence>

      <section className="workspace">
        {activeTab === 'memo' && (
          <div
            className={`memo-workspace-split-layout ${
              isSplitWorkspaceEnabled ? 'split-active' : ''
            }`}
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'row',
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <MemoWorkspace
              activeMemoId={sidebarActiveMemoId}
              isSessionCollapsed={isSessionCollapsed}
              sessionRailWidth={sessionRailWidth}
              onSessionRailWidthChange={setSessionRailWidth}
              isSessionRailResizing={isSessionRailResizing}
              onSessionRailResizeStateChange={setSessionRailResizing}
              onToggleSession={toggleSession}
              memos={memos}
              onDeleteMemoById={(id) => void deleteMemoById(id)}
              onSidebarModeChange={setMemoSidebarMode}
              onSelectMemo={(memo) => {
                selectMemo(memo);
                openMemoInFocusedSplitPane(memo);
              }}
              onTogglePinMemo={togglePinnedMemo}
              pinnedMemoIds={pinnedMemoIds}
              sidebarMode={memoSidebarMode}
              topicClusters={topicClusters}
              topicInboxItems={inboxItems}
              topicInboxMemberships={topicInboxMemberships}
              topicMemberships={topicMemberships}
              workspaceContent={
                <MemoSplitWorkspace
                  ambientEditorId={ambientDisplayEditorId}
                  ambientEmptyEditorId={ambientEmptyEditorId}
                  ambientError={ambientError}
                  ambientPendingEditorId={ambientTarget?.editorId ?? null}
                  ambientResult={ambientResult}
                  onMemoEditorBlur={handleMemoEditorBlur}
                  onBeforeNetworkSearch={async () => {
                    await flushLocalMemoIndexForUser();
                  }}
                  onRunAmbientSearch={runAmbientSearchNow}
                  isTopicsLoading={isRefreshing}
                  onAmbientQuery={updateAmbientTarget}
                  onDismissAmbient={dismissAmbient}
                  appShortcuts={appShortcuts}
                  searchShortcut={shortcuts.openSearch}
                  onOpenPreview={handleOpenPreview}
                  focusedPaneId={focusedPaneId}
                  initialPaneWidths={paneWidths}
                  isSessionCollapsed={isSessionCollapsed}
                  onToggleSession={toggleSession}
                  onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
                  panes={splitPanes}
                  onChangePane={handleChangePane}
                  onMoveEditor={handleMoveEditor}
                  onClosePane={handleClosePane}
                  onCloseAllPanes={handleCloseAllPanes}
                  onAddPane={handleAddSplitPane}
                  onFocusPane={setFocusedPaneId}
                  onPaneWidthsChange={setPaneWidths}
                  canAddPane={splitPanes.length < MAX_SPLIT_PANE_COUNT}
                  memos={memos}
                  memoSaveStates={memoSaveStates}
                  onCreateMemo={createMemoFromContent}
                  onDeleteMemoById={(id) => void deleteMemoById(id)}
                  onUpdateMemo={(id, nextText, previousEditorContent) => {
                    if (id === activeMemoId) {
                      changeMemoDraft(nextText, previousEditorContent);
                    } else {
                      void updateMemoContentById(
                        id,
                        nextText,
                        previousEditorContent,
                      );
                    }
                  }}
                  onRetryMemoSync={(memoId) => {
                    void retryFailedMemoCloudSync(memoId);
                  }}
                  retryingMemoIds={manualMemoSyncRetryIds}
                  onSelectMemoById={selectMemoById}
                  onTogglePinMemo={togglePinnedMemo}
                  pinnedMemoIds={pinnedMemoIds}
                  calendarBlocks={calendarBlocks}
                  calendarCategories={calendarCategories}
                  onCreateCalendarCategory={saveCalendarCategory}
                  onDeleteCalendarCategory={deleteCalendarCategory}
                  onDeleteCalendarBlock={removeCalendarBlock}
                  onSaveCalendarBlock={saveCalendarBlock}
                  onToggleCalendarBlockCompleted={toggleCalendarBlockCompleted}
                  isScheduleInboxPanelOpen={
                    activeSidePanel === 'schedule-inbox'
                  }
                  onDropScheduleInbox={dropScheduleInboxItem}
                  onToggleScheduleInboxPanel={toggleScheduleInboxPanel}
                  hasNewReport={hasNewReport}
                  onOpenReport={openReport}
                  inboxItems={inboxItems}
                  isInboxLoading={isInboxLoading}
                  onRetryInboxSummary={retryInboxSummary}
                  onSaveInboxUrl={(url) =>
                    saveInboxUrl(url, { source: 'manual' })
                  }
                  onToggleInboxLike={toggleInboxLike}
                  onDeleteInboxItem={deleteInboxItem}
                  scheduleInbox={incompleteScheduleInbox}
                  scheduleSuggestions={calendarScheduleSuggestions}
                  onDeleteScheduleInbox={deleteScheduleInboxItem}
                  onPlaceScheduleInbox={(item) => {
                    void placeScheduleInboxItem(item);
                  }}
                  onPlaceScheduleSuggestion={(item, overrides) => {
                    void placeScheduleInboxItem(item, overrides);
                  }}
                  topicClusters={topicClusters}
                  topicUpdatedAt={topicUpdatedAt}
                  topicGlobalEdges={topicGlobalEdges}
                  topicInboxEdges={topicInboxEdges}
                  topicInboxMemberships={topicInboxMemberships}
                  topicMemberships={topicMemberships}
                />
              }
            />
          </div>
        )}
      </section>
      {hasOpenSidePanel && isSidePanelCollapsed && (
        <>
          <div aria-hidden="true" className="app-side-panel-reveal-zone" />
          <div className="app-side-panel-collapsed">
            <TooltipIconButton
              aria-label={t('사이드 패널 열기', 'Open side panel')}
              className="app-side-panel-toggle"
              onClick={() => setSidePanelCollapsed(false)}
              tooltip={t('사이드 패널 열기', 'Open side panel')}
            >
              <PanelRight size={16} />
            </TooltipIconButton>
          </div>
        </>
      )}
      <AnimatePresence initial={false}>
        {hasOpenSidePanel && !isSidePanelCollapsed && (
          <motion.div
            animate={{ x: 0 }}
            className="app-side-panel-slot"
            // Push 모드에서는 그리드 열 자체가 닫힘을 보간한다. 여기서도
            // 슬라이드 exit을 실행하면 트랙이 0으로 줄며 슬롯이 fixed로
            // 바뀌는 한 프레임이 생겨, 뒤의 그래프 캔버스가 잘못 축소된다.
            exit={
              shouldReduceMotion || isSidePanelPushed
                ? undefined
                : { x: '100%' }
            }
            initial={shouldReduceMotion ? false : { x: '100%' }}
            key="app-side-panel"
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    duration: SIDEBAR_COLLAPSE_DURATION_MS / 1000,
                    ease: [0.4, 0, 0.2, 1],
                  }
            }
          >
            {activeSidePanel === 'preview' && previewPanel ? (
              <PreviewPanel
                inboxItems={inboxItems}
                memos={memos}
                onClose={() => {
                  setActiveSidePanel(null);
                  setPreviewPanel(null);
                }}
                onCollapse={() => setSidePanelCollapsed(true)}
                onPromote={promotePreviewResult}
                onResizeStart={handlePreviewResizeStart}
                onRetryInboxSummary={retryInboxSummary}
                onRetry={() => void openAmbientListInPreview()}
                onSelectResult={(result) =>
                  setPreviewPanel((prev) =>
                    prev ? { ...prev, mode: 'detail', result } : prev,
                  )
                }
                onShowMoreResults={() => void openAmbientListInPreview()}
                onShowList={() =>
                  setPreviewPanel((prev) =>
                    prev ? { ...prev, mode: 'list' } : prev,
                  )
                }
                state={previewPanel}
              />
            ) : (
              <aside aria-label={t('일정 저장함', 'Schedule inbox')} className="schedule-inbox-panel">
                <div
                  aria-hidden="true"
                  className="preview-resizer"
                  onPointerDown={handlePreviewResizeStart}
                />
                <header className="schedule-inbox-panel-header">
                  <span className="schedule-inbox-panel-title">
                    {t('일정 저장함', 'Schedule inbox')}
                  </span>
                  <div className="schedule-inbox-panel-actions">
                    <TooltipIconButton
                      aria-label={t('사이드 패널 접기', 'Collapse side panel')}
                      className="schedule-inbox-panel-action side-panel-collapse-action"
                      onClick={() => setSidePanelCollapsed(true)}
                      tooltip={t('사이드 패널 접기', 'Collapse side panel')}
                    >
                      <PanelRightClose size={16} />
                    </TooltipIconButton>
                    <TooltipIconButton
                      aria-label={t('일정 저장함 닫기', 'Close schedule inbox')}
                      className="schedule-inbox-panel-action"
                      onClick={() => setActiveSidePanel(null)}
                      tooltip={t('닫기', 'Close')}
                    >
                      <X size={16} />
                    </TooltipIconButton>
                  </div>
                </header>
                <ScheduleInboxWorkspace
                  compact
                  inboxItems={incompleteScheduleInbox}
                  onDeleteInbox={deleteScheduleInboxItem}
                  onPlaceInbox={(item) => {
                    void placeScheduleInboxItem(item);
                  }}
                />
              </aside>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <GlobalSearchOverlay
        isOpen={isGlobalSearchOpen}
        items={globalSearchItems}
        onClose={() => setGlobalSearchOpen(false)}
        onSelect={openGlobalSearchResult}
      />
      {visibleLocalIndexProgress && (
        <LocalIndexProgress
          onDismiss={() => {
            setModelDownload(null);
            setLocalIndexProgress(null);
          }}
          onRetry={() => {
            const wasModelDownload = modelDownload !== null;
            setModelDownload(null);
            setLocalIndexProgress(null);
            void (async () => {
              if (wasModelDownload) {
                await startModelDownload();
                return;
              }
              // 색인이 실패했어도 원인이 모델이면 다시 색인해 봐야 소용없다.
              // 파일부터 확보한다 — 색인기에 맡기면 관문 없이 조용히 받는다.
              const status = await window.electronAPI?.localEmbedStatus?.();
              if (status && !status.ready) {
                await startModelDownload();
                return;
              }
              await flushLocalMemoIndexForUser();
            })();
          }}
          progress={visibleLocalIndexProgress}
        />
      )}
      <EmbeddingModelGate
        isOpen={isEmbeddingGateOpen}
        onClose={() => setEmbeddingGateOpen(false)}
        onDownload={() => {
          setEmbeddingGateOpen(false);
          void startModelDownload();
        }}
      />
      <MonthlyReportModal
        canGoNext={reportMonth < latestReportMonth}
        isOpen={isReportOpen}
        onClose={() => setReportOpen(false)}
        onNextMonth={() =>
          setReportMonth((current) => shiftMonthKey(current, 1))
        }
        onPrevMonth={() =>
          setReportMonth((current) => shiftMonthKey(current, -1))
        }
        report={monthlyReport}
      />
      <SettingsModal
        appSettings={appSettings}
        appShortcuts={appShortcuts}
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
          if (isMasDistribution) {
            return t(
              'Mac App Store에서 업데이트를 관리합니다.',
              'Updates are managed by the Mac App Store.',
            );
          }
          try {
            const update = await checkForAvailableUpdate();
            return update
              ? appSettings.uiLanguage === 'en'
                ? `Version ${update.version} is available. Use the update button on the left.`
                : `새 버전 ${update.version}을 찾았습니다. 왼쪽 업데이트 버튼을 누르세요.`
              : t('Subnota가 최신 상태입니다.', 'Subnota is up to date.');
          } catch {
            throw new Error(
              t(
                '업데이트를 확인할 수 없습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.',
                'Could not check for updates. Check your network and try again.',
              ),
            );
          }
        }}
        onChooseStorage={async () => {
          const info = await window.electronAPI.chooseLocalStorage();
          if (info) setStorageInfo(info);
          return info;
        }}
        onClose={() => setSettingsOpen(false)}
        onDesktopPreferencesChange={async (preferences) => {
          setDesktopPreferences(
            await window.electronAPI.setDesktopPreferences(preferences),
          );
        }}
        onExportJson={(name, value) =>
          window.electronAPI.exportJson(name, value)
        }
        onOpenStorage={() => window.electronAPI.openLocalStorage()}
        onPasswordReset={async () => {
          const email = session?.user.email;
          if (!email) {
            throw new Error(
              t(
                '비밀번호 재설정 이메일을 확인할 수 없습니다.',
                'Could not find the email address for password reset.',
              ),
            );
          }
          // 설정 버튼도 막고 있지만 여기서 한 번 더 본다. OAuth 계정에
          // 재설정을 보내면 비밀번호가 없던 계정에 로그인 수단을 하나
          // 만들어 주는 셈이라, 화면 쪽 조건 하나에만 기대지 않는다.
          const provider = session?.user?.app_metadata?.provider ?? 'email';
          if (provider !== 'email') {
            throw new Error(
              t(
                '이 계정은 비밀번호를 쓰지 않습니다. 로그인에 사용한 서비스에서 변경해 주세요.',
                'This account does not use a password. Change it through the service you used to sign in.',
              ),
            );
          }
          await sendPasswordResetOtp(email);
          // 코드를 넣을 화면이 로그인 화면에만 있다. 로그인한 채로 두면
          // 메일만 가고 이어서 할 수 있는 것이 없다. 비밀번호를 바꾸는 중에
          // 기존 세션을 살려 두지 않는 편이 안전하기도 하다.
          setPendingResetEmail(email);
          setSettingsOpen(false);
          await handleSignOut();
        }}
        onResetShortcuts={resetShortcutSettings}
        onResetAppShortcuts={() =>
          applyAppShortcutSettings(DEFAULT_APP_SHORTCUT_SETTINGS)
        }
        onDeleteAccount={handleDeleteAccount}
        onRestore={restoreLocalDataFromFile}
        onRestoreFromDialog={async () => {
          const restored = await window.electronAPI.restoreLocalDataFromDialog();
          if (restored) {
            const info = await window.electronAPI.getLocalStorageInfo();
            setStorageInfo(info);
          }
          return restored;
        }}
        onSaveShortcuts={applyShortcutSettings}
        onSaveAppShortcuts={applyAppShortcutSettings}
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
