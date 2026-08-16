import { autoUpdater } from 'electron';
import { getMacUpdateFeedUrl } from './release-channel';

export interface AutoUpdateDownloadedInfo {
  releaseName: string;
  updateUrl: string;
}

interface ConfigureAutoUpdaterOptions {
  isPackaged: boolean;
  notifyRenderer: (channel: string, info?: unknown) => void;
  onError?: () => void;
  onInstallRequested?: () => void;
}

let configured = false;
let updateCheckStarted = false;

export function configureAutoUpdater({
  isPackaged,
  notifyRenderer,
  onError,
  onInstallRequested,
}: ConfigureAutoUpdaterOptions): boolean {
  if (process.platform !== 'darwin' || !isPackaged || configured) {
    return configured;
  }

  const feedUrl = getMacUpdateFeedUrl();
  if (!feedUrl) return false;

  autoUpdater.setFeedURL({
    url: feedUrl,
    serverType: 'json',
  });

  autoUpdater.on('update-downloaded', (_event, _releaseNotes, releaseName, _releaseDate, updateUrl) => {
    notifyRenderer('auto-update-downloaded', {
      releaseName,
      updateUrl,
    });
  });

  autoUpdater.on('update-not-available', () => {
    updateCheckStarted = false;
    notifyRenderer('auto-update-not-available');
  });

  autoUpdater.on('before-quit-for-update', () => {
    onInstallRequested?.();
  });

  autoUpdater.on('error', (error) => {
    updateCheckStarted = false;
    onError?.();
    console.error('Auto update failed:', error);
    notifyRenderer('auto-update-error', {
      message: '업데이트를 다운로드하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해주세요.',
    });
  });

  configured = true;
  return true;
}

export function checkForNativeUpdate(): boolean {
  if (!autoUpdater.getFeedURL()) return false;
  if (updateCheckStarted) return true;
  updateCheckStarted = true;
  autoUpdater.checkForUpdates();
  return true;
}

export function installNativeUpdate(): void {
  autoUpdater.quitAndInstall();
}
