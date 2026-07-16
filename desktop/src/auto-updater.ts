import { autoUpdater } from 'electron';

export interface AutoUpdateDownloadedInfo {
  releaseName: string;
  updateUrl: string;
}

interface ConfigureAutoUpdaterOptions {
  isPackaged: boolean;
  notifyRenderer: (channel: 'auto-update-downloaded', info: AutoUpdateDownloadedInfo) => void;
}

let configured = false;
let updateCheckStarted = false;

function getMacUpdateFeedUrl(): string | null {
  const explicitFeedUrl = (process.env.SUBNOTA_MAC_UPDATE_FEED_URL || '').trim();
  if (explicitFeedUrl) return explicitFeedUrl;

  const releaseRepo = (
    process.env.SUBNOTA_RELEASE_REPO ||
    process.env.GITHUB_REPOSITORY ||
    ''
  ).trim();
  return releaseRepo.includes('/')
    ? `https://github.com/${releaseRepo}/releases/latest/download/RELEASES.json`
    : null;
}

export function configureAutoUpdater({
  isPackaged,
  notifyRenderer,
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

  autoUpdater.on('error', (error) => {
    console.error('Auto update failed:', error);
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
