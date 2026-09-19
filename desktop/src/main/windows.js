/**
 * 窗口管理：主 UI 窗口 / 引擎窗口（隐藏）/ viewer 窗口
 * 引擎窗口使用独立 session partition（persist:qzone）持久化登录态
 *
 * v4.9 §B + K2：引擎窗生命周期统一收口在 attachEngineLifecycle——
 *  - closed / 崩溃 / 加载失败 / 注入成功 / 离开 qzone → pushEngineStatus 统一广播并归位 ready
 *  - 引擎 console 透传（原挂 index.js 只挂第一个引擎窗，窗一重建即断链）移入此处，
 *    每次创建/重建自动重新挂载
 *  - 引擎窗按需创建（R2）：冷启动只建主窗口；登录态轮询发现已登录或用户扫码时才拉起
 */
import { BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineBridge, pushEngineStatus, getActiveTaskContext } from './services/engine-bridge.js';
import { logger } from './services/logger.js';
import { capLog } from '../shared/log-cap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 应用图标（沿用扩展 icon-128.png）
const APP_ICON = path.join(__dirname, 'icon.png');

export const windows = {
  main: null,
  engine: null,
  viewer: null,
};

const PRELOAD_DIR = path.join(__dirname, '../preload');
const RENDERER_INDEX = path.join(__dirname, '../renderer/dist/index.html');

/**
 * 用户手动关闭引擎窗后置位：登录态轮询不再自动拉起引擎窗（尊重用户操作）。
 * 下一次 createEngineWindow()（扫码登录 / 重试连接）时自动复位。
 */
let engineDismissed = false;

/** 引擎窗当前是否处于"用户主动关闭"状态（登录轮询判断是否自动拉起用） */
export function isEngineDismissed() {
  return engineDismissed;
}

/**
 * 禁止窗口接收拖拽（v4.7 反馈 B）
 * Electron 默认允许把文件/链接拖进窗口，拖入时会显示 file:// 路径或直接导航过去。
 * 本应用不需要这条交互：
 *   1. webPreferences.disableBlinkFeatures: 'DragDrop' —— 从渲染引擎层面禁用，最彻底
 *   2. will-navigate 拦截 —— 双保险，拖放万一触发导航也拒绝
 */
function hardenNavigation(win) {
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
}

/** 主 UI 窗口（Vue3 渲染器，file:// 加载构建产物） */
export function createMainWindow() {
  if (windows.main && !windows.main.isDestroyed()) {
    return windows.main;
  }
  logger.info('[windows] 创建主窗口');
  windows.main = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'QQ空间档案备份',
    icon: APP_ICON,
    show: false,
    webPreferences: {
      preload: path.join(PRELOAD_DIR, 'ui-bridge.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // v4.7 反馈 B：禁用渲染引擎的拖放能力，避免拖入文件/链接时出现 file:// 拖放提示
      disableBlinkFeatures: 'DragDrop',
    },
  });
  windows.main.loadFile(RENDERER_INDEX);
  hardenNavigation(windows.main);
  windows.main.once('ready-to-show', () => {
    windows.main.show();
  });
  windows.main.on('closed', () => {
    windows.main = null;
  });
  // 外链一律交给系统浏览器（仅 http/https；deny 其他协议，防 file:/javascript: 等经应用打开）
  windows.main.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  return windows.main;
}

/** 引擎窗口（隐藏）：加载 user.qzone.qq.com，注入引擎五层 */
export function createEngineWindow() {
  if (windows.engine && !windows.engine.isDestroyed()) {
    return windows.engine;
  }
  engineDismissed = false;
  logger.info('[windows] 创建引擎窗口');
  windows.engine = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(PRELOAD_DIR, 'engine-bridge.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      partition: 'persist:qzone',
    },
  });
  windows.engine.loadURL('https://user.qzone.qq.com');
  // P5.1：qzone 页面弹窗一律不在应用内开窗——http/https 交系统浏览器，其余直接拒绝
  // （引擎窗口带 preload 隔离世界注入，禁止其派生子窗口继承 webPreferences）
  windows.engine.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  attachEngineLifecycle(windows.engine);
  return windows.engine;
}

/**
 * §B + K2：引擎窗生命周期与 console 中转的统一收口点。
 * 每次创建引擎窗（含重连重建）都会重新走这里，事件监听不会断链。
 */
function attachEngineLifecycle(engine) {
  const wc = engine.webContents;

  // ---- K2：引擎 console 透传（补充轨道） ----
  // desktop-adapters 的 console 包装加 [e:level] 标记；qzone 页面自身噪音（JSONP/CSP/遥测）
  // 无标记，整体降噪丢弃。有活跃任务 → 写任务日志附录（带脚本名:行号）；无任务 → main.log。
  wc.on('console-message', (event, level, message) => {
    // Electron ^43：console-message 为单 event 对象签名（旧三参数已废弃，保留兼容写法）
    const ev = typeof event === 'object' && event !== null ? event : null;
    const msg = ev ? ev.message : message;
    if (!msg) return;
    const m = /^\[e:(debug|info|warn|error)\]\s?/.exec(msg);
    if (!m) return;
    // v4.9.2：兜底截断——引擎脚本万一整包 dump 大对象，不能灌爆任务日志/UI 日志流
    const line = capLog(msg.slice(m[0].length));
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

  // ---- §B：状态事件统一广播 ----
  wc.on('did-navigate', (_event, url) => {
    // 离开 qzone 页面（如跳转登录页扫码）→ 引擎上下文失效，广播连接中（回 qzone 后重新注入）
    if (!url.startsWith('https://user.qzone.qq.com') && engineBridge.ready) {
      pushEngineStatus('loading', '已离开 qzone 页面');
    }
  });
  wc.on('did-finish-load', () => {
    if (!engineBridge.ready && wc.getURL().startsWith('https://user.qzone.qq.com')) {
      engineBridge
        .inject()
        .then(() => pushEngineStatus('ready'))
        .catch((e) => {
          logger.error(`[main] 引擎注入失败 ${e?.stack || e}`);
          pushEngineStatus('crashed', `注入失败：${e?.message || e}`);
        });
    }
  });
  wc.on('render-process-gone', (_event, details) => {
    logger.error(`[windows] 引擎渲染进程崩溃：${details?.reason || 'unknown'}`);
    pushEngineStatus('crashed', `渲染进程崩溃（${details?.reason || 'unknown'}）`);
  });
  wc.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    logger.error(`[windows] 引擎窗页面加载失败：${code} ${desc} ${url || ''}`);
    pushEngineStatus('crashed', `页面加载失败（${code} ${desc}）`);
  });
  engine.on('closed', () => {
    if (windows.engine === engine) {
      windows.engine = null;
    }
    engineDismissed = true;
    pushEngineStatus('closed');
  });
}

/** 内置 SPA 浏览窗口（file:// 打开备份产物 index.html） */
export function createViewerWindow(backupPath) {
  const viewer = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'QQ空间档案浏览',
    icon: APP_ICON,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      disableBlinkFeatures: 'DragDrop',
    },
  });
  // 返回 loadFile 的 Promise：入口文件加载失败（如产物缺失）时可被调用方捕获并上报
  return viewer
    .loadFile(backupPath)
    .then(() => viewer);
  // P5.1：内置浏览窗口为本地静态产物渲染器，禁止派生任何子窗口（无 preload，链接可经主窗口白名单打开）
  viewer.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  viewer.on('closed', () => {
    if (windows.viewer === viewer) {
      windows.viewer = null;
    }
  });
  windows.viewer = viewer;
  return viewer;
}

/** 确保主窗口存在（应用激活 / 二次启动）；引擎窗按需创建，不在此拉起 */
export function ensureWindows() {
  if (!windows.main || windows.main.isDestroyed()) {
    createMainWindow();
  }
}

/** 将引擎窗口置前（扫码登录） */
export function showEngineWindow() {
  if (!windows.engine || windows.engine.isDestroyed()) {
    createEngineWindow();
  }
  windows.engine.show();
  windows.engine.focus();
  return windows.engine;
}

/**
 * §B④：等待引擎窗完成 qzone 页面加载（重连重建流程用）。
 * 已加载完成则立即返回；否则等 did-finish-load / did-fail-load，超时拒绝。
 */
export function waitForEngineLoad(engine, timeoutMs = 15000) {
  const wc = engine.webContents;
  if (!wc.isLoading() && String(wc.getURL() || '').startsWith('https://user.qzone.qq.com')) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`引擎窗口加载超时（${Math.round(timeoutMs / 1000)}s）`));
    }, timeoutMs);
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onFail = (_e, code, desc) => {
      cleanup();
      reject(new Error(`页面加载失败（${code} ${desc}）`));
    };
    function cleanup() {
      clearTimeout(timer);
      wc.removeListener('did-finish-load', onOk);
      wc.removeListener('did-fail-load', onFail);
    }
    wc.on('did-finish-load', onOk);
    wc.on('did-fail-load', onFail);
  });
}
