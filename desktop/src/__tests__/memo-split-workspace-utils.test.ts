import { describe, expect, it } from 'vitest';

import type { InboxSession } from '../services/backend/inboxService';
import type { MemoRow } from '../types';
import {
  createEditor,
  getActiveEditor,
  getMemoTabLabel,
  getPaneEditors,
  getSourceLabel,
  inboxSessionToSourceResult,
  memoToPreviewResult,
  mirrorEditorPatch,
  viewLabel,
} from '../features/memo/memoSplitWorkspaceUtils';

const inboxItem: InboxSession = {
  canonicalUrl: 'https://example.com/article',
  channelTitle: 'Example',
  createdAt: '2026-01-02T03:04:05.000Z',
  description: 'Description',
  domain: 'example.com',
  duration: null,
  id: 'inbox-1',
  keywords: [],
  liked: false,
  originalUrl: 'https://example.com/original',
  publishedAt: null,
  selectedText: null,
  sourceType: 'url',
  summary: 'Summary',
  summaryBasis: null,
  summaryDetail: null,
  summaryOneLiner: 'One line',
  summaryProvider: null,
  summarySearchText: null,
  summaryStatus: 'ready',
  thumbnailUrl: null,
  title: 'Title',
  userNote: null,
};

const memo: MemoRow = {
  content: 'Memo body',
  content_hash: null,
  created_at: '2026-01-02T03:04:05.000Z',
  id: 'memo-1',
  is_archived: false,
  updated_at: '2026-01-02T04:05:06.000Z',
};

describe('memo split workspace utility boundaries', () => {
  it('keeps localized view labels and first-line tab labels stable', () => {
    expect(viewLabel('calendar', 'ko')).toBe('캘린더');
    expect(viewLabel('calendar', 'en')).toBe('Calendar');
    expect(getMemoTabLabel('  첫 줄  \n둘째 줄', 'ko')).toBe('첫 줄');
    expect(getMemoTabLabel('\n  ', 'en')).toBe('Note');
  });

  it('creates editor state with the existing draft default', () => {
    expect(createEditor('memo', { memoId: 'memo-1' })).toMatchObject({
      memoId: 'memo-1',
      mode: 'draft',
      view: 'memo',
    });
    expect(createEditor('calendar')).toMatchObject({
      mode: undefined,
      view: 'calendar',
    });
  });

  it('normalizes legacy panes and finds the active editor', () => {
    const legacyPane = { id: 'pane-1', view: 'memo' as const };
    const editors = getPaneEditors(legacyPane);

    expect(editors).toHaveLength(1);
    expect(editors[0]).toMatchObject({ id: 'pane-1-editor', view: 'memo' });
    expect(getActiveEditor(legacyPane)).toMatchObject({
      id: 'pane-1-editor',
      view: 'memo',
    });
  });

  it('mirrors editor fields without adding unrelated pane state', () => {
    const editor = createEditor('network', {
      memoId: 'memo-1',
      selectedText: 'selected',
    });

    expect(mirrorEditorPatch(editor)).toEqual({
      draftCategory: undefined,
      draftText: undefined,
      highlight: undefined,
      isViewPicker: undefined,
      memoId: 'memo-1',
      mode: undefined,
      networkErrorMessage: undefined,
      networkIsLoading: undefined,
      networkQueryChunk: undefined,
      networkRequestId: undefined,
      networkResults: undefined,
      selectionEnd: undefined,
      selectionStart: undefined,
      selectedText: 'selected',
      sourceResult: undefined,
      view: 'network',
    });
  });

  it('maps inbox and memo previews to the existing network result contract', () => {
    expect(inboxSessionToSourceResult(inboxItem)).toMatchObject({
      chunkId: 'inbox-inbox-1',
      chunkText: 'One line',
      sourceKind: 'inbox',
      sourceLabel: 'Example',
      sourceUrl: 'https://example.com/article',
    });
    expect(memoToPreviewResult(memo)).toMatchObject({
      chunkId: 'memo-memo-1',
      memoContent: 'Memo body',
      memoId: 'memo-1',
      sourceKind: 'memo',
    });
  });

  it('keeps source labels localized and preserves explicit source labels', () => {
    const memoResult = memoToPreviewResult(memo);
    const inboxResult = inboxSessionToSourceResult({
      ...inboxItem,
      channelTitle: null,
    });

    expect(getSourceLabel(memoResult, 'ko')).toBe('노트');
    expect(getSourceLabel(memoResult, 'en')).toBe('Note');
    expect(getSourceLabel(inboxResult, 'ko')).toBe('example.com');
  });
});
