/**
 * viewer IPC：内置 SPA 浏览（file:// 打开备份产物 index.html）
 */
import { ipcMain } from 'electron';
import { createViewerWindow } from '../windows.js';
import { Channels } from '../../shared/ipc-contract.mjs';

export function registerViewerIpc() {
  ipcMain.handle(Channels.viewer.open, async (event, { backupPath }) => {
    if (!backupPath) {
      return { ok: false, error: '缺少备份入口路径' };
    }
    createViewerWindow(backupPath);
    return { ok: true };
  });
}
