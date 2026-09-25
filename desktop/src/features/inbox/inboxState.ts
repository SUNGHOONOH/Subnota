import type { InboxSession } from '../../services/backend/inboxService';

export const mergeInboxItems = (
  remoteItems: InboxSession[],
  localItems: Array<InboxSession & { local_sync_status?: string }>,
) => {
  // A synced local cache row can have the same server id as the fresh remote
  // row (older rows may not have a client id). Keep one visible card per
  // server id so React keys remain unique.
  const remoteIds = new Set(remoteItems.map((item) => item.id));
  const remoteClientIds = new Set(
    remoteItems.map((item) => item.clientId).filter(Boolean),
  );
  const pendingItems = localItems.filter(
    (item) =>
      (remoteIds.has(item.id)
        ? item.local_sync_status === 'pending' ||
          item.local_sync_status === 'failed'
        : !item.clientId || !remoteClientIds.has(item.clientId)),
  );

  const seenIds = new Set<string>();
  const deduplicated = [...pendingItems, ...remoteItems].filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });

  return deduplicated.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

export const withoutDeletedPendingInboxItems = (
  items: InboxSession[],
  deletedClientIds: Set<string>,
  deletedIds: Set<string> = new Set(),
) =>
  items.filter(
    (item) =>
      !deletedIds.has(item.id) &&
      (!item.clientId || !deletedClientIds.has(item.clientId)),
  );

export const collectPendingInboxDeletes = (
  items: Array<InboxSession & { local_sync_status?: string }>,
) => {
  const clientIds = new Set<string>();
  const ids = new Set<string>();
  for (const item of items) {
    if (item.local_sync_status !== 'pending_delete') continue;
    ids.add(item.id);
    if (item.clientId) clientIds.add(item.clientId);
  }
  return { clientIds, ids };
};

export interface RemoteInboxLikeState {
  confirmedLikes: Map<string, boolean>;
  latestLikes: Map<string, boolean>;
  pendingCounts: Map<string, number>;
  refreshFloor: Map<string, number>;
}

export const reconcileRemoteInboxLikes = (
  items: InboxSession[],
  requestSequence: number,
  { confirmedLikes, latestLikes, pendingCounts, refreshFloor }: RemoteInboxLikeState,
) =>
  items.map((item) => {
    const minimumFreshSequence = refreshFloor.get(item.id) ?? 0;
    const latestLocalLike = latestLikes.get(item.id);
    if (
      latestLocalLike !== undefined &&
      ((pendingCounts.get(item.id) ?? 0) > 0 ||
        requestSequence < minimumFreshSequence)
    ) {
      return { ...item, liked: latestLocalLike };
    }
    confirmedLikes.set(item.id, item.liked);
    latestLikes.set(item.id, item.liked);
    if (requestSequence >= minimumFreshSequence) {
      refreshFloor.delete(item.id);
    }
    return item;
  });
