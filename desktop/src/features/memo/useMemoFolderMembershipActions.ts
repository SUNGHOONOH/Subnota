import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { createFolderClassifierTerms } from './folderOrganization';
import {
  getLocalWorkspaceOwner,
  removeLocalMemoFolderAction,
  removeLocalMemoFolderExclusion,
  removeLocalMemoFolderMembership,
  saveLocalMemoFolder,
  saveLocalMemoFolderAction,
  saveLocalMemoFolderExclusion,
  saveLocalMemoFolderMembership,
} from '../../services/local/offlineStore';
import {
  deleteMemoFolderExclusion,
  deleteMemoFolderMembership,
  upsertMemoFolder,
  upsertMemoFolderExclusion,
  upsertMemoFolderMemberships,
} from '../../services/supabase/data';
import type {
  MemoFolder,
  MemoFolderExclusion,
  MemoFolderMembership,
  MemoRow,
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
  folderMutationQueueRef: MutableRefObject<MutationQueueRef['current']>;
  memoFolderExclusions: MemoFolderExclusion[];
  memoFolderMemberships: MemoFolderMembership[];
  memoFolders: MemoFolder[];
  memos: MemoRow[];
  session: Session | null;
  setMemoFolderExclusions: Dispatch<SetStateAction<MemoFolderExclusion[]>>;
  setMemoFolderMemberships: Dispatch<SetStateAction<MemoFolderMembership[]>>;
  setMemoFolders: Dispatch<SetStateAction<MemoFolder[]>>;
}

export const useMemoFolderMembershipActions = ({
  folderMembershipMutationQueueRef,
  folderMutationQueueRef,
  memoFolderExclusions,
  memoFolderMemberships,
  memoFolders,
  memos,
  session,
  setMemoFolderExclusions,
  setMemoFolderMemberships,
  setMemoFolders,
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

    // Overlap is only created by the explicit Topic → folder conversion. A
    // direct assignment must be a deliberate move: remove the old folder
    // membership first, then add this one.
    if (
      memoFolderMemberships.some(
        (membership) =>
          membership.memoId === memoId && membership.folderId !== folderId,
      )
    ) {
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
    const folder = memoFolders.find((item) => item.id === folderId);
    const selectedMemo = memos.find((memo) => memo.id === memoId);
    if (folder && selectedMemo) {
      const nextFolder = {
        ...folder,
        classifierTerms: createFolderClassifierTerms([
          ...(folder.classifierTerms ?? []),
          selectedMemo.content,
        ]),
        local_sync_status: 'pending' as const,
        updatedAt: new Date().toISOString(),
      };
      setMemoFolders((current) =>
        current.map((item) => (item.id === folderId ? nextFolder : item)),
      );
      await saveLocalMemoFolder(nextFolder, ownerId);
      if (session) {
        await folderMutationQueueRef.current
          .enqueue(folderId, async ({ isLatest }) => {
            await upsertMemoFolder(session, nextFolder);
            if (!isLatest()) return;
            await saveLocalMemoFolder(
              { ...nextFolder, local_sync_status: 'synced' },
              ownerId,
            );
          })
          .catch((error) => {
            console.warn('Folder classifier sync deferred:', error);
          });
      }
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
