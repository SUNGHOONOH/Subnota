export interface WorkAreaBounds {
  height: number;
  width: number;
  x?: number;
  y?: number;
}

export interface WindowFrameSize {
  height: number;
  width: number;
}

export const MAIN_MIN_SIZE = { height: 500, width: 560 };
export const MAIN_PREFERRED_SIZE = { height: 820, width: 860 };
export const AUTH_PREFERRED_SIZE = { height: 720, width: 1000 };
export const WINDOWS_AUTH_PREFERRED_SIZE = { height: 680, width: 960 };

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

export const createPreferredMainContentBounds = (
  workArea: WorkAreaBounds,
  frameSize: WindowFrameSize,
) => {
  const areaX = workArea.x ?? 0;
  const areaY = workArea.y ?? 0;
  const frameWidth = Math.max(0, frameSize.width);
  const frameHeight = Math.max(0, frameSize.height);
  const visibleContentWidth = Math.max(1, workArea.width - frameWidth);
  const visibleContentHeight = Math.max(1, workArea.height - frameHeight);
  const width = Math.min(
    MAIN_PREFERRED_SIZE.width,
    Math.max(
      Math.min(MAIN_MIN_SIZE.width, visibleContentWidth),
      workArea.width - WINDOW_MARGIN - frameWidth,
    ),
  );
  const height = Math.min(
    MAIN_PREFERRED_SIZE.height,
    Math.max(
      Math.min(MAIN_MIN_SIZE.height, visibleContentHeight),
      workArea.height - WINDOW_MARGIN - frameHeight,
    ),
  );

  return {
    height,
    width,
    x: Math.round(areaX + (workArea.width - width - frameWidth) / 2),
    y: Math.round(areaY + (workArea.height - height - frameHeight) / 2),
  };
};

export const createMainWindowMinimumSize = (workArea: WorkAreaBounds) => ({
  height: Math.max(1, Math.min(MAIN_MIN_SIZE.height, workArea.height)),
  width: Math.max(1, Math.min(MAIN_MIN_SIZE.width, workArea.width)),
});

export const createPreferredAuthWindowBounds = (
  workArea: WorkAreaBounds,
  preferredSize = AUTH_PREFERRED_SIZE,
) => {
  const areaX = workArea.x ?? 0;
  const areaY = workArea.y ?? 0;
  const maxWidth = Math.max(1, workArea.width - WINDOW_MARGIN);
  const maxHeight = Math.max(1, workArea.height - WINDOW_MARGIN);
  const width = Math.min(preferredSize.width, maxWidth);
  const height = Math.min(preferredSize.height, maxHeight);

  return {
    height,
    width,
    x: Math.round(areaX + (workArea.width - width) / 2),
    y: Math.round(areaY + (workArea.height - height) / 2),
  };
};
