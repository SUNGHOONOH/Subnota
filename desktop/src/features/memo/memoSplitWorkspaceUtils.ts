import type { InboxSession } from '../../services/backend/inboxService';
import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';
import { localize } from '../../lib/uiLanguage';
import type {
  MemoRow,
} from '../../types';
import type {
  MemoSplitEditorState,
  MemoSplitPaneState,
  MemoSplitPaneView,
} from './components/MemoSplitWorkspace';

export const VIEW_LABELS: Record<MemoSplitPaneView, { en: string; ko: string }> = {
  briefing: { en: 'Schedule inbox', ko: '일정 저장함' },
  calendar: { en: 'Calendar', ko: '캘린더' },
  inbox: { en: 'Link inbox', ko: '링크 저장함' },
  memo: { en: 'Note', ko: '노트' },
  network: { en: 'Nearby notes', ko: '주변 메모' },
  source: { en: 'Web summary', ko: '웹 요약' },
  topics: { en: 'Topics', ko: 'Topics' },
};

export const viewLabel = (
  view: MemoSplitPaneView,
  language: 'en' | 'ko',
) => VIEW_LABELS[view][language];

export const getMemoTabLabel = (content: string, language: 'en' | 'ko') => {
  const firstContentLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return firstContentLine ?? viewLabel('memo', language);
};

export const EDITOR_TAB_DRAG_TYPE = 'application/x-subnota-editor-tab';

export type TabDropTarget = {
  editorId?: string;
  paneId: string;
  position: 'after' | 'before';
};

export const SPLIT_PANE_MIN_WIDTH_PX = 240;

const createEditorId = () =>
  `editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createEditor = (
  view: MemoSplitPaneView = 'memo',
  patch: Partial<MemoSplitEditorState> = {},
): MemoSplitEditorState => ({
  id: createEditorId(),
  mode: view === 'memo' ? 'draft' : undefined,
  view,
  ...patch,
});

export const paneToEditor = (
  pane: MemoSplitPaneState,
): MemoSplitEditorState => ({
  draftCategory: pane.draftCategory,
  draftText: pane.draftText,
  highlight: pane.highlight,
  id: pane.activeEditorId ?? `${pane.id}-editor`,
  isViewPicker: pane.isViewPicker,
  memoId: pane.memoId,
  mode: pane.mode,
  networkErrorMessage: pane.networkErrorMessage,
  networkIsLoading: pane.networkIsLoading,
  networkQueryChunk: pane.networkQueryChunk,
  networkRequestId: pane.networkRequestId,
  networkResults: pane.networkResults,
  selectionEnd: pane.selectionEnd,
  selectionStart: pane.selectionStart,
  selectedText: pane.selectedText,
  sourceResult: pane.sourceResult,
  view: pane.view,
});

export const getPaneEditors = (pane: MemoSplitPaneState) =>
  pane.editors && pane.editors.length > 0
    ? pane.editors
    : [paneToEditor(pane)];

export const getActiveEditor = (pane: MemoSplitPaneState) => {
  const editors = getPaneEditors(pane);
  return (
    editors.find((editor) => editor.id === pane.activeEditorId) ?? editors[0]
  );
};

export const mirrorEditorPatch = (
  editor: MemoSplitEditorState,
): Partial<MemoSplitPaneState> => ({
  draftCategory: editor.draftCategory,
  draftText: editor.draftText,
  highlight: editor.highlight,
  isViewPicker: editor.isViewPicker,
  memoId: editor.memoId,
  mode: editor.mode,
  networkErrorMessage: editor.networkErrorMessage,
  networkIsLoading: editor.networkIsLoading,
  networkQueryChunk: editor.networkQueryChunk,
  networkRequestId: editor.networkRequestId,
  networkResults: editor.networkResults,
  selectionEnd: editor.selectionEnd,
  selectionStart: editor.selectionStart,
  selectedText: editor.selectedText,
  sourceResult: editor.sourceResult,
  view: editor.view,
});

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const inboxSessionToSourceResult = (
  item: InboxSession,
): NetworkSearchResult => ({
  chunkId: `inbox-${item.id}`,
  chunkText: item.summaryOneLiner ?? item.summary ?? item.description ?? '',
  createdAt: item.createdAt ? Date.parse(item.createdAt) : null,
  endIndex: 0,
  inboxSessionId: item.id,
  memoContent: null,
  memoCreatedAt: null,
  memoId: null,
  memoUpdatedAt: null,
  similarity: 0,
  sourceKind: 'inbox',
  sourceLabel: item.channelTitle ?? item.domain,
  sourceType: item.sourceType,
  sourceUrl: item.canonicalUrl ?? item.originalUrl,
  startIndex: 0,
  thumbnailUrl: item.thumbnailUrl,
  title: item.title,
});

export const memoToPreviewResult = (memo: MemoRow): NetworkSearchResult => ({
  chunkId: `memo-${memo.id}`,
  chunkText: '',
  createdAt: memo.created_at ? Date.parse(memo.created_at) : null,
  endIndex: 0,
  inboxSessionId: null,
  memoContent: memo.content,
  memoCreatedAt: memo.created_at ? Date.parse(memo.created_at) : null,
  memoId: memo.id,
  memoUpdatedAt: memo.updated_at ? Date.parse(memo.updated_at) : null,
  similarity: 0,
  sourceKind: 'memo',
  sourceLabel: null,
  sourceType: null,
  sourceUrl: null,
  startIndex: 0,
  thumbnailUrl: null,
  title: null,
});

export const getSourceLabel = (
  result: NetworkSearchResult,
  language: 'en' | 'ko',
) => {
  if (result.sourceKind === 'memo') {
    return localize(language, '노트', 'Note');
  }
  if (result.sourceLabel) {
    return result.sourceLabel;
  }
  return localize(language, '웹페이지', 'Web page');
};
