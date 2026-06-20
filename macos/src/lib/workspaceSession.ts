import type { MemoSplitPaneState } from '../features/memo/components/MemoSplitWorkspace';
import type { TabKey } from '../types';

const WORKSPACE_SESSION_VERSION = 1;
const MAX_PANE_COUNT = 3;
const VALID_TABS = new Set<TabKey>(['memo', 'calendar', 'inbox', 'briefing']);
const VALID_VIEWS = new Set([
  'memo',
  'inbox',
  'calendar',
  'briefing',
  'network',
  'source',
]);

export const WORKSPACE_SESSION_STORAGE_KEY = 'subnota.workspaceSession.v1';

const workspaceSessionKey = (ownerId: string | null) =>
  `${WORKSPACE_SESSION_STORAGE_KEY}.${ownerId ? `user.${ownerId}` : 'guest'}`;

export interface WorkspaceSession {
  activeMemoId: string | null;
  activeTab: TabKey;
  focusedPaneId: string | null;
  isSessionCollapsed: boolean;
  isSplitWorkspaceEnabled: boolean;
  paneWidths: Record<string, number>;
  splitPanes: MemoSplitPaneState[];
  version: 1;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const restorePane = (value: unknown): MemoSplitPaneState | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !VALID_VIEWS.has(String(value.view))
  ) {
    return null;
  }

  const editors = Array.isArray(value.editors)
    ? value.editors
        .filter(
          editor =>
            isRecord(editor) &&
            typeof editor.id === 'string' &&
            VALID_VIEWS.has(String(editor.view)),
        )
        .map(editor => ({
          ...editor,
          networkIsLoading: false,
          networkRequestId: undefined,
        }))
    : undefined;
  const activeEditorId =
    editors?.some(editor => editor.id === value.activeEditorId)
      ? String(value.activeEditorId)
      : editors?.[0]?.id;

  return {
    ...value,
    activeEditorId,
    editors,
    networkIsLoading: false,
    networkRequestId: undefined,
  } as MemoSplitPaneState;
};

export const normalizeWorkspaceSession = (
  value: unknown,
): WorkspaceSession | null => {
  if (!isRecord(value) || value.version !== WORKSPACE_SESSION_VERSION) {
    return null;
  }

  const splitPanes = Array.isArray(value.splitPanes)
    ? value.splitPanes
        .map(restorePane)
        .filter((pane): pane is MemoSplitPaneState => Boolean(pane))
        .slice(0, MAX_PANE_COUNT)
    : [];
  const paneIds = new Set(splitPanes.map(pane => pane.id));
  const focusedPaneId =
    typeof value.focusedPaneId === 'string' && paneIds.has(value.focusedPaneId)
      ? value.focusedPaneId
      : splitPanes[0]?.id ?? null;
  const paneWidths: Record<string, number> = {};
  if (isRecord(value.paneWidths)) {
    for (const [id, width] of Object.entries(value.paneWidths)) {
      if (
        paneIds.has(id) &&
        typeof width === 'number' &&
        Number.isFinite(width) &&
        width >= 16 &&
        width <= 84
      ) {
        paneWidths[id] = width;
      }
    }
  }

  return {
    activeMemoId:
      typeof value.activeMemoId === 'string' ? value.activeMemoId : null,
    activeTab: VALID_TABS.has(value.activeTab as TabKey)
      ? (value.activeTab as TabKey)
      : 'memo',
    focusedPaneId,
    isSessionCollapsed: value.isSessionCollapsed === true,
    isSplitWorkspaceEnabled: value.isSplitWorkspaceEnabled !== false,
    paneWidths,
    splitPanes,
    version: WORKSPACE_SESSION_VERSION,
  };
};

export const loadWorkspaceSession = (ownerId: string | null = null) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(workspaceSessionKey(ownerId));
    return raw ? normalizeWorkspaceSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const saveWorkspaceSession = (
  value: Omit<WorkspaceSession, 'version'>,
  ownerId: string | null = null,
) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(
      workspaceSessionKey(ownerId),
      JSON.stringify({ ...value, version: WORKSPACE_SESSION_VERSION }),
    );
  } catch {
    // Workspace restoration is best-effort and must not interrupt editing.
  }
};
