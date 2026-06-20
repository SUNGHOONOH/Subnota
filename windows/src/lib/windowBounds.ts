export interface WorkAreaBounds {
  height: number;
  width: number;
  x?: number;
  y?: number;
}

export const MAIN_MIN_SIZE = { height: 500, width: 560 };
export const MAIN_PREFERRED_SIZE = { height: 820, width: 860 };

const WINDOW_MARGIN = 40;

export const createPreferredMainWindowBounds = (workArea: WorkAreaBounds) => {
  const areaX = workArea.x ?? 0;
  const areaY = workArea.y ?? 0;
  const maxWidth = Math.max(MAIN_MIN_SIZE.width, workArea.width - WINDOW_MARGIN);
  const maxHeight = Math.max(MAIN_MIN_SIZE.height, workArea.height - WINDOW_MARGIN);
  const width = Math.min(MAIN_PREFERRED_SIZE.width, maxWidth);
  const height = Math.min(MAIN_PREFERRED_SIZE.height, maxHeight);

  return {
    height,
    width,
    x: Math.round(areaX + (workArea.width - width) / 2),
    y: Math.round(areaY + (workArea.height - height) / 2),
  };
};
