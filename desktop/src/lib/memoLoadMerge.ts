import type { MemoRow } from '../types';

const byUpdatedDesc = (left: MemoRow, right: MemoRow) =>
  new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();

export const pendingMemoIdsForOwner = (
  pendingOwners: ReadonlyMap<string, string | null>,
  ownerId?: string,
) =>
  new Set(
    [...pendingOwners.entries()]
      .filter(([, pendingOwnerId]) => pendingOwnerId === (ownerId ?? null))
      .map(([memoId]) => memoId),
  );

export const partitionRemoteMemoConflictCopies = (memos: MemoRow[]) => ({
  conflictCopies: memos.filter(memo => Boolean(memo.conflict_of)),
  visibleMemos: memos.filter(memo => !memo.conflict_of),
});

// A workspace refresh is only a snapshot. A pending local write remains
// authoritative until SQLite accepts it. An open editor also owns its live
// document until that editor closes; replacing only the parent row would leave
// Tiptap on the old text and make the next keystroke overwrite the loaded row.
export const mergeLoadedMemosPreservingLocalWrites = (
  loadedMemos: MemoRow[],
  currentMemos: MemoRow[],
  pendingLocalWriteIds: ReadonlySet<string>,
  openEditorMemoIds: ReadonlySet<string> = new Set(),
) => {
  const merged = new Map(loadedMemos.map(memo => [memo.id, memo]));

  for (const memo of currentMemos) {
    if (
      pendingLocalWriteIds.has(memo.id) ||
      openEditorMemoIds.has(memo.id)
    ) {
      merged.set(memo.id, memo);
    }
  }

  return [...merged.values()]
    .filter(memo => !memo.is_archived)
    .sort(byUpdatedDesc);
};

export const shouldDeferMemoSync = (
  memoId: string,
  pendingLocalWriteIds: ReadonlySet<string>,
  scheduledSyncIds: { has: (memoId: string) => boolean },
) =>
  pendingLocalWriteIds.has(memoId) || scheduledSyncIds.has(memoId);
