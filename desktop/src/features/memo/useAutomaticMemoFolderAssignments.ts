import { type Dispatch, useEffect, useRef, useState, type MutableRefObject, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import { subscribeLocalMemoIndexProgress } from '../../services/local/localMemoIndexer';
import { getLocalWorkspaceOwner, saveLocalMemoFolderMembership } from '../../services/local/offlineStore';
import { upsertMemoFolderMemberships } from '../../services/supabase/data';
import type { MemoFolder, MemoFolderExclusion, MemoFolderMembership, MemoRow } from '../../types';
import { buildFolderClassificationRequest, toAutomaticMemberships } from './folderOrganization';

interface Options {
  folderMembershipMutationQueueRef: MutableRefObject<{ enqueue: (key: string, action: (options: { isLatest: () => boolean }) => Promise<void>) => Promise<void> }>;
  memoFolderExclusions: MemoFolderExclusion[];
  memoFolderMemberships: MemoFolderMembership[];
  memoFolders: MemoFolder[];
  memos: MemoRow[];
  session: Session | null;
  setMemoFolderMemberships: Dispatch<SetStateAction<MemoFolderMembership[]>>;
}

/** Files unfiled notes into automatic folders using the stored local chunk
 * vectors. It needs no model at run time, only notes that were indexed. */
export const useAutomaticMemoFolderAssignments = ({ folderMembershipMutationQueueRef, memoFolderExclusions, memoFolderMemberships, memoFolders, memos, session, setMemoFolderMemberships }: Options) => {
  // New vectors land a few seconds after typing; re-run when indexing finishes.
  const [indexGeneration, setIndexGeneration] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeLocalMemoIndexProgress((progress) => {
      if (progress.stage === 'complete') setIndexGeneration((current) => current + 1);
    });
    return () => { unsubscribe(); };
  }, []);

  // A sync can file a note while the classifier is still answering; the
  // effect cleanup only runs after that commit, so re-check the latest rows.
  const latestMembershipsRef = useRef(memoFolderMemberships);
  latestMembershipsRef.current = memoFolderMemberships;

  // Only the set of live notes matters, not their text — typing must not re-run this.
  const activeMemoKey = memos.filter((memo) => !memo.is_archived).map((memo) => memo.id).join('\n');

  useEffect(() => {
    const activeMemoIds = activeMemoKey ? activeMemoKey.split('\n') : [];
    const request = buildFolderClassificationRequest({ activeMemoIds, folders: memoFolders, memberships: memoFolderMemberships });
    const api = window.electronAPI;
    if (!request || !api?.localDbClassifyFolderMemos) return;
    // Any membership change re-runs this effect; a stale answer must not land.
    let isCurrent = true;
    const localOwner = getLocalWorkspaceOwner();
    const ownerId = session?.user.id ?? localOwner ?? undefined;
    void api.localDbSetOwner(localOwner)
      .then(() => api.localDbClassifyFolderMemos(localOwner, request))
      .then(async (assignments) => {
        if (!isCurrent) return;
        const filedMemoIds = new Set(latestMembershipsRef.current.map((item) => item.memoId));
        const pendingAssignments = toAutomaticMemberships(assignments, memoFolderExclusions)
          .filter((membership) => !filedMemoIds.has(membership.memoId))
          .map((membership) => ({ ...membership, local_sync_status: 'pending' as const }));
        if (pendingAssignments.length === 0) return;
        setMemoFolderMemberships((current) => {
          const filed = new Set(current.map((item) => item.memoId));
          return [...current, ...pendingAssignments.filter((item) => !filed.has(item.memoId))];
        });
        await Promise.all(pendingAssignments.map((membership) => saveLocalMemoFolderMembership(membership, ownerId)));
        if (session === null) return;
        await Promise.all(pendingAssignments.map((membership) =>
          folderMembershipMutationQueueRef.current.enqueue(`${membership.folderId}:${membership.memoId}`, async ({ isLatest }) => {
            if (!isLatest()) return;
            await upsertMemoFolderMemberships(session, [membership], { ignoreExisting: true });
            if (!isLatest()) return;
            await saveLocalMemoFolderMembership({ ...membership, local_sync_status: 'synced' }, ownerId);
          })));
      })
      .catch((error) => { console.warn('Automatic folder assignment deferred:', error); });
    return () => { isCurrent = false; };
  }, [activeMemoKey, indexGeneration, memoFolderMemberships, memoFolderExclusions, memoFolders, session]);
};
