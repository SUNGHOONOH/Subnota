import type { InboxSession } from '../../services/backend/inboxService';

type InboxItemSavedListener = (item: InboxSession) => void;

const inboxItemSavedListeners = new Set<InboxItemSavedListener>();

export const emitInboxItemSaved = (item: InboxSession) => {
  inboxItemSavedListeners.forEach(listener => listener(item));
};

export const subscribeInboxItemSaved = (listener: InboxItemSavedListener) => {
  inboxItemSavedListeners.add(listener);
  return () => {
    inboxItemSavedListeners.delete(listener);
  };
};
