import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { createUuid } from '../../lib/contentHash';
import {
  getLocalWorkspaceOwner,
  saveLocalMemoFolder,
  saveLocalMemoFolderMembership,
} from '../../services/local/offlineStore';
import {
  upsertMemoFolder,
  upsertMemoFolderMemberships,
} from '../../services/supabase/data';
import type {
  MemoFolder,
  MemoFolderMembership,
  MemoFolderMode,
  MemoRow,
  TopicCluster,
  TopicMembership,
} from '../../types';
import {
  createFolderClassifierTerms,
  createTopicFolderMemberships,
} from './folderOrganization';

interface MutationQueueRef {
  current: {
    enqueue: (
      key: string,
      action: (options: { isLatest: () => boolean }) => Promise<void>,
    ) => Promise<void>;
  };
}

interface UseCreateMemoFolderFromTopicOptions {
  folderMutationQueueRef: MutableRefObject<MutationQueueRef['current']>;
  memoFolders: MemoFolder[];
  memos: MemoRow[];
  session: Session | null;
  setMemoFolderMemberships: Dispatch<SetStateAction<MemoFolderMembership[]>>;
  setMemoFolders: Dispatch<SetStateAction<MemoFolder[]>>;
  topicClusters: TopicCluster[];
  topicMemberships: TopicMembership[];
}

export const useCreateMemoFolderFromTopic = ({
  folderMutationQueueRef,
  memoFolders,
  memos,
  session,
  setMemoFolderMemberships,
  setMemoFolders,
  topicClusters,
  topicMemberships,
}: UseCreateMemoFolderFromTopicOptions) => {
  const createMemoFolderFromTopic = async ({
    description,
    memoIds,
    mode = 'automatic',
    name,
    topicId,
  }: {
    description?: string;
    memoIds?: string[];
    mode?: MemoFolderMode;
    name?: string;
    topicId: string;
  }) => {
    const cluster = topicClusters.find((topic) => topic.id === topicId);
    if (!cluster) return null;

    const existing = memoFolders.find(
      (folder) => folder.sourceTopicId === topicId,
    );
    if (existing) return existing;

    const now = new Date().toISOString();
    const topicMemoIds = topicMemberships
      .filter((membership) => membership.topicId === topicId)
      .map((membership) => membership.memoId);
    const topicMemoContents = memos
      .filter((memo) => topicMemoIds.includes(memo.id))
      .map((memo) => memo.content);
    const folder: MemoFolder = {
      classifierTerms: createFolderClassifierTerms([
        name?.trim() || cluster.label,
        description?.trim() || cluster.keywords.join(' · '),
        ...cluster.keywords,
        ...topicMemoContents,
      ]),
      createdAt: now,
      description: description?.trim() || cluster.keywords.join(' · '),
      id: createUuid(),
      local_sync_status: 'pending',
      mode,
      name: name?.trim() || cluster.label,
      sourceTopicId: topicId,
      updatedAt: now,
    };
    // Topic conversion is the one intentional overlap path: all current
    // members are copied even when the user already filed a note elsewhere.
    const copiedMemberships = createTopicFolderMemberships(
      folder.id,
      topicId,
      topicMemberships,
      now,
    )
      .map((membership) => ({
        ...membership,
        local_sync_status: 'pending' as const,
      }))
      .filter((membership) => !memoIds || memoIds.includes(membership.memoId));
    const ownerId = session?.user.id ?? getLocalWorkspaceOwner() ?? undefined;

    setMemoFolders((current) => [folder, ...current]);
    setMemoFolderMemberships((current) => [...current, ...copiedMemberships]);
    await Promise.all([
      saveLocalMemoFolder(folder, ownerId),
      ...copiedMemberships.map((membership) =>
        saveLocalMemoFolderMembership(membership, ownerId),
      ),
    ]);
    if (session) {
      try {
        await folderMutationQueueRef.current.enqueue(
          folder.id,
          async ({ isLatest }) => {
            await upsertMemoFolder(session, folder);
            if (!isLatest()) return;
            await saveLocalMemoFolder(
              { ...folder, local_sync_status: 'synced' },
              ownerId,
            );
          },
        );
        await upsertMemoFolderMemberships(session, copiedMemberships);
        await Promise.all([
          ...copiedMemberships.map((membership) =>
            saveLocalMemoFolderMembership(
              { ...membership, local_sync_status: 'synced' },
              ownerId,
            ),
          ),
        ]);
      } catch (error) {
        console.warn('Topic folder sync deferred:', error);
      }
    }
    return folder;
  };

  return { createMemoFolderFromTopic };
};
