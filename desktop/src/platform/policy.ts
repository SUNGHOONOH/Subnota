export interface DesktopPlatformFeatures {
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

export const getDesktopPlatformFeatures = (
  platform: NodeJS.Platform = process.platform,
): DesktopPlatformFeatures => {
  const isMac = platform === 'darwin';
  const platformName = isMac
    ? 'macos'
    : platform === 'win32'
      ? 'windows'
      : 'other';

  return {
    browserExtensionClipper: false,
    captureShortcut: isMac,
    manualLinkCapture: true,
    miniSubnota: true,
    nativeCurrentPageCapture: isMac,
    platform: platformName,
    recentCapturesInTray: isMac,
    trayQuickMemo: true,
    webClipperDeepLinks: isMac,
    webInbox: true,
  };
};

export const DESKTOP_PLATFORM_FEATURES = getDesktopPlatformFeatures();
