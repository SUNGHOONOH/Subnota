import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  getLocalWorkspaceOwner,
  removeLocalMemoFolderAction,
  removeLocalMemoFolderExclusion,
  removeLocalMemoFolderMembership,
  saveLocalMemoFolderAction,
  saveLocalMemoFolderExclusion,
  saveLocalMemoFolderMembership,
} from '../../services/local/offlineStore';
import {
  deleteMemoFolderExclusion,
  deleteMemoFolderMembership,
  upsertMemoFolderExclusion,
  upsertMemoFolderMemberships,
} from '../../services/supabase/data';
import type {
  MemoFolder,
  MemoFolderExclusion,
  MemoFolderMembership,
} from '../../types';

interface MutationQueueRef {
  current: {
    enqueue: (
      key: string,
      action: (options: { isLatest: () => boolean }) => Promise<void>,
    ) => Promise<void>;
  };
}

interface UseMemoFolderMembershipActionsOptions {
  folderMembershipMutationQueueRef: MutableRefObject<
    MutationQueueRef['current']
  >;
  memoFolderExclusions: MemoFolderExclusion[];
  memoFolderMemberships: MemoFolderMembership[];
  memoFolders: MemoFolder[];
  session: Session | null;
  setMemoFolderExclusions: Dispatch<SetStateAction<MemoFolderExclusion[]>>;
  setMemoFolderMemberships: Dispatch<SetStateAction<MemoFolderMembership[]>>;
}

export const useMemoFolderMembershipActions = ({
  folderMembershipMutationQueueRef,
  memoFolderExclusions,
  memoFolderMemberships,
  memoFolders,
  session,
  setMemoFolderExclusions,
  setMemoFolderMemberships,
}: UseMemoFolderMembershipActionsOptions) => {
  const toggleMemoFolderMembership = async (
    folderId: string,
    memoId: string,
  ) => {
    const existing = memoFolderMemberships.find(
      (membership) =>
        membership.folderId === folderId && membership.memoId === memoId,
    );
    const ownerId = session?.user.id ?? getLocalWorkspaceOwner() ?? undefined;
    if (existing) {
      setMemoFolderMemberships((current) =>
        current.filter((item) => item !== existing),
      );
      await Promise.all([
        saveLocalMemoFolderAction(
          {
            folderId,
            id: `delete_membership:${folderId}:${memoId}`,
            kind: 'delete_membership',
            memoId,
            updated_at: new Date().toISOString(),
          },
          ownerId,
        ),
        removeLocalMemoFolderMembership(folderId, memoId, ownerId),
      ]);
      const folder = memoFolders.find((item) => item.id === folderId);
      const exclusion: MemoFolderExclusion | null =
        folder?.mode === 'automatic' || existing.source === 'automatic'
          ? {
              createdAt: new Date().toISOString(),
              folderId,
              local_sync_status: 'pending' as const,
              memoId,
            }
          : null;
      if (exclusion) {
        setMemoFolderExclusions((current) => [
          ...current.filter(
            (item) => item.folderId !== folderId || item.memoId !== memoId,
          ),
          exclusion,
        ]);
        await saveLocalMemoFolderExclusion(exclusion, ownerId);
      }
      if (session) {
        await folderMembershipMutationQueueRef.current
          .enqueue(`${folderId}:${memoId}`, async () => {
            if (exclusion) {
              await upsertMemoFolderExclusion(session, exclusion);
              await saveLocalMemoFolderExclusion(
                { ...exclusion, local_sync_status: 'synced' },
                ownerId,
              );
            }
            await deleteMemoFolderMembership(session, folderId, memoId);
            await removeLocalMemoFolderAction(
              `delete_membership:${folderId}:${memoId}`,
              ownerId,
            );
          })
          .catch((error) => {
            console.warn('Folder membership removal sync deferred:', error);
          });
      }
      return;
    }

    const membership: MemoFolderMembership = {
      createdAt: new Date().toISOString(),
      folderId,
      local_sync_status: 'pending',
      memoId,
      score: null,
      source: 'user',
    };
    const hadExclusion = memoFolderExclusions.some(
      (item) => item.folderId === folderId && item.memoId === memoId,
    );
    if (hadExclusion) {
      setMemoFolderExclusions((current) =>
        current.filter(
          (item) => item.folderId !== folderId || item.memoId !== memoId,
        ),
      );
      await Promise.all([
        saveLocalMemoFolderAction(
          {
            folderId,
            id: `delete_exclusion:${folderId}:${memoId}`,
            kind: 'delete_exclusion',
            memoId,
            updated_at: new Date().toISOString(),
          },
          ownerId,
        ),
        removeLocalMemoFolderExclusion(folderId, memoId, ownerId),
      ]);
    }
    setMemoFolderMemberships((current) => [...current, membership]);
    await Promise.all([
      removeLocalMemoFolderAction(
        `delete_membership:${folderId}:${memoId}`,
        ownerId,
      ),
      saveLocalMemoFolderMembership(membership, ownerId),
    ]);
    if (session) {
      await folderMembershipMutationQueueRef.current
        .enqueue(`${folderId}:${memoId}`, async () => {
          if (hadExclusion) {
            await deleteMemoFolderExclusion(session, folderId, memoId);
            await removeLocalMemoFolderAction(
              `delete_exclusion:${folderId}:${memoId}`,
              ownerId,
            );
          }
          await upsertMemoFolderMemberships(session, [membership]);
          await saveLocalMemoFolderMembership(
            { ...membership, local_sync_status: 'synced' },
            ownerId,
          );
        })
        .catch((error) => {
          console.warn('Folder membership sync deferred:', error);
        });
    }
  };

  return { toggleMemoFolderMembership };
};
