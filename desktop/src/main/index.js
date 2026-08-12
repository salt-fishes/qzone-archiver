/**
 * 主进程入口
 * 启动流程：单实例锁 → 注册 IPC → 创建主窗口 + 引擎窗口
 */
import { app, Menu } from 'electron';
import { createMainWindow, createEngineWindow, ensureWindows, windows } from './windows.js';
import { registerIpc } from './ipc/index.js';
import { registerEngineIpc } from './ipc/engine.js';
import { watchAuthStatus } from './ipc/auth.js';
import { engineBridge } from './services/engine-bridge.js';
import { downloadManager } from './services/download-manager.js';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    ensureWindows();
  });

  app.whenReady().then(() => {
    // 移除默认菜单栏（File / Edit / View / Window 等）
    Menu.setApplicationMenu(null);
    registerIpc();
    registerEngineIpc();
    downloadManager.load();
    createMainWindow();
    createEngineWindow();

    // 登录态自动监听（扫码登录后 UI 自动更新，无需手动刷新）
    watchAuthStatus();

    // 引擎窗口加载到 qzone 页面后注入引擎（登录跳转完成后也会触发）
    const engineWc = windows.engine?.webContents;
    // 开发期：引擎窗口 console 转发到 stdout（排查注入错误）
    engineWc?.on('console-message', (event, level, message) => {
      const msg = typeof event === 'object' ? event.message : message;
      if (!msg) return;
      // 过滤 qzone 页面自身噪音（页面脚本 JSONP 回调未定义、CSP/Mixed Content 遥测上报等），仅转发引擎侧有效日志
      if (/SHARE is not defined|shine0_Callback is not defined|Content Security Policy|Mixed Content|galileotelemetry|isdspeed/.test(msg)) {
        return;
      }
      console.log(`[engine:console] ${msg}`);
    });
    engineWc?.on('did-navigate', (_event, url) => {
      // 离开 qzone 页面（如跳转登录页）视为引擎上下文失效，待回到 qzone 页重新注入
      if (!url.startsWith('https://user.qzone.qq.com')) {
        engineBridge.ready = false;
      }
    });
    engineWc?.on('did-finish-load', () => {
      if (!engineBridge.ready && engineWc.getURL().startsWith('https://user.qzone.qq.com')) {
        engineBridge.inject().catch((e) => console.error('[main] 引擎注入失败', e));
      }
    });

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
