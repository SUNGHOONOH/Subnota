import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { focus: vi.fn(), hide: vi.fn(), isActive: vi.fn(() => false) },
  BrowserWindow: class MockBrowserWindow {},
  globalShortcut: {
    register: vi.fn(() => true),
    unregisterAll: vi.fn(),
  },
  screen: {
    getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
    getDisplayNearestPoint: vi.fn(() => ({
      workArea: { height: 900, width: 1440, x: 0, y: 0 },
    })),
  },
}));

import {
  decideMiniDismissalTarget,
  getBrowserCaptureScript,
  parseBrowserPageOutput,
} from '../mini-subnota';

describe('Quick Subnota browser capture helpers', () => {
  it('keeps the legacy supported browser bundle IDs', () => {
    expect(getBrowserCaptureScript('com.apple.Safari')).toContain('Safari');
    expect(getBrowserCaptureScript('com.google.Chrome')).toContain('Google Chrome');
    expect(getBrowserCaptureScript('company.thebrowser.Browser')).toContain('Arc');
    expect(getBrowserCaptureScript('com.microsoft.edgemac')).toContain('Microsoft Edge');
    expect(getBrowserCaptureScript('com.brave.Browser')).toContain('Brave Browser');
    expect(getBrowserCaptureScript('com.unsupported.Browser')).toBeNull();
    expect(getBrowserCaptureScript('com.apple.Safari\nmalicious')).toBeNull();
    expect(getBrowserCaptureScript('com.apple.Safari"')).toBeNull();
  });

  it('limits every browser script to the current tab URL and title', () => {
    const scripts = [
      'com.apple.Safari',
      'com.google.Chrome',
      'company.thebrowser.Browser',
      'com.microsoft.edgemac',
      'com.brave.Browser',
    ].map(bundleId => getBrowserCaptureScript(bundleId) ?? '');

    for (const script of scripts) {
      expect(script).toMatch(/URL/);
      expect(script).toMatch(/name|title/);
      expect(script).not.toMatch(/source|history|cookie|password|text of/i);
    }
  });

  it('parses URL and title from osascript output', () => {
    expect(parseBrowserPageOutput('https://example.com\nExample title')).toEqual({
      title: 'Example title',
      url: 'https://example.com',
    });
  });

  it('returns an empty title when the browser only returns a URL', () => {
    expect(parseBrowserPageOutput('https://example.com')).toEqual({
      title: '',
      url: 'https://example.com',
    });
  });
});

// 전역 단축키로 부르는 창이라 앱이 백그라운드인 상태가 기본값이다. macOS의
// NSPanel은 앱이 활성화되지 않으면 key window가 되지 못해, 창은 떴는데
// 타이핑이 직전 앱(에디터·터미널)으로 그대로 들어간다.
describe('Quick Subnota 포커스', () => {
  const source = readFileSync(resolve(__dirname, '../mini-subnota.ts'), 'utf8');

  it('창을 띄우기 전에 앱을 활성화한다', () => {
    const reveal = source.slice(
      source.indexOf('const revealMiniWindow'),
      source.indexOf('const buildMiniWindow'),
    );

    expect(reveal).toContain("app.focus({ steal: true })");
    // 활성화가 show 보다 뒤면 패널이 이미 뜬 뒤라 포커스를 못 가져온다.
    expect(reveal.indexOf('app.focus')).toBeLessThan(reveal.indexOf('window.show()'));
  });

  // 전체 화면 앱은 자기 Space에 산다. 이 두 가지가 없으면 Quick을 부를 때
  // macOS가 Subnota 메인 창이 있는 Space로 화면을 전환해 버린다.
  it('전체 화면 위에 뜨고, Space를 전환시키지 않는다', () => {
    expect(source).toContain('setVisibleOnAllWorkspaces(true, {');
    expect(source).toContain('visibleOnFullScreen: true');

    // show()가 활성화보다 먼저여야 한다. 활성화가 앞서면 그 순간 현재 Space에
    // Subnota 창이 없어 macOS가 다른 Space로 넘어간다.
    const reveal = source.slice(
      source.indexOf('const revealMiniWindow'),
      source.indexOf('const buildMiniWindow'),
    );
    // 주석에도 같은 표현이 나오므로 세미콜론까지 붙여 실제 구문만 잡는다.
    expect(reveal.indexOf('window.show();')).toBeGreaterThan(-1);
    expect(reveal.indexOf('window.show();')).toBeLessThan(
      reveal.indexOf('app.focus({ steal: true });'),
    );
  });

  it('창을 드러내는 경로가 모두 같은 헬퍼를 쓴다', () => {
    // show 를 직접 부르는 곳이 남으면 그 경로만 조용히 버그가 된다.
    // 헬퍼 안의 한 번이 전부여야 한다.
    expect(source.match(/window\.show\(\)/g)).toHaveLength(1);
    expect(source.match(/revealMiniWindow\(window\)/g)).toHaveLength(2);
  });

  it('Mini를 열기 전의 포커스 상태로 돌아갈 대상을 정한다', () => {
    expect(
      decideMiniDismissalTarget(
        { focusedMainWindowId: 42 },
        false,
        'com.google.Chrome',
      ),
    ).toEqual({ kind: 'main-window', windowId: 42 });
    expect(
      decideMiniDismissalTarget(
        { focusedMainWindowId: null },
        false,
        'com.google.Chrome',
      ),
    ).toEqual({ kind: 'external-app', bundleId: 'com.google.Chrome' });
    expect(
      decideMiniDismissalTarget(
        { focusedMainWindowId: null },
        true,
        null,
      ),
    ).toEqual({ kind: 'none' });
  });

  it('외부 앱 복귀 실패 시에도 Subnota를 앞에 남기지 않는 폴백이 있다', () => {
    const dismiss = source.slice(
      source.indexOf('const restoreMiniFocus'),
      source.indexOf('let lastBrowserBundleId'),
    );

    expect(dismiss).toContain('activateRunningApplication');
    expect(dismiss).toContain('app.hide()');
  });

  // app.hide()는 Subnota 창을 전부 감춘다. 이 분기는 "메인 창이 포커스가
  // 아니었다"이지 "메인 창이 없다"가 아니라, 가드가 없으면 띄워 둔 창이
  // 통째로 사라진다.
  it('보이는 Subnota 창이 있으면 app.hide()로 전부 감추지 않는다', () => {
    const dismiss = source.slice(
      source.indexOf('const restoreMiniFocus'),
      source.indexOf('let lastBrowserBundleId'),
    );

    expect(dismiss).toContain('if (!hasVisibleAppWindow()) {');
    // 판정은 우리 창 상태만 본다 — 다른 앱을 조회하면 샌드박스에서 또 막힌다.
    const helper = source.slice(
      source.indexOf('const hasVisibleAppWindow'),
      source.indexOf('const restoreMiniFocus'),
    );
    expect(helper).toContain('BrowserWindow.getAllWindows()');
    expect(helper).toContain('window !== miniWindow');
    expect(helper).not.toContain('osascript');
    expect(helper).not.toContain('getFrontmostApplicationBundleId');
  });
});

// 메인 창이 열려 있을 때만 나던 증상: Quick을 닫으면 메인 창이 잠깐 앞으로
// 튀어나왔다가 사라지고 그제서야 원래 앱으로 돌아갔다. Quick을 먼저 숨기면
// Subnota가 아직 활성 앱이라 macOS가 다음 창을 key로 올리기 때문이다.
describe('Quick Subnota 닫을 때 메인 창이 끼어들지 않는다', () => {
  const source = readFileSync(resolve(__dirname, '../mini-subnota.ts'), 'utf8');
  const hide = source.slice(
    source.indexOf('export const hideMiniWindow'),
    source.indexOf('export const isMiniSubnotaWebContents'),
  );

  it('외부 앱으로 돌아갈 때는 활성화가 먼저다', () => {
    const branch = hide.slice(hide.indexOf("dismissalTarget.kind === 'external-app'"));
    const restoreAt = branch.indexOf('restoreMiniFocus');
    const hideAt = branch.indexOf('window.hide()');

    expect(restoreAt).toBeGreaterThan(-1);
    expect(restoreAt).toBeLessThan(hideAt);
  });

  // 활성화가 실패해도 창은 반드시 닫혀야 한다.
  it('활성화가 실패해도 창을 닫는다', () => {
    expect(hide).toContain('.finally(');
    expect(hide).toContain('window.isVisible()');
  });

  // 메인 창으로 돌아가는 경우는 그 창이 앞으로 나오는 게 맞아 순서를 유지한다.
  it('메인 창으로 돌아갈 때는 기존 순서를 유지한다', () => {
    const tail = hide.slice(hide.lastIndexOf('window.hide();'));
    expect(tail).toContain('restoreMiniFocus(dismissalTarget)');
  });
});
