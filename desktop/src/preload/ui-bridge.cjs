/**
 * 主 UI preload：window.api（白名单，契约见设计文档 §3.2）
 * on(channel, cb) 返回取消订阅函数
 */
const { contextBridge, ipcRenderer } = require('electron');

const PUSH_CHANNELS = [
  'auth:status-changed',
  'backup:progress',
  'backup:log',
  'backup:module-done',
  'backup:state-changed',
  'backup:completed',
  'download:progress',
  'download:item-failed',
  'download:state-changed',
  'zip:progress',
  'log:batch',
];

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

const api = {
  app: {
    getInfo: () => invoke('app:get-info'),
    openExternal: (url) => invoke('app:open-external', { url }),
  },
  auth: {
    getStatus: () => invoke('auth:get-status'),
    showLogin: () => invoke('auth:show-login'),
    getOverview: () => invoke('auth:get-overview'),
    logout: () => invoke('auth:logout'),
  },
  config: {
    get: () => invoke('config:get'),
    set: (partial) => invoke('config:set', partial),
    reset: () => invoke('config:reset'),
    import: (path) => invoke('config:import', { path }),
    export: (path) => invoke('config:export', { path }),
  },
  backup: {
    start: (payload) => invoke('backup:start', payload),
    pause: (taskId) => invoke('backup:pause', { taskId }),
    resume: (taskId) => invoke('backup:resume', { taskId }),
    cancel: (taskId) => invoke('backup:cancel', { taskId }),
    getState: () => invoke('backup:get-state'),
  },
  download: {
    start: (task, targetDir) => invoke('download:start', { task, targetDir }),
    pause: () => invoke('download:pause'),
    resume: () => invoke('download:resume'),
    cancel: () => invoke('download:cancel'),
    getState: () => invoke('download:get-state'),
  },
  fs: {
    selectDirectory: (title) => invoke('fs:select-directory', { title }),
    openPath: (path) => invoke('fs:open-path', { path }),
    showInFolder: (path) => invoke('fs:show-in-folder', { path }),
  },
  zip: {
    create: (srcDir, destPath) => invoke('zip:create', { srcDir, destPath }),
  },
  viewer: {
    open: (backupPath) => invoke('viewer:open', { backupPath }),
  },
  /** 订阅主进程推送事件，返回取消订阅函数 */
  on(channel, cb) {
    if (!PUSH_CHANNELS.includes(channel)) {
      console.warn('[ui-bridge] 未授权通道:', channel);
      return () => {};
    }
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
