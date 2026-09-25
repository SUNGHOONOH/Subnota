import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import { cancelLocalInboxIndexing } from '../../services/local/localInboxIndexer';
import { cancelLocalMemoIndexing } from '../../services/local/localMemoIndexer';
import { clearLocalWorkspaceOwner } from '../../services/local/offlineStore';
import { deleteAccount } from '../../services/backend/accountService';
import { signOut } from '../../services/supabase/data';
import { supabase } from '../../services/supabase/client';

interface UseAccountActionsOptions {
  deactivateSession: () => void;
  session: Session | null;
  sessionRef: MutableRefObject<Session | null>;
  setAuthNotice: Dispatch<SetStateAction<string | null>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  t: (korean: string, english: string) => string;
}

export const useAccountActions = ({
  deactivateSession,
  session,
  sessionRef,
  setAuthNotice,
  setSettingsOpen,
  t,
}: UseAccountActionsOptions) => {
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // A global sign-out revokes the refresh token on the server and can fail
      // while offline. Fall back to a local sign-out so the persisted session is
      // cleared and the app returns to (and stays on) the auth screen — even
      // after a restart.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignore — we still force-clear the in-memory session below
      }
      deactivateSession();
    }
  };

  const handleDeleteAccount = async () => {
    const ownerId = sessionRef.current?.user.id ?? session?.user.id;
    if (!ownerId) {
      throw new Error(
        t(
          '계정 삭제를 위해 다시 로그인해 주세요.',
          'Sign in again to delete your account.',
        ),
      );
    }

    cancelLocalMemoIndexing();
    cancelLocalInboxIndexing();
    await deleteAccount();
    let localCleanupFailed = false;
    try {
      await clearLocalWorkspaceOwner(ownerId);
    } catch {
      localCleanupFailed = true;
    }
    setAuthNotice(
      localCleanupFailed
        ? t(
            '계정은 삭제되었지만 이 기기의 일부 데이터 정리에 문제가 있습니다. 앱을 다시 시작해 주세요.',
            'Your account was deleted, but some data on this device could not be cleaned up. Please restart the app.',
          )
        : t(
            '계정과 데이터가 삭제되었습니다.',
            'Your account and data were deleted.',
          ),
    );
    setSettingsOpen(false);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      deactivateSession();
    }
  };

  return { handleDeleteAccount, handleSignOut };
};
