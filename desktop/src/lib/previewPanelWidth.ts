/**
 * 미리보기 패널 폭. 조사한 앱(Notion Side Peek, VS Code 사이드바,
 * Obsidian 사이드바) 중 고정폭인 것이 없어 드래그 조절 + 폭 기억으로 둔다.
 */
const STORAGE_KEY = 'subnota.previewPanel.width';

export const PREVIEW_PANEL_DEFAULT_WIDTH = 360;
export const PREVIEW_PANEL_MIN_WIDTH = 280;
export const PREVIEW_PANEL_MAX_WIDTH = 600;

export const clampPreviewPanelWidth = (width: number): number =>
  Math.min(
    PREVIEW_PANEL_MAX_WIDTH,
    Math.max(PREVIEW_PANEL_MIN_WIDTH, Math.round(width)),
  );

export const loadPreviewPanelWidth = (): number => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed)
      ? clampPreviewPanelWidth(parsed)
      : PREVIEW_PANEL_DEFAULT_WIDTH;
  } catch {
    return PREVIEW_PANEL_DEFAULT_WIDTH;
  }
};

export const savePreviewPanelWidth = (width: number): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(clampPreviewPanelWidth(width)));
  } catch {
    // 저장 실패는 기능에 영향을 주지 않는다 — 다음 실행에서 기본값을 쓴다.
  }
};
