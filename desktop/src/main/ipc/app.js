/**
 * app IPC：版本信息 / 打开外链
 */
import { app, shell, ipcMain } from 'electron';
import { Channels } from '../../shared/ipc-contract.mjs';

export function registerAppIpc() {
  ipcMain.handle(Channels.app.getInfo, () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  }));

  ipcMain.handle(Channels.app.openExternal, (event, { url }) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return null;
  });
}
