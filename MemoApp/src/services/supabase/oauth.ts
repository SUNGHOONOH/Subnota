import type { Provider } from '@supabase/supabase-js';

import { supabase } from './client';

export const SUPABASE_AUTH_CALLBACK_URL = 'subnota://auth/callback';

export const isSupabaseAuthCallback = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'subnota:' &&
      parsed.hostname === 'auth' &&
      parsed.pathname === '/callback'
    );
  } catch {
    return false;
  }
};

export const createOAuthSignInUrl = async (provider: Provider) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    options: {
      redirectTo: SUPABASE_AUTH_CALLBACK_URL,
      skipBrowserRedirect: true,
    },
    provider,
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error('OAuth 로그인 URL을 만들지 못했습니다.');
  }

  return data.url;
};

export const completeOAuthCallback = async (url: string) => {
  if (!isSupabaseAuthCallback(url)) {
    return false;
  }

  const params = getCallbackParams(url);
  const errorDescription = params.get('error_description') ?? params.get('error');
  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription));
  }

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }
    return true;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('로그인 callback에서 세션 토큰을 찾지 못했습니다.');
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    throw error;
  }

  return true;
};

const getCallbackParams = (url: string) => {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;

  if (hash) {
    new URLSearchParams(hash).forEach((value, key) => {
      params.set(key, value);
    });
  }

  return params;
};
