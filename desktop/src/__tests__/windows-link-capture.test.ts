import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '..', relativePath), 'utf8');

const composer = read('features/mini/MiniComposer.tsx');
const main = read('main.ts');
const trayHint = read('features/onboarding/TrayHintModal.tsx');

describe('Windows 링크 저장', () => {
  // 클립보드를 미리 채우면 몇 시간 전에 복사한 URL이 들어와 있고, 사용자는
  // 대체로 맞는 값을 보다 확인을 멈춘다. 그러다 한 번 엉뚱한 링크를 저장한다.
  // Ctrl+V 한 번을 아끼려고 예측 가능성을 파는 거래라 하지 않는다.
  it('클립보드로 입력란을 미리 채우지 않는다', () => {
    expect(composer).toContain("const [linkUrl, setLinkUrl] = useState<string | null>(null)");
    expect(composer).not.toContain('readText');
    expect(composer).not.toContain('clipboard');
  });

  // Mini는 백엔드에 접근하지 않는다. 웹 클리퍼 딥링크와 같은 경로로 넘겨야
  // 저장·요약·토스트가 한 벌로 돈다.
  it('링크 저장은 기존 수집함 경로를 그대로 탄다', () => {
    expect(composer).toContain('window.electronAPI?.saveMiniLink?.(url)');
    expect(main).toContain("ipcMain.on('mini-save-link'");
    expect(main).toContain("deliverToMainWindow('inbox-capture', { title: '', url: normalized })");
    // 렌더러가 보낸 문자열을 그대로 믿지 않는다.
    expect(main).toContain('normalizeWebUrl(typeof url === \'string\' ? url : null)');
  });
});

describe('Windows에서 앱을 찾을 수 있게', () => {
  // Windows 11은 새 트레이 아이콘을 ⌃ 오버플로에 숨긴다. 작업 표시줄 아이콘은
  // 항상 보이므로 같은 항목을 점프 리스트에도 건다.
  it('점프 리스트는 Windows에서만 건다', () => {
    const jumpList = main.slice(
      main.indexOf('const installJumpList'),
      main.indexOf('const installTrayItem'),
    );

    expect(jumpList).toContain("DESKTOP_PLATFORM_FEATURES.platform !== 'windows'");
    expect(jumpList).toContain("args: 'subnota://memo'");
    expect(jumpList).toContain("args: 'subnota://link'");
  });

  // 안내보다 단축키가 먼저다 — 아이콘을 고정하지 않아도 계속 쓸 수 있다는
  // 것이 여기서 가장 중요한 정보다.
  it('안내는 단축키를 아이콘 고정법보다 먼저 말한다', () => {
    expect(trayHint.indexOf('tray-hint-key')).toBeLessThan(
      trayHint.indexOf('작업 표시줄 오른쪽'),
    );
  });

  it('안내는 Windows에서 한 번만 뜬다', () => {
    const hint = main.slice(
      main.indexOf('const showTrayHintOnce'),
      main.indexOf("ipcMain.on('hide-main-window'"),
    );

    expect(hint).toContain("DESKTOP_PLATFORM_FEATURES.platform !== 'windows'");
    expect(hint).toContain('if (preferences.trayHintSeen) return false;');
    expect(hint).toContain('trayHintSeen: true');
  });
});
