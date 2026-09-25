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

// stdout/stderr 断管保护（§K：日志失败不得打断主流程）——2026-09-22 实机踩到：
// 从终端/脚本拉起后父 shell 退出，管道断开，之后任何 console/日志镜像写入都会抛
// EPIPE → 未捕获异常弹窗杀掉主进程。挂 no-op error 处理器让写入静默失败，
// 文件日志轨道（真正的可观测性主路径）不受影响。
for (const stream of [process.stdout, process.stderr]) {
  stream?.on?.('error', () => {});
}

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
