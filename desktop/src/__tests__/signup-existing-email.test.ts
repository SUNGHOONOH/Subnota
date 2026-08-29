import { beforeEach, describe, expect, it, vi } from 'vitest';

const signUp = vi.fn();
vi.mock('../services/supabase/client', () => ({
  supabase: { auth: { signUp: (...args: unknown[]) => signUp(...args) } },
}));

import { signUpWithPassword } from '../services/supabase/data';

beforeEach(() => {
  signUp.mockReset();
});

describe('signUpWithPassword against email-enumeration protection', () => {
  it('flags an email that already has an account (obfuscated user, no identities)', async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: { id: 'obfuscated', identities: [] } },
      error: null,
    });

    expect(await signUpWithPassword('taken@example.com', 'Abcdefg1')).toEqual({
      alreadyRegistered: true,
      session: null,
    });
  });

  it('treats a genuinely new email as awaiting its emailed code', async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: { id: 'u1', identities: [{ id: 'i1' }] } },
      error: null,
    });

    expect(await signUpWithPassword('new@example.com', 'Abcdefg1')).toEqual({
      alreadyRegistered: false,
      session: null,
    });
  });

  it('returns the session when confirmation is disabled', async () => {
    const session = { access_token: 'a' };
    signUp.mockResolvedValue({
      data: { session, user: { id: 'u1', identities: [{ id: 'i1' }] } },
      error: null,
    });

    expect(await signUpWithPassword('new@example.com', 'Abcdefg1')).toEqual({
      alreadyRegistered: false,
      session,
    });
  });
});
