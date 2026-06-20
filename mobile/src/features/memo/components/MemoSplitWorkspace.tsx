import React, { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MemoChunk } from '../../../lib/memoChunker';
import { Memo, useMemoStore } from '../../../store/useMemoStore';
import BriefingScreen from '../../briefing/BriefingScreen';
import CalendarScreen from '../../calendar/CalendarScreen';
import InboxScreen from '../../inbox/InboxScreen';
import { NetworkSearchResult } from '../../network/services/networkService';
import GlobalNetworkGraph from './GlobalNetworkGraph';
import LocalKnnGraph from './LocalKnnGraph';
import MemoEditor from './MemoEditor';

export type MemoSplitPaneView =
  | 'memo'
  | 'inbox'
  | 'calendar'
  | 'briefing'
  | 'network'
  | 'source';

export interface MemoSplitEditorState {
  draftText?: string;
  highlight?: {
    chunkText?: string;
    endIndex: number;
    startIndex: number;
  } | null;
  id: string;
  memoId?: string;
  mode?: 'draft' | 'existing';
  networkErrorMessage?: string | null;
  networkIsLoading?: boolean;
  networkQueryChunk?: MemoChunk | null;
  networkRequestId?: string;
  networkResults?: NetworkSearchResult[];
  sourceResult?: NetworkSearchResult;
  view: MemoSplitPaneView;
}

export interface MemoSplitPaneState extends MemoSplitEditorState {
  activeEditorId?: string;
  editors?: MemoSplitEditorState[];
}

const VIEW_LABELS: Record<MemoSplitPaneView, string> = {
  briefing: '브리핑',
  calendar: '캘린더',
  inbox: '수집함',
  memo: '노트',
  network: '무의식',
  source: '링크',
};
const MENU_VIEWS: MemoSplitPaneView[] = [
  'memo',
  'inbox',
  'calendar',
  'briefing',
  'network',
];
const splitFontFamily =
  Platform.OS === 'macos' ? 'Apple SD Gothic Neo' : undefined;

const createEditorId = () =>
  `editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEditor = (
  view: MemoSplitPaneView = 'memo',
  patch: Partial<MemoSplitEditorState> = {},
): MemoSplitEditorState => ({
  id: createEditorId(),
  mode: view === 'memo' ? 'draft' : undefined,
  view,
  ...patch,
});

const paneToEditor = (pane: MemoSplitPaneState): MemoSplitEditorState => ({
  draftText: pane.draftText,
  highlight: pane.highlight,
  id: pane.activeEditorId ?? `${pane.id}-editor`,
  memoId: pane.memoId,
  mode: pane.mode,
  networkErrorMessage: pane.networkErrorMessage,
  networkIsLoading: pane.networkIsLoading,
  networkQueryChunk: pane.networkQueryChunk,
  networkRequestId: pane.networkRequestId,
  networkResults: pane.networkResults,
  sourceResult: pane.sourceResult,
  view: pane.view,
});

const getPaneEditors = (pane: MemoSplitPaneState) => {
  return pane.editors && pane.editors.length > 0
    ? pane.editors
    : [paneToEditor(pane)];
};

const getActiveEditor = (pane: MemoSplitPaneState) => {
  const editors = getPaneEditors(pane);
  return (
    editors.find(editor => editor.id === pane.activeEditorId) ?? editors[0]
  );
};

const mirrorEditorPatch = (
  editor: MemoSplitEditorState,
): Partial<MemoSplitPaneState> => ({
  draftText: editor.draftText,
  highlight: editor.highlight,
  memoId: editor.memoId,
  mode: editor.mode,
  networkErrorMessage: editor.networkErrorMessage,
  networkIsLoading: editor.networkIsLoading,
  networkQueryChunk: editor.networkQueryChunk,
  networkRequestId: editor.networkRequestId,
  networkResults: editor.networkResults,
  sourceResult: editor.sourceResult,
  view: editor.view,
});

interface MemoSplitWorkspaceProps {
  activeMemoId: string | null;
  focusedPaneId?: string | null;
  onChangePane: (id: string, patch: Partial<MemoSplitPaneState>) => void;
  onClosePane?: (id: string) => void;
  onFocusPane?: (id: string) => void;
  onOpenResult?: (result: NetworkSearchResult) => void;
  onSelectCategory: (category: string) => void;
  panes: MemoSplitPaneState[];
}

const getSourceLabel = (result: NetworkSearchResult) => {
  if (result.sourceKind === 'memo') {
    return '노트';
  }

  if (result.sourceLabel) {
    return result.sourceLabel;
  }

  if (result.sourceType === 'youtube') {
    return 'YouTube';
  }

  if (result.sourceType === 'instagram') {
    return 'Instagram';
  }

  return '웹페이지';
};

const SplitCalendarPane = React.memo(function SplitCalendarPane() {
  return <CalendarScreen />;
});

const SplitBriefingPane = React.memo(function SplitBriefingPane() {
  return <BriefingScreen />;
});

const SplitInboxPane = React.memo(function SplitInboxPane() {
  return <InboxScreen />;
});

const SplitGlobalNetworkPane = React.memo(function SplitGlobalNetworkPane({
  activeMemoId,
  onOpenMemoInPane,
  onSelectCategory,
  paneId,
}: {
  activeMemoId: string | null;
  onOpenMemoInPane: (paneId: string, memo: Memo) => void;
  onSelectCategory: (category: string) => void;
  paneId: string;
}) {
  const handleSelectMemo = useCallback(
    (memo: Memo) => {
      onOpenMemoInPane(paneId, memo);
    },
    [onOpenMemoInPane, paneId],
  );

  return (
    <GlobalNetworkGraph
      activeMemoId={activeMemoId}
      onSelectCategory={onSelectCategory}
      onSelectMemo={handleSelectMemo}
    />
  );
});

const SplitNetworkSearchPane = React.memo(function SplitNetworkSearchPane({
  errorMessage,
  isLoading,
  memoById,
  onOpenMemoInPane,
  paneId,
  queryChunk,
  results,
}: {
  errorMessage?: string | null;
  isLoading: boolean;
  memoById: Map<string, Memo>;
  onOpenMemoInPane: (paneId: string, memo: Memo) => void;
  paneId: string;
  queryChunk: MemoChunk | null;
  results: NetworkSearchResult[];
}) {
  const handleNavigateToMemo = useCallback(
    (memoId: string) => {
      const memo = memoById.get(memoId);
      if (memo) {
        onOpenMemoInPane(paneId, memo);
      }
    },
    [memoById, onOpenMemoInPane, paneId],
  );

  return (
    <View style={styles.networkSearchPane}>
      <View style={styles.networkSearchHeader}>
        <Text style={styles.networkSearchTitle}>네트워크</Text>
        <Text style={styles.networkSearchSubtitle}>
          커서 문장 기준으로 탐색합니다
        </Text>
      </View>
      <LocalKnnGraph
        errorMessage={errorMessage}
        isLoading={isLoading}
        onNavigateToMemo={handleNavigateToMemo}
        queryChunk={queryChunk}
        results={results}
      />
    </View>
  );
});

const MemoSplitWorkspace = ({
  activeMemoId,
  onChangePane,
  onClosePane,
  onSelectCategory,
  panes,
}: MemoSplitWorkspaceProps) => {
  const [openMenuPaneId, setOpenMenuPaneId] = useState<string | null>(null);
  const memos = useMemoStore(state => state.memos);
  const addMemo = useMemoStore(state => state.addMemo);
  const updateMemo = useMemoStore(state => state.updateMemo);

  const memoById = useMemo(() => {
    return new Map(memos.map(memo => [memo.id, memo]));
  }, [memos]);

  const patchActiveEditor = useCallback(
    (pane: MemoSplitPaneState, patch: Partial<MemoSplitEditorState>) => {
      const editors = getPaneEditors(pane);
      const activeEditor = getActiveEditor(pane);
      const nextActiveEditor: MemoSplitEditorState = {
        ...activeEditor,
        ...patch,
      };
      const nextEditors = editors.map(editor =>
        editor.id === activeEditor.id ? nextActiveEditor : editor,
      );

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextActiveEditor),
        activeEditorId: nextActiveEditor.id,
        editors: nextEditors,
      });
    },
    [onChangePane],
  );

  const handleAddEditor = useCallback(
    (pane: MemoSplitPaneState, view: MemoSplitPaneView = 'memo') => {
      const editors = getPaneEditors(pane);
      const activeEditor = getActiveEditor(pane);

      let finalEditors = editors;

      // Persist an in-progress draft before opening a new tab so it isn't lost.
      if (activeEditor.view === 'memo') {
        if (activeEditor.mode === 'draft' && activeEditor.draftText?.trim()) {
          const newId = addMemo(activeEditor.draftText.trim());
          finalEditors = editors.map(e => e.id === activeEditor.id ? { ...e, mode: 'existing', memoId: newId, draftText: undefined } : e);
        }
      }

      const nextEditor = createEditor(view);

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: [...finalEditors, nextEditor],
      });
    },
    [addMemo, onChangePane],
  );

  const handleCloseActiveEditor = useCallback(
    (pane: MemoSplitPaneState) => {
      const editors = getPaneEditors(pane);
      const activeEditor = getActiveEditor(pane);

      if (editors.length <= 1) {
        const nextEditor = createEditor('memo');
        onChangePane(pane.id, {
          ...mirrorEditorPatch(nextEditor),
          activeEditorId: nextEditor.id,
          editors: [nextEditor],
        });
        return;
      }

      const activeIndex = editors.findIndex(
        editor => editor.id === activeEditor.id,
      );
      const nextEditors = editors.filter(editor => editor.id !== activeEditor.id);
      const nextEditor =
        nextEditors[Math.max(0, Math.min(activeIndex, nextEditors.length - 1))];

      onChangePane(pane.id, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors: nextEditors,
      });
    },
    [onChangePane],
  );

  const openMemoInPane = useCallback(
    (paneId: string, memo: Memo) => {
      const pane = panes.find(candidate => candidate.id === paneId);
      const nextEditor = createEditor('memo', {
        highlight: null,
        memoId: memo.id,
        mode: 'existing',
      });
      const nextEditors = pane ? getPaneEditors(pane) : [];

      onChangePane(paneId, {
        ...mirrorEditorPatch(nextEditor),
        activeEditorId: nextEditor.id,
        editors:
          pane && nextEditors.length > 0
            ? nextEditors.map(editor =>
                editor.id === getActiveEditor(pane).id ? nextEditor : editor,
              )
            : [nextEditor],
      });
    },
    [onChangePane, panes],
  );

  const handleChangeMemoText = (
    pane: MemoSplitPaneState,
    editor: MemoSplitEditorState,
    nextText: string,
  ) => {
    if (editor.mode === 'existing' && editor.memoId) {
      updateMemo(editor.memoId, nextText);
      if (editor.highlight) {
        patchActiveEditor(pane, { highlight: null });
      }
      return;
    }

    if (!nextText.trim()) {
      patchActiveEditor(pane, { draftText: nextText, mode: 'draft' });
      return;
    }

    const memoId = addMemo(nextText);
    patchActiveEditor(pane, {
      draftText: undefined,
      highlight: null,
      memoId,
      mode: 'existing',
      sourceResult: undefined,
      view: 'memo',
    });
  };

  const renderHighlight = (
    pane: MemoSplitPaneState,
    editor: MemoSplitEditorState,
    value: string,
  ) => {
    if (!editor.highlight) {
      return null;
    }

    const startIndex = Math.max(0, editor.highlight.startIndex);
    const endIndex = Math.max(startIndex, editor.highlight.endIndex);
    const snippet =
      editor.highlight.chunkText ||
      value.slice(startIndex, Math.min(value.length, endIndex));

    return (
      <View style={styles.highlightCard}>
        <View style={styles.highlightHeader}>
          <Text style={styles.highlightLabel}>관련 문장</Text>
          <Pressable
            accessibilityLabel="관련 문장 강조 닫기"
            focusable={false}
            // @ts-ignore
            enableFocusRing={false}
            onPress={() => patchActiveEditor(pane, { highlight: null })}
            style={styles.highlightCloseButton}
          >
            <Text style={styles.highlightCloseText}>x</Text>
          </Pressable>
        </View>
        <Text numberOfLines={3} style={styles.highlightText}>
          {snippet}
        </Text>
      </View>
    );
  };

  const renderSourceBody = (result?: NetworkSearchResult) => {
    if (!result) {
      return (
        <View style={styles.emptySource}>
          <Text style={styles.emptySourceTitle}>출처가 없습니다</Text>
          <Text style={styles.emptySourceText}>
            추천 결과를 클릭하면 여기에서 저장한 링크 요약을 확인합니다.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.sourceContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sourceKind}>{getSourceLabel(result)}</Text>
        <Text style={styles.sourceTitle}>
          {result.title ?? result.sourceLabel ?? '저장한 링크'}
        </Text>
        {result.sourceUrl ? (
          <Pressable
            accessibilityRole="link"
            focusable={false}
            // @ts-ignore
            enableFocusRing={false}
            onPress={() => Linking.openURL(result.sourceUrl!)}
            style={({ pressed }) => [
              styles.sourceUrlButton,
              pressed && styles.pressed,
            ]}
          >
            <Text numberOfLines={1} style={styles.sourceUrlText}>
              {result.sourceUrl}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.sourceSummaryCard}>
          <Text style={styles.sourceSummaryLabel}>추천에 사용된 요약</Text>
          <Text style={styles.sourceSummaryText}>
            {result.chunkText || '요약 텍스트가 없습니다.'}
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderPaneBody = (
    pane: MemoSplitPaneState,
    editor: MemoSplitEditorState,
  ) => {
    if (editor.view === 'calendar') {
      return <SplitCalendarPane />;
    }

    if (editor.view === 'briefing') {
      return <SplitBriefingPane />;
    }

    if (editor.view === 'inbox') {
      return <SplitInboxPane />;
    }

    if (editor.view === 'network') {
      if (
        editor.networkIsLoading ||
        editor.networkErrorMessage ||
        editor.networkQueryChunk ||
        editor.networkResults
      ) {
        return (
          <SplitNetworkSearchPane
            errorMessage={editor.networkErrorMessage}
            isLoading={Boolean(editor.networkIsLoading)}
            memoById={memoById}
            onOpenMemoInPane={openMemoInPane}
            paneId={pane.id}
            queryChunk={editor.networkQueryChunk ?? null}
            results={editor.networkResults ?? []}
          />
        );
      }

      return (
        <SplitGlobalNetworkPane
          activeMemoId={activeMemoId}
          onOpenMemoInPane={openMemoInPane}
          onSelectCategory={onSelectCategory}
          paneId={pane.id}
        />
      );
    }

    if (editor.view === 'source') {
      return renderSourceBody(editor.sourceResult);
    }

    const memo = editor.memoId ? memoById.get(editor.memoId) ?? null : null;
    const value =
      editor.mode === 'existing' ? memo?.content ?? '' : editor.draftText ?? '';

    return (
      <View style={styles.memoPaneBody}>
        {renderHighlight(pane, editor, value)}
        <MemoEditor
          onChangeText={nextText => handleChangeMemoText(pane, editor, nextText)}
          onScheduleSelection={() => {}}
          onSelectionChange={() => {}}
          text={value}
        />
      </View>
    );
  };

  return (
    <View style={styles.workspace}>
      {panes.map(pane => {
        const editors = getPaneEditors(pane);
        const activeEditor = getActiveEditor(pane);
        const isMenuOpen = openMenuPaneId === pane.id;

        return (
          <View key={pane.id} style={styles.pane}>
            <View style={styles.paneHeader}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.editorTabsScroll}
              >
                <View style={styles.editorTabs}>
                  {editors.map(editor => (
                    <Pressable
                      key={editor.id}
                      accessibilityRole="tab"
                      accessibilityState={{
                        selected: editor.id === activeEditor.id,
                      }}
                      focusable={false}
                      // @ts-ignore
                      enableFocusRing={false}
                      onPress={() =>
                        onChangePane(pane.id, {
                          ...mirrorEditorPatch(editor),
                          activeEditorId: editor.id,
                          editors,
                        })
                      }
                      style={[
                        styles.editorTab,
                        editor.id === activeEditor.id && styles.editorTabActive,
                      ]}
                    >
                      <View style={styles.editorTabInner}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.editorTabText,
                            editor.id === activeEditor.id &&
                              styles.editorTabTextActive,
                          ]}
                        >
                          {VIEW_LABELS[editor.view]}
                        </Text>
                        {editors.length > 1 && (
                          <Pressable
                            accessibilityLabel="에디터 닫기"
                            focusable={false}
                            // @ts-ignore
                            enableFocusRing={false}
                            onPress={(e) => {
                              e.stopPropagation();
                              onChangePane(pane.id, {
                                ...mirrorEditorPatch(editor),
                                activeEditorId: activeEditor.id === editor.id 
                                  ? editors.find(e => e.id !== editor.id)!.id 
                                  : activeEditor.id,
                                editors: editors.filter(e => e.id !== editor.id),
                              });
                            }}
                            style={({ pressed }) => [
                              styles.tabCloseButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={styles.tabCloseIcon}>x</Text>
                          </Pressable>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.paneActions}>
                <Pressable
                  accessibilityLabel="에디터 추가"
                  focusable={false}
                  // @ts-ignore
                  enableFocusRing={false}
                  onPress={() => handleAddEditor(pane)}
                  style={({ pressed }) => [
                    styles.paneIconButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.paneIconText}>+</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="에디터 종류 선택"
                  focusable={false}
                  // @ts-ignore
                  enableFocusRing={false}
                  onPress={() =>
                    setOpenMenuPaneId(current =>
                      current === pane.id ? null : pane.id,
                    )
                  }
                  style={({ pressed }) => [
                    styles.paneIconButton,
                    isMenuOpen && styles.paneIconButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.paneIconText}>...</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="패널 닫기"
                  focusable={false}
                  // @ts-ignore
                  enableFocusRing={false}
                  onPress={() => onClosePane?.(pane.id)}
                  style={({ pressed }) => [
                    styles.paneIconButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.paneIconText, { fontSize: 13, paddingBottom: 2 }]}>x</Text>
                </Pressable>
              </View>
              {isMenuOpen && (
                <View style={styles.paneMenu}>
                  {MENU_VIEWS.map(view => (
                    <Pressable
                      key={view}
                      accessibilityRole="menuitem"
                      focusable={false}
                      // @ts-ignore
                      enableFocusRing={false}
                      onPress={() => {
                        handleAddEditor(pane, view);
                        setOpenMenuPaneId(null);
                      }}
                      style={({ pressed }) => [
                        styles.paneMenuItem,
                        activeEditor.view === view && styles.paneMenuItemActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.paneMenuItemText,
                          activeEditor.view === view &&
                            styles.paneMenuItemTextActive,
                        ]}
                      >
                        {VIEW_LABELS[view]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.paneBody}>
              {renderPaneBody(pane, activeEditor)}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  workspace: {
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
    overflow: 'hidden',
  },
  pane: {
    backgroundColor: '#FBFAF7',
    borderLeftColor: '#DCD7CF',
    borderLeftWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  paneHeader: {
    alignItems: 'center',
    backgroundColor: '#F6F4EF',
    borderBottomColor: '#DCD7CF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 32,
    overflow: 'visible',
    paddingHorizontal: 6,
    position: 'relative',
    zIndex: 10,
  },
  editorTabsScroll: {
    flex: 1,
  },
  editorTabs: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 1,
  },
  editorTab: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    maxWidth: 132,
    minHeight: 25,
    minWidth: 52,
    paddingHorizontal: 9,
  },
  editorTabActive: {
    backgroundColor: '#FBFAF7',
    borderColor: '#E1D8CA',
  },
  editorTabText: {
    color: '#766C61',
    fontSize: 11,
    fontWeight: '700',
  },
  editorTabTextActive: {
    color: '#2C2520',
  },
  editorTabInner: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  tabCloseButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    marginLeft: 6,
    width: 16,
  },
  tabCloseIcon: {
    color: '#8A8175',
    fontSize: 10,
    fontWeight: '600',
    marginTop: -1,
  },
  paneActions: {
    flexDirection: 'row',
    gap: 1,
    marginLeft: 6,
  },
  paneIconButton: {
    alignItems: 'center',
    borderRadius: 4,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  paneIconButtonActive: {
    backgroundColor: '#EDE7DC',
  },
  paneIconText: {
    color: '#5C4D3C',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  pressed: {
    backgroundColor: '#E5E0D6',
  },
  paneMenu: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E6E1DA',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 10,
    padding: 4,
    position: 'absolute',
    right: 8,
    shadowColor: '#2C2520',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    top: 42,
    width: 160,
    zIndex: 10,
  },
  paneMenuItem: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  paneMenuItemActive: {
    backgroundColor: '#EFE9DD',
  },
  paneMenuItemText: {
    color: '#5C4D3C',
    fontSize: 11,
    fontWeight: '800',
  },
  paneMenuItemTextActive: {
    color: '#2C2520',
    fontWeight: '900',
  },
  paneBody: {
    flex: 1,
    overflow: 'hidden',
  },
  networkSearchPane: {
    flex: 1,
  },
  networkSearchHeader: {
    borderBottomColor: '#E6E1DA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  networkSearchTitle: {
    color: '#2C2520',
    fontSize: 18,
    fontWeight: '900',
  },
  networkSearchSubtitle: {
    color: '#9C8E7C',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  memoPaneBody: {
    flex: 1,
    padding: 14,
  },
  highlightCard: {
    backgroundColor: '#F2EBDD',
    borderColor: '#DACDBB',
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
    padding: 10,
  },
  highlightHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  highlightLabel: {
    color: '#5C4D3C',
    fontSize: 11,
    fontWeight: '900',
  },
  highlightCloseButton: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  highlightCloseText: {
    color: '#786B5F',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  highlightText: {
    color: '#3B332B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  memoInput: {
    backgroundColor: '#FBFAF7',
    borderColor: '#DCD7CF',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#2C2520',
    flex: 1,
    ...(splitFontFamily ? { fontFamily: splitFontFamily } : {}),
    fontSize: Platform.OS === 'macos' ? 16 : 15,
    lineHeight: Platform.OS === 'macos' ? 25 : 23,
    padding: 14,
  },
  emptySource: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptySourceTitle: {
    color: '#2C2520',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptySourceText: {
    color: '#9C8E7C',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  sourceContent: {
    padding: 18,
  },
  sourceKind: {
    color: '#8B7355',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 6,
  },
  sourceTitle: {
    color: '#2C2520',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
    marginBottom: 10,
  },
  sourceUrlButton: {
    backgroundColor: '#EFE9DD',
    borderRadius: 7,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sourceUrlText: {
    color: '#5C4D3C',
    fontSize: 12,
    fontWeight: '800',
  },
  sourceSummaryCard: {
    backgroundColor: '#FFFDF8',
    borderColor: '#E6E1DA',
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  sourceSummaryLabel: {
    color: '#8B7355',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 7,
  },
  sourceSummaryText: {
    color: '#2C2520',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
});

export default MemoSplitWorkspace;
