/**
 * app IPC：版本信息 / 打开外链
 */
import { app, shell, ipcMain } from 'electron';

export function registerAppIpc() {
  ipcMain.handle('app:get-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  }));

  ipcMain.handle('app:open-external', (event, { url }) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return null;
  });
}
