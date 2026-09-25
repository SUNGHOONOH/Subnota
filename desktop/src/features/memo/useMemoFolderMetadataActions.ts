import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import { createUuid } from '../../lib/contentHash';
import { getLocalWorkspaceOwner, saveLocalMemoFolder } from '../../services/local/offlineStore';
import { upsertMemoFolder } from '../../services/supabase/data';
import type { MemoFolder, MemoFolderMode } from '../../types';
import { createFolderClassifierTerms } from './folderOrganization';

interface UseMemoFolderMetadataActionsOptions {
  folderMutationQueueRef: MutableRefObject<{
    enqueue: (
      key: string,
      action: (options: { isLatest: () => boolean }) => Promise<void>,
    ) => Promise<void>;
  }>;
  memoFolders: MemoFolder[];
  session: Session | null;
  setMemoFolders: Dispatch<SetStateAction<MemoFolder[]>>;
}

export const useMemoFolderMetadataActions = ({
  folderMutationQueueRef,
  memoFolders,
  session,
  setMemoFolders,
}: UseMemoFolderMetadataActionsOptions) => {
  const ownerId = () => session?.user.id ?? getLocalWorkspaceOwner() ?? undefined;

  const syncFolder = async (
    folder: MemoFolder,
    folderOwnerId: string | undefined,
    warning: string,
  ) => {
    if (!session) return;
    await folderMutationQueueRef.current.enqueue(folder.id, async ({ isLatest }) => {
      await upsertMemoFolder(session, folder);
      if (!isLatest()) return;
      await saveLocalMemoFolder({ ...folder, local_sync_status: 'synced' }, folderOwnerId);
    }).catch(error => console.warn(warning, error));
  };

  const createMemoFolder = async ({ description = '', mode, name }: {
    description?: string;
    mode: MemoFolderMode;
    name: string;
  }) => {
    const now = new Date().toISOString();
    const folder: MemoFolder = {
      classifierTerms: createFolderClassifierTerms([name, description]),
      createdAt: now,
      description: description.trim(),
      id: createUuid(),
      local_sync_status: 'pending',
      mode,
      name: name.trim(),
      sourceTopicId: null,
      updatedAt: now,
    };
    if (!folder.name) return null;
    const folderOwnerId = ownerId();
    setMemoFolders(current => [folder, ...current]);
    await saveLocalMemoFolder(folder, folderOwnerId);
    await syncFolder(folder, folderOwnerId, 'Folder creation sync deferred:');
    return folder;
  };

  const updateMemoFolderMode = async (folderId: string, mode: MemoFolderMode) => {
    const current = memoFolders.find(folder => folder.id === folderId);
    if (!current || current.mode === mode) return;
    const next = { ...current, local_sync_status: 'pending' as const, mode, updatedAt: new Date().toISOString() };
    const folderOwnerId = ownerId();
    setMemoFolders(folders => folders.map(folder => folder.id === folderId ? next : folder));
    await saveLocalMemoFolder(next, folderOwnerId);
    await syncFolder(next, folderOwnerId, 'Folder mode sync deferred:');
  };

  const updateMemoFolderDetails = async (folderId: string, draft: { description: string; name: string }) => {
    const current = memoFolders.find(folder => folder.id === folderId);
    const name = draft.name.trim();
    if (!current || !name) return;
    const next = {
      ...current,
      classifierTerms: createFolderClassifierTerms([...(current.classifierTerms ?? []), draft.name, draft.description]),
      description: draft.description.trim(),
      local_sync_status: 'pending' as const,
      name,
      updatedAt: new Date().toISOString(),
    };
    const folderOwnerId = ownerId();
    setMemoFolders(folders => folders.map(folder => folder.id === folderId ? next : folder));
    await saveLocalMemoFolder(next, folderOwnerId);
    await syncFolder(next, folderOwnerId, 'Folder details sync deferred:');
  };

  return { createMemoFolder, updateMemoFolderDetails, updateMemoFolderMode };
};
