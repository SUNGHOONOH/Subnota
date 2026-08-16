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
