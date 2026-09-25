import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';

// Vitest has no `@` alias (only the Vite renderer config does).
vi.mock('@/components/icons', () => import('../components/icons'));

import MemoSplitNoteMenu from '../features/memo/components/MemoSplitNoteMenu';
import type { MemoFolder, MemoRow } from '../types';

const memo: MemoRow = {
  category: null,
  content: '방금 쓴 메모',
  content_hash: null,
  created_at: '2026-09-25T00:00:00.000Z',
  id: 'memo-1',
  is_archived: false,
  updated_at: '2026-09-25T00:00:00.000Z',
};
const folder = (id: string, name: string): MemoFolder => ({
  createdAt: '2026-09-25T00:00:00.000Z',
  id,
  mode: 'manual',
  name,
  sourceTopicId: null,
  updatedAt: '2026-09-25T00:00:00.000Z',
});

const renderMenu = (patch: Partial<Parameters<typeof MemoSplitNoteMenu>[0]> = {}) =>
  renderToStaticMarkup(
    <MantineProvider>
      <MemoSplitNoteMenu
        editor={{ id: 'editor-1', memoId: 'memo-1', view: 'memo' } as never}
        folderMemberships={[{
          createdAt: '2026-09-25T00:00:00.000Z',
          folderId: 'folder-work',
          memoId: 'memo-1',
          score: null,
          source: 'user',
        }]}
        folders={[folder('folder-work', '업무'), folder('folder-trip', '여행')]}
        isMemoSyncRetrying={false}
        isNoteMenuOpen
        memo={memo}
        noteMenuFeedback={null}
        noteTitle="방금 쓴 메모"
        onClearFeedback={() => undefined}
        onCloseEditor={() => undefined}
        onCloseMenu={() => undefined}
        onCreateMemo={() => memo}
        onOpenMemoInPane={() => undefined}
        onSetFeedback={() => undefined}
        onSetMenuButtonElement={() => undefined}
        onSetMenuDropdownElement={() => undefined}
        onToggleMemoFolder={async () => undefined}
        onToggleMenu={() => undefined}
        pane={{ id: 'pane-1' } as never}
        pinnedMemoIds={[]}
        savePresentation={null}
        translate={(korean) => korean}
        value="방금 쓴 메모"
        {...patch}
      />
    </MantineProvider>,
  );

describe('note menu folder section', () => {
  it('lists every folder and marks the ones holding this note', () => {
    const markup = renderMenu();
    expect(markup).toContain('폴더에 넣기');
    expect(markup).toMatch(/aria-pressed="true"[^>]*>.*?업무/);
    expect(markup).toMatch(/aria-pressed="false"[^>]*>.*?여행/);
  });

  it('hides the section for an unsaved draft or when there are no folders', () => {
    expect(renderMenu({ memo: null })).not.toContain('폴더에 넣기');
    expect(renderMenu({ folders: [] })).not.toContain('폴더에 넣기');
  });
});
