import type { ReactElement } from 'react';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import AppEntryGate from '../features/workspace/AppEntryGate';

vi.mock('../features/auth/AuthScreen', () => ({
  default: () => <div className="auth-screen-test-double" />,
}));

const render = (node: ReactElement) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

const baseProps = {
  authNotice: null,
  bootMarkVariant: 'assemble' as const,
  bootPhase: 'brand' as const,
  error: null,
  isBooting: true,
  isSignedIn: false,
  isWorkspaceOwnerTransition: false,
  language: 'ko' as const,
  pendingResetEmail: null,
};

describe('AppEntryGate', () => {
  it('renders the CSS brand phase without mounting workspace content', () => {
    const markup = render(
      <AppEntryGate {...baseProps}>
        <div className="workspace-content-test-double" />
      </AppEntryGate>,
    );

    expect(markup).toContain('loading-screen');
    expect(markup).toContain('boot-mark');
    expect(markup).not.toContain('workspace-content-test-double');
  });

  it('renders the shell skeleton after the brand phase', () => {
    const markup = render(
      <AppEntryGate {...baseProps} bootPhase="shell">
        <div />
      </AppEntryGate>,
    );

    expect(markup).toContain('boot-skeleton-commandbar');
    expect(markup).not.toContain('workspace-content-test-double');
  });

  it('keeps the account transition behind the shell skeleton', () => {
    const markup = render(
      <AppEntryGate
        {...baseProps}
        bootPhase="ready"
        isBooting={false}
        isSignedIn
        isWorkspaceOwnerTransition
      >
        <div />
      </AppEntryGate>,
    );

    expect(markup).toContain('boot-skeleton-commandbar');
  });

  it('shows the auth screen only when the session is absent', () => {
    const markup = render(
      <AppEntryGate
        {...baseProps}
        bootPhase="ready"
        isBooting={false}
      >
        <div />
      </AppEntryGate>,
    );

    expect(markup).toContain('auth-screen-test-double');
  });

  it('returns the existing workspace content once the gate is ready', () => {
    const markup = render(
      <AppEntryGate
        {...baseProps}
        bootPhase="ready"
        isBooting={false}
        isSignedIn
      >
        <div className="workspace-content-test-double" />
      </AppEntryGate>,
    );

    expect(markup).toContain('workspace-content-test-double');
    expect(markup).not.toContain('loading-screen');
    expect(markup).not.toContain('boot-skeleton-commandbar');
  });
});
