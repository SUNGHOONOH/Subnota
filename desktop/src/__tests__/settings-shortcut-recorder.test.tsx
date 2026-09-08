import type { ReactElement } from 'react';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import SettingsShortcutRecorder from '../features/settings/SettingsShortcutRecorder';

const render = (node: ReactElement) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

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
    expect(markup).toContain('⌘');
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
