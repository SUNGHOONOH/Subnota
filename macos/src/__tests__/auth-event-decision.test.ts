import { describe, expect, it } from 'vitest';

import { decideAuthEvent } from '../features/auth/authEventDecision';

describe('auth event decisions', () => {
  it('keeps password recovery on the auth screen until the password changes', () => {
    const recovery = decideAuthEvent({
      event: 'PASSWORD_RECOVERY',
      hasSession: true,
      isSameSession: false,
      recoveryActive: false,
    });
    expect(recovery).toEqual({ action: 'ignore', recoveryActive: true });

    expect(
      decideAuthEvent({
        event: 'TOKEN_REFRESHED',
        hasSession: true,
        isSameSession: false,
        recoveryActive: true,
      }),
    ).toEqual({ action: 'ignore', recoveryActive: true });

    expect(
      decideAuthEvent({
        event: 'USER_UPDATED',
        hasSession: true,
        isSameSession: false,
        recoveryActive: true,
      }),
    ).toEqual({ action: 'activate', recoveryActive: false });
  });

  it('ignores startup and duplicate sign-in events', () => {
    expect(
      decideAuthEvent({
        event: 'INITIAL_SESSION',
        hasSession: true,
        isSameSession: false,
        recoveryActive: false,
      }).action,
    ).toBe('ignore');

    expect(
      decideAuthEvent({
        event: 'SIGNED_IN',
        hasSession: true,
        isSameSession: true,
        recoveryActive: false,
      }).action,
    ).toBe('ignore');
  });

  it('activates a new sign-in and deactivates sign-out', () => {
    expect(
      decideAuthEvent({
        event: 'SIGNED_IN',
        hasSession: true,
        isSameSession: false,
        recoveryActive: false,
      }).action,
    ).toBe('activate');

    expect(
      decideAuthEvent({
        event: 'SIGNED_OUT',
        hasSession: false,
        isSameSession: false,
        recoveryActive: false,
      }).action,
    ).toBe('deactivate');
  });
});
