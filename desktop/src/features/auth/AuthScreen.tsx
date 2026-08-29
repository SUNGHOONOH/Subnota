import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
import SubnotaMark from '../../components/SubnotaMark';
import { isSupabaseConfigured, supabase } from '../../services/supabase/client';
import AuthCharacters from './AuthCharacters';
import PasswordConfirmInput from './PasswordConfirmInput';
import ResetPasswordForm from './ResetPasswordForm';
import SignupOtpForm from './SignupOtpForm';
import {
  isStrongPassword,
  passwordRequirementText,
  PASSWORD_REQUIREMENTS,
} from './authValidation';
import { localize, useUiLanguage } from '../../lib/uiLanguage';

interface AuthScreenProps {
  initialError?: string | null;
  initialNotice?: string | null;
  /**
   * 설정에서 비밀번호 재설정을 시작하면 앱이 로그아웃시키고 이 값을 넘긴다.
   * 코드를 넣을 화면이 로그인 화면에만 있어서, 로그인한 채로는 메일만 가고
   * 이어서 할 수 있는 것이 없었다.
   */
  initialResetEmail?: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STRENGTH_LEVELS = ['weak', 'fair', 'good', 'strong'] as const;

const evaluatePassword = (password: string) => {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return STRENGTH_LEVELS[Math.min(STRENGTH_LEVELS.length, Math.max(1, score)) - 1];
};

const strengthLabel = (key: (typeof STRENGTH_LEVELS)[number], language: 'en' | 'ko') =>
  localize(
    language,
    { fair: '보통', good: '강함', strong: '매우 강함', weak: '약함' }[key],
    { fair: 'Fair', good: 'Strong', strong: 'Very strong', weak: 'Weak' }[key],
  );

// Electron wraps rejected IPC handlers as "Error invoking remote method
// 'x': Error: <message>" — strip that prefix so only our message shows.
const stripIpcPrefix = (message: string) =>
  message.replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, '').trim();

const friendlyAuthError = (message: string, language: 'en' | 'ko') => {
  const lower = message.toLowerCase();
  if (lower.includes('already') || lower.includes('registered') || lower.includes('exists')) {
    return localize(language, '이미 사용된 이메일입니다. 로그인을 시도해 주세요.', 'That email is already in use. Try signing in.');
  }
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return localize(language, '이메일 또는 비밀번호가 올바르지 않습니다.', 'Your email or password is incorrect.');
  }
  if (lower.includes('email not confirmed')) {
    return localize(language, '메일 인증이 완료되지 않았습니다. 메일함(스팸함 포함)을 확인해 주세요.', 'Please confirm your email, including your spam folder.');
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return localize(language, '요청이 많아 잠시 후 다시 시도해 주세요.', 'Too many requests. Please try again shortly.');
  }
  return message;
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const AuthScreen = ({
  initialError = null,
  initialNotice = null,
  initialResetEmail = null,
}: AuthScreenProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const [view, setView] = useState<'auth' | 'reset' | 'signupOtp'>(
    initialResetEmail ? 'reset' : 'auth',
  );
  const [email, setEmail] = useState(initialResetEmail ?? '');
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(initialNotice);
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
    if (initialNotice) {
      setNotice(initialNotice);
    }
  }, [initialNotice]);

  useEffect(() => {
    let cancelled = false;

    void window.electronAPI?.consumeOAuthCallback?.().then(async callback => {
      if (!callback || cancelled) return;
      if (callback.error) {
        throw new Error(callback.error);
      }
      if (!callback.code) {
        throw new Error(t('로그인 응답에서 코드를 찾지 못했습니다.', 'No authorization code was returned.'));
      }

      setOauthPending(true);
      const session = await exchangeOAuthCode(callback.code);
      if (!session) {
        throw new Error(t('소셜 로그인 세션을 만들지 못했습니다.', 'Could not create a social sign-in session.'));
      }
    }).catch(caught => {
      if (!cancelled) {
        setError(
          caught instanceof Error
            ? friendlyAuthError(stripIpcPrefix(caught.message), language)
            : t('소셜 로그인에 실패했습니다.', 'Social sign-in failed.'),
        );
      }
    }).finally(() => {
      if (!cancelled) setOauthPending(false);
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const toggleMode = () => {
    setSignUp(value => !value);
    setError(null);
    setNotice(null);
    setPasswordConfirmation('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isSupabaseConfigured()) {
      setError(t('Supabase 환경변수가 설정되지 않았습니다.', 'Supabase is not configured.'));
      return;
    }
    if (!emailValid) {
      setError(t('올바른 이메일 형식이 아닙니다.', 'Enter a valid email address.'));
      return;
    }
    if (isSignUp && password !== passwordConfirmation) {
      setError(t('비밀번호와 비밀번호 확인이 일치하지 않습니다.', 'Passwords do not match.'));
      return;
    }
    if (isSignUp && !isStrongPassword(password)) {
      setError(t('비밀번호는 8자 이상이며 대문자, 소문자, 숫자를 포함해야 합니다.', 'Use at least 8 characters with uppercase, lowercase, and a number.'));
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (isSignUp) {
        const { alreadyRegistered, session } = await signUpWithPassword(
          trimmedEmail,
          password,
        );
        if (alreadyRegistered) {
          // Drop back to sign-in with the email kept: whichever way they first
          // signed up (password or Google), the next step is on this screen.
          setSignUp(false);
          setPasswordConfirmation('');
          setError(
            t(
              '이미 가입된 이메일입니다. 비밀번호로 로그인하거나, Google로 가입하셨다면 위의 Google 로그인을 사용해 주세요.',
              'That email already has an account. Sign in with your password, or use Continue with Google if that is how you signed up.',
            ),
          );
        } else if (!session) {
          setView('signupOtp');
        }
        return;
      }

      const session = await signInWithPassword(trimmedEmail, password);
      if (!session) {
        setError(t('메일 인증이 완료되지 않았습니다. 메일함(스팸함 포함)을 확인해 주세요.', 'Please confirm your email, including your spam folder.'));
      }
    } catch (caught) {
      setError(caught instanceof Error ? friendlyAuthError(caught.message, language) : t('로그인에 실패했습니다.', 'Sign-in failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const startOAuth = async (provider: 'google' | 'kakao') => {
    if (!isSupabaseConfigured()) {
      setError(t('Supabase 환경변수가 설정되지 않았습니다.', 'Supabase is not configured.'));
      return;
    }

    setError(null);
    setNotice(null);
    setOauthPending(true);

    try {
      const authUrl = await createProviderAuthUrl(provider);
      if (!authUrl) {
        throw new Error(t('소셜 로그인 주소를 만들지 못했습니다.', 'Could not build the social sign-in URL.'));
      }
      const code = await window.electronAPI?.startOAuth?.(authUrl);
      if (!code) {
        throw new Error(t('소셜 로그인이 취소되었습니다.', 'Social sign-in was cancelled.'));
      }
      const session = await exchangeOAuthCode(code);
      if (!session) {
        throw new Error(t('소셜 로그인 세션을 만들지 못했습니다.', 'Could not create a social sign-in session.'));
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? friendlyAuthError(stripIpcPrefix(caught.message), language)
          : t('소셜 로그인에 실패했습니다.', 'Social sign-in failed.'),
      );
    } finally {
      setOauthPending(false);
    }
  };

  const cancelOAuth = () => {
    void window.electronAPI?.cancelOAuth?.().catch(() => {
      setError(t('소셜 로그인을 취소하지 못했습니다. 다시 시도해 주세요.', 'Could not cancel social sign-in. Try again.'));
    });
  };

  const startReset = async () => {
    if (!isSupabaseConfigured()) {
      setError(t('Supabase 환경변수가 설정되지 않았습니다.', 'Supabase is not configured.'));
      return;
    }
    if (!emailValid) {
      setError(t('재설정 코드를 받을 이메일을 먼저 입력해 주세요.', 'Enter the email address that should receive the reset code.'));
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await sendPasswordResetOtp(trimmedEmail);
      setView('reset');
    } catch (caught) {
      setError(caught instanceof Error ? friendlyAuthError(caught.message, language) : t('재설정 코드를 보내지 못했습니다.', 'Could not send the reset code.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (view === 'reset') {
    return (
      <AuthLayout>
        <section className="desktop-auth-panel">
          <motion.div
            className="desktop-auth-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <ResetPasswordForm
              email={trimmedEmail}
              language={language}
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
      </AuthLayout>
    );
  }

  if (view === 'signupOtp') {
    return (
      <AuthLayout>
        <section className="desktop-auth-panel">
          <motion.div
            className="desktop-auth-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <SignupOtpForm
              email={trimmedEmail}
              language={language}
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
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <section className="desktop-auth-panel">
        <motion.div
          className="desktop-auth-card"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          initial="hidden"
          animate="show"
        >
          <motion.div className="desktop-auth-header" variants={fadeUp}>
            {/* 마크만 두면 그냥 아이콘이다. 이름을 붙여 로고 락업으로 만든다.
                왼쪽 꽃밭 패널에는 마크를 두지 않는다 — 한 화면에 브랜드는
                한 번이다. */}
            <div className="desktop-auth-brand">
              <SubnotaMark size={34} />
              <span className="desktop-auth-brand-name">Subnota</span>
            </div>
            <h2>{isSignUp ? t('Subnota 시작하기', 'Get started with Subnota') : t('다시 만나서 반가워요', 'Welcome back')}</h2>
            <p>{t('정리하지 말고, 작성만 하세요.', 'Just write. Organize later.')}</p>
          </motion.div>

          <motion.div className="oauth-buttons-wrapper" variants={fadeUp}>
            <button type="button" className="oauth-custom-btn google" onClick={() => startOAuth('google')} disabled={isSubmitting || oauthPending}>
              <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              {t('Google 계정으로 로그인', 'Continue with Google')}
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
                <span>{t('브라우저에서 로그인을 완료하세요.', 'Finish signing in in your browser.')}</span>
                <button type="button" className="oauth-cancel-btn" onClick={cancelOAuth}>
                  {t('취소', 'Cancel')}
                </button>
              </div>
            )}
          </motion.div>

          <motion.div className="auth-divider-line" variants={fadeUp}>
            <span>{t('또는 이메일로 계속하기', 'or continue with email')}</span>
          </motion.div>

          <motion.form className="auth-minimal-form" onSubmit={submit} variants={fadeUp}>
            <div className="form-input-field">
              <label htmlFor="email-input">{t('이메일', 'Email')}</label>
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
                <p className="field-hint err">{t('올바른 이메일 형식이 아닙니다.', 'Enter a valid email address.')}</p>
              )}
              {isSignUp && emailValid && <p className="field-hint ok">{t('사용할 수 있는 이메일 형식입니다.', 'This email address looks valid.')}</p>}
            </div>

            <div className="form-input-field">
              <div className="label-row">
                <label htmlFor="password-input">{t('비밀번호', 'Password')}</label>
                {!isSignUp && (
                  <button type="button" className="forgot-link" onClick={startReset} disabled={isSubmitting}>
                    {t('비밀번호를 잊으셨나요?', 'Forgot password?')}
                  </button>
                )}
              </div>
              <div className="password-input-wrap">
                <input
                  id="password-input"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={isSignUp ? 8 : 6}
                  onChange={event => setPassword(event.target.value)}
                  placeholder={isSignUp ? t('8자 이상 입력', 'At least 8 characters') : t('비밀번호 입력', 'Enter your password')}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? t('비밀번호 숨기기', 'Hide password') : t('비밀번호 표시', 'Show password')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Collapsible gap={6} isOpen={isSignUp && password.length > 0}>
                <div className={`password-strength ${strength}`}>
                  <div className="password-strength-bars">
                    {STRENGTH_LEVELS.map(level => (
                      <span key={level} className="bar" />
                    ))}
                  </div>
                  <span className="password-strength-label">{strengthLabel(strength, language)}</span>
                </div>
                {!isStrongPassword(password) && (
                  <p className="field-hint err">
                    {PASSWORD_REQUIREMENTS.filter(
                      requirement => !requirement.test(password),
                    )
                      .map(requirement => passwordRequirementText(requirement.key, language))
                      .join(' · ')}
                  </p>
                )}
              </Collapsible>
            </div>

            <Collapsible gap={13} isOpen={isSignUp}>
              <div className="form-input-field">
                <label htmlFor="password-confirmation-input">{t('비밀번호 확인', 'Confirm password')}</label>
                <PasswordConfirmInput
                  passwordToMatch={password}
                  placeholder={t('비밀번호를 한 번 더 입력', 'Re-enter your password')}
                  value={passwordConfirmation}
                  onChange={setPasswordConfirmation}
                  showPassword={showPassword}
                />
              </div>
            </Collapsible>

            {error && <p className="form-error-msg">{error}</p>}
            {notice && <p className="form-notice-msg">{notice}</p>}

            <button className="minimal-submit-btn" disabled={!canSubmit || isSubmitting} type="submit">
              <Mail size={15} />
              {isSubmitting ? t('진행 중...', 'Please wait…') : isSignUp ? t('이메일 가입', 'Create account') : t('이메일 로그인', 'Sign in with email')}
            </button>
          </motion.form>

          <motion.div className="auth-footer-toggle" variants={fadeUp}>
            <button className="footer-toggle-btn" onClick={toggleMode} type="button">
              {isSignUp ? t('이미 계정이 있으신가요? 로그인', 'Already have an account? Sign in') : t('계정이 없으신가요? 회원가입', 'New to Subnota? Create an account')}
            </button>
          </motion.div>
          <motion.p className="auth-legal-notice" variants={fadeUp}>
            {language === 'en' ? (
              <>
                By continuing, you agree to the{' '}
                <button
                  className="auth-legal-link"
                  onClick={() =>
                    void window.electronAPI?.openExternal('https://subnota.com/terms')
                  }
                  type="button"
                >
                  Terms of Service
                </button>{' '}
                and acknowledge the{' '}
                <button
                  className="auth-legal-link"
                  onClick={() =>
                    void window.electronAPI?.openExternal(
                      'https://subnota.com/privacy',
                    )
                  }
                  type="button"
                >
                  Privacy Policy
                </button>
                .
              </>
            ) : (
              <>
                계속하면{' '}
                <button
                  className="auth-legal-link"
                  onClick={() =>
                    void window.electronAPI?.openExternal('https://subnota.com/terms')
                  }
                  type="button"
                >
                  서비스 이용약관
                </button>
                에 동의하며,{' '}
                <button
                  className="auth-legal-link"
                  onClick={() =>
                    void window.electronAPI?.openExternal(
                      'https://subnota.com/privacy',
                    )
                  }
                  type="button"
                >
                  개인정보 처리방침
                </button>
                에 따라 개인정보가 처리됩니다.
              </>
            )}
          </motion.p>
        </motion.div>
      </section>
    </AuthLayout>
  );
};

const AuthCharacterAside = () => (
  <aside className="auth-character-panel">
    <div className="auth-character-stage">
      <AuthCharacters />
    </div>
  </aside>
);

/**
 * 모드를 바꿀 때 늘었다 줄어드는 폼 조각. 높이와 함께 바깥 간격(margin)까지
 * 애니메이션한다 — flex gap만 믿으면 요소가 사라지는 순간 간격만 남았다가
 * 툭 없어져 마지막에 한 번 튄다.
 *
 * 높이가 변하면 카드가 늘고, stretch로 묶인 왼쪽 꽃밭도 같이 늘어난다.
 * transform이 아니라 실제 레이아웃이라 두 면이 어긋나지 않는다.
 */
const Collapsible = ({
  children,
  gap,
  isOpen,
}: {
  children: ReactNode;
  gap: number;
  isOpen: boolean;
}) => {
  const shouldReduceMotion = useReducedMotion();

  // AnimatePresence는 조건문 **바깥**에 둔다. 안에 두면 트리째 사라져
  // exit이 조용히 건너뛰어진다(docs/design.md).
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          animate={{ height: 'auto', marginTop: gap, opacity: 1 }}
          // 나가는 쪽은 짧고 조용하게 — 시선은 이미 옮겨 갔다.
          exit={{
            height: 0,
            marginTop: 0,
            opacity: 0,
            transition: { duration: shouldReduceMotion ? 0 : 0.15 },
          }}
          initial={{ height: 0, marginTop: 0, opacity: 0 }}
          style={{ overflow: 'hidden' }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: 'spring', duration: 0.3, bounce: 0 }
          }
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const AuthLayout = ({ children }: { children: ReactNode }) => (
  <main className="desktop-auth-container two-col">
    <div className="desktop-auth-columns">
      <AuthCharacterAside />
      {children}
    </div>
  </main>
);

export default AuthScreen;
