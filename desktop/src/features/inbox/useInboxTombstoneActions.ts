import { useCallback, type MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  type InboxSession,
  deleteInboxSessionByClientId,
} from '../../services/backend/inboxService';
import { removeLocalInboxSession } from '../../services/local/offlineStore';

interface UseInboxTombstoneActionsOptions {
  deletedPendingInboxClientIdsRef: MutableRefObject<Set<string>>;
  inboxServerIdsByClientIdRef: MutableRefObject<Map<string, string>>;
  pendingInboxDeleteIdsRef: MutableRefObject<Set<string>>;
  pendingInboxTombstoneWritesRef: MutableRefObject<Map<string, Promise<void>>>;
}

/**
 * Keeps a local Inbox delete tombstone ahead of slow create/list responses.
 * The server row is removed first; only then are the client-id tombstone and
 * local cache entries cleared so reconnects cannot resurrect the item.
 */
export const useInboxTombstoneActions = ({
  deletedPendingInboxClientIdsRef,
  inboxServerIdsByClientIdRef,
  pendingInboxDeleteIdsRef,
  pendingInboxTombstoneWritesRef,
}: UseInboxTombstoneActionsOptions) => {
  const discardDeletedPendingInboxItem = useCallback(
    async (
      currentSession: Session,
      item: InboxSession,
      clientId: string,
      ownerId: string,
    ) => {
      // The client-id tombstone survives until the server UUID is confirmed
      // deleted. This also closes the renderer-exit gap after a pending delete.
      await pendingInboxTombstoneWritesRef.current.get(
        `${ownerId}:${clientId}`,
      );
      const deleted = await deleteInboxSessionByClientId(
        currentSession,
        clientId,
      );
      if (!deleted) return;
      if (item.id !== clientId) {
        await removeLocalInboxSession(item.id, ownerId);
      }
      await removeLocalInboxSession(clientId, ownerId);
      inboxServerIdsByClientIdRef.current.delete(clientId);
      deletedPendingInboxClientIdsRef.current.delete(clientId);
      pendingInboxDeleteIdsRef.current.delete(clientId);
      pendingInboxDeleteIdsRef.current.delete(item.id);
    },
    [
      deletedPendingInboxClientIdsRef,
      inboxServerIdsByClientIdRef,
      pendingInboxDeleteIdsRef,
      pendingInboxTombstoneWritesRef,
    ],
  );

  const retryDeletedPendingInboxItems = useCallback(
    (currentSession: Session, items: InboxSession[], ownerId: string) => {
      for (const item of items) {
        const clientId = item.clientId;
        if (
          !clientId ||
          !deletedPendingInboxClientIdsRef.current.has(clientId)
        ) {
          continue;
        }
        inboxServerIdsByClientIdRef.current.set(clientId, item.id);
        void discardDeletedPendingInboxItem(
          currentSession,
          item,
          clientId,
          ownerId,
        ).catch(() => undefined);
      }
    },
    [
      deletedPendingInboxClientIdsRef,
      discardDeletedPendingInboxItem,
      inboxServerIdsByClientIdRef,
    ],
  );

  return { discardDeletedPendingInboxItem, retryDeletedPendingInboxItems };
};
