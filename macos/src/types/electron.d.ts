declare const __APP_VERSION__: string;

interface ElectronAPI {
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
}

interface Window {
  electronAPI: ElectronAPI;
}
