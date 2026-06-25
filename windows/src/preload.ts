// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpened: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('file-opened', listener);
    return () => ipcRenderer.removeListener('file-opened', listener);
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
  readFile: (filePath: string): Promise<{ path: string; content: string }> => {
    return ipcRenderer.invoke('read-file', filePath);
  },
  checkForUpdate: (): Promise<{ version: string; downloadUrl: string } | null> => {
    return ipcRenderer.invoke('check-for-update');
  },
  onUpdateDownloaded: (callback: (info: { releaseName: string; updateUrl: string }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      info: { releaseName: string; updateUrl: string },
    ) => callback(info);
    ipcRenderer.on('auto-update-downloaded', listener);
    return () => ipcRenderer.removeListener('auto-update-downloaded', listener);
  },
  installUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('install-update');
  },
  openExternal: (url: string): Promise<boolean> => {
    return ipcRenderer.invoke('open-external', url);
  },
  openLocalFile: (filePath: string): Promise<boolean> => {
    return ipcRenderer.invoke('open-local-file', filePath);
  },
  saveFile: (filePath: string, content: string): Promise<void> => {
    return ipcRenderer.invoke('save-file', filePath, content);
  },
  onSaveBeforeClose: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('save-before-close', listener);
    return () => ipcRenderer.removeListener('save-before-close', listener);
  },
  notifySaveComplete: () => {
    ipcRenderer.send('save-complete');
  },
  getFilePath: (file: File) => {
    return webUtils.getPathForFile(file);
  },
  setFilePath: (filePath: string): Promise<void> => {
    return ipcRenderer.invoke('set-file-path', filePath);
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
  localDbDelete: (
    ownerId: string | null,
    recordType: string,
    recordId: string,
  ): Promise<void> => ipcRenderer.invoke('local-db:delete', ownerId, recordType, recordId),
  localDbReplaceSynced: (
    ownerId: string | null,
    recordType: string,
    values: unknown[],
  ): Promise<unknown[]> =>
    ipcRenderer.invoke('local-db:replace-synced', ownerId, recordType, values),
  localDbMigrate: (ownerId: string | null, datasets: unknown): Promise<void> =>
    ipcRenderer.invoke('local-db:migrate', ownerId, datasets),
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
    const listener = (_event: Electron.IpcRendererEvent, message: string) =>
      callback(message);
    ipcRenderer.on('mini-status', listener);
    return () => ipcRenderer.removeListener('mini-status', listener);
  },
  closeMini: () => {
    ipcRenderer.send('mini-close');
  },
  notifyMiniSaved: () => {
    ipcRenderer.send('mini-saved');
  },
  showMainWindow: () => {
    ipcRenderer.send('open-main-window');
  },
  setGlobalShortcuts: (settings: {
    capturePage: string;
    openSearch: string;
    toggleMini: string;
  }) => {
    return ipcRenderer.invoke('set-global-shortcuts', settings);
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
      settings: { capturePage: string; openSearch: string; toggleMini: string },
    ) => callback(settings);
    ipcRenderer.on('shortcut-settings-changed', listener);
    return () => ipcRenderer.removeListener('shortcut-settings-changed', listener);
  },
  onMemosUpdated: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('memos-updated', listener);
    return () => ipcRenderer.removeListener('memos-updated', listener);
  },
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
});
