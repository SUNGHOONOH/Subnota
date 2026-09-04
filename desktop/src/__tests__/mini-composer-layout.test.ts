import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '..', relativePath), 'utf8');

const composer = read('features/mini/MiniComposer.tsx');
const composerStyles = read('features/mini/MiniComposer.scss');
const miniMain = read('mini-subnota.ts');
const main = read('main.ts');
const preload = read('preload.ts');

describe('Quick Subnota — 단축키는 표시만 한다', () => {
  // 캡처 창 안에서 전역 단축키를 재녹화하려면 OS 등록을 내렸다 올려야 하고,
  // 그 왕복이 창의 절반과 버그 하나(토글해도 안내 문구가 남는)를 만들었다.
  // 바꾸는 일은 설정의 ShortcutRecorder가 이미 한다.
  it('실시간 단축키 수정 UI를 두지 않는다', () => {
    expect(composer).not.toContain('recordingField');
    expect(composer).not.toContain('suspendGlobalShortcuts');
    expect(composer).not.toContain('setGlobalShortcuts');
    expect(composer).not.toContain('keyboardEventToAccelerator');
    expect(composerStyles).not.toContain('.recording');
  });

  it('설정 쪽 단축키 편집은 그대로 남아 있다', () => {
    const settings = read('features/settings/SettingsModal.tsx');

    expect(settings).toContain('suspendGlobalShortcuts');
    expect(settings).toContain('ShortcutRecorder');
  });

  // 창을 부르는 단축키는 툴팁으로만 알린다. 창이 아주 작아서 상시 표시하면
  // 그 한 줄이 입력 영역을 잡아먹는다. 툴팁은 찾는 사람에게만 보인다.
  it('창을 부르는 단축키는 툴팁으로만 알린다', () => {
    const header = composer.slice(
      composer.indexOf('<header className="mini-composer__header">'),
      composer.indexOf('</header>'),
    );

    expect(header).toContain('shortcuts.toggleMini');
    // 상시 노출용 표기는 두지 않는다.
    expect(composer).not.toContain('renderAccelerator');
    expect(composer).not.toContain('<Kbd');
  });

  // Esc만 두면 손이 마우스에 있는 사람은 닫을 방법이 없다.
  it('Esc 말고 닫기 버튼으로도 닫을 수 있다', () => {
    const header = composer.slice(
      composer.indexOf('<header className="mini-composer__header">'),
      composer.indexOf('</header>'),
    );

    expect(header).toContain('mini-composer__close-button');
    expect(header).toContain('onClick={close}');
    // 단축키는 버튼 툴팁이 대신 알린다 — 상시 문구는 없앴다.
    expect(composer).not.toContain('Esc 닫기');
    expect(header).toMatch(/t\(\s*'닫기',\s*'Close'\s*\)\s*\+\s*' · Esc'/);
  });

  // 설정에서 바꾼 조합이 캡처 버튼 툴팁에 그대로 반영돼야 한다.
  it('표시용 단축키 값은 설정 변경을 따라간다', () => {
    expect(composer).toContain('onShortcutSettingsChanged');
    expect(composer).toContain('shortcuts.capturePage');
  });
});

describe('Quick Subnota — 두 저장 버튼', () => {
  it('최근 링크 머리글과 같은 줄, 오른쪽 끝에 선다', () => {
    const actions = composer.slice(
      composer.indexOf('<div className="mini-composer__actions">'),
      composer.indexOf('mini-composer__recent-list'),
    );

    expect(actions).toContain('mini-composer__secondary');
    expect(actions).toContain('현재 페이지 저장');
    expect(actions).toContain('mini-composer__save');
    expect(actions).toContain('메모 저장');
    expect(composerStyles).toMatch(/&__actions \{[\s\S]*?margin-left: auto/);
    // 별도 푸터는 없앴다 — 창 아래를 버튼이 한 줄 더 먹지 않는다.
    expect(composer).not.toContain('mini-composer__footer');
  });

  // 최근 링크는 macOS에서만 내보내지만 저장 버튼은 어디서나 있어야 한다.
  // 머리글 조건에 버튼까지 묶이면 Windows에서 저장할 방법이 사라진다.
  it('최근 링크를 숨기는 플랫폼에서도 버튼은 남는다', () => {
    const head = composer.slice(
      composer.indexOf('<div className="mini-composer__recent-head">'),
      composer.indexOf('<div className="mini-composer__actions">'),
    );

    expect(head).toContain('{showsRecentCaptures && (');
    expect(head).not.toContain('capturePageEnabled');
  });

  it('최근 링크를 숨기는 플랫폼에서는 최근 링크 안내도 숨긴다', () => {
    expect(composer).toContain(
      "aria-label={showsRecentCaptures ? t('최근 링크', 'Recent links') : undefined}",
    );
  });

  it('단축키는 각 버튼의 툴팁이 알려 준다', () => {
    expect(composer).toContain('formatAcceleratorLabel(shortcuts.capturePage, platform)');
    expect(composer).toContain("t('메모 저장', 'Save memo')");
    expect(composer).toContain("platform === 'macos' ? '⌘↵' : 'Ctrl+Enter'");
  });

  // 플랫폼 정책: Windows는 활성 브라우저 캡처를 아직 내보내지 않는다.
  // 버튼은 양쪽 플랫폼에 있다. 자동 조회가 되는 곳에서만 "현재" 페이지라고
  // 부른다 — Windows에서 그렇게 부르면 앱이 보고 있는 페이지를 안다는
  // 거짓 약속이 된다.
  it('자동 조회가 되는 플랫폼에서만 "현재" 페이지라고 말한다', () => {
    expect(composer).toContain('{capturePageEnabled && (');
    expect(composer).toContain(
      "platformFeatures?.nativeCurrentPageCapture !== false",
    );
    expect(composer).toContain("t('페이지 저장', 'Save a page')");
  });

  it('저장 중 버튼이 눌린 것처럼 보이지 않는다', () => {
    expect(composerStyles).toMatch(/&:disabled \{[\s\S]*?opacity: 0\.6/);
    expect(composerStyles).toContain('&:hover:not(:disabled)');
  });
});

describe('Quick Subnota — 캡처 버튼의 최전면 앱 문제', () => {
  // 창 안의 버튼을 누르면 최전면 앱이 Subnota다. frontmostApplication만
  // 보면 "지원하는 브라우저를 찾지 못했습니다"로 끝난다.
  it('Mini를 열기 직전의 브라우저를 기억해 둔다', () => {
    expect(miniMain).toContain('let lastBrowserBundleId: string | null = null;');
    const show = miniMain.slice(
      miniMain.indexOf('export const showMiniForMemo'),
      miniMain.indexOf('export const toggleMiniWindow'),
    );
    expect(show).toContain('void revealMiniWindow(window)');
    expect(miniMain).toContain('rememberFrontmostBrowser(bundleId);');
  });

  it('Subnota 자신은 기억하지 않는다', () => {
    const remember = miniMain.slice(
      miniMain.indexOf('const rememberFrontmostBrowser'),
      miniMain.indexOf('export const captureCurrentBrowserPage'),
    );

    expect(remember).toContain('bundleId && getBrowserCaptureScript(bundleId)');
  });

  // 전역 단축키 경로는 브라우저가 최전면일 때 눌리므로 실시간 조회가 맞다.
  it('대비책은 버튼 경로에서만 쓴다', () => {
    expect(miniMain).toContain('config.allowRememberedApp && lastBrowserBundleId');
    expect(main).toContain('requestPageCapture({ allowRememberedApp: true });');
    expect(main).toContain('onCapture: () => requestPageCapture(),');
  });

  // 자동 조회가 없는 플랫폼은 링크를 붙여넣을 칸으로 간다. 분기는 이 함수
  // 안에만 있어야 한다 — 진입점마다 흩어지면 하나씩 어긋난다.
  it('자동 조회가 없으면 링크 입력란으로 보낸다', () => {
    const router = main.slice(
      main.indexOf('const requestPageCapture'),
      main.indexOf('const capturePageLabel'),
    );

    expect(router).toContain('!DESKTOP_PLATFORM_FEATURES.nativeCurrentPageCapture');
    expect(router).toContain('showMiniForLink()');
  });

  it('버튼 IPC는 Mini 창에서 온 것만 받는다', () => {
    const handler = main.slice(
      main.indexOf("ipcMain.on('mini-capture-page'"),
      main.indexOf("ipcMain.on('mini-capture-page'") + 300,
    );

    expect(handler).toContain('if (!isTrustedMiniIpcSender(event)) return;');
    expect(preload).toContain("ipcRenderer.send('mini-capture-page')");
  });
});

describe('Quick Subnota — 이름과 마크', () => {
  it('사용자에게 보이는 이름은 모두 Quick Subnota다', () => {
    const userFacing = [
      composer,
      main,
      read('lib/shortcutSettings.ts'),
      read('lib/memoSections.ts'),
      read('features/inbox/InboxWorkspace.tsx'),
    ].join('\n');

    expect(composer).toContain('>Quick Subnota<');
    expect(main).toContain("mainT('새 Quick Subnota', 'New Quick Subnota')");
    expect(read('lib/shortcutSettings.ts')).toContain("'Quick Subnota 열기'");
    expect(userFacing).not.toContain(`Mini${' '}Subnota`);
  });

  // 저장된 값이라 이름만 바꾸면 기존 메모가 분류에서 떨어져 나간다.
  // 표시 이름과 저장 값은 별개다.
  it('저장된 카테고리 값은 건드리지 않는다', () => {
    expect(read('lib/memoCategory.ts')).toContain(
      "MINI_SUBNOTA_CATEGORY = 'MiniSubnota'",
    );
    expect(composer).toContain('subnota.miniComposer.draft.v1');
  });

  it('제목 왼쪽에 브랜드 마크가 있다', () => {
    expect(composer).toContain('<SubnotaMark className="mini-composer__mark"');
    expect(composerStyles).toContain('&__mark');
  });

  // 로고 배치는 한 곳에서만 정의한다 — 부팅 조립 모션과 어긋나면 안 된다.
  it('마크 배치는 부팅 모션과 같은 출처를 쓴다', () => {
    expect(read('components/BootBrandMark.tsx')).toContain(
      "from './SubnotaMark'",
    );
  });
});

describe('Quick Subnota — 상태 줄', () => {
  // 창은 blur돼도 숨기만 하고 언마운트되지 않는다. 지우지 않으면 캡처·저장·
  // 오류 문구가 다음 프리필까지 저장 버튼 옆에 남는다.
  it('다시 쓰기 시작하면 지난 문구를 지운다', () => {
    const changeText = composer.slice(
      composer.indexOf('const changeText'),
      composer.indexOf('const close ='),
    );

    expect(changeText).toContain('setStatus(null)');
  });

  // 가장 중요한 실패 문구가 ellipsis로 잘리던 자리다.
  it('버튼과 폭을 다투지 않고 두 줄까지 보여 준다', () => {
    expect(composerStyles).toMatch(
      /&__status \{[\s\S]*?-webkit-line-clamp: 2/,
    );
    expect(composerStyles).not.toMatch(
      /&__status \{[\s\S]*?white-space: nowrap/,
    );
  });
});
