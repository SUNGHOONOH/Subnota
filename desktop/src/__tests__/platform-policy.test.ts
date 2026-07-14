import { describe, expect, it } from 'vitest';

import { getDesktopPlatformFeatures } from '../platform/policy';

describe('desktop platform policy', () => {
  it('keeps Mini Subnota and manual inbox links on Windows without web clipping', () => {
    expect(getDesktopPlatformFeatures('win32')).toEqual({
      browserExtensionClipper: false,
      captureShortcut: false,
      manualLinkCapture: true,
      miniSubnota: true,
      nativeCurrentPageCapture: false,
      platform: 'windows',
      recentCapturesInTray: false,
      trayQuickMemo: true,
      webClipperDeepLinks: false,
      webInbox: true,
    });
  });

  it('keeps the existing macOS Mini and native page capture features', () => {
    expect(getDesktopPlatformFeatures('darwin')).toEqual({
      browserExtensionClipper: false,
      captureShortcut: true,
      manualLinkCapture: true,
      miniSubnota: true,
      nativeCurrentPageCapture: true,
      platform: 'macos',
      recentCapturesInTray: true,
      trayQuickMemo: true,
      webClipperDeepLinks: true,
      webInbox: true,
    });
  });
});
