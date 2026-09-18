/**
 * 主进程入口
 * 启动流程：单实例锁 → 注册 IPC → 创建主窗口（引擎窗按需创建，见 windows.js §B/R2）
 */
import { app, Menu } from 'electron';
import { createMainWindow, ensureWindows } from './windows.js';
import { registerIpc } from './ipc/index.js';
import { registerEngineIpc } from './ipc/engine.js';
import { watchAuthStatus } from './ipc/auth.js';
import { downloadManager } from './services/download-manager.js';
import { logger } from './services/logger.js';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    ensureWindows();
  });

  app.whenReady().then(() => {
    // §K2 会话自检行：应用日志链路的验收探针（缺失即链路断）
    logger.sessionStart();
    // 移除默认菜单栏（File / Edit / View / Window 等）
    Menu.setApplicationMenu(null);
    registerIpc();
    registerEngineIpc();
    downloadManager.load();
    createMainWindow();

    // 登录态自动监听（扫码登录后 UI 自动更新，无需手动刷新）。
    // §B/R2：引擎窗不再于启动时创建——轮询发现已登录（含持久化 session）时按需拉起，
    // 或用户点「扫码登录」时经 showEngineWindow() 拉起；注入/状态广播随窗口生命周期走。
    watchAuthStatus();

    app.on('activate', () => {
      ensureWindows();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
