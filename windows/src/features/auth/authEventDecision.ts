import type { AuthChangeEvent } from '@supabase/supabase-js';

export interface AuthEventDecision {
  action: 'activate' | 'deactivate' | 'ignore' | 'update';
}

export const decideAuthEvent = ({
  event,
  hasSession,
  isSameSession,
}: {
  event: AuthChangeEvent;
  hasSession: boolean;
  isSameSession: boolean;
}): AuthEventDecision => {
  if (event === 'INITIAL_SESSION') {
    return { action: 'ignore' };
  }

  if (event === 'SIGNED_OUT' || !hasSession) {
    return { action: 'deactivate' };
  }

  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
    return { action: 'update' };
  }

  if (event === 'SIGNED_IN') {
    return { action: isSameSession ? 'ignore' : 'activate' };
  }

  return { action: 'ignore' };
};
