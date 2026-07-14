// Pinned memo ids, persisted locally per account (same owner scoping as the
// workspace session). ponytail: local-only — add a memos.pinned column +
// Supabase sync when cross-device pinning matters.
const PINNED_MEMOS_STORAGE_KEY = 'subnota.pinnedMemoIds.v1';

const pinnedMemosKey = (ownerId: string | null) =>
  `${PINNED_MEMOS_STORAGE_KEY}.${ownerId ? `user.${ownerId}` : 'guest'}`;

export const loadPinnedMemoIds = (ownerId: string | null): string[] => {
  try {
    const raw = window.localStorage?.getItem(pinnedMemosKey(ownerId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
};

export const savePinnedMemoIds = (ownerId: string | null, ids: string[]) => {
  try {
    window.localStorage?.setItem(pinnedMemosKey(ownerId), JSON.stringify(ids));
  } catch {
    // Pinning silently degrades to session-only when storage is unavailable.
  }
};

export const togglePinnedMemoId = (ids: string[], memoId: string): string[] =>
  ids.includes(memoId) ? ids.filter(id => id !== memoId) : [...ids, memoId];
