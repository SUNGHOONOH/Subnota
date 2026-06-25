export const PASSWORD_REQUIREMENTS = [
  { key: 'lowercase', text: '소문자 포함', test: (password: string) => /[a-z]/.test(password) },
  { key: 'length', text: '8자 이상', test: (password: string) => password.length >= 8 },
  { key: 'uppercase', text: '대문자 포함', test: (password: string) => /[A-Z]/.test(password) },
  { key: 'number', text: '숫자 포함', test: (password: string) => /[0-9]/.test(password) },
] as const;

export const isStrongPassword = (password: string) =>
  PASSWORD_REQUIREMENTS.every(requirement => requirement.test(password));

export const isCompleteOtp = (value: string) => /^\d{6}$/.test(value);

export const isCompleteRecoveryOtp = isCompleteOtp;
