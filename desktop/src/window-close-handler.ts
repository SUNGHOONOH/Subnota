import type { BrowserWindow } from 'electron';
import { dialog, ipcMain } from 'electron';

export function attachCloseHandler(
  mainWindow: BrowserWindow,
  options: { shouldHideOnClose?: () => boolean } = {},
) {
  let forceClose = false;
  const finish = () => {
    if (options.shouldHideOnClose?.()) {
      mainWindow.hide();
      return;
    }
    forceClose = true;
    mainWindow.close();
  };

  mainWindow.on('close', (e) => {
    if (forceClose) return;
    e.preventDefault();
    mainWindow.webContents
      .executeJavaScript('window.__hasUnsavedChanges?.()')
      .then((dirty: boolean) => {
        if (!dirty) {
          finish();
          return;
        }
        const choice = dialog.showMessageBoxSync(mainWindow, {
          type: 'warning',
          buttons: ['Save', "Don't Save", 'Cancel'],
          defaultId: 0,
          cancelId: 2,
          message: 'You have unsaved changes.',
          detail: 'Do you want to save before closing?',
        });
        if (choice === 0) {
          mainWindow.webContents.send('save-before-close');
          ipcMain.once('save-complete', () => {
            finish();
          });
        } else if (choice === 1) {
          finish();
        }
      });
  });
}
