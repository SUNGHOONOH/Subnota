import type { AuthChangeEvent } from '@supabase/supabase-js';

export interface AuthEventDecision {
  action: 'activate' | 'deactivate' | 'ignore' | 'update';
}

export const decideAuthEvent = ({
  event,
  hasSession,
  isSameSession,
  isSameUser = false,
}: {
  event: AuthChangeEvent;
  hasSession: boolean;
  isSameSession: boolean;
  isSameUser?: boolean;
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
    // Same user with a rotated access token (focus refresh) must NOT
    // re-activate: activation resets the whole workspace (memo draft included)
    // and loses text being typed.
    return { action: isSameSession ? 'ignore' : isSameUser ? 'update' : 'activate' };
  }

  return { action: 'ignore' };
};
