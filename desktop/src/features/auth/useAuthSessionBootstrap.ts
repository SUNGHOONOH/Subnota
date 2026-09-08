import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';

import { decideAuthEvent } from './authEventDecision';
import { getInitialSession } from './bootSession';
import { isSupabaseConfigured, supabase } from '../../services/supabase/client';

type SessionAction = (
  nextSession?: Session | null,
  options?: { migrateLegacy?: boolean; resetWorkspace?: boolean },
) => Promise<void> | void;

interface UseAuthSessionBootstrapOptions {
  activateSession: SessionAction;
  applyLocalWorkspace: () => Promise<void>;
  deactivateSession: SessionAction;
  sessionRef: { current: Session | null };
  sessionActivationIdRef: { current: number };
  setBooting: (value: boolean) => void;
  setError: (value: string | null) => void;
  setSession: (value: Session | null) => void;
  t: (korean: string, english: string) => string;
  workspaceLoadIdRef: { current: number };
}

/**
 * Starts the local-first workspace, then listens for auth changes. The
 * decision table and account-transition cleanup stay in their existing hooks;
 * this boundary only owns the initial session subscription lifecycle.
 */
export const useAuthSessionBootstrap = ({
  activateSession,
  applyLocalWorkspace,
  deactivateSession,
  sessionRef,
  sessionActivationIdRef,
  setBooting,
  setError,
  setSession,
  t,
  workspaceLoadIdRef,
}: UseAuthSessionBootstrapOptions) => {
  useEffect(() => {
    let mounted = true;
    let passwordRecoveryActive = false;

    void applyLocalWorkspace();

    if (!isSupabaseConfigured()) {
      setError(
        t(
          '최초 로그인에는 온라인 연결과 Supabase 설정이 필요합니다.',
          'Your first sign-in requires an internet connection and Supabase setup.',
        ),
      );
      setBooting(false);
      return () => {
        mounted = false;
      };
    }

    getInitialSession()
      .then(async (nextSession) => {
        if (!mounted) {
          return;
        }
        if (nextSession) {
          // 로딩 화면은 로컬 작업 공간이 붙는 즉시 닫힌다. 첫 서버 동기화는
          // 콜드 스타트/네트워크 지연으로 오래 걸릴 수 있어 화면을 걸어 두지
          // 않고 뒤에서 이어 돌린다(local-first).
          await activateSession(nextSession, { migrateLegacy: true });
        } else {
          deactivateSession();
        }
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : t('세션 확인에 실패했습니다.', 'Could not verify your session.'),
        );
      })
      .finally(() => {
        if (mounted) {
          setBooting(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const currentSession = sessionRef.current;
      const decision = decideAuthEvent({
        event,
        hasSession: Boolean(nextSession),
        isSameSession:
          currentSession?.user.id === nextSession?.user.id &&
          currentSession?.access_token === nextSession?.access_token,
        isSameUser:
          Boolean(currentSession && nextSession) &&
          currentSession?.user.id === nextSession?.user.id,
        recoveryActive: passwordRecoveryActive,
      });
      passwordRecoveryActive = decision.recoveryActive;

      if (decision.action === 'deactivate') {
        deactivateSession();
        return;
      }

      if (decision.action === 'ignore' || !nextSession) {
        return;
      }

      if (decision.action === 'update') {
        sessionRef.current = nextSession;
        setSession(nextSession);
        return;
      }

      if (decision.action === 'activate') {
        void activateSession(nextSession, { resetWorkspace: true });
      }
    });

    return () => {
      mounted = false;
      sessionActivationIdRef.current += 1;
      workspaceLoadIdRef.current += 1;
      data.subscription.unsubscribe();
    };
  }, [
    activateSession,
    applyLocalWorkspace,
    deactivateSession,
    sessionActivationIdRef,
    sessionRef,
    setBooting,
    setError,
    setSession,
    t,
    workspaceLoadIdRef,
  ]);
};
