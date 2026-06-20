import { appStorage } from '../../../shared/storage/appStorage';
import type { InboxSession, InboxSourceType } from './inboxApi';

export type LocalInboxSyncStatus = 'pending' | 'failed';

export interface InboxSaveInput {
  clientId?: string | null;
  rawSharedText?: string | null;
  selectedText?: string | null;
  url: string;
  userNote?: string | null;
}

export interface LocalInboxSession extends InboxSession {
  clientId: string;
  isLocalOnly: true;
  rawSharedText: string | null;
  syncStatus: LocalInboxSyncStatus;
}

const STORAGE_KEY = 'subnota.inbox.localQueue.v1';

// Captures can arrive concurrently (menu-bar bridge + UI + background sync), and
// every mutation is a read-modify-write of the whole queue. Serialize them so a
// later write cannot clobber an earlier capture that hasn't been persisted yet.
let queueLock: Promise<unknown> = Promise.resolve();

const withQueueLock = <T>(operation: () => Promise<T>): Promise<T> => {
  const run = queueLock.then(operation, operation);
  queueLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const parseQueue = (raw: string | null): LocalInboxSession[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveQueue = (items: LocalInboxSession[]) =>
  appStorage.setItem(STORAGE_KEY, JSON.stringify(items));

export const createInboxClientId = () =>
  `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const domainFor = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const sourceTypeFor = (url: string): InboxSourceType => {
  const domain = domainFor(url) ?? '';
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    return 'youtube';
  }
  if (domain.includes('instagram.com')) {
    return 'instagram';
  }
  return 'url';
};

const urlKeyFor = (item: { canonicalUrl?: string | null; originalUrl?: string | null }) =>
  (item.canonicalUrl ?? item.originalUrl ?? '').trim();

const titleFor = (input: InboxSaveInput) => {
  const sharedText = input.rawSharedText?.trim();
  if (sharedText) {
    return sharedText;
  }
  return input.url;
};

export const listLocalInboxSessions = async (): Promise<LocalInboxSession[]> =>
  parseQueue(await appStorage.getItem(STORAGE_KEY));

export const enqueueLocalInboxSession = async (
  input: InboxSaveInput,
  syncStatus: LocalInboxSyncStatus = 'pending',
): Promise<LocalInboxSession> => {
  const now = new Date().toISOString();
  const clientId = input.clientId ?? createInboxClientId();
  const item: LocalInboxSession = {
    canonicalUrl: input.url,
    channelTitle: null,
    clientId,
    createdAt: now,
    description: null,
    domain: domainFor(input.url),
    duration: null,
    id: `local-${clientId}`,
    isLocalOnly: true,
    originalUrl: input.url,
    publishedAt: null,
    rawSharedText: input.rawSharedText ?? null,
    selectedText: input.selectedText ?? null,
    sourceType: sourceTypeFor(input.url),
    summary: null,
    summaryBasis: '오프라인 저장',
    summaryDetail: null,
    summaryOneLiner: null,
    summaryProvider: null,
    summarySearchText: null,
    summaryStatus: 'pending',
    syncStatus,
    thumbnailUrl: null,
    title: titleFor(input),
    userNote: input.userNote ?? null,
  };
  const itemUrlKey = urlKeyFor(item);
  return withQueueLock(async () => {
    const queue = await listLocalInboxSessions();
    const nextQueue = [
      item,
      ...queue.filter(previous => {
        if (previous.clientId === clientId) {
          return false;
        }
        return !itemUrlKey || urlKeyFor(previous) !== itemUrlKey;
      }),
    ];
    await saveQueue(nextQueue);
    return item;
  });
};

export const removeLocalInboxSession = async (clientId: string) =>
  withQueueLock(async () => {
    const queue = await listLocalInboxSessions();
    await saveQueue(queue.filter(item => item.clientId !== clientId));
  });

export const markLocalInboxSessionFailed = async (clientId: string) =>
  withQueueLock(async () => {
    const queue = await listLocalInboxSessions();
    await saveQueue(
      queue.map(item =>
        item.clientId === clientId ? { ...item, syncStatus: 'failed' } : item,
      ),
    );
  });
