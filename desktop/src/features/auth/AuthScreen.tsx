import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail } from '@/components/icons';
import {
  createProviderAuthUrl,
  exchangeOAuthCode,
  resendSignupOtp,
  sendPasswordResetOtp,
  signInWithPassword,
  signUpWithPassword,
  updateUserPassword,
  verifyRecoveryOtp,
  verifySignupOtp,
} from '../../services/supabase/data';
import { isSupabaseConfigured, supabase } from '../../services/supabase/client';
import AuthCharacters from './AuthCharacters';
import PasswordConfirmInput from './PasswordConfirmInput';
import ResetPasswordForm from './ResetPasswordForm';
import SignupOtpForm from './SignupOtpForm';
import { isStrongPassword, PASSWORD_REQUIREMENTS } from './authValidation';

interface AuthScreenProps {
  initialError?: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STRENGTH_LEVELS = [
  { key: 'weak', label: '약함' },
  { key: 'fair', label: '보통' },
  { key: 'good', label: '강함' },
  { key: 'strong', label: '매우 강함' },
] as const;

const evaluatePassword = (password: string) => {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return STRENGTH_LEVELS[Math.min(STRENGTH_LEVELS.length, Math.max(1, score)) - 1];
};

// Electron wraps rejected IPC handlers as "Error invoking remote method
// 'x': Error: <message>" — strip that prefix so only our message shows.
const stripIpcPrefix = (message: string) =>
  message.replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, '').trim();

const friendlyAuthError = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
    return '이미 사용된 이메일입니다. 로그인을 시도해 주세요.';
  }
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (lower.includes('email not confirmed')) {
    return '메일 인증이 완료되지 않았습니다. 메일함(스팸함 포함)을 확인해 주세요.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return '요청이 많아 잠시 후 다시 시도해 주세요.';
  }
  return message;
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const AuthScreen = ({ initialError = null }: AuthScreenProps) => {
  const [view, setView] = useState<'auth' | 'reset' | 'signupOtp'>('auth');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSignUp, setSignUp] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);

  const trimmedEmail = email.trim();
  const emailValid = EMAIL_PATTERN.test(trimmedEmail);
  const passwordsMatch = password === passwordConfirmation;
  const strength = evaluatePassword(password);

  const canSubmit =
    emailValid &&
    password.length >= 6 &&
    (!isSignUp || (isStrongPassword(password) && passwordsMatch));

  useEffect(() => {
    void window.electronAPI?.setAuthWindowMode?.(true).catch(() => undefined);
    return () => {
      void window.electronAPI?.setAuthWindowMode?.(false).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  useEffect(() => {
    let cancelled = false;

    void window.electronAPI?.consumeOAuthCallback?.().then(async callback => {
      if (!callback || cancelled) return;
      if (callback.error) {
        throw new Error(callback.error);
      }
      if (!callback.code) {
        throw new Error('로그인 응답에서 코드를 찾지 못했습니다.');
      }

      setOauthPending(true);
      const session = await exchangeOAuthCode(callback.code);
      if (!session) {
        throw new Error('소셜 로그인 세션을 만들지 못했습니다.');
      }
    }).catch(caught => {
      if (!cancelled) {
        setError(
          caught instanceof Error
            ? friendlyAuthError(stripIpcPrefix(caught.message))
            : '소셜 로그인에 실패했습니다.',
        );
      }
    }).finally(() => {
      if (!cancelled) setOauthPending(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMode = () => {
    setSignUp(value => !value);
    setError(null);
    setNotice(null);
    setPasswordConfirmation('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isSupabaseConfigured()) {
      setError('Supabase 환경변수가 설정되지 않았습니다.');
      return;
    }
    if (!emailValid) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }
    if (isSignUp && password !== passwordConfirmation) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (isSignUp && !isStrongPassword(password)) {
      setError('비밀번호는 8자 이상이며 대문자, 소문자, 숫자를 포함해야 합니다.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const session = isSignUp
        ? await signUpWithPassword(trimmedEmail, password)
        : await signInWithPassword(trimmedEmail, password);

      if (!session && isSignUp) {
        setView('signupOtp');
      } else if (!session) {
        setError('메일 인증이 완료되지 않았습니다. 메일함(스팸함 포함)을 확인해 주세요.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? friendlyAuthError(caught.message) : '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const startOAuth = async (provider: 'google' | 'kakao') => {
    if (!isSupabaseConfigured()) {
      setError('Supabase 환경변수가 설정되지 않았습니다.');
      return;
    }

    setError(null);
    setNotice(null);
    setOauthPending(true);

    try {
      const authUrl = await createProviderAuthUrl(provider);
      const code = await window.electronAPI?.startOAuth?.(authUrl);
      if (!code) {
        throw new Error('소셜 로그인이 취소되었습니다.');
      }
      const session = await exchangeOAuthCode(code);
      if (!session) {
        throw new Error('소셜 로그인 세션을 만들지 못했습니다.');
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? friendlyAuthError(stripIpcPrefix(caught.message))
          : '소셜 로그인에 실패했습니다.',
      );
    } finally {
      setOauthPending(false);
    }
  };

  const cancelOAuth = () => {
    void window.electronAPI?.cancelOAuth?.().catch(() => {
      setError('소셜 로그인을 취소하지 못했습니다. 다시 시도해 주세요.');
    });
  };

  const startReset = async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase 환경변수가 설정되지 않았습니다.');
      return;
    }
    if (!emailValid) {
      setError('재설정 코드를 받을 이메일을 먼저 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await sendPasswordResetOtp(trimmedEmail);
      setView('reset');
    } catch (caught) {
      setError(caught instanceof Error ? friendlyAuthError(caught.message) : '재설정 코드를 보내지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (view === 'reset') {
    return (
      <main className="desktop-auth-container two-col">
        <AuthCharacterAside />
        <section className="desktop-auth-panel">
          <motion.div
            className="desktop-auth-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ResetPasswordForm
              email={trimmedEmail}
              onVerifyCode={async code => {
                const session = await verifyRecoveryOtp(trimmedEmail, code);
                return Boolean(session);
              }}
              onSubmit={async newPassword => {
                await updateUserPassword(newPassword);
              }}
              onCancel={() => {
                void supabase.auth.signOut({ scope: 'local' }).finally(() => {
                  setView('auth');
                  setError(null);
                });
              }}
            />
          </motion.div>
        </section>
      </main>
    );
  }

  if (view === 'signupOtp') {
    return (
      <main className="desktop-auth-container two-col">
        <AuthCharacterAside />
        <section className="desktop-auth-panel">
          <motion.div
            className="desktop-auth-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <SignupOtpForm
              email={trimmedEmail}
              onVerifyCode={async code => {
                const session = await verifySignupOtp(trimmedEmail, code);
                return Boolean(session);
              }}
              onResendCode={async () => {
                await resendSignupOtp(trimmedEmail);
              }}
              onCancel={() => {
                setView('auth');
                setSignUp(false);
                setError(null);
                setNotice(null);
                setPassword('');
                setPasswordConfirmation('');
              }}
            />
          </motion.div>
        </section>
      </main>
    );
  }

  return (
    <main className="desktop-auth-container two-col">
      <AuthCharacterAside />

      <section className="desktop-auth-panel">
        <motion.div
          className="desktop-auth-card"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          initial="hidden"
          animate="show"
        >
          <motion.div className="desktop-auth-header" variants={fadeUp}>
            <div className="brand-mark-coral">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4zm0 20a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4 4 4 0 0 1 4 4v2a4 4 0 0 1-4 4zm-8-8a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4 4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zm16 0a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4 4 4 0 0 1 4-4h2a4 4 0 0 1 4 4z" />
              </svg>
            </div>
            <h2>{isSignUp ? 'Subnota 시작하기' : '다시 만나서 반가워요'}</h2>
            <p>정리하지 말고, 작성만 하세요.</p>
          </motion.div>

          <motion.div className="oauth-buttons-wrapper" variants={fadeUp}>
            <button type="button" className="oauth-custom-btn google" onClick={() => startOAuth('google')} disabled={isSubmitting || oauthPending}>
              <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              Google 계정으로 로그인
            </button>

            {/*
              ponytail: Kakao OAuth still works; restore this button when Kakao login is needed again.
              <button type="button" className="oauth-custom-btn kakao" onClick={() => startOAuth('kakao')} disabled={isSubmitting || oauthPending}>
                <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.707 4.8 4.27 6.054-.277.946-.997 3.425-1.144 3.945-.184.646.216.638.455.48 1.883-1.248 3.018-2.008 4.225-2.81 1.077.29 2.222.446 3.414.446 4.97 0 9-3.185 9-7.115C21 6.185 16.97 3 12 3z" />
                </svg>
                카카오로 로그인
              </button>
            */}

            {oauthPending && (
              <div className="oauth-pending">
                <span>브라우저에서 로그인을 완료하세요.</span>
                <button type="button" className="oauth-cancel-btn" onClick={cancelOAuth}>
                  취소
                </button>
              </div>
            )}
          </motion.div>

          <motion.div className="auth-divider-line" variants={fadeUp}>
            <span>또는 이메일로 계속하기</span>
          </motion.div>

          <motion.form className="auth-minimal-form" onSubmit={submit} variants={fadeUp}>
            <div className="form-input-field">
              <label htmlFor="email-input">이메일</label>
              <input
                id="email-input"
                autoComplete="email"
                onChange={event => setEmail(event.target.value)}
                placeholder="name@example.com"
                type="email"
                value={email}
                required
              />
              {trimmedEmail.length > 0 && !emailValid && (
                <p className="field-hint err">올바른 이메일 형식이 아닙니다.</p>
              )}
              {isSignUp && emailValid && <p className="field-hint ok">사용할 수 있는 이메일 형식입니다.</p>}
            </div>

            <div className="form-input-field">
              <div className="label-row">
                <label htmlFor="password-input">비밀번호</label>
                {!isSignUp && (
                  <button type="button" className="forgot-link" onClick={startReset} disabled={isSubmitting}>
                    비밀번호를 잊으셨나요?
                  </button>
                )}
              </div>
              <div className="password-input-wrap">
                <input
                  id="password-input"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={isSignUp ? 8 : 6}
                  onChange={event => setPassword(event.target.value)}
                  placeholder={isSignUp ? '8자 이상 입력' : '비밀번호 입력'}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {isSignUp && password.length > 0 && (
                <>
                  <div className={`password-strength ${strength.key}`}>
                    <div className="password-strength-bars">
                      {STRENGTH_LEVELS.map(level => (
                        <span key={level.key} className="bar" />
                      ))}
                    </div>
                    <span className="password-strength-label">{strength.label}</span>
                  </div>
                  {!isStrongPassword(password) && (
                    <p className="field-hint err">
                      {PASSWORD_REQUIREMENTS.filter(
                        requirement => !requirement.test(password),
                      )
                        .map(requirement => requirement.text)
                        .join(' · ')}
                    </p>
                  )}
                </>
              )}
            </div>

            {isSignUp && (
              <div className="form-input-field">
                <label htmlFor="password-confirmation-input">비밀번호 확인</label>
                <PasswordConfirmInput
                  passwordToMatch={password}
                  value={passwordConfirmation}
                  onChange={setPasswordConfirmation}
                  showPassword={showPassword}
                />
              </div>
            )}

            {error && <p className="form-error-msg">{error}</p>}
            {notice && <p className="form-notice-msg">{notice}</p>}

            <button className="minimal-submit-btn" disabled={!canSubmit || isSubmitting} type="submit">
              <Mail size={15} />
              {isSubmitting ? '진행 중...' : isSignUp ? '이메일 가입' : '이메일 로그인'}
            </button>
          </motion.form>

          <motion.div className="auth-footer-toggle" variants={fadeUp}>
            <button className="footer-toggle-btn" onClick={toggleMode} type="button">
              {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
};

const AuthCharacterAside = () => (
  <aside className="auth-character-panel">
    <div className="auth-character-brand">
      <span className="auth-character-logo">Subnota</span>
    </div>
    <div className="auth-character-stage">
      <AuthCharacters />
    </div>
    <p className="auth-character-tagline">생각의 결을 잇는 메모</p>
  </aside>
);

export default AuthScreen;
