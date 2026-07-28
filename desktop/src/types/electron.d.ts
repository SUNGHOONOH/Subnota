declare const __APP_VERSION__: string;

// 로컬 임베딩 모델(bge-m3 ONNX q8)의 준비 상태. 모델은 앱에 번들하지 않고
// 첫 사용 시 userData로 내려받으므로, 렌더러가 진행률을 보여줄 수 있어야 한다.
interface LocalEmbeddingStatusBridge {
  downloadedBytes: number;
  error?: string;
  modelId: string;
  ready: boolean;
  state: 'absent' | 'downloading' | 'loading' | 'ready' | 'failed';
  totalBytes: number;
}

interface DesktopPlatformFeatures {
  browserExtensionClipper: boolean;
  captureShortcut: boolean;
  manualLinkCapture: boolean;
  miniSubnota: boolean;
  nativeCurrentPageCapture: boolean;
  platform: 'macos' | 'other' | 'windows';
  recentCapturesInTray: boolean;
  trayQuickMemo: boolean;
  webClipperDeepLinks: boolean;
  webInbox: boolean;
}

interface ElectronAPI {
  getPlatformFeatures: () => DesktopPlatformFeatures;
  onFileOpened: (callback: (filePath: string) => void) => () => void;
  onMiniPrefill: (callback: (text: string) => void) => () => void;
  onMiniRecentInbox: (
    callback: (items: Array<{ title: string; url: string; sourceLabel: string }>) => void,
  ) => () => void;
  onMiniStatus: (callback: (message: string) => void) => () => void;
  closeMini: () => void;
  notifyMiniSaved: () => void;
  showMainWindow: () => void;
  openSettings: () => void;
  recordInboxSave: (item: {
    sourceLabel: string;
    summaryStatus?: 'pending' | 'ready' | 'partial' | 'unsupported' | 'failed';
    title: string;
    url: string;
  }) => void;
  setGlobalShortcuts: (settings: {
    capturePage: string;
    openSearch: string;
    toggleMini: string;
  }) => Promise<{
    registered: { capture: boolean; toggle: boolean };
    settings: { capturePage: string; openSearch: string; toggleMini: string };
  }>;
  suspendGlobalShortcuts: (suspended: boolean) => Promise<void>;
  localEmbedStatus: () => Promise<LocalEmbeddingStatusBridge>;
  localEmbedEnsureModel: () => Promise<LocalEmbeddingStatusBridge>;
  localEmbed: (texts: string[]) => Promise<number[][]>;
  localEmbedForIndex: (texts: string[]) => Promise<number[][]>;
  localEmbedReleaseIndexModel: () => Promise<void>;
  onShortcutSettingsChanged: (
    callback: (settings: {
      capturePage: string;
      openSearch: string;
      toggleMini: string;
    }) => void,
  ) => () => void;
  onMemosUpdated: (callback: () => void) => () => void;
  onOpenSettings: (callback: () => void) => () => void;
  onNewMemo: (callback: () => void) => () => void;
  onInboxCapture: (
    callback: (payload: { url?: string; title?: string; error?: string }) => void,
  ) => () => void;
  readFile: (filePath: string) => Promise<{ path: string; content: string }>;
  checkForUpdate: () => Promise<{ version: string; downloadUrl: string } | null>;
  onUpdateDownloaded: (
    callback: (info: { releaseName: string; updateUrl: string }) => void,
  ) => () => void;
  installUpdate: () => Promise<void>;
  openExternal: (url: string) => Promise<boolean>;
  openLocalFile: (filePath: string) => Promise<boolean>;
  saveFile: (filePath: string, content: string) => Promise<void>;
  getFilePath: (file: File) => string;
  onSaveBeforeClose: (callback: () => void) => () => void;
  notifySaveComplete: () => void;
  setFilePath: (filePath: string) => Promise<void>;
  setAuthWindowMode: (isAuthMode: boolean) => Promise<boolean>;
  startOAuth: (authUrl: string) => Promise<string>;
  cancelOAuth: () => Promise<void>;
  consumeOAuthCallback: () => Promise<{
    code: string | null;
    error: string | null;
  } | null>;
  localDbSetOwner: (ownerId: string | null) => Promise<void>;
  localDbList: (ownerId: string | null, recordType: string) => Promise<unknown[]>;
  localDbUpsert: (
    ownerId: string | null,
    recordType: string,
    recordId: string,
    value: unknown,
  ) => Promise<void>;
  localDbDelete: (
    ownerId: string | null,
    recordType: string,
    recordId: string,
  ) => Promise<void>;
  localDbReplaceSynced: (
    ownerId: string | null,
    recordType: string,
    values: unknown[],
  ) => Promise<unknown[]>;
  localDbMigrate: (ownerId: string | null, datasets: unknown) => Promise<void>;
  localDbMemoVectorState: (
    ownerId: string | null,
  ) => Promise<
    Array<{
      chunkCount: number;
      memoId: string;
      sourceContentHash: string;
    }>
  >;
  localDbMemoVectorTexts: (
    ownerId: string | null,
    memoId: string,
  ) => Promise<string[]>;
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
  ) => Promise<{ stored: boolean }>;
  localDbDeleteMemoVectors: (
    ownerId: string | null,
    memoId: string,
  ) => Promise<void>;
  localDbSearchMemoVectors: (
    ownerId: string | null,
    queryVector: number[],
    excludeMemoId: string | null,
    limit: number,
    minimumSimilarity: number,
  ) => Promise<
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
  >;
  localDbInboxVectorState: (
    ownerId: string | null,
  ) => Promise<
    Array<{
      inboxSessionId: string;
      sourceContentHash: string;
    }>
  >;
  localDbReplaceInboxVector: (
    ownerId: string | null,
    inboxSessionId: string,
    sourceContentHash: string,
    expectedSourceText: string,
    vector: number[],
  ) => Promise<{ stored: boolean }>;
  localDbDeleteInboxVector: (
    ownerId: string | null,
    inboxSessionId: string,
  ) => Promise<void>;
  localDbSearchInboxVectors: (
    ownerId: string | null,
    queryVector: number[],
    limit: number,
    minimumSimilarity: number,
  ) => Promise<
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
  >;
  getDesktopPreferences: () => Promise<{
    closeBehavior: 'quit' | 'tray';
    launchAtLogin: boolean;
  }>;
  setDesktopPreferences: (preferences: {
    closeBehavior: 'quit' | 'tray';
    launchAtLogin: boolean;
  }) => Promise<{
    closeBehavior: 'quit' | 'tray';
    launchAtLogin: boolean;
  }>;
  getLocalStorageInfo: () => Promise<{
    databasePath: string;
    size: number;
  }>;
  chooseLocalStorage: () => Promise<{
    databasePath: string;
    size: number;
  } | null>;
  openLocalStorage: () => Promise<void>;
  backupLocalData: () => Promise<string | null>;
  restoreLocalData: (filePath: string) => Promise<void>;
  exportJson: (name: string, value: unknown) => Promise<string | null>;
  exportMarkdown: (name: string, content: string) => Promise<string | null>;
}

interface Window {
  electronAPI: ElectronAPI;
}
