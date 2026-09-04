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
    // 단축키는 양쪽에 있다. 하는 일만 다르다 — macOS는 최전면 브라우저를
    // 조회하고, Windows는 링크를 붙여넣을 칸을 띄운다.
    captureShortcut: true,
    manualLinkCapture: true,
    miniSubnota: true,
    // 최전면 브라우저 자동 조회는 macOS(AppleScript) 전용이다. Windows에는
    // 대응 수단이 없다 — UI Automation은 브라우저를 접근성 모드로 바꿔
    // 느리게 만들고, 요소 이름이 언어·버전마다 다르다.
    nativeCurrentPageCapture: isMac,
    platform: platformName,
    // 저장 결과를 확인할 경로. OS 알림을 꺼둔 사용자에게는 이게 유일하다.
    recentCapturesInTray: true,
    trayQuickMemo: true,
    // 브라우저 확장이 붙을 자리. 지금 열어 두면 확장이 나왔을 때 앱은
    // 손댈 것이 없다.
    webClipperDeepLinks: true,
    webInbox: true,
  };
};

export const DESKTOP_PLATFORM_FEATURES = getDesktopPlatformFeatures();
