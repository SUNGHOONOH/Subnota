import { describe, expect, it } from 'vitest';

import { isStrongPassword } from '../features/auth/authValidation';

describe('authentication validation', () => {
  it('uses the same password policy for signup validation', () => {
    expect(isStrongPassword('Abcdefg1')).toBe(true);
    expect(isStrongPassword('abcdefg1')).toBe(false);
    expect(isStrongPassword('ABCDEFG1')).toBe(false);
    expect(isStrongPassword('Abcdefgh')).toBe(false);
    expect(isStrongPassword('Abc1')).toBe(false);
  });
});
