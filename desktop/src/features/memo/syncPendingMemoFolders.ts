import type { Session } from '@supabase/supabase-js';

import {
  loadLocalMemoFolderActions,
  loadLocalMemoFolderExclusions,
  loadLocalMemoFolderMemberships,
  loadLocalMemoFolders,
  removeLocalMemoFolderAction,
  saveLocalMemoFolder,
  saveLocalMemoFolderExclusion,
  saveLocalMemoFolderMembership,
} from '../../services/local/offlineStore';
import {
  deleteMemoFolder,
  deleteMemoFolderExclusion,
  deleteMemoFolderMembership,
  upsertMemoFolder,
  upsertMemoFolderExclusion,
  upsertMemoFolderMemberships,
} from '../../services/supabase/data';

/**
 * Retries local-first folder writes without allowing one failed row to block
 * the remaining folders, memberships, exclusions, or delete actions.
 */
export const syncPendingMemoFolders = async (
  currentSession: Session,
  ownerId: string,
) => {
  const pendingFolders = (await loadLocalMemoFolders(ownerId)).filter(
    (folder) =>
      folder.local_sync_status && folder.local_sync_status !== 'synced',
  );
  for (const folder of pendingFolders) {
    try {
      await upsertMemoFolder(currentSession, folder);
      await saveLocalMemoFolder(
        { ...folder, local_sync_status: 'synced' },
        ownerId,
      );
    } catch (error) {
      console.warn(
        'Pending folder sync failed; keeping it for retry.',
        error,
      );
    }
  }

  const pendingFolderMemberships = (
    await loadLocalMemoFolderMemberships(ownerId)
  ).filter(
    (membership) =>
      membership.local_sync_status &&
      membership.local_sync_status !== 'synced',
  );
  for (const membership of pendingFolderMemberships) {
    try {
      await upsertMemoFolderMemberships(currentSession, [membership], {
        ignoreExisting: membership.source !== 'user',
      });
      await saveLocalMemoFolderMembership(
        { ...membership, local_sync_status: 'synced' },
        ownerId,
      );
    } catch (error) {
      console.warn(
        'Pending folder membership sync failed; keeping it for retry.',
        error,
      );
    }
  }

  const pendingFolderExclusions = (
    await loadLocalMemoFolderExclusions(ownerId)
  ).filter(
    (exclusion) =>
      exclusion.local_sync_status &&
      exclusion.local_sync_status !== 'synced',
  );
  for (const exclusion of pendingFolderExclusions) {
    try {
      await upsertMemoFolderExclusion(currentSession, exclusion);
      await saveLocalMemoFolderExclusion(
        { ...exclusion, local_sync_status: 'synced' },
        ownerId,
      );
    } catch (error) {
      console.warn(
        'Pending folder exclusion sync failed; keeping it for retry.',
        error,
      );
    }
  }

  for (const action of await loadLocalMemoFolderActions(ownerId)) {
    try {
      if (action.kind === 'delete_folder') {
        await deleteMemoFolder(currentSession, action.folderId);
      } else if (action.kind === 'delete_membership' && action.memoId) {
        await deleteMemoFolderMembership(
          currentSession,
          action.folderId,
          action.memoId,
        );
      } else if (action.kind === 'delete_exclusion' && action.memoId) {
        await deleteMemoFolderExclusion(
          currentSession,
          action.folderId,
          action.memoId,
        );
      }
      await removeLocalMemoFolderAction(action.id, ownerId);
    } catch (error) {
      console.warn(
        'Pending folder delete failed; keeping it for retry.',
        error,
      );
    }
  }
};
