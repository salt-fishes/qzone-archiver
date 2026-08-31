/**
 * download IPC：下载任务 pause/resume/cancel/clear-done/get-state（M2b 完善）
 * start 不暴露给渲染层：下载由 main 侧备份流程经 download-manager 自主调度
 */
import { ipcMain } from 'electron';
import { downloadManager } from '../services/download-manager.js';
import { Channels } from '../../shared/ipc-contract.mjs';

export function registerDownloadIpc() {
  ipcMain.handle(Channels.download.pause, async () => {
    await downloadManager.pause();
    return { ok: true };
  });

  ipcMain.handle(Channels.download.resume, async () => {
    await downloadManager.resume();
    return { ok: true };
  });

  ipcMain.handle(Channels.download.cancel, async () => {
    await downloadManager.cancel();
    return { ok: true };
  });

  ipcMain.handle(Channels.download.clearDone, async () => {
    await downloadManager.clearDone();
    return { ok: true };
  });

  ipcMain.handle(Channels.download.getState, () => downloadManager.getState());
}
