/**
 * 主进程入口
 * 启动流程：单实例锁 → 注册 IPC → 创建主窗口 + 引擎窗口
 */
import { app, Menu } from 'electron';
import { createMainWindow, createEngineWindow, ensureWindows, windows } from './windows.js';
import { registerIpc } from './ipc/index.js';
import { registerEngineIpc } from './ipc/engine.js';
import { watchAuthStatus } from './ipc/auth.js';
import { engineBridge, getActiveTaskContext } from './services/engine-bridge.js';
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
    createEngineWindow();

    // 登录态自动监听（扫码登录后 UI 自动更新，无需手动刷新）
    watchAuthStatus();

    // 引擎窗口加载到 qzone 页面后注入引擎（登录跳转完成后也会触发）
    const engineWc = windows.engine?.webContents;
    // 引擎窗口 console 透传（P6.1 分级白名单）：desktop-adapters 的 console 包装为引擎日志，
    // 加 [e:level] 标记；qzone 页面自身噪音（JSONP 回调未定义、CSP/Mixed Content、遥测上报等）
    // 无标记，整体降噪丢弃。
    // §K5：透传降级为任务日志的"补充来源"——有活跃任务时写入 backup-<taskId>.log 附录区段
    // （带注入脚本名:行号，定位引擎内部问题）；无任务时维持原 main.log [engine] 行（启动期引擎日志）。
    engineWc?.on('console-message', (event, level, message) => {
      // Electron ^43：console-message 为单 event 对象签名（旧三参数已废弃，保留兼容写法）
      const ev = typeof event === 'object' && event !== null ? event : null;
      const msg = ev ? ev.message : message;
      if (!msg) return;
      const m = /^\[e:(debug|info|warn|error)\]\s?/.exec(msg);
      if (!m) return;
      const line = msg.slice(m[0].length);
      // §K5：注入脚本名:行号 一并落盘（此前丢弃）——引擎日志定位到"哪个脚本第几行"全靠它
      const loc = ev?.sourceId
        ? `${String(ev.sourceId).split(/[\\/]/).pop()}:${ev.lineNumber ?? '?'}`
        : '';
      const taskId = getActiveTaskContext()?.taskId;
      if (taskId) {
        logger.task(taskId).engine(m[1], line, loc);
      } else {
        logger.log(m[1], `[engine] ${line}${loc ? ` @ ${loc}` : ''}`);
      }
    });
    engineWc?.on('did-navigate', (_event, url) => {
      // 离开 qzone 页面（如跳转登录页）视为引擎上下文失效，待回到 qzone 页重新注入
      if (!url.startsWith('https://user.qzone.qq.com')) {
        engineBridge.ready = false;
      }
    });
    engineWc?.on('did-finish-load', () => {
      if (!engineBridge.ready && engineWc.getURL().startsWith('https://user.qzone.qq.com')) {
        engineBridge
          .inject()
          .then(() => logger.info('[main] 引擎注入完成'))
          .catch((e) => logger.error(`[main] 引擎注入失败 ${e?.stack || e}`));
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
