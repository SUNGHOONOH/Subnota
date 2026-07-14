import { describe, expect, it } from 'vitest';

import {
  isCompleteRecoveryOtp,
  isStrongPassword,
} from '../features/auth/authValidation';

describe('authentication validation', () => {
  it('requires the shared password policy for signup and recovery', () => {
    expect(isStrongPassword('Abcdefg1')).toBe(true);
    expect(isStrongPassword('abcdefg1')).toBe(false);
    expect(isStrongPassword('ABCDEFG1')).toBe(false);
    expect(isStrongPassword('Abcdefgh')).toBe(false);
    expect(isStrongPassword('Abc1')).toBe(false);
  });

  it('accepts only a complete six-digit recovery OTP', () => {
    expect(isCompleteRecoveryOtp('123456')).toBe(true);
    expect(isCompleteRecoveryOtp('12345')).toBe(false);
    expect(isCompleteRecoveryOtp('12345a')).toBe(false);
    expect(isCompleteRecoveryOtp('1234567')).toBe(false);
  });
});
