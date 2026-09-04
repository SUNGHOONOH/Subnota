/**
 * 앱을 켠 뒤 처음 만든 창에만 붙는 인자.
 *
 * 브랜드 조립 모션은 "앱을 껐다 켰다"에만 어울린다. 창만 닫았다 다시 여는
 * 것은 프로세스가 살아 있던 것이라 사용자에겐 재시작이 아니고, 렌더러의
 * navigation type으로는 둘 다 'navigate'라 구분되지 않는다.
 *
 * main(창 생성) → preload(process.argv) → renderer 로 흐른다. IPC가 아니라
 * 인자인 이유: 부팅 화면의 첫 프레임이 메인 프로세스 응답을 기다리면 안 된다.
 */
export const COLD_START_ARG = '--subnota-cold-start';

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

const BUILD_NATIVE_PAGE_CAPTURE_ENABLED =
  typeof __SUBNOTA_NATIVE_PAGE_CAPTURE_ENABLED__ === 'undefined' ||
  __SUBNOTA_NATIVE_PAGE_CAPTURE_ENABLED__;

export const getDesktopPlatformFeatures = (
  platform: NodeJS.Platform = process.platform,
  nativePageCaptureEnabled = BUILD_NATIVE_PAGE_CAPTURE_ENABLED,
): DesktopPlatformFeatures => {
  const isMac = platform === 'darwin';
  const supportsNativePageCapture = isMac && nativePageCaptureEnabled;
  const platformName = isMac
    ? 'macos'
    : platform === 'win32'
      ? 'windows'
      : 'other';

  return {
    browserExtensionClipper: false,
    captureShortcut: supportsNativePageCapture,
    manualLinkCapture: true,
    miniSubnota: true,
    nativeCurrentPageCapture: supportsNativePageCapture,
    platform: platformName,
    recentCapturesInTray: isMac,
    trayQuickMemo: true,
    webClipperDeepLinks: isMac,
    webInbox: true,
  };
};

export const DESKTOP_PLATFORM_FEATURES = getDesktopPlatformFeatures();
