import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const appSource = read('App.tsx');
const hookSource = read('features/memo/useDeleteMemoFolder.ts');

describe('memo folder deletion boundary', () => {
  it('keeps App as the folder deletion wiring layer', () => {
    expect(appSource).toContain(
      "import { useDeleteMemoFolder } from './features/memo/useDeleteMemoFolder';",
    );
    expect(appSource).toContain(
      'const { deleteUserMemoFolder } = useDeleteMemoFolder({',
    );
    expect(appSource).not.toContain('const deleteUserMemoFolder = async (folderId: string) => {');
  });

  it('removes the folder and every local child record optimistically', () => {
    expect(hookSource).toContain('folderMemberships.filter');
    expect(hookSource).toContain('folderExclusions.filter');
    expect(hookSource).toContain('setMemoFolders((current) =>');
    expect(hookSource).toContain('setMemoFolderMemberships((current) =>');
    expect(hookSource).toContain('setMemoFolderExclusions((current) =>');
    expect(hookSource).toContain('removeLocalMemoFolder(folderId, ownerId)');
    expect(hookSource).toContain('removeLocalMemoFolderMembership(folderId, membership.memoId, ownerId)');
    expect(hookSource).toContain('removeLocalMemoFolderExclusion(folderId, exclusion.memoId, ownerId)');
  });

  it('records a deletion tombstone before removing the cloud row', () => {
    expect(hookSource).toContain("kind: 'delete_folder'");
    expect(hookSource).toContain('folderMutationQueueRef.current');
    expect(hookSource).toContain('await deleteMemoFolder(session, folderId);');
    expect(hookSource).toContain('await removeLocalMemoFolderAction(`delete_folder:${folderId}`, ownerId);');
  });

  it('uses the existing authenticated session guard and deferred-sync warning', () => {
    expect(hookSource).toContain('if (session) {');
    expect(hookSource).toContain("console.warn('Folder deletion sync deferred:', error);");
  });
});
