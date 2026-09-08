import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { Session } from '@supabase/supabase-js';
import {
  isReloadNavigation,
  resolveBootMarkVariant,
  resolveBootPhase,
} from './lib/bootPhase';

import { useAccountActions } from './features/auth/useAccountActions';
import { useSessionLifecycle } from './features/auth/useSessionLifecycle';
import { useAuthSessionBootstrap } from './features/auth/useAuthSessionBootstrap';
import { useEmbeddingModelDownload } from './features/search/useEmbeddingModelDownload';
import { useLocalIndexingLifecycle } from './features/search/useLocalIndexingLifecycle';
import { useGlobalSearchNavigation } from './features/search/useGlobalSearchNavigation';
import { useLocalMemoIndexFlush } from './features/search/useLocalMemoIndexFlush';
import { useAmbientSearchInteraction } from './features/search/useAmbientSearchInteraction';
import { useTopicMapState } from './features/topics/useTopicMapState';
import { useTopicRegeneration } from './features/topics/useTopicRegeneration';
import { useMemoFolderMetadataActions } from './features/memo/useMemoFolderMetadataActions';
import { useMemoFolderMembershipActions } from './features/memo/useMemoFolderMembershipActions';
import { useAutomaticMemoFolderAssignments } from './features/memo/useAutomaticMemoFolderAssignments';
import { useCreateMemoFolderFromTopic } from './features/memo/useCreateMemoFolderFromTopic';
import { useDeleteMemoFolder } from './features/memo/useDeleteMemoFolder';
import MemoWorkspace, {
  SESSION_RAIL_WIDTH,
  type MemoSidebarMode,
} from './features/memo/MemoWorkspace';
import MemoSplitWorkspace, {
  MemoSplitPaneState,
} from './features/memo/components/MemoSplitWorkspace';
import {
  getFolderRecommendations,
} from './features/memo/folderOrganization';
import { useShortcutSettings } from './features/settings/useShortcutSettings';
import { useDesktopPreferences } from './features/settings/useDesktopPreferences';
import {
  countFailedSync,
  countPendingSync,
} from './features/settings/syncStatus';
import UpdatePopover from './features/update/UpdatePopover';
import { type UpdateState, useAppUpdate } from './features/update/useAppUpdate';
import { getUpdateActionPresentation } from './features/update/updateActionPresentation';
import { useAppHotkeys } from './hooks/useAppHotkeys';
import {
  AmbientSearchTarget,
} from './lib/ambientSearch';
import { createUuid } from './lib/contentHash';
import {
  loadPinnedMemoIds,
  savePinnedMemoIds,
  togglePinnedMemoId,
} from './lib/pinnedMemos';
import {
  buildGlobalSearchItems,
} from './lib/globalSearch';
import { registerReconnectSync } from './lib/reconnectSync';
import { createKeyedMutationQueue } from './lib/keyedMutationQueue';
import { useOnlineStatus } from './lib/useOnlineStatus';
import {
  AppSettings,
  applyEditorSettings,
  loadAppSettings,
  saveAppSettings,
} from './lib/appSettings';
import { localize } from './lib/uiLanguage';
import { DEFAULT_APP_SHORTCUT_SETTINGS } from './lib/shortcutSettings';
import { DEFAULT_MEMO_CATEGORY } from './lib/memoCategory';
import { loadWorkspaceSession } from './lib/workspaceSession';
import { InboxSession } from './services/backend/inboxService';
import {
  getLocalWorkspaceOwner,
  loadVisibleLocalMemos,
} from './services/local/offlineStore';
import { type LocalMemoIndexProgress } from './services/local/localMemoIndexer';
import { type NetworkSearchResult } from './services/local/memoSearchTypes';
import {
  sendPasswordResetOtp,
} from './services/supabase/data';
import { shiftMonthKey } from './features/report/monthlyReport';
import { useMonthlyReport } from './features/report/useMonthlyReport';
import { useWorkspacePersistence } from './features/workspace/useWorkspacePersistence';
import { useWorkspaceRestoration } from './features/workspace/useWorkspaceRestoration';
import AppNavRail from './features/workspace/AppNavRail';
import AppOverlayCluster from './features/workspace/AppOverlayCluster';
import AppEntryGate from './features/workspace/AppEntryGate';
import { useWindowViewport } from './features/workspace/useWindowViewport';
import { useRestoreLocalData } from './features/workspace/useRestoreLocalData';
import { useLocalWriteGuard } from './features/workspace/useLocalWriteGuard';
import { useLocalWorkspaceHydration } from './features/workspace/useLocalWorkspaceHydration';
import { useWorkspaceLoader } from './features/workspace/useWorkspaceLoader';
import { getAppShellPresentation } from './features/workspace/appShellPresentation';
import { useInboxLikeActions } from './features/inbox/useInboxLikeActions';
import { useInboxRefresh } from './features/inbox/useInboxRefresh';
import { useInboxItemActions } from './features/inbox/useInboxItemActions';
import { useInboxSummaryActions } from './features/inbox/useInboxSummaryActions';
import { useInboxTombstoneActions } from './features/inbox/useInboxTombstoneActions';
import { useInboxCaptureSubscription } from './features/inbox/useInboxCaptureSubscription';
import { useSplitPaneLifecycle } from './features/memo/useSplitPaneLifecycle';
import { useSplitPaneEditorMovement } from './features/memo/useSplitPaneEditorMovement';
import { useOpenNewTab } from './features/memo/useOpenNewTab';
import { useOpenMemoInFocusedSplitPane } from './features/memo/useOpenMemoInFocusedSplitPane';
import { useOpenDraftInFocusedSplitPane } from './features/memo/useOpenDraftInFocusedSplitPane';
import { useRelativeTabFocus } from './features/memo/useRelativeTabFocus';
import { useCloseActiveTab } from './features/memo/useCloseActiveTab';
import { useMemoNavigation } from './features/memo/useMemoNavigation';
import { useEnsureMemoWorkspacePane } from './features/memo/useEnsureMemoWorkspacePane';
import { useOpenViewAsTab } from './features/memo/useOpenViewAsTab';
import { useMemoSelection } from './features/memo/useMemoSelection';
import { useMemoContentPersistence } from './features/memo/useMemoContentPersistence';
import { useDeleteMemo } from './features/memo/useDeleteMemo';
import { useMemoEditorActions } from './features/memo/useMemoEditorActions';
import { useEnqueueMemoCloudSync } from './features/memo/useEnqueueMemoCloudSync';
import { useMemoCloudSyncActions } from './features/memo/useMemoCloudSyncActions';
import { useMemoCloudRetryScheduler } from './features/memo/useMemoCloudRetryScheduler';
import { useSessionSidebarToggle } from './features/workspace/useSessionSidebarToggle';
import { useScheduleInboxPanelNavigation } from './features/workspace/useScheduleInboxPanelNavigation';
import { syncPendingLocalWorkspace as syncPendingLocalWorkspaceOutbox } from './features/workspace/syncPendingLocalWorkspace';
import { useAmbientListPreview } from './features/search/useAmbientListPreview';
import {
  type MemoCloudSyncInput,
} from './features/memo/memoCloudSync';
import { isCurrentSession as isCurrentAuthSession } from './features/auth/sessionIdentity';
import { type PreviewPanelState } from './features/preview/PreviewPanel';
import { usePreviewPanelActions } from './features/preview/usePreviewPanelActions';
import { usePreviewPanelResize } from './features/preview/usePreviewPanelResize';
import AppSidePanel from './features/workspace/AppSidePanel';
import { useBootLifecycle } from './features/workspace/useBootLifecycle';
import { partitionScheduleInbox } from './features/schedule/scheduleInboxUtils';
import { useScheduleInboxItemActions } from './features/schedule/useScheduleInboxItemActions';
import { useCalendarCompletionActions } from './features/calendar/useCalendarCompletionActions';
import { useDeleteCalendarBlock } from './features/calendar/useDeleteCalendarBlock';
import { useSaveCalendarBlock } from './features/calendar/useSaveCalendarBlock';
import { useCalendarCategoryActions } from './features/calendar/useCalendarCategoryActions';
import {
  loadCalendarCategories,
} from './features/calendar/calendarCategories';
import {
  loadPreviewPanelWidth,
} from './lib/previewPanelWidth';
import {
  ActivityCompletion,
} from './features/report/growthTypes';
import {
  CalendarBlockRow,
  CalendarCategoryRow,
  MemoFolder,
  MemoFolderExclusion,
  MemoFolderMembership,
  MemoRow,
  MemoSaveState,
  ScheduleInboxRow,
  TabKey,
} from './types';

// Local SQLite writes remain immediate. Only coalesce cloud uploads so brief
// pauses while writing do not produce a server round-trip for every draft.
const SAVE_DELAY_MS = 2500;
type AppSidePanelKind = 'preview' | 'schedule-inbox';
const MAX_SPLIT_PANE_COUNT = 2;
const LAST_SYNC_STORAGE_KEY = 'subnota.lastSyncAt.v1';
const SIDEBAR_COLLAPSE_DURATION_MS = 280;
const App = () => {
  const [appSettings, setAppSettings] = useState(loadAppSettings);
  const uiLanguageRef = useRef(appSettings.uiLanguage);
  uiLanguageRef.current = appSettings.uiLanguage;
  const t = useCallback(
    (korean: string, english: string) =>
      localize(uiLanguageRef.current, korean, english),
    [],
  );
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
  const [manualAmbientSearchNotice, setManualAmbientSearchNotice] = useState<{
    id: number;
    startedAt: number;
  } | null>(null);
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
  // Windows에서 창을 닫아 트레이로 내려가는 첫 순간에 메인이 한 번 알려준다.
  const [isTrayHintOpen, setTrayHintOpen] = useState(false);
  useEffect(
    () => window.electronAPI?.onShowTrayHint?.(() => setTrayHintOpen(true)),
    [],
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
  const [memoFolders, setMemoFolders] = useState<MemoFolder[]>([]);
  const [memoFolderExclusions, setMemoFolderExclusions] = useState<
    MemoFolderExclusion[]
  >([]);
  const [memoFolderMemberships, setMemoFolderMemberships] = useState<
    MemoFolderMembership[]
  >([]);
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
  const {
    applyTopicMap,
    clearTopicMap,
    topicClusters,
    topicGlobalEdges,
    topicInboxEdges,
    topicInboxMemberships,
    topicMemberships,
    topicUpdatedAt,
  } = useTopicMapState();
  const { regenerateTopics } = useTopicRegeneration({
    applyTopicMap,
    session,
    t,
  });
  const folderRecommendations = useMemo(
    () =>
      getFolderRecommendations({
        folders: memoFolders,
        memberships: memoFolderMemberships,
        topicClusters,
        topicMemberships,
      }),
    [memoFolderMemberships, memoFolders, topicClusters, topicMemberships],
  );
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
  const { isWindowResizing } = useWindowViewport({ setWindowWidth });
  const [activeSidePanel, setActiveSidePanel] =
    useState<AppSidePanelKind | null>(null);
  const [isSidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [isSidePanelResizing, setSidePanelResizing] = useState(false);
  const { handleOpenPreview, promotePreviewResult } = usePreviewPanelActions({
    focusedPaneId,
    setActiveSidePanel,
    setPreviewPanel,
    setSidePanelCollapsed,
    splitPanes,
  });
  const handlePreviewResizeStart = usePreviewPanelResize({
    previewPanelWidth,
    setPreviewPanelWidth,
    setSidePanelResizing,
  });
  // 검색 모델이 없을 때만 관문을 띄운다. 상태는 물어볼 때 확인한다 —
  // 앱 시작마다 확인하면 모델이 이미 있는 사용자에게 불필요한 IPC가 된다.
  const [isEmbeddingGateOpen, setEmbeddingGateOpen] = useState(false);
  // 관문에서 시작한 다운로드는 색인기를 거치지 않아 구독으로는 진행률이
  // 오지 않는다. 상태를 직접 폴링해 같은 진행 표시에 흘려보낸다.
  const [modelDownload, setModelDownload] =
    useState<LocalMemoIndexProgress | null>(null);
  const startModelDownload = useEmbeddingModelDownload({
    getCurrentOwnerId: () => sessionRef.current?.user.id ?? null,
    getInboxItems: () => inboxItemsRef.current,
    getIndexOwnerId: () => localIndexOwnerIdRef.current,
    getMemos: () => memosRef.current,
    language: appSettings.uiLanguage,
    setModelDownload,
  });
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
  const {
    hasNewReport,
    isReportOpen,
    latestReportMonth,
    monthlyReport,
    openReport,
    reportMonth,
    setReportMonth,
    setReportOpen,
    setSeenReportMonth,
  } = useMonthlyReport({
    activities: activityCompletions,
    currentOwnerId: session?.user.id ?? null,
    edges: topicGlobalEdges,
    initialOwnerId: getLocalWorkspaceOwner(),
    memberships: topicMemberships,
    memos,
    topicClusters,
  });
  const shouldReduceMotion = useReducedMotion();
  const {
    appShortcuts,
    applyAppShortcutSettings,
    applyShortcutSettings,
    resetShortcutSettings,
    shortcuts,
  } = useShortcutSettings({ setGlobalSearchOpen, setSettingsOpen });
  const {
    chooseLocalStorage,
    desktopPreferences,
    openLocalStorage,
    storageInfo,
    updateDesktopPreferences,
  } = useDesktopPreferences();
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(
    () => window.localStorage?.getItem(LAST_SYNC_STORAGE_KEY) ?? null,
  );
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
  const hasHydratedActiveMemoRef = useRef(false);
  const sidebarCollapseTimerRef = useRef<number | null>(null);
  const memoSyncChainsRef = useRef<Map<string, Promise<void>>>(new Map());
  const splitPanesRef = useRef(splitPanes);
  splitPanesRef.current = splitPanes;
  const calendarMutationQueueRef = useRef(createKeyedMutationQueue());
  const folderMutationQueueRef = useRef(createKeyedMutationQueue());
  const folderMembershipMutationQueueRef = useRef(createKeyedMutationQueue());
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
  const inboxRefreshSequenceRef = useRef(0);
  const isPreparingToQuitRef = useRef(false);
  const activeLocalWriteGuardRef = useRef<(() => void) | null>(null);
  const confirmedRestoreMaintenanceRef = useRef(false);
  const localWriteGuardAcquirePromiseRef = useRef<Promise<() => void> | null>(
    null,
  );
  const localWriteGuardUnlockRef = useRef<() => void>(() => undefined);

  const {
    discardDeletedPendingInboxItem,
    retryDeletedPendingInboxItems,
  } = useInboxTombstoneActions({
    deletedPendingInboxClientIdsRef,
    inboxServerIdsByClientIdRef,
    pendingInboxDeleteIdsRef,
    pendingInboxTombstoneWritesRef,
  });

  const isCurrentSession = useCallback((expectedSession: Session) => {
    return isCurrentAuthSession(sessionRef.current, expectedSession);
  }, []);

  const { acquireLocalWriteGuard, flushRendererLocalWrites } =
    useLocalWriteGuard({
      activeLocalWriteGuardRef,
      confirmedRestoreMaintenanceRef,
      isPreparingToQuitRef,
      localWriteGuardAcquirePromiseRef,
      localWriteGuardUnlockRef,
      pendingCalendarLocalWritesRef,
      pendingInboxTombstoneWritesRef,
    });

  const {
    invalidateInboxLike,
    reconcileRemoteInboxLikes,
    reset: resetInboxLikeState,
    toggleInboxLike,
  } = useInboxLikeActions({
    currentSessionRef: sessionRef,
    refreshSequenceRef: inboxRefreshSequenceRef,
    setInboxItems,
    translate: t,
  });

  const { retryInboxSummary } = useInboxSummaryActions({
    currentSession: session,
    isCurrentSession,
    setInboxItems,
    translate: t,
  });

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

  const localIndexOwnerId = session?.user.id ?? null;
  // 다운로드 완료 후 보류했던 색인을 이어서 돌릴 때 최신 소유자가 필요하다.
  const localIndexOwnerIdRef = useRef(localIndexOwnerId);
  localIndexOwnerIdRef.current = localIndexOwnerId;

  useLocalIndexingLifecycle({
    inboxItems,
    isBooting,
    localIndexOwnerId,
    localIndexOwnerIdRef,
    memos,
    sessionRef,
    setEmbeddingGateOpen,
    setLocalIndexProgress,
  });

  const { checkForAvailableUpdate, startAvailableUpdate } = useAppUpdate({
    autoCheckUpdates: appSettings.autoCheckUpdates,
    isWindowsDistribution,
    language: appSettings.uiLanguage,
    setUpdatePopoverOpen,
    setUpdateState,
    updateState,
  });

  useEffect(
    () => () => {
      memoSyncTimersRef.current.forEach((timeout) =>
        window.clearTimeout(timeout),
      );
      memoSyncTimersRef.current.clear();
      if (sidebarCollapseTimerRef.current !== null) {
        window.clearTimeout(sidebarCollapseTimerRef.current);
      }
    },
    [],
  );

  const { cancelMemoCloudRetry, scheduleMemoCloudRetry } =
    useMemoCloudRetryScheduler({
      isCurrentSession,
      memoSyncRetryAttemptsRef,
      memoSyncRetryRunnerRef,
      memoSyncRetryTimersRef,
      memosRef,
    });

  const { toggleSession } = useSessionSidebarToggle({
    collapseDurationMs: SIDEBAR_COLLAPSE_DURATION_MS,
    isSessionCollapsed,
    setFloatingNavDismissed,
    setSessionCollapsed,
    setSidebarCollapseReady,
    sidebarCollapseTimerRef,
  });

  const { enqueueMemoCloudSync } = useEnqueueMemoCloudSync({
    activeMemoIdRef,
    cancelMemoCloudRetry,
    deletingMemoIdsRef,
    isCurrentSession,
    memoSyncChainsRef,
    memoSyncRevisionsRef,
    memosRef,
    pendingLocalMemoWritePromisesRef,
    scheduleMemoCloudRetry,
    setActiveMemoCreatedAt,
    setError,
    setMemos,
    t,
  });

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

  const {
    cancelMemoCloudSync,
    retryFailedMemoCloudSync,
    syncMemoToCloudNow,
  } = useMemoCloudSyncActions({
    cancelMemoCloudRetry,
    enqueueMemoCloudSync,
    memoSyncChainsRef,
    memoSyncRevisionsRef,
    memoSyncRetryRunnerRef,
    memoSyncTimersRef,
    memosRef,
    sessionRef,
    setManualMemoSyncRetryIds,
  });

  useWorkspacePersistence({
    activeMemoId,
    activeTab,
    focusedPaneId,
    isBooting,
    isSessionCollapsed,
    isSplitWorkspaceEnabled,
    ownerId: session?.user.id ?? null,
    paneWidths,
    splitPanes,
  });

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
  const { applyLocalWorkspace, hydrateActiveMemo } =
    useLocalWorkspaceHydration({
      activeMemoIdRef,
      applyTopicMap,
      deletedPendingInboxClientIdsRef,
      hasHydratedActiveMemoRef,
      memosRef,
      pendingInboxDeleteIdsRef,
      pendingLocalMemoWriteOwnersRef,
      setActiveDraftCategory,
      setActiveMemoCreatedAt,
      setActiveMemoId,
      setActivityCompletions,
      setCalendarBlocks,
      setCalendarCategories,
      setInboxItems,
      setLocalWorkspaceReady,
      setMemoFolderExclusions,
      setMemoFolderMemberships,
      setMemoFolders,
      setMemos,
      setScheduleInbox,
      splitPanesRef,
      workspaceLoadIdRef,
    });

  const syncPendingLocalWorkspace = useCallback(
    async (currentSession: Session) => {
      await syncPendingLocalWorkspaceOutbox({
        cancelMemoCloudSync,
        calendarMutationQueueRef,
        currentSession,
        deletedPendingInboxClientIdsRef,
        discardDeletedPendingInboxItem,
        inboxServerIdsByClientIdRef,
        memoSyncTimersRef,
        pendingInboxDeleteIdsRef,
        pendingLocalMemoWriteOwnersRef,
        syncMemoToCloudNow,
      });
    },
    [cancelMemoCloudSync, discardDeletedPendingInboxItem, syncMemoToCloudNow],
  );

  const { refreshInbox } = useInboxRefresh({
    currentSession: session,
    currentSessionRef: sessionRef,
    deletedPendingInboxClientIdsRef,
    pendingInboxDeleteIdsRef,
    refreshSequenceRef: inboxRefreshSequenceRef,
    reconcileRemoteInboxLikes,
    retryDeletedPendingInboxItems,
    setError,
    setInboxItems,
    setInboxLoading,
    syncPendingLocalWorkspace,
    translate: t,
  });

  const { loadWorkspace } = useWorkspaceLoader({
    applyLocalWorkspace,
    applyTopicMap,
    deletedPendingInboxClientIdsRef,
    hydrateActiveMemo,
    inboxRefreshSequenceRef,
    lastSyncStorageKey: LAST_SYNC_STORAGE_KEY,
    memosRef,
    pendingInboxDeleteIdsRef,
    pendingLocalMemoWriteOwnersRef,
    reconcileRemoteInboxLikes,
    retryDeletedPendingInboxItems,
    sessionRef,
    setCalendarBlocks,
    setError,
    setInboxItems,
    setLastSyncAt,
    setMemoFolderExclusions,
    setMemoFolderMemberships,
    setMemoFolders,
    setMemos,
    setRefreshing,
    setScheduleInbox,
    splitPanesRef,
    syncPendingLocalWorkspace,
    t,
    workspaceLoadIdRef,
  });

  const restoreWorkspaceForAccount = useWorkspaceRestoration({
    activeMemoIdRef,
    hasHydratedActiveMemoRef,
    sidebarCollapseTimerRef,
    setActiveDraftCategory,
    setActiveMemoCreatedAt,
    setActiveMemoId,
    setActiveTab,
    setCalendarCategories,
    setFloatingNavDismissed,
    setFocusedPaneId,
    setIsSplitWorkspaceEnabled,
    setPaneWidths,
    setPinnedMemoIds,
    setSeenReportMonth,
    setSessionCollapsed,
    setSidebarCollapseReady,
    setSplitPanes,
  });

  const { activateSession, deactivateSession } = useSessionLifecycle({
    applyLocalWorkspace,
    clearTopicMap,
    deletedPendingInboxClientIdsRef,
    inboxServerIdsByClientIdRef,
    loadWorkspace,
    memosRef,
    memoSyncRetryAttemptsRef,
    memoSyncRetryTimersRef,
    pendingInboxDeleteIdsRef,
    resetInboxLikeState,
    restoreWorkspaceForAccount,
    sessionActivationIdRef,
    sessionRef,
    setActivityCompletions,
    setAuthNotice,
    setCalendarBlocks,
    setError,
    setInboxItems,
    setInboxLoading,
    setLocalWorkspaceReady,
    setManualMemoSyncRetryIds,
    setMemoFolderExclusions,
    setMemoFolderMemberships,
    setMemoFolders,
    setMemoSaveStates,
    setMemos,
    setRefreshing,
    setScheduleInbox,
    setSession,
    setWorkspaceOwnerTransition,
    t,
    workspaceLoadIdRef,
  });

  useAuthSessionBootstrap({
    activateSession,
    applyLocalWorkspace,
    deactivateSession,
    sessionActivationIdRef,
    sessionRef,
    setBooting,
    setError,
    setSession,
    t,
    workspaceLoadIdRef,
  });

  useBootLifecycle({
    bootMarkVariantRef,
    bootStartedAtRef,
    isBooting,
    isLocalWorkspaceReady,
    setBootElapsedMs,
    setBooting,
  });

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

  const { flushLocalMemoIndex, flushLocalMemoIndexForUser } =
    useLocalMemoIndexFlush({
      memosRef,
      pendingLocalMemoWritePromisesRef,
      setEmbeddingGateOpen,
    });

  const {
    dismissAmbient,
    runAmbientSearchNow,
    updateAmbientTarget,
  } = useAmbientSearchInteraction({
    ambientDisplayEditorId,
    ambientEmptyEditorId,
    ambientTarget,
    ambientTargetRef,
    appAmbientAutoSearchEnabled: appSettings.ambientAutoSearchEnabled,
    flushLocalMemoIndex,
    hasSession: Boolean(session),
    setAmbientDisplayEditorId,
    setAmbientEmptyEditorId,
    setAmbientError,
    setAmbientResult,
    setAmbientTarget,
    setManualAmbientSearchNotice,
  });

  const { saveMemoContent } = useMemoContentPersistence({
    cancelMemoCloudRetry,
    deletingMemoIdsRef,
    isCurrentSession,
    isPreparingToQuitRef,
    memosRef,
    memoLocalWriteRevisionsRef,
    memoSyncRevisionsRef,
    pendingLocalMemoWriteOwnersRef,
    pendingLocalMemoWritePromisesRef,
    scheduleMemoCloudSync,
    sessionRef,
    setError,
    setMemoSaveStates,
    setMemos,
    t,
  });

  const { openAmbientListInPreview } = useAmbientListPreview({
    ambientTarget,
    ambientTargetRef,
    flushLocalMemoIndexForUser,
    getLocalWorkspaceOwner,
    handleOpenPreview,
    setActiveSidePanel,
    setAmbientError,
    setPreviewPanel,
    setSidePanelCollapsed,
    t,
  });

  // blur는 사용자가 요청한 적 없는 정리다 — 조용히 처리한다.
  const handleMemoEditorBlur = useCallback(
    (memoId: string) => {
      void flushLocalMemoIndex([memoId]);
    },
    [flushLocalMemoIndex],
  );

  const {
    changeMemoDraft,
    createMemoFromContent,
    updateMemoContentById,
  } = useMemoEditorActions({
    activeDraftCategory,
    activeMemoCreatedAtRef,
    activeMemoIdRef,
    ambientTargetRef,
    saveMemoContent,
    setActiveMemoCreatedAt,
    setActiveMemoId,
    setAmbientError,
    setAmbientResult,
    setAmbientTarget,
    t,
  });

  const { deleteMemoById } = useDeleteMemo({
    activeMemoId,
    cancelMemoCloudSync,
    deletingMemoIdsRef,
    memoLocalWriteRevisionsRef,
    memos,
    memosRef,
    session,
    setActiveDraftCategory,
    setActiveMemoCreatedAt,
    setActiveMemoId,
    setManualMemoSyncRetryIds,
    setMemoSaveStates,
    setMemos,
    t,
  });

  const { selectMemo, selectMemoById } = useMemoSelection({
    activeMemoId,
    ambientTargetRef,
    memos,
    setActiveDraftCategory,
    setActiveMemoCreatedAt,
    setActiveMemoId,
    setActiveTab,
    setAmbientDisplayEditorId,
    setAmbientEmptyEditorId,
    setAmbientError,
    setAmbientResult,
    setAmbientTarget,
  });

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

  const { createMemoFolder, updateMemoFolderDetails, updateMemoFolderMode } =
    useMemoFolderMetadataActions({
      folderMutationQueueRef,
      memoFolders,
      session,
      setMemoFolders,
    });

  const { toggleMemoFolderMembership } = useMemoFolderMembershipActions({
    folderMembershipMutationQueueRef,
    folderMutationQueueRef,
    memoFolderExclusions,
    memoFolderMemberships,
    memoFolders,
    memos,
    session,
    setMemoFolderExclusions,
    setMemoFolderMemberships,
    setMemoFolders,
  });

  const { createMemoFolderFromTopic } = useCreateMemoFolderFromTopic({
    folderMutationQueueRef,
    memoFolders,
    memos,
    session,
    setMemoFolderMemberships,
    setMemoFolders,
    topicClusters,
    topicMemberships,
  });

  const { deleteUserMemoFolder } = useDeleteMemoFolder({
    folderExclusions: memoFolderExclusions,
    folderMemberships: memoFolderMemberships,
    folderMutationQueueRef,
    session,
    setMemoFolderExclusions,
    setMemoFolderMemberships,
    setMemoFolders,
  });

  const createMemoInFolder = async (folderId: string) => {
    const createdAt = new Date().toISOString();
    const memo = saveMemoContent(
      createUuid(),
      '',
      { category: DEFAULT_MEMO_CATEGORY, createdAt },
      undefined,
      true,
    );
    if (!memo) return;
    await toggleMemoFolderMembership(folderId, memo.id);
    selectMemo(memo);
    openMemoInFocusedSplitPane(memo);
  };
  useAutomaticMemoFolderAssignments({ folderMembershipMutationQueueRef, memoFolderExclusions, memoFolderMemberships, memoFolders, session, setMemoFolderMemberships, topicClusters, topicMemberships });

  const { saveCalendarBlock } = useSaveCalendarBlock({
    calendarBlocks,
    calendarMutationQueueRef,
    isCurrentSession,
    session,
    setCalendarBlocks,
    t,
    trackCalendarLocalWrite,
  });

  const {
    deleteScheduleInboxItem,
    dropScheduleInboxItem,
    placeScheduleInboxItem,
  } = useScheduleInboxItemActions({
    isCurrentSession,
    saveCalendarBlock,
    scheduleInbox,
    session,
    setScheduleInbox,
  });

  const { deleteCalendarCategory, saveCalendarCategory } =
    useCalendarCategoryActions({
      calendarBlocks,
      calendarCategories,
      saveCalendarBlock,
      session,
      setCalendarCategories,
    });

  const { toggleCalendarBlockCompleted } = useCalendarCompletionActions({
    calendarBlocks,
    calendarMutationQueueRef,
    isCurrentSession,
    session,
    sessionRef,
    setActivityCompletions,
    setCalendarBlocks,
    t,
    trackCalendarLocalWrite,
  });

  const { removeCalendarBlock } = useDeleteCalendarBlock({
    calendarBlocks,
    calendarMutationQueueRef,
    isCurrentSession,
    session,
    setCalendarBlocks,
    t,
    trackCalendarLocalWrite,
  });

  const {
    handleAddSplitPane,
    handleChangePane,
    handleCloseAllPanes,
    handleClosePane,
  } = useSplitPaneLifecycle({
    focusedPaneId,
    maxPaneCount: MAX_SPLIT_PANE_COUNT,
    setFocusedPaneId,
    setIsSplitWorkspaceEnabled,
    setSplitPanes,
    splitPanes,
  });

  const { handleMoveEditor } = useSplitPaneEditorMovement({
    setFocusedPaneId,
    setSplitPanes,
  });

  const { openNewTabInFocusedSplitPane } = useOpenNewTab({
    focusedPaneId,
    setActiveTab,
    setFocusedPaneId,
    setIsSplitWorkspaceEnabled,
    setSplitPanes,
    splitPanes,
  });

  const { openViewAsTab } = useOpenViewAsTab({
    focusedPaneId,
    onRefreshInbox: refreshInbox,
    setActiveTab,
    setFocusedPaneId,
    setIsSplitWorkspaceEnabled,
    setSplitPanes,
    splitPanes,
  });

  const { openMemoInFocusedSplitPane } = useOpenMemoInFocusedSplitPane({
    focusedPaneId,
    setFocusedPaneId,
    setIsSplitWorkspaceEnabled,
    setSplitPanes,
  });

  const {
    openScheduleInboxPanel,
    toggleScheduleInboxPanel,
  } = useScheduleInboxPanelNavigation({
    setActiveSidePanel,
    setPreviewPanel,
    setSidePanelCollapsed,
  });

  const { openGlobalSearchResult } = useGlobalSearchNavigation({
    memos,
    onOpenMemoInFocusedSplitPane: openMemoInFocusedSplitPane,
    onOpenScheduleInboxPanel: openScheduleInboxPanel,
    onOpenViewAsTab: openViewAsTab,
    onSelectMemo: selectMemo,
    scheduleInbox,
  });

  const { openDraftInFocusedSplitPane } = useOpenDraftInFocusedSplitPane({
    focusedPaneId,
    setActiveDraftCategory,
    setActiveMemoCreatedAt,
    setActiveMemoId,
    setActiveTab,
    setAmbientResult,
    setFocusedPaneId,
    setIsSplitWorkspaceEnabled,
    setSplitPanes,
  });

  const { handleMemoNavClick } = useMemoNavigation({
    activeTab,
    focusedPaneId,
    onOpenDraftInFocusedSplitPane: openDraftInFocusedSplitPane,
    onSelectMemoById: selectMemoById,
    setActiveDraftCategory,
    setActiveMemoCreatedAt,
    setActiveMemoId,
    setActiveTab,
    setFocusedPaneId,
    setSplitPanes,
    splitPanes,
  });

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

  const { focusRelativeTab } = useRelativeTabFocus({
    focusedPaneId,
    onSelectMemoById: selectMemoById,
    setActiveTab,
    setFocusedPaneId,
    setSplitPanes,
    splitPanes,
  });

  const { closeActiveTab } = useCloseActiveTab({
    focusedPaneId,
    handleClosePane,
    onSelectMemoById: selectMemoById,
    setFocusedPaneId,
    setSplitPanes,
    splitPanes,
  });

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
      openMemos: handleMemoNavClick,
      openTopics: () => openViewAsTab('topics'),
      // 추천이 떠 있을 때만 반응한다. 안 떠 있으면 조용히 무시해서
      // 다른 곳에서 누른 Mod+Enter를 삼키지 않는다.
      openAmbientDetail: () => {
        if (ambientResult) {
          handleOpenPreview([ambientResult], 'detail', {
            promotionTooltip: t(
              '새 메모 탭으로 열기',
              'Open in a new note tab',
            ),
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
    () => countPendingSync({ calendarBlocks, inboxItems, memos }),
    [calendarBlocks, inboxItems, memos],
  );

  const failedSyncCount = useMemo(
    () => countFailedSync({ calendarBlocks, inboxItems, memos }),
    [calendarBlocks, inboxItems, memos],
  );

  const updateAppSettings = (next: AppSettings) => {
    setAppSettings(saveAppSettings(next));
  };

  useEnsureMemoWorkspacePane({
    activeMemo,
    activeTab,
    memos,
    setFocusedPaneId,
    setIsSplitWorkspaceEnabled,
    setSplitPanes,
    splitPaneCount: splitPanes.length,
  });

  const { handleDeleteAccount, handleSignOut } = useAccountActions({
    deactivateSession,
    session,
    sessionRef,
    setAuthNotice,
    setSettingsOpen,
    t,
  });

  const { deleteInboxItem, saveInboxUrl } = useInboxItemActions({
    currentSessionRef: sessionRef,
    discardDeletedPendingInboxItem,
    deletedPendingInboxClientIdsRef,
    inboxItems,
    inboxServerIdsByClientIdRef,
    invalidateInboxLike,
    isCurrentSession,
    language: appSettings.uiLanguage,
    pendingInboxDeleteIdsRef,
    pendingInboxTombstoneWritesRef,
    refreshInbox,
    session,
    setError,
    setInboxItems,
    t,
  });

  useInboxCaptureSubscription({
    onCaptureError: setError,
    onOpenInbox: () => {
      window.electronAPI?.showMainWindow?.();
      openViewAsTab('inbox');
    },
    saveInboxUrl,
  });

  const { restoreLocalDataFromFile } = useRestoreLocalData({
    acquireLocalWriteGuard,
    confirmedRestoreMaintenanceRef,
    flushRendererLocalWrites,
  });

  // The Quick Subnota panel writes to the same local store in a separate window;
  // refresh the visible memo list when it notifies us of a save.
  useEffect(() => {
    return window.electronAPI?.onMemosUpdated?.(() => {
      void loadVisibleLocalMemos().then(setMemos);
    });
  }, []);

  const bootPhase = resolveBootPhase({ elapsedMs: bootElapsedMs, isBooting });

  const {
    appShellClassName,
    hasOpenSidePanel,
    isSidePanelPushed,
    sidePanelWidth,
  } = getAppShellPresentation({
    activeSidePanel,
    isFloatingNavDismissed,
    isSessionCollapsed,
    isSessionRailResizing,
    isSidebarCollapseReady,
    isSidePanelCollapsed,
    isSidePanelResizing,
    isWindowResizing,
    previewPanel,
    previewPanelWidth,
    windowWidth,
  });
  const {
    hasPendingUpdate,
    isWorking: isUpdateWorking,
    label: updateActionLabel,
    tooltip: updateActionTooltip,
  } = getUpdateActionPresentation(updateState, t);

  return (
    <AppEntryGate
      authNotice={authNotice}
      bootMarkVariant={bootMarkVariantRef.current}
      bootPhase={bootPhase}
      error={error}
      isBooting={isBooting}
      isSignedIn={Boolean(session)}
      isWorkspaceOwnerTransition={isWorkspaceOwnerTransition}
      language={appSettings.uiLanguage}
      pendingResetEmail={pendingResetEmail}
    >
      <div
        className={appShellClassName}
        style={
          {
            '--app-side-panel-width': `${sidePanelWidth}px`,
            '--session-rail-width': `${sessionRailWidth}px`,
          } as React.CSSProperties
        }
      >
      <div aria-hidden="true" className="app-window-drag" />
      <AppNavRail
        activeTab={activeTab}
        appShortcuts={appShortcuts}
        handleMemoNavClick={handleMemoNavClick}
        hasNewReport={hasNewReport}
        hasPendingUpdate={hasPendingUpdate}
        isSessionCollapsed={isSessionCollapsed}
        isUpdatePopoverOpen={isUpdatePopoverOpen}
        isUpdateWorking={isUpdateWorking}
        memoSidebarMode={memoSidebarMode}
        onCollapsedNavInteraction={() => setFloatingNavDismissed(true)}
        onOpenCalendar={() => openViewAsTab('calendar')}
        onOpenInbox={() => openViewAsTab('inbox')}
        onOpenNewTab={openNewTabInFocusedSplitPane}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenTopics={() => openViewAsTab('topics')}
        onRevealFloatingNav={() => setFloatingNavDismissed(false)}
        onSetActiveTab={setActiveTab}
        onSetMemoSidebarMode={setMemoSidebarMode}
        onStartUpdate={() => void startAvailableUpdate()}
        translate={t}
        updateActionLabel={updateActionLabel}
        updateActionTooltip={updateActionTooltip}
      />

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
              memos={memos}
              onDeleteMemoById={(id) => void deleteMemoById(id)}
              onCreateFolder={createMemoFolder}
              onCreateFolderFromRecommendation={createMemoFolderFromTopic}
              onCreateMemoInFolder={createMemoInFolder}
              onDeleteFolder={deleteUserMemoFolder}
              onSelectMemo={(memo) => {
                selectMemo(memo);
                openMemoInFocusedSplitPane(memo);
              }}
              onTogglePinMemo={togglePinnedMemo}
              onToggleMemoFolder={toggleMemoFolderMembership}
              onUpdateFolderMode={updateMemoFolderMode}
              onUpdateFolderDetails={updateMemoFolderDetails}
              pinnedMemoIds={pinnedMemoIds}
              folders={memoFolders}
              folderMemberships={memoFolderMemberships}
              folderRecommendations={folderRecommendations}
              sidebarMode={memoSidebarMode}
              workspaceContent={
                <MemoSplitWorkspace
                  ambientEditorId={ambientDisplayEditorId}
                  ambientEmptyEditorId={ambientEmptyEditorId}
                  ambientError={ambientError}
                  ambientPendingEditorId={ambientTarget?.editorId ?? null}
                  ambientResult={ambientResult}
                  onMemoEditorBlur={handleMemoEditorBlur}
                  onRunAmbientSearch={runAmbientSearchNow}
                  onCreateFolderFromTopic={createMemoFolderFromTopic}
                  folderSourceTopicIds={memoFolders.flatMap((folder) =>
                    folder.sourceTopicId ? [folder.sourceTopicId] : [],
                  )}
                  isTopicsLoading={isRefreshing}
                  onRegenerateTopics={regenerateTopics}
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
      <AppSidePanel
        activeSidePanel={activeSidePanel}
        collapseDurationMs={SIDEBAR_COLLAPSE_DURATION_MS}
        hasOpenSidePanel={hasOpenSidePanel}
        incompleteScheduleInbox={incompleteScheduleInbox}
        inboxItems={inboxItems}
        isSidePanelCollapsed={isSidePanelCollapsed}
        isSidePanelPushed={isSidePanelPushed}
        memos={memos}
        onClosePreview={() => {
          setActiveSidePanel(null);
          setPreviewPanel(null);
        }}
        onCloseScheduleInbox={() => setActiveSidePanel(null)}
        onCollapse={() => setSidePanelCollapsed(true)}
        onDeleteScheduleInbox={deleteScheduleInboxItem}
        onExpand={() => setSidePanelCollapsed(false)}
        onPlaceScheduleInbox={(item) => {
          void placeScheduleInboxItem(item);
        }}
        onPromotePreview={promotePreviewResult}
        onResizeStart={handlePreviewResizeStart}
        onRetryInboxSummary={retryInboxSummary}
        onRetryPreview={() => void openAmbientListInPreview()}
        onSelectPreviewResult={(result) =>
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
        previewPanel={previewPanel}
        shouldReduceMotion={shouldReduceMotion}
        translate={t}
      />
      <AppOverlayCluster
        embeddingGateProps={{
          isOpen: isEmbeddingGateOpen,
          onClose: () => setEmbeddingGateOpen(false),
          onDownload: () => {
            setEmbeddingGateOpen(false);
            void startModelDownload();
          },
        }}
        globalSearchProps={{
          isOpen: isGlobalSearchOpen,
          items: globalSearchItems,
          onClose: () => setGlobalSearchOpen(false),
          onSelect: openGlobalSearchResult,
        }}
        hasManualAmbientSearchNotice={manualAmbientSearchNotice !== null}
        localIndexProgress={visibleLocalIndexProgress}
        onDismissLocalIndexProgress={() => {
          setModelDownload(null);
          setLocalIndexProgress(null);
        }}
        onRetryLocalIndexProgress={() => {
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
        reportProps={{
          canGoNext: reportMonth < latestReportMonth,
          isOpen: isReportOpen,
          onClose: () => setReportOpen(false),
          onNextMonth: () =>
            setReportMonth((current) => shiftMonthKey(current, 1)),
          onPrevMonth: () =>
            setReportMonth((current) => shiftMonthKey(current, -1)),
          report: monthlyReport,
        }}
        settingsProps={{
          appSettings,
          appShortcuts,
          desktopPreferences,
          email: session?.user?.email,
          failedSyncCount,
          inboxData: inboxItems,
          isOnline,
          isOpen: isSettingsOpen,
          isSignedIn: Boolean(session),
          isSyncing: isRefreshing,
          lastSyncAt,
          pendingSyncCount,
          provider: session?.user?.app_metadata?.provider,
          scheduleData: calendarBlocks,
          shortcuts,
          storageInfo,
          onAppSettingsChange: updateAppSettings,
          onBackup: () => window.electronAPI.backupLocalData(),
          onCheckUpdates: async () => {
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
          },
          onChooseStorage: chooseLocalStorage,
          onClose: () => setSettingsOpen(false),
          onDesktopPreferencesChange: updateDesktopPreferences,
          onExportJson: (name, value) =>
            window.electronAPI.exportJson(name, value),
          onOpenStorage: openLocalStorage,
          onPasswordReset: async () => {
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
          },
          onResetShortcuts: resetShortcutSettings,
          onResetAppShortcuts: () =>
            applyAppShortcutSettings(DEFAULT_APP_SHORTCUT_SETTINGS),
          onDeleteAccount: handleDeleteAccount,
          onRestore: restoreLocalDataFromFile,
          onSaveShortcuts: applyShortcutSettings,
          onSaveAppShortcuts: applyAppShortcutSettings,
          onSignOut: () => {
            setSettingsOpen(false);
            void handleSignOut();
          },
          onSync: () => void loadWorkspace(),
        }}
        trayHintProps={{
          isOpen: isTrayHintOpen,
          onClose: () => {
            setTrayHintOpen(false);
            // 안내 때문에 미뤄 둔 일을 마저 한다 — 사용자는 창을 닫으려던 것이다.
            window.electronAPI?.hideMainWindow?.();
          },
        }}
        translate={t}
      />
      </div>
    </AppEntryGate>
  );
};

export default App;
