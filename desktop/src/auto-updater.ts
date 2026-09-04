import { app, autoUpdater } from 'electron';
import { getMacUpdateFeedUrl, getReleaseRepository } from './release-channel';

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
  // Mac App Store apps are updated exclusively by the App Store. Electron's
  // Squirrel feed must never be configured for a MAS build.
  if (process.platform === 'darwin' && process.mas === true) {
    return false;
  }
  const isMac = process.platform === 'darwin';
  const isWindows = process.platform === 'win32';
  if ((!isMac && !isWindows) || !isPackaged || configured) {
    return configured;
  }

  const repository = getReleaseRepository();
  const feedUrl = isMac
    ? getMacUpdateFeedUrl()
    : repository &&
      `https://update.electronjs.org/${repository}/win32-${process.arch}/${app.getVersion()}`;
  if (!feedUrl) return false;

  autoUpdater.setFeedURL(
    isMac ? { url: feedUrl, serverType: 'json' } : { url: feedUrl },
  );

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
  if (process.platform === 'darwin' && process.mas === true) return false;
  if (!autoUpdater.getFeedURL()) return false;
  if (updateCheckStarted) return true;
  updateCheckStarted = true;
  autoUpdater.checkForUpdates();
  return true;
}

export function installNativeUpdate(): void {
  if (process.platform === 'darwin' && process.mas === true) return;
  autoUpdater.quitAndInstall();
}
