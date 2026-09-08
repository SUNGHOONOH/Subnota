import {
  useCallback,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';

import { clamp, SPLIT_PANE_MIN_WIDTH_PX } from './memoSplitWorkspaceUtils';

export interface SplitPaneResizePane {
  id: string;
}

interface UseSplitPaneResizeOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  onPaneWidthsChange?: (widths: Record<string, number>) => void;
  paneWidths: Record<string, number>;
  panes: SplitPaneResizePane[];
  setPaneWidths: Dispatch<SetStateAction<Record<string, number>>>;
}

export const useSplitPaneResize = ({
  containerRef,
  onPaneWidthsChange,
  paneWidths,
  panes,
  setPaneWidths,
}: UseSplitPaneResizeOptions) => {
  const beginResizePane = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      leftPaneId: string,
      rightPaneId: string,
    ) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const containerWidth = container.getBoundingClientRect().width;
      const paneCount = Math.max(panes.length, 1);
      const leftStart = paneWidths[leftPaneId] ?? 100 / paneCount;
      const rightStart = paneWidths[rightPaneId] ?? 100 / paneCount;
      const startX = event.clientX;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      let latestWidths = paneWidths;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaPercent =
          ((moveEvent.clientX - startX) / containerWidth) * 100;
        const combined = leftStart + rightStart;
        const minPercent = Math.min(
          (SPLIT_PANE_MIN_WIDTH_PX / containerWidth) * 100,
          combined / 2,
        );
        const nextLeft = clamp(
          leftStart + deltaPercent,
          minPercent,
          combined - minPercent,
        );
        const nextRight = combined - nextLeft;

        latestWidths = {
          ...latestWidths,
          [leftPaneId]: nextLeft,
          [rightPaneId]: nextRight,
        };
        setPaneWidths(latestWidths);
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('blur', onPointerUp);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        onPaneWidthsChange?.(latestWidths);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      window.addEventListener('blur', onPointerUp);
    },
    [containerRef, onPaneWidthsChange, paneWidths, panes.length, setPaneWidths],
  );

  return beginResizePane;
};
