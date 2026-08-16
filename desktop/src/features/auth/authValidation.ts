import { UiLanguage } from '../../lib/appSettings';

export const PASSWORD_REQUIREMENTS = [
  { key: 'lowercase', test: (password: string) => /[a-z]/.test(password) },
  { key: 'length', test: (password: string) => password.length >= 8 },
  { key: 'uppercase', test: (password: string) => /[A-Z]/.test(password) },
  { key: 'number', test: (password: string) => /[0-9]/.test(password) },
] as const;

const PASSWORD_REQUIREMENT_TEXT: Record<
  (typeof PASSWORD_REQUIREMENTS)[number]['key'],
  Record<UiLanguage, string>
> = {
  length: { en: 'At least 8 characters', ko: '8자 이상' },
  lowercase: { en: 'Lowercase letter', ko: '소문자 포함' },
  number: { en: 'Number', ko: '숫자 포함' },
  uppercase: { en: 'Uppercase letter', ko: '대문자 포함' },
};

export const passwordRequirementText = (
  key: (typeof PASSWORD_REQUIREMENTS)[number]['key'],
  language: UiLanguage,
) => PASSWORD_REQUIREMENT_TEXT[key][language];

export const isStrongPassword = (password: string) =>
  PASSWORD_REQUIREMENTS.every(requirement => requirement.test(password));

export const isCompleteOtp = (value: string) => /^\d{6}$/.test(value);

export const isCompleteRecoveryOtp = isCompleteOtp;
