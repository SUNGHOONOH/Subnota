import { FormEvent, useEffect, useState } from 'react';
import { Mail } from '@/components/icons';
import { signInWithPassword, signInWithProvider, signUpWithPassword } from '../../services/supabase/data';
import { isSupabaseConfigured, supabase } from '../../services/supabase/client';

interface AuthScreenProps {
  onContinueOffline?: () => void;
  onSignedIn: () => void;
}

const AuthScreen = ({ onContinueOffline, onSignedIn }: AuthScreenProps) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setSignUp] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (!isSignUp || passwordConfirmation.length >= 6);

  useEffect(() => {
    void window.electronAPI?.setAuthWindowMode?.(true);
    return () => {
      void window.electronAPI?.setAuthWindowMode?.(false);
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isSupabaseConfigured()) {
      setError('Supabase 환경변수가 설정되지 않았습니다.');
      return;
    }

    if (isSignUp && password !== passwordConfirmation) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const session = isSignUp
        ? await signUpWithPassword(email.trim(), password)
        : await signInWithPassword(email.trim(), password);

      if (session) {
        onSignedIn();
      } else {
        setError('메일 인증이 필요할 수 있습니다. 메일함을 확인하세요.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const startOAuth = async (provider: 'google' | 'kakao') => {
    setError(null);
    setSubmitting(true);

    try {
      if (window.electronAPI && window.electronAPI.startOAuth) {
        const sessionData = await window.electronAPI.startOAuth(provider);
        if (sessionData && sessionData.access_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          });
          if (sessionError) throw sessionError;
          onSignedIn();
        }
      } else {
        // Fallback for web view context
        await signInWithProvider(provider);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : '소셜 로그인 설정을 확인해야 합니다.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="desktop-auth-container">
      <section className="desktop-auth-panel">
        <div className="desktop-auth-card">
          <div className="desktop-auth-header">
            <div className="brand-mark-coral">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4zm0 20a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4 4 4 0 0 1 4 4v2a4 4 0 0 1-4 4zm-8-8a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4 4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zm16 0a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4 4 4 0 0 1 4-4h2a4 4 0 0 1 4 4z" />
              </svg>
            </div>
            <h2>{isSignUp ? 'Subnota 시작하기' : '다시 만나서 반가워요'}</h2>
            <p>정리하지 말고, 작성만 하세요.</p>
          </div>

          {/* OAuth Buttons */}
          <div className="oauth-buttons-wrapper">
            <button 
              type="button" 
              className="oauth-custom-btn google" 
              onClick={() => startOAuth('google')}
              disabled={isSubmitting}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Google 계정으로 로그인
            </button>
            
            <button 
              type="button" 
              className="oauth-custom-btn kakao" 
              onClick={() => startOAuth('kakao')}
              disabled={isSubmitting}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.707 4.8 4.27 6.054-.277.946-.997 3.425-1.144 3.945-.184.646.216.638.455.48 1.883-1.248 3.018-2.008 4.225-2.81 1.077.29 2.222.446 3.414.446 4.97 0 9-3.185 9-7.115C21 6.185 16.97 3 12 3z"/>
              </svg>
              카카오로 로그인
            </button>
          </div>

          <div className="auth-divider-line">
            <span>또는 이메일로 계속하기</span>
          </div>

          <form className="auth-minimal-form" onSubmit={submit}>
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
            </div>

            <div className="form-input-field">
              <label htmlFor="password-input">비밀번호</label>
              <input
                id="password-input"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={6}
                onChange={event => setPassword(event.target.value)}
                placeholder={isSignUp ? "6자 이상 입력" : "비밀번호 입력"}
                type="password"
                value={password}
                required
              />
            </div>

            {isSignUp && (
              <div className="form-input-field">
                <label htmlFor="password-confirmation-input">비밀번호 확인</label>
                <input
                  id="password-confirmation-input"
                  autoComplete="new-password"
                  minLength={6}
                  onChange={event => setPasswordConfirmation(event.target.value)}
                  placeholder="비밀번호 한 번 더 입력"
                  type="password"
                  value={passwordConfirmation}
                  required
                />
              </div>
            )}

            {error && <p className="form-error-msg">{error}</p>}

            <button className="minimal-submit-btn" disabled={!canSubmit || isSubmitting} type="submit">
              <Mail size={15} />
              {isSubmitting ? '진행 중...' : isSignUp ? '이메일 가입' : '이메일 로그인'}
            </button>
          </form>

          <div className="auth-footer-toggle">
            {onContinueOffline && (
              <button
                className="footer-toggle-btn"
                onClick={onContinueOffline}
                type="button"
              >
                로그인 없이 오프라인으로 시작
              </button>
            )}
            <button
              className="footer-toggle-btn"
              onClick={() => setSignUp(value => !value)}
              type="button"
            >
              {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AuthScreen;
