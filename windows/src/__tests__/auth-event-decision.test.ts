import { describe, expect, it } from 'vitest';

import { decideAuthEvent } from '../features/auth/authEventDecision';

describe('auth event decisions', () => {
  it('ignores startup and duplicate sign-in events', () => {
    expect(
      decideAuthEvent({
        event: 'INITIAL_SESSION',
        hasSession: true,
        isSameSession: false,
      }).action,
    ).toBe('ignore');

    expect(
      decideAuthEvent({
        event: 'SIGNED_IN',
        hasSession: true,
        isSameSession: true,
      }).action,
    ).toBe('ignore');
  });

  it('activates a new sign-in and deactivates sign-out', () => {
    expect(
      decideAuthEvent({
        event: 'SIGNED_IN',
        hasSession: true,
        isSameSession: false,
      }).action,
    ).toBe('activate');

    expect(
      decideAuthEvent({
        event: 'SIGNED_OUT',
        hasSession: false,
        isSameSession: false,
      }).action,
    ).toBe('deactivate');
  });
});
