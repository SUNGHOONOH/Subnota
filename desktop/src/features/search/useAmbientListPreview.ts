import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { AmbientSearchTarget } from '../../lib/ambientSearch';
import { AMBIENT_LIST_MIN_SIMILARITY } from '../../lib/constants';
import { formatLocalMemoSearchErrorMessage, searchLocalMemoChunks } from '../../services/local/localMemoSearch';
import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';
import type { PreviewPanelState } from '../preview/PreviewPanel';

interface UseAmbientListPreviewOptions {
  ambientTarget: AmbientSearchTarget | null;
  ambientTargetRef: { current: AmbientSearchTarget | null };
  flushLocalMemoIndexForUser: () => Promise<boolean>;
  getLocalWorkspaceOwner: () => string | null;
  handleOpenPreview: (
    results: NetworkSearchResult[],
    mode?: 'detail' | 'list',
    options?: Pick<
      PreviewPanelState,
      'isAmbientList' | 'promotionTooltip' | 'showMoreResults'
    >,
  ) => void;
  setActiveSidePanel: Dispatch<SetStateAction<'preview' | 'schedule-inbox' | null>>;
  setAmbientError: Dispatch<SetStateAction<string | null>>;
  setPreviewPanel: Dispatch<SetStateAction<PreviewPanelState | null>>;
  setSidePanelCollapsed: Dispatch<SetStateAction<boolean>>;
  t: (korean: string, english: string) => string;
}

export const useAmbientListPreview = ({
  ambientTarget,
  ambientTargetRef,
  flushLocalMemoIndexForUser,
  getLocalWorkspaceOwner,
  handleOpenPreview,
  setActiveSidePanel,
  setAmbientError,
  setPreviewPanel,
  setSidePanelCollapsed,
  t,
}: UseAmbientListPreviewOptions) => {
  const openAmbientListInPreview = useCallback(async () => {
    const target = ambientTarget;
    if (!target) return;
    const ownerId = getLocalWorkspaceOwner();
    try {
      const indexed = await flushLocalMemoIndexForUser();
      if (!indexed) return;
      const response = await searchLocalMemoChunks({
        limit: 8,
        memoId: target.memoId,
        minimumSimilarity: AMBIENT_LIST_MIN_SIMILARITY,
        ownerId,
        queryText: target.queryText,
      });
      if (
        getLocalWorkspaceOwner() !== ownerId ||
        ambientTargetRef.current?.editorId !== target.editorId ||
        ambientTargetRef.current?.queryText !== target.queryText
      ) {
        return;
      }
      setAmbientError(null);
      // 목록 열기는 ghost가 떠 있을 때만 도달한다 — openAmbientList가
      // ambientResult로 막는다. 방금 같은 질의가 결과를 냈다는 뜻이라 0건은
      // 원본이 그사이 지워진 정도로만 나온다. 그때 "없습니다"를 띄우면 방금
      // 본 추천과 모순되므로 조용히 아무것도 열지 않는다.
      if (response.results.length > 0) {
        handleOpenPreview(response.results, 'list', {
          isAmbientList: true,
          promotionTooltip: t('새 메모 탭으로 열기', 'Open in a new note tab'),
        });
      }
    } catch (caught) {
      const message = formatLocalMemoSearchErrorMessage(caught);
      if (!message) return;
      // ⌘⏎는 "패널을 열어 달라"는 요청이다. 실패를 편집기 쪽 고스트로
      // 되돌리면 사용자는 열리지 않은 패널을 기다리게 된다. 패널을 열고
      // 그 안에서 알린다.
      setSidePanelCollapsed(false);
      setActiveSidePanel('preview');
      setPreviewPanel({
        error: message,
        isAmbientList: true,
        mode: 'list',
        result: null,
        results: [],
      });
    }
  }, [
    ambientTarget,
    ambientTargetRef,
    flushLocalMemoIndexForUser,
    getLocalWorkspaceOwner,
    handleOpenPreview,
    setActiveSidePanel,
    setAmbientError,
    setPreviewPanel,
    setSidePanelCollapsed,
    t,
  ]);

  return { openAmbientListInPreview };
};
