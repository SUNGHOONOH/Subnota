import { createInboxSession } from './inboxApi';
import {
  listLocalInboxSessions,
  markLocalInboxSessionFailed,
  removeLocalInboxSession,
} from './localInboxQueue';

export interface InboxSyncResult {
  syncedCount: number;
}

export const syncPendingInboxSessions = async (): Promise<InboxSyncResult> => {
  const queue = await listLocalInboxSessions();
  let syncedCount = 0;

  for (const item of queue) {
    const url = item.originalUrl ?? item.canonicalUrl;
    if (!url) {
      await markLocalInboxSessionFailed(item.clientId);
      continue;
    }

    try {
      await createInboxSession({
        clientId: item.clientId,
        rawSharedText: item.rawSharedText ?? item.title,
        selectedText: item.selectedText,
        url,
        userNote: item.userNote,
      });
      await removeLocalInboxSession(item.clientId);
      syncedCount += 1;
    } catch {
      await markLocalInboxSessionFailed(item.clientId);
    }
  }

  return { syncedCount };
};
