import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';
import type { PreviewPanelState } from './PreviewPanel';

type ActiveSidePanel = 'preview' | 'schedule-inbox';

interface UsePreviewPanelActionsOptions {
  focusedPaneId: string | null;
  setActiveSidePanel: Dispatch<SetStateAction<ActiveSidePanel | null>>;
  setPreviewPanel: Dispatch<SetStateAction<PreviewPanelState | null>>;
  setSidePanelCollapsed: Dispatch<SetStateAction<boolean>>;
  splitPanes: ReadonlyArray<{ id: string }>;
}

export const usePreviewPanelActions = ({
  focusedPaneId,
  setActiveSidePanel,
  setPreviewPanel,
  setSidePanelCollapsed,
  splitPanes,
}: UsePreviewPanelActionsOptions) => {
  // 참조 열기: 패널이 닫혀 있으면 열고, 열려 있으면 내용만 갈아끼운다.
  // 패널이 늘어나지 않으므로 그래프 노드를 연달아 눌러도 누적되지 않는다.
  const handleOpenPreview = useCallback(
    (
      results: NetworkSearchResult[],
      mode: 'detail' | 'list' = 'detail',
      options: Pick<
        PreviewPanelState,
        'isAmbientList' | 'promotionTooltip' | 'showMoreResults'
      > = {},
    ) => {
      if (results.length === 0) return;
      setSidePanelCollapsed(false);
      setActiveSidePanel('preview');
      setPreviewPanel({
        mode,
        ...options,
        result: mode === 'detail' ? results[0] : null,
        results,
      });
    },
    [setActiveSidePanel, setPreviewPanel, setSidePanelCollapsed],
  );

  /**
   * 미리보기 → 실물 탭 승격.
   *
   * 패널이 2개면 포커스되지 않은 쪽에 연다. 포커스 패널에 열면 쓰던
   * 초안이 배경 탭으로 밀려 동시 작업이 깨지기 때문이다. 패널이 1개면
   * 그 패널에 새 탭으로 연다 — 사용자가 단일 패널을 선택한 것이므로
   * 앱이 멋대로 split을 만들지 않는다.
   *
   * 포커스는 옮기지 않는다. 승격 버튼을 누를 때 손은 키보드에 있어서,
   * 포커스가 넘어가면 다음 타이핑이 엉뚱한 곳으로 들어간다.
   */
  const promotePreviewResult = useCallback(
    (result: NetworkSearchResult) => {
      const beside =
        splitPanes.length > 1 &&
        splitPanes.some(pane => pane.id !== focusedPaneId);
      const detail = { target: beside ? 'beside' : 'focused' } as const;

      if (result.sourceKind === 'inbox' && result.inboxSessionId) {
        window.dispatchEvent(
          new CustomEvent('subnota:open-inbox-source', {
            detail: { ...detail, inboxSessionId: result.inboxSessionId },
          }),
        );
      } else if (result.memoId) {
        window.dispatchEvent(
          new CustomEvent('subnota:open-memo', {
            detail: { ...detail, memoId: result.memoId },
          }),
        );
      }
      setActiveSidePanel(null);
      setPreviewPanel(null);
    },
    [
      focusedPaneId,
      setActiveSidePanel,
      setPreviewPanel,
      splitPanes,
    ],
  );

  return { handleOpenPreview, promotePreviewResult };
};
