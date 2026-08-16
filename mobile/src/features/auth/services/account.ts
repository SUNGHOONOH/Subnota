import { MEMO_BACKEND_URL } from '@env';

import { supabase } from '../../../shared/supabase/client';

const getBackendUrl = () =>
  typeof MEMO_BACKEND_URL === 'string' ? MEMO_BACKEND_URL.trim() : '';

export const isAccountDeletionAvailable = async (): Promise<boolean> => {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return false;
  }

  try {
    const response = await fetch(`${backendUrl.replace(/\/$/, '')}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

export const deleteAccount = async (): Promise<void> => {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    throw new Error('MEMO_BACKEND_URL is not configured.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token || !session.user.id) {
    throw new Error('계정 삭제를 위해 다시 로그인해 주세요.');
  }

  const request = (accessToken: string) =>
    fetch(`${backendUrl.replace(/\/$/, '')}/account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      method: 'DELETE',
    });

  let response = await request(session.access_token);
  if (response.status === 401) {
    const {
      data: { session: refreshedSession },
    } = await supabase.auth.refreshSession();
    if (!refreshedSession?.access_token || refreshedSession.user.id !== session.user.id) {
      throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }
    response = await request(refreshedSession.access_token);
  }

  if (!response.ok) {
    throw new Error('계정 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
};
