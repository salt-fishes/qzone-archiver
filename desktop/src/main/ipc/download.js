/**
 * download IPC：下载任务 start/pause/resume/cancel/get-state（M2b 完善）
 */
import { ipcMain } from 'electron';
import { downloadManager } from '../services/download-manager.js';

export function registerDownloadIpc() {
  ipcMain.handle('download:start', async (event, { task, targetDir }) => {
    try {
      const id = await downloadManager.enqueue({ ...(task || {}), targetDir });
      return { ok: true, id };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('download:pause', async () => {
    await downloadManager.pause();
    return { ok: true };
  });

  ipcMain.handle('download:resume', async () => {
    await downloadManager.resume();
    return { ok: true };
  });

  ipcMain.handle('download:cancel', async () => {
    await downloadManager.cancel();
    return { ok: true };
  });

  ipcMain.handle('download:get-state', () => downloadManager.getState());
}
