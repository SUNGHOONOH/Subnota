import { type Dispatch, useEffect, type MutableRefObject, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import { getLocalWorkspaceOwner, saveLocalMemoFolderMembership } from '../../services/local/offlineStore';
import { upsertMemoFolderMemberships } from '../../services/supabase/data';
import type { MemoFolder, MemoFolderExclusion, MemoFolderMembership, TopicCluster, TopicMembership } from '../../types';
import { getAutomaticFolderAssignments } from './folderOrganization';

interface Options {
  folderMembershipMutationQueueRef: MutableRefObject<{ enqueue: (key: string, action: (options: { isLatest: () => boolean }) => Promise<void>) => Promise<void> }>;
  memoFolderExclusions: MemoFolderExclusion[];
  memoFolderMemberships: MemoFolderMembership[];
  memoFolders: MemoFolder[];
  session: Session | null;
  setMemoFolderMemberships: Dispatch<SetStateAction<MemoFolderMembership[]>>;
  topicClusters: TopicCluster[];
  topicMemberships: TopicMembership[];
}

export const useAutomaticMemoFolderAssignments = ({ folderMembershipMutationQueueRef, memoFolderExclusions, memoFolderMemberships, memoFolders, session, setMemoFolderMemberships, topicClusters, topicMemberships }: Options) => {
  useEffect(() => {
    const assignments = getAutomaticFolderAssignments({ exclusions: memoFolderExclusions, folders: memoFolders, memberships: memoFolderMemberships, topicClusters, topicMemberships });
    if (assignments.length === 0) return;
    const pendingAssignments = assignments.map((membership) => ({ ...membership, local_sync_status: 'pending' as const }));
    const ownerId = session?.user.id ?? getLocalWorkspaceOwner() ?? undefined;
    setMemoFolderMemberships((current) => [...current, ...pendingAssignments]);
    void Promise.all(pendingAssignments.map((membership) => saveLocalMemoFolderMembership(membership, ownerId)))
      .then(() => Promise.all(pendingAssignments.map((membership) => {
        if (session === null) return undefined;
        return folderMembershipMutationQueueRef.current.enqueue(`${membership.folderId}:${membership.memoId}`, async ({ isLatest }) => {
          if (!isLatest()) return;
          await upsertMemoFolderMemberships(session, [membership], { ignoreExisting: true });
          if (!isLatest()) return;
          await saveLocalMemoFolderMembership({ ...membership, local_sync_status: 'synced' }, ownerId);
        });
      })))
      .catch((error) => { console.warn('Automatic folder assignment sync deferred:', error); });
  }, [memoFolderMemberships, memoFolderExclusions, memoFolders, session, topicClusters, topicMemberships]);
};
