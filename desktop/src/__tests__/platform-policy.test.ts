import { describe, expect, it } from 'vitest';

import { getDesktopPlatformFeatures } from '../platform/policy';

describe('desktop platform policy', () => {
  // Windows도 캡처 단축키·트레이 최근 링크·클리퍼 딥링크를 갖는다. 자동
  // 조회만 못 한다 — 그 자리는 링크를 붙여넣는 입력란이 대신한다.
  it('gives Windows everything but native page capture', () => {
    expect(getDesktopPlatformFeatures('win32')).toEqual({
      browserExtensionClipper: false,
      captureShortcut: true,
      manualLinkCapture: true,
      miniSubnota: true,
      nativeCurrentPageCapture: false,
      platform: 'windows',
      recentCapturesInTray: true,
      trayQuickMemo: true,
      webClipperDeepLinks: true,
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
