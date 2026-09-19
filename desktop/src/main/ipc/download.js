/**
 * download IPC：下载任务 pause/resume/cancel/clear-done/get-state（M2b 完善）
 * start 不暴露给渲染层：下载由 main 侧备份流程经 download-manager 自主调度
 */
import { ipcMain } from 'electron';
import { downloadManager } from '../services/download-manager.js';
import { logger } from '../services/logger.js';
import { Channels } from '../../shared/ipc-contract.mjs';

export function registerDownloadIpc() {
  ipcMain.handle(Channels.download.pause, async () => {
    // v4.9.2：页面暂停此前完全无日志——队列静默冻结时无从排查是否有人按过暂停
    await downloadManager.pause();
    logger.info('[download] 下载队列已暂停（下载页操作）');
    return { ok: true };
  });

  ipcMain.handle(Channels.download.resume, async () => {
    await downloadManager.resume();
    logger.info('[download] 下载队列已恢复（下载页操作）');
    return { ok: true };
  });

  ipcMain.handle(Channels.download.cancel, async () => {
    await downloadManager.cancel();
    logger.info('[download] 下载队列已取消（清空 pending，中断 running）');
    return { ok: true };
  });

  ipcMain.handle(Channels.download.clearDone, async () => {
    await downloadManager.clearDone();
    return { ok: true };
  });

  ipcMain.handle(Channels.download.getState, () => downloadManager.getState());
}
