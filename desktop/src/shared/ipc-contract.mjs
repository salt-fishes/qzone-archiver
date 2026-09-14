/**
 * IPC 通道契约单一来源（P1）
 *
 * 消费方：
 *   - main（ESM）：ipc/* 注册 handler、services/* 推送 UI 时引用
 *   - preload（.mjs）：白名单校验 + api 装配时引用
 *
 * 约束：
 *   - 本模块必须保持零依赖（不 import electron / node 内置模块），
 *     以便 preload（渲染进程侧）与未来渲染层 TS 类型生成共用
 *   - 通道值一旦发布即冻结：只增不改；废弃通道先标记 @deprecated 再清理
 */

/** UI invoke 类通道（renderer → main，ipcMain.handle） */
export const Channels = {
  app: {
    getInfo: 'app:get-info',
    openExternal: 'app:open-external',
    /** v4.6 只增：GitHub Releases 检查更新 */
    checkUpdate: 'app:check-update',
  },
  auth: {
    getStatus: 'auth:get-status',
    showLogin: 'auth:show-login',
    getOverview: 'auth:get-overview',
    logout: 'auth:logout',
  },
  config: {
    get: 'config:get',
    set: 'config:set',
    reset: 'config:reset',
    import: 'config:import',
    export: 'config:export',
  },
  backup: {
    start: 'backup:start',
    pause: 'backup:pause',
    resume: 'backup:resume',
    cancel: 'backup:cancel',
    getState: 'backup:get-state',
    getHistory: 'backup:get-history',
    listAlbums: 'backup:list-albums',
    engineInject: 'backup:engine-inject',
    /** 他人模式（v4.6 只增）：好友列表（目标选择器数据源）与目标空间可访问性探测 */
    listFriends: 'backup:list-friends',
    validateTarget: 'backup:validate-target',
  },
  download: {
    pause: 'download:pause',
    resume: 'download:resume',
    cancel: 'download:cancel',
    clearDone: 'download:clear-done',
    getState: 'download:get-state',
  },
  fs: {
    selectDirectory: 'fs:select-directory',
    openPath: 'fs:open-path',
    showInFolder: 'fs:show-in-folder',
    saveDialog: 'fs:save-dialog',
    writeText: 'fs:write-text',
    scanBackups: 'fs:scan-backups',
  },
  zip: {
    create: 'zip:create',
  },
  /** v4.7 只增：备份目标头像（主进程按 uin 本地缓存，返回 data URL） */
  avatars: {
    get: 'avatars:get',
  },
  viewer: {
    open: 'viewer:open',
  },

  /** 引擎窗通道（隔离世界 engineBridge → main） */
  engine: {
    notify: 'engine:notify',
    storageGet: 'engine:storage-get',
    storageSet: 'engine:storage-set',
    storageRemove: 'engine:storage-remove',
    fsWrite: 'engine:fs-write',
    fsRead: 'engine:fs-read',
    fsExists: 'engine:fs-exists',
    fsMkdir: 'engine:fs-mkdir',
    fsRemove: 'engine:fs-remove',
    fsList: 'engine:fs-list',
    resourceRead: 'engine:resource-read',
    cookieGet: 'engine:cookie-get',
    downloadEnqueue: 'engine:download-enqueue',
    networkMimetype: 'engine:network-mimetype',
    networkJson: 'engine:network-json',
  },
};

/** main → UI 推送通道（sendToUi；ui-bridge 白名单的唯一来源） */
export const PushChannels = {
  authStatusChanged: 'auth:status-changed',

  backupProgress: 'backup:progress',
  backupLog: 'backup:log',
  backupModuleDone: 'backup:module-done',
  backupStateChanged: 'backup:state-changed',
  backupCompleted: 'backup:completed',
  backupHistoryChanged: 'backup:history-changed',

  downloadProgress: 'download:progress',
  downloadItemFailed: 'download:item-failed',
  downloadStateChanged: 'download:state-changed',

  zipProgress: 'zip:progress',
};

/** ui-bridge on() 白名单（由契约自动派生，杜绝双处维护漂移） */
export const PUSH_CHANNEL_LIST = Object.values(PushChannels);
