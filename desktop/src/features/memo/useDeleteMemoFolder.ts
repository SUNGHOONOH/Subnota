import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  getLocalWorkspaceOwner,
  removeLocalMemoFolder,
  removeLocalMemoFolderAction,
  removeLocalMemoFolderExclusion,
  removeLocalMemoFolderMembership,
  saveLocalMemoFolderAction,
} from '../../services/local/offlineStore';
import { deleteMemoFolder } from '../../services/supabase/data';
import type {
  MemoFolder,
  MemoFolderExclusion,
  MemoFolderMembership,
} from '../../types';

interface MutationQueueRef {
  current: {
    enqueue: (
      key: string,
      action: () => Promise<void>,
    ) => Promise<void>;
  };
}

interface UseDeleteMemoFolderOptions {
  folderMemberships: MemoFolderMembership[];
  folderExclusions: MemoFolderExclusion[];
  folderMutationQueueRef: MutableRefObject<MutationQueueRef['current']>;
  session: Session | null;
  setMemoFolderExclusions: Dispatch<SetStateAction<MemoFolderExclusion[]>>;
  setMemoFolderMemberships: Dispatch<SetStateAction<MemoFolderMembership[]>>;
  setMemoFolders: Dispatch<SetStateAction<MemoFolder[]>>;
}

export const useDeleteMemoFolder = ({
  folderExclusions,
  folderMemberships,
  folderMutationQueueRef,
  session,
  setMemoFolderExclusions,
  setMemoFolderMemberships,
  setMemoFolders,
}: UseDeleteMemoFolderOptions) => {
  const deleteUserMemoFolder = async (folderId: string) => {
    const ownerId = session?.user.id ?? getLocalWorkspaceOwner() ?? undefined;
    const removedMemberships = folderMemberships.filter(
      (membership) => membership.folderId === folderId,
    );
    const removedExclusions = folderExclusions.filter(
      (exclusion) => exclusion.folderId === folderId,
    );
    setMemoFolders((current) =>
      current.filter((folder) => folder.id !== folderId),
    );
    setMemoFolderMemberships((current) =>
      current.filter((membership) => membership.folderId !== folderId),
    );
    setMemoFolderExclusions((current) =>
      current.filter((exclusion) => exclusion.folderId !== folderId),
    );
    await Promise.all([
      saveLocalMemoFolderAction(
        {
          folderId,
          id: `delete_folder:${folderId}`,
          kind: 'delete_folder',
          updated_at: new Date().toISOString(),
        },
        ownerId,
      ),
      removeLocalMemoFolder(folderId, ownerId),
      ...removedMemberships.map((membership) =>
        removeLocalMemoFolderMembership(folderId, membership.memoId, ownerId),
      ),
      ...removedExclusions.map((exclusion) =>
        removeLocalMemoFolderExclusion(folderId, exclusion.memoId, ownerId),
      ),
    ]);
    if (session) {
      await folderMutationQueueRef.current
        .enqueue(folderId, async () => {
          await deleteMemoFolder(session, folderId);
          await removeLocalMemoFolderAction(`delete_folder:${folderId}`, ownerId);
        })
        .catch((error) => {
          console.warn('Folder deletion sync deferred:', error);
        });
    }
  };

  return { deleteUserMemoFolder };
};
