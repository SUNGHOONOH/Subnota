import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { AmbientSearchTarget } from '../../lib/ambientSearch';
import { AMBIENT_MIN_SIMILARITY } from '../../lib/constants';
import { formatLocalMemoSearchErrorMessage, searchLocalMemoChunks } from '../../services/local/localMemoSearch';
import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';
import type { PreviewPanelState } from '../preview/PreviewPanel';
import type { AmbientListCache } from './ambientResultCounts';

interface UseAmbientListPreviewOptions {
  ambientTarget: AmbientSearchTarget | null;
  ambientTargetRef: { current: AmbientSearchTarget | null };
  ambientListCache: AmbientListCache | null;
  flushLocalMemoIndexForUser: () => Promise<boolean>;
  getLocalWorkspaceOwner: () => string | null;
  handleOpenPreview: (
    results: NetworkSearchResult[],
    mode?: 'detail' | 'list',
    options?: Pick<
      PreviewPanelState,
      'additionalCounts' | 'isAmbientList' | 'promotionTooltip' | 'showMoreResults' | 'topicModelMissing'
    >,
  ) => void;
  setActiveSidePanel: Dispatch<SetStateAction<'preview' | 'schedule-inbox' | null>>;
  setAmbientError: Dispatch<SetStateAction<string | null>>;
  setPreviewPanel: Dispatch<SetStateAction<PreviewPanelState | null>>;
  setSidePanelCollapsed: Dispatch<SetStateAction<boolean>>;
  t: (korean: string, english: string) => string;
}

// 이미 BGE를 받아 둔 사용자는 받기 창을 다시 보지 않는다. 관련 결과가
// 필요한 순간인 목록에서 A.X 받기를 안내한다.
const isTopicModelMissing = async () => {
  try {
    const status = await window.electronAPI?.localEmbedStatus?.();
    return Boolean(status?.ready && !status.topicReady);
  } catch {
    return false;
  }
};

export const useAmbientListPreview = ({
  ambientTarget,
  ambientTargetRef,
  ambientListCache,
  flushLocalMemoIndexForUser,
  getLocalWorkspaceOwner,
  handleOpenPreview,
  setActiveSidePanel,
  setAmbientError,
  setPreviewPanel,
  setSidePanelCollapsed,
  t,
}: UseAmbientListPreviewOptions) => {
  const openAmbientListInPreview = useCallback(async (refresh = false) => {
    const target = ambientTarget;
    if (!target) return;
    const ownerId = getLocalWorkspaceOwner();
    if (!refresh && ambientListCache &&
      ambientListCache.ownerId === ownerId &&
      ambientListCache.target.editorId === target.editorId &&
      ambientListCache.target.memoId === target.memoId &&
      ambientListCache.target.queryText === target.queryText) {
      if (ambientListCache.results.length > 0) {
        handleOpenPreview(ambientListCache.results, 'list', {
          isAmbientList: true,
          topicModelMissing: await isTopicModelMissing(),
          promotionTooltip: t('새 메모 탭으로 열기', 'Open in a new note tab'),
        });
      }
      return;
    }
    try {
      const indexed = await flushLocalMemoIndexForUser();
      if (!indexed) return;
      const response = await searchLocalMemoChunks({
        includeRelatedness: true,
        limit: 8,
        memoId: target.memoId,
        minimumSimilarity: AMBIENT_MIN_SIMILARITY,
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
      // 재시도 시에는 원본이 바뀌어 0건이 될 수도 있다. 방금 보던 추천과
      // 모순되는 빈 목록을 열지 않고 기존 패널을 유지한다.
      if (response.results.length > 0) {
        handleOpenPreview(response.results, 'list', {
          isAmbientList: true,
          topicModelMissing: await isTopicModelMissing(),
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
    ambientListCache,
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
