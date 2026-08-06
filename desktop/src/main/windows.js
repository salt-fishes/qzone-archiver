/**
 * 窗口管理：主 UI 窗口 / 引擎窗口（隐藏）/ viewer 窗口
 * 引擎窗口使用独立 session partition（persist:qzone）持久化登录态
 */
import { BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const windows = {
  main: null,
  engine: null,
  viewer: null,
};

const PRELOAD_DIR = path.join(__dirname, '../preload');
const RENDERER_INDEX = path.join(__dirname, '../renderer/dist/index.html');

/** 主 UI 窗口（Vue3 渲染器，file:// 加载构建产物） */
export function createMainWindow() {
  if (windows.main && !windows.main.isDestroyed()) {
    return windows.main;
  }
  windows.main = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'QQ空间档案备份',
    show: false,
    webPreferences: {
      preload: path.join(PRELOAD_DIR, 'ui-bridge.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });
  windows.main.loadFile(RENDERER_INDEX);
  windows.main.once('ready-to-show', () => {
    windows.main.show();
  });
  windows.main.on('closed', () => {
    windows.main = null;
  });
  // 外链一律交给系统浏览器
  windows.main.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  return windows.main;
}

/** 引擎窗口（隐藏）：加载 user.qzone.qq.com，注入引擎五层 */
export function createEngineWindow() {
  if (windows.engine && !windows.engine.isDestroyed()) {
    return windows.engine;
  }
  windows.engine = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(PRELOAD_DIR, 'engine-bridge.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      partition: 'persist:qzone',
    },
  });
  windows.engine.loadURL('https://user.qzone.qq.com');
  windows.engine.on('closed', () => {
    windows.engine = null;
  });
  return windows.engine;
}

/** 内置 SPA 浏览窗口（file:// 打开备份产物 index.html） */
export function createViewerWindow(backupPath) {
  const viewer = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'QQ空间档案浏览',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  viewer.loadFile(backupPath);
  viewer.on('closed', () => {
    if (windows.viewer === viewer) {
      windows.viewer = null;
    }
  });
  windows.viewer = viewer;
  return viewer;
}

/** 确保主窗口与引擎窗口存在（应用激活 / 二次启动） */
export function ensureWindows() {
  if (!windows.main || windows.main.isDestroyed()) {
    createMainWindow();
  }
  if (!windows.engine || windows.engine.isDestroyed()) {
    createEngineWindow();
  }
}

/** 将引擎窗口置前（扫码登录） */
export function showEngineWindow() {
  if (!windows.engine || windows.engine.isDestroyed()) {
    createEngineWindow();
  }
  windows.engine.show();
  windows.engine.focus();
}
