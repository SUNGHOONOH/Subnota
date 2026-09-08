import type { Session } from '@supabase/supabase-js';

export const isCurrentSession = (
  currentSession: Session | null,
  expectedSession: Session,
) =>
  currentSession?.user.id === expectedSession.user.id &&
  currentSession.access_token === expectedSession.access_token;
