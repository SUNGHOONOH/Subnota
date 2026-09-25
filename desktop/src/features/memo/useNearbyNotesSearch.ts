import {
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { NETWORK_MIN_SIMILARITY } from '../../lib/constants';
import type { MemoChunk } from '../../lib/memoChunker';
import { formatLocalMemoSearchErrorMessage, searchLocalMemoChunks } from '../../services/local/localMemoSearch';
import { getLocalWorkspaceOwner } from '../../services/local/offlineStore';
import type { InboxSession } from '../../services/backend/inboxService';
import type { MemoRow } from '../../types';
import {
  createEditor,
  getPaneEditors,
} from './memoSplitWorkspaceUtils';
import type {
  MemoSplitEditorState,
  MemoSplitPaneState,
} from './components/MemoSplitWorkspace';

type UpsertEditorById = (
  paneId: string,
  editor: MemoSplitEditorState,
  patch: Partial<MemoSplitEditorState>,
  activate: boolean,
) => void;

interface UseNearbyNotesSearchOptions {
  inboxItems: InboxSession[];
  memoById: ReadonlyMap<string, MemoRow>;
  memos: MemoRow[];
  panes: MemoSplitPaneState[];
  t: (korean: string, english: string) => string;
  upsertEditorById: UpsertEditorById;
}

export const useNearbyNotesSearch = ({
  inboxItems,
  memoById,
  memos,
  panes,
  t,
  upsertEditorById,
}: UseNearbyNotesSearchOptions) => {
  const networkControllersRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    const liveEditorIds = new Set(
      panes.flatMap((pane) => getPaneEditors(pane).map((editor) => editor.id)),
    );
    for (const [editorId, controller] of networkControllersRef.current) {
      if (!liveEditorIds.has(editorId)) {
        controller.abort();
        networkControllersRef.current.delete(editorId);
      }
    }
  }, [panes]);

  useEffect(() => {
    return () => {
      for (const controller of networkControllersRef.current.values()) {
        controller.abort();
      }
      networkControllersRef.current.clear();
    };
  }, []);

  const runEditorStateBSearch = useCallback(
    async (pane: MemoSplitPaneState, editor: MemoSplitEditorState) => {
      const memo = editor.memoId ? memoById.get(editor.memoId) : null;
      const queryText = (editor.draftText ?? memo?.content ?? '').trim();
      const targetEditor =
        editor.view === 'network'
          ? editor
          : createEditor('network', { memoId: editor.memoId });

      if (!queryText) {
        upsertEditorById(
          pane.id,
          targetEditor,
          {
            networkErrorMessage:
              t(
                '내용이 있는 메모에서 주변 메모를 찾아 주세요.',
                'Add some content to this note before finding nearby notes.',
              ),
            networkIsLoading: false,
            networkResults: [],
            view: 'network',
          },
          true,
        );
        return;
      }

      // 붙을 것이 하나도 없으면 로컬 모델을 깨울 이유가 없다.
      const hasSearchableNeighbor =
        inboxItems.length > 0 ||
        memos.some(
          (candidate) =>
            candidate.id !== editor.memoId && candidate.content.trim().length > 0,
        );
      if (!hasSearchableNeighbor) {
        upsertEditorById(
          pane.id,
          targetEditor,
          {
            networkErrorMessage: null,
            networkIsLoading: false,
            networkQueryChunk: {
              end: queryText.length,
              id: 'query-local-empty',
              index: 0,
              start: 0,
              text: queryText,
            },
            networkResults: [],
            view: 'network',
          },
          true,
        );
        return;
      }

      const networkRequestId = `network-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const queryChunk: MemoChunk = {
        end: queryText.length,
        id: `query-${networkRequestId}`,
        index: 0,
        start: 0,
        text: queryText,
      };
      networkControllersRef.current.get(targetEditor.id)?.abort();
      const controller = new AbortController();
      networkControllersRef.current.set(targetEditor.id, controller);

      // networkResults는 비우지 않는다 — 재검색이면 기존 그래프를 그대로 두고
      // 작은 상태 표시만 얹었다가 새 결과로 교체한다.
      upsertEditorById(
        pane.id,
        targetEditor,
        {
          networkErrorMessage: null,
          networkIsLoading: true,
          networkQueryChunk: queryChunk,
          networkRequestId,
          view: 'network',
        },
        true,
      );

      try {
        const response = await searchLocalMemoChunks({
          limit: 8,
          minimumSimilarity: NETWORK_MIN_SIMILARITY,
          memoId: editor.memoId ?? null,
          ownerId: getLocalWorkspaceOwner(),
          queryText,
          signal: controller.signal,
        });

        if (networkControllersRef.current.get(targetEditor.id) !== controller) {
          return;
        }
        upsertEditorById(
          pane.id,
          targetEditor,
          {
            // 무의미한 질의는 queryChunk가 없다. 이때 안내 문구까지 버리면
            // 주변 메모 탭이 빈 화면으로 남는다.
            networkErrorMessage: response.queryChunk ? null : response.message,
            networkIsLoading: false,
            networkQueryChunk: response.queryChunk,
            networkRequestId,
            networkResults: response.results,
            view: 'network',
          },
          false,
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          networkControllersRef.current.get(targetEditor.id) !== controller
        ) {
          return;
        }
        upsertEditorById(
          pane.id,
          targetEditor,
          {
            networkErrorMessage: formatLocalMemoSearchErrorMessage(error),
            networkIsLoading: false,
            networkRequestId,
            networkResults: [],
            view: 'network',
          },
          false,
        );
      } finally {
        if (networkControllersRef.current.get(targetEditor.id) === controller) {
          networkControllersRef.current.delete(targetEditor.id);
        }
      }
    },
    [inboxItems, memoById, memos, t, upsertEditorById],
  );

  return { runEditorStateBSearch };
};
