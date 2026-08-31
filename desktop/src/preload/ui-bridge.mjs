/**
 * 主 UI preload：window.api（白名单，契约见设计文档 §3.2）
 * on(channel, cb) 返回取消订阅函数
 *
 * P1-2：迁移为 ESM（sandbox:false 前提），通道常量统一引用 shared/ipc-contract.mjs
 */
import { contextBridge, ipcRenderer } from 'electron';
import { Channels, PUSH_CHANNEL_LIST } from '../shared/ipc-contract.mjs';

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

const api = {
  app: {
    getInfo: () => invoke(Channels.app.getInfo),
    openExternal: (url) => invoke(Channels.app.openExternal, { url }),
  },
  auth: {
    getStatus: () => invoke(Channels.auth.getStatus),
    showLogin: () => invoke(Channels.auth.showLogin),
    getOverview: () => invoke(Channels.auth.getOverview),
    logout: () => invoke(Channels.auth.logout),
  },
  config: {
    get: () => invoke(Channels.config.get),
    set: (partial) => invoke(Channels.config.set, partial),
    reset: () => invoke(Channels.config.reset),
    import: (path) => invoke(Channels.config.import, { path }),
    export: (path) => invoke(Channels.config.export, { path }),
  },
  backup: {
    start: (payload) => invoke(Channels.backup.start, payload),
    pause: (taskId) => invoke(Channels.backup.pause, { taskId }),
    resume: (taskId) => invoke(Channels.backup.resume, { taskId }),
    cancel: (taskId) => invoke(Channels.backup.cancel, { taskId }),
    getState: () => invoke(Channels.backup.getState),
    getHistory: () => invoke(Channels.backup.getHistory),
    listAlbums: () => invoke(Channels.backup.listAlbums),
    engineInject: () => invoke(Channels.backup.engineInject),
  },
  download: {
    pause: () => invoke(Channels.download.pause),
    resume: () => invoke(Channels.download.resume),
    cancel: () => invoke(Channels.download.cancel),
    clearDone: () => invoke(Channels.download.clearDone),
    getState: () => invoke(Channels.download.getState),
  },
  fs: {
    selectDirectory: (title) => invoke(Channels.fs.selectDirectory, { title }),
    openPath: (path) => invoke(Channels.fs.openPath, { path }),
    showInFolder: (path) => invoke(Channels.fs.showInFolder, { path }),
    scanBackups: (root) => invoke(Channels.fs.scanBackups, { root }),
    saveDialog: (opts) => invoke(Channels.fs.saveDialog, opts || {}),
    writeText: (path, content) => invoke(Channels.fs.writeText, { path, content }),
  },
  zip: {
    create: (srcDir, destPath) => invoke(Channels.zip.create, { srcDir, destPath }),
  },
  viewer: {
    open: (backupPath) => invoke(Channels.viewer.open, { backupPath }),
  },
  /** 订阅主进程推送事件，返回取消订阅函数 */
  on(channel, cb) {
    if (!PUSH_CHANNEL_LIST.includes(channel)) {
      console.warn('[ui-bridge] 未授权通道:', channel);
      return () => {};
    }
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
