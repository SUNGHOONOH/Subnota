import {
  useCallback,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';

import {
  clampPreviewPanelWidth,
  savePreviewPanelWidth,
} from '../../lib/previewPanelWidth';

interface UsePreviewPanelResizeOptions {
  previewPanelWidth: number;
  setPreviewPanelWidth: Dispatch<SetStateAction<number>>;
  setSidePanelResizing: Dispatch<SetStateAction<boolean>>;
}

export const usePreviewPanelResize = ({
  previewPanelWidth,
  setPreviewPanelWidth,
  setSidePanelResizing,
}: UsePreviewPanelResizeOptions) => {
  // 왼쪽 가장자리를 끌면 폭이 커지므로 delta 부호를 뒤집는다.
  const handlePreviewResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const startX = event.clientX;
      const startWidth = previewPanelWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      setSidePanelResizing(true);

      const handleMove = (moveEvent: PointerEvent) => {
        setPreviewPanelWidth(
          clampPreviewPanelWidth(startWidth - (moveEvent.clientX - startX)),
        );
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', cleanup);
        window.removeEventListener('pointercancel', cleanup);
        window.removeEventListener('blur', cleanup);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setSidePanelResizing(false);
        setPreviewPanelWidth(current => {
          savePreviewPanelWidth(current);
          return current;
        });
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', cleanup);
      window.addEventListener('pointercancel', cleanup);
      window.addEventListener('blur', cleanup);
    },
    [previewPanelWidth, setPreviewPanelWidth, setSidePanelResizing],
  );

  return handlePreviewResizeStart;
};
