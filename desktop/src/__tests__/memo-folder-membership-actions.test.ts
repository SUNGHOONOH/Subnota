import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '..', relativePath), 'utf8');

const actions = read('features/memo/useMemoFolderMembershipActions.ts');
const menu = read('features/memo/components/MemoContextMenu.tsx');

describe('memo folder memberships', () => {
  it('allows an explicit assignment to keep existing folder memberships', () => {
    expect(actions).not.toContain('direct assignment must be a deliberate move');
    expect(actions).not.toContain(
      'membership.memoId === memoId && membership.folderId !== folderId',
    );
    expect(menu).not.toContain('isAssignedElsewhere');
    expect(menu).not.toContain('disabled={!isAssigned');
  });
});
