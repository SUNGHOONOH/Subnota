import type { MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  type InboxSession,
  createInboxSession,
  deleteInboxSession,
  deleteInboxSessionByClientId,
} from '../../services/backend/inboxService';
import {
  cacheLocalInboxItem,
  isLocalInboxSessionDeleted,
  loadLocalInboxItems,
  loadLocalInboxQueue,
  removeLocalInboxSession,
  removeLocalInboxSessionIfNotDeleted,
} from '../../services/local/offlineStore';

interface UseSyncPendingInboxItemsOptions {
  currentSession: Session;
  deletedPendingInboxClientIdsRef: MutableRefObject<Set<string>>;
  discardDeletedPendingInboxItem: (
    currentSession: Session,
    item: InboxSession,
    clientId: string,
    ownerId: string,
  ) => Promise<void>;
  inboxServerIdsByClientIdRef: MutableRefObject<Map<string, string>>;
  ownerId: string;
  pendingInboxDeleteIdsRef: MutableRefObject<Set<string>>;
}

/**
 * Drains Inbox tombstones and the local create queue after a session becomes
 * available. Client-id checks keep a slow create/delete race from resurrecting
 * a row that the user already removed.
 */
export const syncPendingInboxItems = async ({
  currentSession,
  deletedPendingInboxClientIdsRef,
  discardDeletedPendingInboxItem,
  inboxServerIdsByClientIdRef,
  ownerId,
  pendingInboxDeleteIdsRef,
}: UseSyncPendingInboxItemsOptions) => {
  // client_id lets a tombstone delete a server row without depending on the
  // limited Inbox list. If a slow POST has not committed yet, keep the
  // tombstone and retry instead of treating an empty delete as completion.
  for (const tombstone of (await loadLocalInboxItems(ownerId)).filter(
    (item) => item.local_sync_status === 'pending_delete',
  )) {
    try {
      const deleted = tombstone.clientId
        ? await deleteInboxSessionByClientId(
            currentSession,
            tombstone.clientId,
          )
        : (await deleteInboxSession(currentSession, tombstone.id), true);
      if (!deleted) continue;
      await removeLocalInboxSession(tombstone.id, ownerId);
      pendingInboxDeleteIdsRef.current.delete(tombstone.id);
      if (tombstone.clientId) {
        if (tombstone.id !== tombstone.clientId) {
          await removeLocalInboxSession(tombstone.clientId, ownerId);
        }
        deletedPendingInboxClientIdsRef.current.delete(tombstone.clientId);
      }
    } catch {
      // Keep the tombstone hidden and retry on reconnect/app start.
    }
  }

  for (const item of await loadLocalInboxQueue(ownerId)) {
    if (deletedPendingInboxClientIdsRef.current.has(item.clientId)) {
      continue;
    }
    if (!item.originalUrl) {
      continue;
    }

    try {
      const created = await createInboxSession(currentSession, {
        clientId: item.clientId,
        selectedText: item.selectedText,
        url: item.originalUrl,
        userNote: item.userNote,
      });
      inboxServerIdsByClientIdRef.current.set(item.clientId, created.id);
      const pendingItemWasDeleted = async () =>
        deletedPendingInboxClientIdsRef.current.has(item.clientId) ||
        (await isLocalInboxSessionDeleted(item.clientId, ownerId));
      if (await pendingItemWasDeleted()) {
        deletedPendingInboxClientIdsRef.current.add(item.clientId);
        pendingInboxDeleteIdsRef.current.add(item.clientId);
        await discardDeletedPendingInboxItem(
          currentSession,
          created,
          item.clientId,
          ownerId,
        );
        continue;
      }
      // 캐시에 먼저 쓰고 큐에서 뺀다 — 다음 fetch 전에 재시작해도 보인다.
      await cacheLocalInboxItem(created, ownerId);
      if (await pendingItemWasDeleted()) {
        deletedPendingInboxClientIdsRef.current.add(item.clientId);
        pendingInboxDeleteIdsRef.current.add(item.clientId);
        await discardDeletedPendingInboxItem(
          currentSession,
          created,
          item.clientId,
          ownerId,
        );
        continue;
      }
      const removedPendingItem = await removeLocalInboxSessionIfNotDeleted(
        item.clientId,
        ownerId,
      );
      if (!removedPendingItem || (await pendingItemWasDeleted())) {
        deletedPendingInboxClientIdsRef.current.add(item.clientId);
        pendingInboxDeleteIdsRef.current.add(item.clientId);
        await discardDeletedPendingInboxItem(
          currentSession,
          created,
          item.clientId,
          ownerId,
        );
      }
    } catch {
      // Keep the item queued. Reconnect or a later app start retries it.
    }
  }
};
