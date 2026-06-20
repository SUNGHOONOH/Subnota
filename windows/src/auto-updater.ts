export interface AutoUpdateDownloadedInfo {
  releaseName: string;
  updateUrl: string;
}

interface ConfigureAutoUpdaterOptions {
  isPackaged: boolean;
  notifyRenderer: (
    channel: 'auto-update-downloaded',
    info: AutoUpdateDownloadedInfo,
  ) => void;
}

// Windows currently uses the GitHub release checker in `update-checker.ts`,
// which surfaces the Squirrel Setup EXE download. Native Squirrel.Windows
// auto-update requires a different feed/server shape than the macOS
// Squirrel.Mac RELEASES.json path, so keep this bridge as an explicit no-op.
export function configureAutoUpdater(
  options: ConfigureAutoUpdaterOptions,
): boolean {
  void options;
  return false;
}

export function checkForNativeUpdate(): boolean {
  return false;
}

export function installNativeUpdate(): void {
  // No native downloaded update exists on Windows in the current release path.
}
