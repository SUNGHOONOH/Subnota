/**
 * 미리보기 패널 폭. 조사한 앱(Notion Side Peek, VS Code 사이드바,
 * Obsidian 사이드바) 중 고정폭인 것이 없어 드래그 조절 + 폭 기억으로 둔다.
 */
const STORAGE_KEY = 'subnota.previewPanel.width';

export const PREVIEW_PANEL_DEFAULT_WIDTH = 360;
// nav-rail 폭(--legacy-size-nav-rail)과 맞춘 값. 사이드 패널을 밀어낼지
// 판단할 때 창 폭에서 빼기 위해 쓴다. 토큰을 고치면 여기도 같이 고칠 것 —
// 예전에 레일이 50 → 58 로 넓어졌을 때 이 값만 남아 8px을 덜 빼고 있었다.
export const NAV_RAIL_WIDTH = 58;
// 밀어냈을 때 워크스페이스가 최소한 이만큼은 남아야 한다 — 메모 본문이
// 읽을 만한 폭. 이보다 좁아지면 패널을 오버레이로 띄운다.
export const WORKSPACE_MIN_WIDTH = 400;
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

/**
 * 창 폭에 맞춰 실제로 그릴 패널 폭. 저장된 값은 그대로 두고 표시만 줄인다.
 * 가용 폭의 절반을 넘지 않게 해 참조 패널이 본문보다 커지는 일을 막는다 —
 * 좁은 창에서 패널이 화면을 삼키던 문제가 여기서 걸린다.
 */
export const effectiveSidePanelWidth = (
  windowWidth: number,
  storedWidth: number,
): number => {
  const available = windowWidth - NAV_RAIL_WIDTH;
  return clampPreviewPanelWidth(
    Math.min(storedWidth, Math.floor(available / 2)),
  );
};

/**
 * 사이드 패널을 워크스페이스 옆으로 밀어낼(push) 수 있는지.
 * 폭이 이미 절반 이하로 제한되므로 "본문이 읽을 만한가"만 보면 된다.
 */
export const canPushSidePanel = (
  windowWidth: number,
  storedWidth: number,
): boolean =>
  windowWidth -
    NAV_RAIL_WIDTH -
    effectiveSidePanelWidth(windowWidth, storedWidth) >=
  WORKSPACE_MIN_WIDTH;
