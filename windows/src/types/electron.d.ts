declare const __APP_VERSION__: string;

interface ElectronAPI {
  onFileOpened: (callback: (filePath: string) => void) => () => void;
  onInboxCapture: (
    callback: (payload: { url?: string; title?: string; error?: string }) => void,
  ) => () => void;
  onOpenSettings: (callback: () => void) => () => void;
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
}

interface Window {
  electronAPI: ElectronAPI;
}
