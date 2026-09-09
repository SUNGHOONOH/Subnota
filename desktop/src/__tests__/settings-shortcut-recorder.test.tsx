import type { ReactElement } from 'react';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SettingsShortcutRecorder from '../features/settings/SettingsShortcutRecorder';

const render = (node: ReactElement) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

/**
 * 표시 기호는 실행 중인 OS를 따른다(shortcutSettings의 isMacPlatform).
 * Node 24는 전역 navigator를 제공하므로 테스트가 아무 것도 안 하면 호스트가
 * 결과를 정한다 — CI는 macOS와 Windows 양쪽에서 도는데 그러면 한쪽이 깨진다.
 * 플랫폼을 고정해 두 표기를 모두 검증한다.
 */
const withPlatform = (platform: string, run: () => void) => {
  vi.stubGlobal('navigator', { platform });
  run();
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseProps = {
  canReset: false,
  field: 'openSearch',
  language: 'ko' as const,
  label: '검색',
  onCancel: () => undefined,
  onKeyDown: () => undefined,
  onReset: () => undefined,
  onStart: () => undefined,
  recording: false,
};

describe('SettingsShortcutRecorder', () => {
  it('renders an explicit not-set badge for an empty shortcut', () => {
    const markup = render(
      <SettingsShortcutRecorder {...baseProps} value="" />,
    );

    expect(markup).toContain('settings-reference-badge');
    expect(markup).toContain('미설정');
  });

  it('renders the existing shortcut value and optional reset control', () => {
    const markup = render(
      <SettingsShortcutRecorder
        {...baseProps}
        canReset
        conflict="다른 기능"
        value="CommandOrControl+K"
      />,
    );

    expect(markup).toContain('settings-reference-shortcut-value');
    expect(markup).toContain('data-conflict');
    expect(markup).toContain('settings-reference-shortcut-reset');
  });

  // 저장값은 CommandOrControl로 공유하되 표기는 OS를 따른다(design.md 규칙).
  // Windows 사용자에게 ⌘를 보여주면 안 된다.
  it('shows the modifier symbol that belongs to the running OS', () => {
    withPlatform('MacIntel', () => {
      const markup = render(
        <SettingsShortcutRecorder {...baseProps} value="CommandOrControl+K" />,
      );
      expect(markup).toContain('⌘');
      expect(markup).not.toContain('Ctrl');
    });

    withPlatform('Win32', () => {
      const markup = render(
        <SettingsShortcutRecorder {...baseProps} value="CommandOrControl+K" />,
      );
      expect(markup).toContain('Ctrl');
      expect(markup).not.toContain('⌘');
    });
  });

  it('keeps the recording state focused and cancellable', () => {
    const markup = render(
      <SettingsShortcutRecorder
        {...baseProps}
        conflict="Conflict"
        recording
        value="CommandOrControl+K"
      />,
    );

    expect(markup).toContain('settings-reference-shortcut-record');
    expect(markup).toContain('autofocus');
    expect(markup).toContain('settings-reference-shortcut-cancel');
    expect(markup).toContain('단축키를 누르세요');
    expect(markup).not.toContain('settings-reference-shortcut-value');
  });
});
