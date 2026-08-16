import type { BrowserWindow } from 'electron';

export function attachCloseHandler(
  mainWindow: BrowserWindow,
  options: { shouldHideOnClose?: () => boolean } = {},
) {
  mainWindow.on('close', (e) => {
    if (!options.shouldHideOnClose?.()) return;
    e.preventDefault();
    mainWindow.hide();
  });
}
