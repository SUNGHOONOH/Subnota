// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { COLD_START_ARG, DESKTOP_PLATFORM_FEATURES } from './platform/policy';
// 타입 전용 import는 컴파일 시 완전히 제거되므로 main 프로세스 코드가
// preload 번들로 끌려오지 않는다. 상태 모양의 단일 출처를 유지하기 위함.
import type { LocalEmbeddingStatus } from './local-embedding';

type ClipNotificationKind = 'failed' | 'saved';
const LOCAL_WRITE_FLUSH_REASONS = new Set<LocalWriteFlushReason>([
  'database-maintenance',
  'shutdown',
  'window-close',
]);
let clipNotificationSequence = 0;
const pendingClipNotificationClicks = new Map<string, () => void>();

ipcRenderer.on('clip-notification:event', (_event, payload: unknown) => {
  if (!payload || typeof payload !== 'object') return;
  const { action, id } = payload as { action?: unknown; id?: unknown };
  if (
    typeof id !== 'string' ||
    !/^[a-z0-9-]{1,64}$/i.test(id) ||
    (action !== 'click' && action !== 'closed')
  ) {
    return;
  }
  const onClick = pendingClipNotificationClicks.get(id);
  pendingClipNotificationClicks.delete(id);
  if (action === 'click') onClick?.();
});

contextBridge.exposeInMainWorld('electronAPI', {
  // 앱을 켠 뒤 처음 만든 창인가. 창만 다시 연 경우와 구분하려고 main이
  // 창 생성 시 인자로 넘겨 준다(COLD_START_ARG 주석 참고).
  isColdStart: process.argv.includes(COLD_START_ARG),
  getPlatformFeatures: () => DESKTOP_PLATFORM_FEATURES,
  getActiveWorkspaceOwner: (): Promise<string | null> =>
    ipcRenderer.invoke('active-workspace-owner:get'),
  setActiveWorkspaceOwner: (ownerId: string | null): Promise<void> =>
    ipcRenderer.invoke('active-workspace-owner:set', ownerId),
  setUiLanguage: (language: 'en' | 'ko'): Promise<void> =>
    ipcRenderer.invoke('app:set-ui-language', language),
  // Mini를 무엇을 하려고 열었는가. 'link'면 링크 입력란에 포커스를 둔다.
  onMiniMode: (
    callback: (payload: { mode: 'link' | 'memo'; status: string }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { mode: 'link' | 'memo'; status: string },
    ) => callback(payload);
    ipcRenderer.on('mini-mode', listener);
    return () => ipcRenderer.removeListener('mini-mode', listener);
  },
  onMiniPrefill: (callback: (text: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, text: string) => callback(text);
    ipcRenderer.on('mini-prefill', listener);
    return () => ipcRenderer.removeListener('mini-prefill', listener);
  },
  onMiniRecentInbox: (
    callback: (items: Array<{ title: string; url: string; sourceLabel: string }>) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      items: Array<{ title: string; url: string; sourceLabel: string }>,
    ) => callback(items);
    ipcRenderer.on('mini-recent-inbox', listener);
    return () => ipcRenderer.removeListener('mini-recent-inbox', listener);
  },
  onMiniStatus: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => {
      callback(message);
    };
    ipcRenderer.on('mini-status', listener);
    return () => ipcRenderer.removeListener('mini-status', listener);
  },
  onFlushPendingLocalWrites: (
    callback: (reason: LocalWriteFlushReason) => Promise<void>,
  ) => {
    if (typeof callback !== 'function') {
      throw new TypeError('A local write flush callback is required.');
    }
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const { reason, requestId } = payload as {
        reason?: unknown;
        requestId?: unknown;
      };
      if (
        typeof requestId !== 'string' ||
        !/^flush-[a-z0-9]+-[a-z0-9]+$/.test(requestId) ||
        typeof reason !== 'string' ||
        !LOCAL_WRITE_FLUSH_REASONS.has(reason as LocalWriteFlushReason)
      ) {
        return;
      }
      void Promise.resolve()
        .then(() => callback(reason as LocalWriteFlushReason))
        .then(() => {
          ipcRenderer.send('flush-pending-local-writes-complete', {
            ok: true,
            requestId,
          });
        })
        .catch(error => {
          ipcRenderer.send('flush-pending-local-writes-complete', {
            message: (error instanceof Error ? error.message : String(error)).slice(
              0,
              500,
            ),
            ok: false,
            requestId,
          });
        });
    };
    ipcRenderer.on('flush-pending-local-writes', listener);
    return () => ipcRenderer.removeListener('flush-pending-local-writes', listener);
  },
  onLocalWriteFlushCancelled: (callback: () => void) => {
    if (typeof callback !== 'function') {
      throw new TypeError('A local write flush cancellation callback is required.');
    }
    const listener = () => callback();
    ipcRenderer.on('local-write-flush-cancelled', listener);
    return () =>
      ipcRenderer.removeListener('local-write-flush-cancelled', listener);
  },
  closeMini: () => {
    ipcRenderer.send('mini-close');
  },
  notifyMiniSaved: () => {
    ipcRenderer.send('mini-saved');
  },
  captureCurrentPage: () => {
    ipcRenderer.send('mini-capture-page');
  },
  saveMiniLink: (url: string) => {
    ipcRenderer.send('mini-save-link', url);
  },
  showMainWindow: () => {
    ipcRenderer.send('open-main-window');
  },
  hideMainWindow: () => {
    ipcRenderer.send('hide-main-window');
  },
  // Windows에서 창을 닫아 트레이로 내려가는 첫 순간에 한 번 온다.
  onShowTrayHint: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('show-tray-hint', listener);
    return () => ipcRenderer.removeListener('show-tray-hint', listener);
  },
  showClipNotification: async (
    kind: ClipNotificationKind,
    body: string,
    onClick?: () => void,
  ): Promise<boolean> => {
    const id = `${Date.now().toString(36)}-${(++clipNotificationSequence).toString(36)}`;
    if (typeof onClick === 'function') {
      if (pendingClipNotificationClicks.size >= 100) {
        const oldestId = pendingClipNotificationClicks.keys().next().value;
        if (typeof oldestId === 'string') {
          pendingClipNotificationClicks.delete(oldestId);
        }
      }
      pendingClipNotificationClicks.set(id, onClick);
    }
    try {
      const shown = await ipcRenderer.invoke('clip-notification:show', {
        body,
        id,
        kind,
      });
      if (shown !== true) pendingClipNotificationClicks.delete(id);
      return shown === true;
    } catch (error) {
      pendingClipNotificationClicks.delete(id);
      throw error;
    }
  },
  openSettings: () => {
    ipcRenderer.send('open-settings-window');
  },
  recordInboxSave: (item: {
    sourceLabel: string;
    summaryStatus?: 'pending' | 'ready' | 'partial' | 'unsupported' | 'failed';
    title: string;
    url: string;
  }) => {
    ipcRenderer.send('record-inbox-save', item);
  },
  setGlobalShortcuts: (settings: {
    capturePage: string;
    openSearch: string;
    toggleMini: string;
  }) => {
    return ipcRenderer.invoke('set-global-shortcuts', settings);
  },
  suspendGlobalShortcuts: (suspended: boolean) => {
    return ipcRenderer.invoke('suspend-global-shortcuts', suspended);
  },
  onShortcutSettingsChanged: (
    callback: (settings: {
      capturePage: string;
      openSearch: string;
      toggleMini: string;
    }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      settings: {
        capturePage: string;
        openSearch: string;
        toggleMini: string;
      },
    ) => callback(settings);
    ipcRenderer.on('shortcut-settings-changed', listener);
    return () => ipcRenderer.removeListener('shortcut-settings-changed', listener);
  },
  onMemosUpdated: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('memos-updated', listener);
    return () => ipcRenderer.removeListener('memos-updated', listener);
  },
  onOpenSettings: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('open-settings', listener);
    return () => ipcRenderer.removeListener('open-settings', listener);
  },
  onNewMemo: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('new-memo', listener);
    return () => ipcRenderer.removeListener('new-memo', listener);
  },
  onInboxCapture: (
    callback: (payload: { url?: string; title?: string; error?: string }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { url?: string; title?: string; error?: string },
    ) => callback(payload);
    ipcRenderer.on('inbox-capture', listener);
    return () => ipcRenderer.removeListener('inbox-capture', listener);
  },
  checkForUpdate: (): Promise<{ version: string; downloadUrl: string } | null> => {
    return ipcRenderer.invoke('check-for-update');
  },
  downloadUpdate: (): Promise<boolean> => {
    return ipcRenderer.invoke('download-update');
  },
  onUpdateDownloaded: (callback: (info: { releaseName: string; updateUrl: string }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      info: { releaseName: string; updateUrl: string },
    ) => callback(info);
    ipcRenderer.on('auto-update-downloaded', listener);
    return () => ipcRenderer.removeListener('auto-update-downloaded', listener);
  },
  onUpdateError: (callback: (info: { message: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: { message: string }) => {
      callback(info);
    };
    ipcRenderer.on('auto-update-error', listener);
    return () => ipcRenderer.removeListener('auto-update-error', listener);
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('auto-update-not-available', listener);
    return () => ipcRenderer.removeListener('auto-update-not-available', listener);
  },
  installUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('install-update');
  },
  openExternal: (url: string): Promise<boolean> => {
    return ipcRenderer.invoke('open-external', url);
  },
  getFilePath: (file: File) => {
    return webUtils.getPathForFile(file);
  },
  setAuthWindowMode: (isAuthMode: boolean): Promise<boolean> => {
    return ipcRenderer.invoke('set-auth-window-mode', isAuthMode);
  },
  startOAuth: (authUrl: string): Promise<string> => {
    return ipcRenderer.invoke('start-oauth', authUrl);
  },
  cancelOAuth: (): Promise<void> => {
    return ipcRenderer.invoke('cancel-oauth');
  },
  consumeOAuthCallback: (): Promise<{
    code: string | null;
    error: string | null;
  } | null> => {
    return ipcRenderer.invoke('consume-oauth-callback');
  },
  localDbSetOwner: (ownerId: string | null): Promise<void> =>
    ipcRenderer.invoke('local-db:set-owner', ownerId),
  localDbList: (ownerId: string | null, recordType: string): Promise<unknown[]> =>
    ipcRenderer.invoke('local-db:list', ownerId, recordType),
  localDbUpsert: (
    ownerId: string | null,
    recordType: string,
    recordId: string,
    value: unknown,
  ): Promise<void> => ipcRenderer.invoke('local-db:upsert', ownerId, recordType, recordId, value),
  localDbApplyMemoSyncResult: (
    ownerId: string | null,
    memoId: string,
    expectedLocalContent: string,
    value: unknown,
  ): Promise<boolean> =>
    ipcRenderer.invoke(
      'local-db:apply-memo-sync-result',
      ownerId,
      memoId,
      expectedLocalContent,
      value,
    ),
  localDbPatchMemoSyncBase: (
    ownerId: string | null,
    memoId: string,
    syncedContent: string,
    syncedContentHash: string | null,
  ): Promise<unknown | null> =>
    ipcRenderer.invoke(
      'local-db:patch-memo-sync-base',
      ownerId,
      memoId,
      syncedContent,
      syncedContentHash,
    ),
  localDbRestoreMemoSnapshotAfterPull: (
    ownerId: string | null,
    memoId: string,
    value: unknown,
  ): Promise<void> =>
    ipcRenderer.invoke(
      'local-db:restore-memo-snapshot-after-pull',
      ownerId,
      memoId,
      value,
    ),
  localDbDelete: (
    ownerId: string | null,
    recordType: string,
    recordId: string,
  ): Promise<void> => ipcRenderer.invoke('local-db:delete', ownerId, recordType, recordId),
  localDbClearOwner: (ownerId: string | null): Promise<void> =>
    ipcRenderer.invoke('local-db:clear-owner', ownerId),
  localDbDeleteInboxPendingIfNotDeleted: (
    ownerId: string | null,
    recordId: string,
  ): Promise<boolean> =>
    ipcRenderer.invoke(
      'local-db:delete-inbox-pending-if-not-deleted',
      ownerId,
      recordId,
    ),
  localDbReplaceSynced: (
    ownerId: string | null,
    recordType: string,
    values: unknown[],
    preserveIds?: string[],
  ): Promise<unknown[]> =>
    ipcRenderer.invoke(
      'local-db:replace-synced',
      ownerId,
      recordType,
      values,
      preserveIds,
    ),
  localDbMigrate: (ownerId: string | null, datasets: unknown): Promise<void> =>
    ipcRenderer.invoke('local-db:migrate', ownerId, datasets),
  localDbMemoVectorState: (
    ownerId: string | null,
  ): Promise<
    Array<{
      chunkCount: number;
      memoId: string;
      sourceContentHash: string;
    }>
  > => ipcRenderer.invoke('local-db:memo-vector-state', ownerId),
  localDbMemoVectorTexts: (
    ownerId: string | null,
    memoId: string,
  ): Promise<string[]> =>
    ipcRenderer.invoke('local-db:memo-vector-texts', ownerId, memoId),
  localDbReplaceMemoVectors: (
    ownerId: string | null,
    memoId: string,
    sourceContentHash: string,
    expectedContent: string,
    chunks: Array<{
      end: number;
      id: string;
      index: number;
      start: number;
      text: string;
      vector: number[] | null;
    }>,
  ): Promise<{ stored: boolean }> =>
    ipcRenderer.invoke(
      'local-db:replace-memo-vectors',
      ownerId,
      memoId,
      sourceContentHash,
      expectedContent,
      chunks,
    ),
  localDbDeleteMemoVectors: (
    ownerId: string | null,
    memoId: string,
  ): Promise<void> =>
    ipcRenderer.invoke('local-db:delete-memo-vectors', ownerId, memoId),
  localDbSearchMemoVectors: (
    ownerId: string | null,
    queryVector: number[],
    excludeMemoId: string | null,
    limit: number,
    minimumSimilarity: number,
  ): Promise<
    Array<{
      chunkId: string;
      chunkText: string;
      endIndex: number;
      memoContent: string;
      memoCreatedAt: string | null;
      memoId: string;
      memoUpdatedAt: string | null;
      similarity: number;
      startIndex: number;
    }>
  > =>
    ipcRenderer.invoke(
      'local-db:search-memo-vectors',
      ownerId,
      queryVector,
      excludeMemoId,
      limit,
      minimumSimilarity,
    ),
  localDbInboxVectorState: (
    ownerId: string | null,
  ): Promise<
    Array<{
      inboxSessionId: string;
      sourceContentHash: string;
    }>
  > => ipcRenderer.invoke('local-db:inbox-vector-state', ownerId),
  localDbReplaceInboxVector: (
    ownerId: string | null,
    inboxSessionId: string,
    sourceContentHash: string,
    expectedSourceText: string,
    vector: number[],
  ): Promise<{ stored: boolean }> =>
    ipcRenderer.invoke(
      'local-db:replace-inbox-vector',
      ownerId,
      inboxSessionId,
      sourceContentHash,
      expectedSourceText,
      vector,
    ),
  localDbDeleteInboxVector: (
    ownerId: string | null,
    inboxSessionId: string,
  ): Promise<void> =>
    ipcRenderer.invoke(
      'local-db:delete-inbox-vector',
      ownerId,
      inboxSessionId,
    ),
  localDbSearchInboxVectors: (
    ownerId: string | null,
    queryVector: number[],
    limit: number,
    minimumSimilarity: number,
  ): Promise<
    Array<{
      chunkId: string;
      chunkText: string;
      createdAt: string | null;
      inboxSessionId: string;
      similarity: number;
      sourceLabel: string | null;
      sourceType: string | null;
      sourceUrl: string | null;
      thumbnailUrl: string | null;
      title: string | null;
    }>
  > =>
    ipcRenderer.invoke(
      'local-db:search-inbox-vectors',
      ownerId,
      queryVector,
      limit,
      minimumSimilarity,
    ),
  localEmbedStatus: (): Promise<LocalEmbeddingStatus> =>
    ipcRenderer.invoke('local-embed:status'),
  localEmbedDownloadModel: (): Promise<LocalEmbeddingStatus> =>
    ipcRenderer.invoke('local-embed:download-model'),
  localEmbedDeleteModel: (): Promise<LocalEmbeddingStatus> =>
    ipcRenderer.invoke('local-embed:delete-model'),
  localEmbedDiskSpace: (): Promise<{
    freeBytes: number | null;
    requiredBytes: number;
  }> => ipcRenderer.invoke('local-embed:disk-space'),
  localEmbedEnsureModel: (): Promise<LocalEmbeddingStatus> =>
    ipcRenderer.invoke('local-embed:ensure-model'),
  localEmbed: (texts: string[]): Promise<number[][]> =>
    ipcRenderer.invoke('local-embed:embed', texts),
  localEmbedForIndex: (texts: string[]): Promise<number[][]> =>
    ipcRenderer.invoke('local-embed:index', texts),
  localEmbedReleaseIndexModel: (): Promise<void> =>
    ipcRenderer.invoke('local-embed:release-index'),
  getDesktopPreferences: (): Promise<{
    closeBehavior: 'quit' | 'tray';
    launchAtLogin: boolean;
  }> => ipcRenderer.invoke('desktop-preferences:get'),
  setDesktopPreferences: (preferences: {
    closeBehavior: 'quit' | 'tray';
    launchAtLogin: boolean;
  }): Promise<{
    closeBehavior: 'quit' | 'tray';
    launchAtLogin: boolean;
  }> => ipcRenderer.invoke('desktop-preferences:set', preferences),
  getLocalStorageInfo: (): Promise<{
    databasePath: string;
    size: number;
  }> => ipcRenderer.invoke('local-db:storage-info'),
  chooseLocalStorage: (): Promise<{
    databasePath: string;
    size: number;
  } | null> => ipcRenderer.invoke('local-db:choose-storage'),
  openLocalStorage: (): Promise<void> =>
    ipcRenderer.invoke('local-db:open-storage'),
  backupLocalData: (): Promise<string | null> =>
    ipcRenderer.invoke('local-db:backup'),
  restoreLocalData: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('local-db:restore', filePath),
  exportJson: (name: string, value: unknown): Promise<string | null> =>
    ipcRenderer.invoke('local-db:export-json', name, value),
  exportMarkdown: (name: string, content: string): Promise<string | null> =>
    ipcRenderer.invoke('local-db:export-markdown', name, content),
  copyText: (text: string): Promise<boolean> =>
    ipcRenderer.invoke('clipboard:write-text', text),
});
