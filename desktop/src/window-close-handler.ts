import type { BrowserWindow } from 'electron';

export function attachCloseHandler(
  mainWindow: BrowserWindow,
  options: {
    shouldHideOnClose?: () => boolean;
    /**
     * 숨기기 직전에 끼어들 기회. true를 돌려주면 이번 닫기는 숨기지 않는다
     * (안내를 띄우고, 사용자가 닫으면 그때 숨긴다). 창이 이미 숨겨진 뒤에는
     * 무엇을 그려도 보이지 않으므로 순서가 중요하다.
     */
    interceptHide?: () => boolean;
  } = {},
) {
  mainWindow.on('close', (e) => {
    if (!options.shouldHideOnClose?.()) return;
    e.preventDefault();
    if (options.interceptHide?.()) return;
    mainWindow.hide();
  });
}
