import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  retryInboxSessionSummary,
  type InboxSession,
} from '../../services/backend/inboxService';
import { cacheLocalInboxItem } from '../../services/local/offlineStore';

type Translate = (korean: string, english: string) => string;

interface UseInboxSummaryActionsOptions {
  currentSession: Session | null;
  isCurrentSession: (session: Session) => boolean;
  setInboxItems: Dispatch<SetStateAction<InboxSession[]>>;
  translate: Translate;
}

export const useInboxSummaryActions = ({
  currentSession,
  isCurrentSession,
  setInboxItems,
  translate: t,
}: UseInboxSummaryActionsOptions) => {
  const retryInboxSummary = useCallback(
    async (item: InboxSession) => {
      if (!currentSession) {
        throw new Error(
          t(
            '요약을 다시 만들려면 로그인해 주세요.',
            'Sign in to create the summary again.',
          ),
        );
      }

      const ownerId = currentSession.user.id;
      const updated = await retryInboxSessionSummary(currentSession, item.id);
      if (!isCurrentSession(currentSession)) return;

      await cacheLocalInboxItem(updated, ownerId);
      if (!isCurrentSession(currentSession)) return;
      setInboxItems(previous =>
        previous.map(previousItem =>
          previousItem.id === updated.id ? updated : previousItem,
        ),
      );
    },
    [currentSession, isCurrentSession, setInboxItems, t],
  );

  return { retryInboxSummary };
};
