import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const appSource = read('App.tsx');
const hookSource = read('features/memo/useCreateMemoFolderFromTopic.ts');

describe('Topic → folder creation boundary', () => {
  it('leaves App with dependency wiring instead of the mutation body', () => {
    expect(appSource).toContain(
      "import { useCreateMemoFolderFromTopic } from './features/memo/useCreateMemoFolderFromTopic';",
    );
    expect(appSource).toContain(
      'const { createMemoFolderFromTopic } = useCreateMemoFolderFromTopic({',
    );
    expect(appSource).not.toContain('const createMemoFolderFromTopic = async ({');
  });

  it('keeps Topic conversion as an explicit, idempotent operation', () => {
    expect(hookSource).toContain('const cluster = topicClusters.find');
    expect(hookSource).toContain(
      'folder.sourceTopicId === topicId',
    );
    expect(hookSource).toContain('if (existing) return existing;');
    expect(hookSource).toContain('sourceTopicId: topicId');
    expect(hookSource).toContain("mode = 'automatic'");
  });

  it('freezes classifier input from the Topic and its current notes', () => {
    expect(hookSource).toContain('...cluster.keywords');
    expect(hookSource).toContain('...topicMemoContents');
    expect(hookSource).toContain('createFolderClassifierTerms([');
  });

  it('preserves the intentional overlap and optional recommendation subset', () => {
    expect(hookSource).toContain(
      'all current\n    // members are copied even when the user already filed a note elsewhere.',
    );
    expect(hookSource).toContain('createTopicFolderMemberships(');
    expect(hookSource).toContain(
      '.filter((membership) => !memoIds || memoIds.includes(membership.memoId));',
    );
  });

  it('keeps local-first persistence before authenticated cloud synchronization', () => {
    expect(hookSource.indexOf('setMemoFolders(')).toBeGreaterThan(-1);
    expect(hookSource.indexOf('await Promise.all([')).toBeGreaterThan(
      hookSource.indexOf('setMemoFolderMemberships('),
    );
    expect(hookSource).toContain('saveLocalMemoFolder(folder, ownerId)');
    expect(hookSource).toContain('saveLocalMemoFolderMembership(membership, ownerId)');
    expect(hookSource).toContain('folderMutationQueueRef.current.enqueue(');
    expect(hookSource).toContain('await upsertMemoFolder(session, folder);');
    expect(hookSource).toContain('await upsertMemoFolderMemberships(session, copiedMemberships);');
    expect(hookSource).toContain("console.warn('Topic folder sync deferred:', error);");
  });
});
