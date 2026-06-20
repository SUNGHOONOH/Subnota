import type { AuthChangeEvent } from '@supabase/supabase-js';

export interface AuthEventDecision {
  action: 'activate' | 'deactivate' | 'ignore' | 'update';
  recoveryActive: boolean;
}

export const decideAuthEvent = ({
  event,
  hasSession,
  isSameSession,
  recoveryActive,
}: {
  event: AuthChangeEvent;
  hasSession: boolean;
  isSameSession: boolean;
  recoveryActive: boolean;
}): AuthEventDecision => {
  if (event === 'INITIAL_SESSION') {
    return { action: 'ignore', recoveryActive };
  }

  if (event === 'PASSWORD_RECOVERY') {
    return { action: 'ignore', recoveryActive: true };
  }

  if (event === 'SIGNED_OUT' || !hasSession) {
    return { action: 'deactivate', recoveryActive: false };
  }

  if (recoveryActive && event !== 'USER_UPDATED') {
    return { action: 'ignore', recoveryActive: true };
  }

  if (event === 'USER_UPDATED') {
    return {
      action: recoveryActive ? 'activate' : 'update',
      recoveryActive: false,
    };
  }

  if (event === 'TOKEN_REFRESHED') {
    return { action: 'update', recoveryActive: false };
  }

  if (event === 'SIGNED_IN') {
    return {
      action: isSameSession ? 'ignore' : 'activate',
      recoveryActive: false,
    };
  }

  return { action: 'ignore', recoveryActive };
};
