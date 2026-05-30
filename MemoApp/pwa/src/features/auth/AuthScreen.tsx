import { FormEvent, useState } from 'react';
import { Mail, Sparkles } from 'lucide-react';

import {
  signInWithPassword,
  signInWithProvider,
  signUpWithPassword,
} from '../../services/supabase/data';
import { isSupabaseConfigured } from '../../services/supabase/client';

interface AuthScreenProps {
  onSignedIn: () => void;
}

const AuthScreen = ({ onSignedIn }: AuthScreenProps) => {
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

    try {
      await signInWithProvider(provider);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : '소셜 로그인 설정을 확인해야 합니다.',
      );
    }
  };

  return (
    <main className="auth-screen">
      {/* 백그라운드 빛무리(Blur Orbs) 효과 */}
      <div className="auth-bg-orb orb-1"></div>
      <div className="auth-bg-orb orb-2"></div>

      <section className="auth-panel">
        <div className="auth-copy">
          <div className="brand-mark">
            <Sparkles size={24} />
          </div>
          <p className="eyebrow">Subnota for Desktop</p>
          <h1>적기만 하세요.<br />정리는 조용히 따라옵니다.</h1>
          <p className="auth-copy-desc">
            메모, 캘린더, 브리핑을 하나의 계정으로 완벽히 동기화합니다. 데스크톱에서는 PWA 설치를 통해 주소창 없는 전용 앱 환경에서 더 넓은 화면과 키보드 중심 작업을 제공합니다.
          </p>
        </div>

        <div className="auth-card-container">
          <div className="auth-card">
            <div className="auth-card-header">
              <h2>{isSignUp ? '계정 만들기' : '반갑습니다'}</h2>
              <p>iOS/macOS 앱과 동일한 Supabase 계정을 사용합니다.</p>
            </div>

            {/* 소셜 간편 로그인 (상단에 큼직하게 배치) */}
            <div className="oauth-container">
              <button 
                type="button" 
                className="oauth-btn google" 
                onClick={() => startOAuth('google')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Google 계정으로 계속하기
              </button>
              
              <button 
                type="button" 
                className="oauth-btn kakao" 
                onClick={() => startOAuth('kakao')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.707 4.8 4.27 6.054-.277.946-.997 3.425-1.144 3.945-.184.646.216.638.455.48 1.883-1.248 3.018-2.008 4.225-2.81 1.077.29 2.222.446 3.414.446 4.97 0 9-3.185 9-7.115C21 6.185 16.97 3 12 3z"/>
                </svg>
                카카오로 3초 만에 시작하기
              </button>
            </div>

            {/* 또는 구분선 */}
            <div className="auth-separator">
              <span>또는 이메일 로그인</span>
            </div>

            <form className="auth-email-form" onSubmit={submit}>
              <div className="input-group">
                <label htmlFor="email-input">이메일 주소</label>
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

              <div className="input-group">
                <label htmlFor="password-input">비밀번호</label>
                <input
                  id="password-input"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={6}
                  onChange={event => setPassword(event.target.value)}
                  placeholder={isSignUp ? "6자 이상 비밀번호 설정" : "비밀번호 입력"}
                  type="password"
                  value={password}
                  required
                />
              </div>

              {isSignUp && (
                <div className="input-group">
                  <label htmlFor="password-confirmation-input">비밀번호 확인</label>
                  <input
                    id="password-confirmation-input"
                    autoComplete="new-password"
                    minLength={6}
                    onChange={event => setPasswordConfirmation(event.target.value)}
                    placeholder="비밀번호를 한 번 더 입력"
                    type="password"
                    value={passwordConfirmation}
                    required
                  />
                </div>
              )}

              {error && <p className="form-error">{error}</p>}

              <button className="email-submit-btn" disabled={!canSubmit || isSubmitting} type="submit">
                <Mail size={16} />
                {isSubmitting ? '처리 중...' : isSignUp ? '이메일로 가입하기' : '이메일로 로그인'}
              </button>
            </form>

            <div className="auth-toggle-footer">
              <button
                className="link-button"
                onClick={() => setSignUp(value => !value)}
                type="button"
              >
                {isSignUp ? '이미 계정이 있으신가요? 로그인' : '처음 방문하셨나요? 회원가입'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AuthScreen;
