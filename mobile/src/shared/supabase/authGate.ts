import { Alert } from 'react-native';

import { isSupabaseConfigured, supabase } from './client';

export const hasSupabaseSession = async () => {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return Boolean(session?.access_token);
};

export const requireOnlineLogin = async (featureName: string) => {
  const isSignedIn = await hasSupabaseSession();

  if (isSignedIn) {
    return true;
  }

  Alert.alert(
    '로그인이 필요합니다',
    `${featureName} 기능은 기기 연동 로그인이 필요합니다. 노트 작성과 로컬 일정 등록은 계속 사용할 수 있고, Kakao/Google 로그인은 이후 연결할 예정입니다.`,
    [{ text: '확인' }],
  );

  return false;
};
