import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { isCurrentSession } from '../features/auth/sessionIdentity';

const session = (userId: string, accessToken: string) =>
  ({ access_token: accessToken, user: { id: userId } }) as Session;

describe('session identity', () => {
  it('requires the same user and token', () => {
    const expected = session('user-a', 'token-a');

    expect(isCurrentSession(session('user-a', 'token-a'), expected)).toBe(true);
    expect(isCurrentSession(session('user-a', 'token-b'), expected)).toBe(false);
    expect(isCurrentSession(session('user-b', 'token-a'), expected)).toBe(false);
    expect(isCurrentSession(null, expected)).toBe(false);
  });
});
