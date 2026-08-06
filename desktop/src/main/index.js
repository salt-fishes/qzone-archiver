/**
 * 主进程入口
 * 启动流程：单实例锁 → 注册 IPC → 创建主窗口 + 引擎窗口
 */
import { app } from 'electron';
import { createMainWindow, createEngineWindow, ensureWindows, windows } from './windows.js';
import { registerIpc } from './ipc/index.js';
import { registerEngineIpc } from './ipc/engine.js';
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
    registerIpc();
    registerEngineIpc();
    downloadManager.load();
    createMainWindow();
    createEngineWindow();

    // 引擎窗口加载到 qzone 页面后注入引擎（登录跳转完成后也会触发）
    const engineWc = windows.engine?.webContents;
    // 开发期：引擎窗口 console 转发到 stdout（排查注入错误）
    engineWc?.on('console-message', (event, level, message) => {
      const msg = typeof event === 'object' ? event.message : message;
      if (msg) console.log(`[engine:console] ${msg}`);
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
