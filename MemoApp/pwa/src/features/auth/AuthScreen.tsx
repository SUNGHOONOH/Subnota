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

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isSupabaseConfigured()) {
      setError('Supabase 환경변수가 설정되지 않았습니다.');
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
      <section className="auth-panel">
        <div className="auth-copy">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <p className="eyebrow">Subnota for Desktop</p>
          <h1>적기만 하세요. 정리는 조용히 따라옵니다.</h1>
          <p>
            메모, 캘린더, 브리핑을 같은 계정으로 동기화합니다. 데스크톱에서는
            설치형 PWA로 큰 화면과 키보드 중심 작업을 제공합니다.
          </p>
        </div>

        <form className="auth-card" onSubmit={submit}>
          <div>
            <h2>{isSignUp ? '계정 만들기' : '로그인'}</h2>
            <p>iOS/macOS 앱과 같은 Supabase 계정을 사용합니다.</p>
          </div>

          <label>
            이메일
            <input
              autoComplete="email"
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>

          <label>
            비밀번호
            <input
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={6}
              onChange={event => setPassword(event.target.value)}
              placeholder="6자 이상"
              type="password"
              value={password}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="primary-button" disabled={isSubmitting} type="submit">
            <Mail size={16} />
            {isSubmitting ? '처리 중' : isSignUp ? '회원가입' : '로그인'}
          </button>

          <div className="oauth-row">
            <button type="button" onClick={() => startOAuth('google')}>
              Google
            </button>
            <button type="button" onClick={() => startOAuth('kakao')}>
              Kakao
            </button>
          </div>

          <button
            className="link-button"
            onClick={() => setSignUp(value => !value)}
            type="button"
          >
            {isSignUp ? '이미 계정이 있습니다' : '처음이라면 계정 만들기'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default AuthScreen;
