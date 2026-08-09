/**
 * 注入入口（P0 骨架 → P1 适配器装配）：desktop-runner.js
 *
 * 职责：
 *   1. 校验 QZonePlatform 装配
 *   2. 任务层临时垫片（P6 迁入 tasks/state.js + tasks/progress.js）：
 *      - __engineExportState / checkExportState
 *      - StatusIndicator（进度上报 → QZonePlatform.notify.progress）
 *   3. 暴露 __engineCommands（start/pause/resume/cancel/getLoginStatus）
 */
(function () {
  if (!window.QZonePlatform) {
    console.error('[desktop-runner] QZonePlatform 未装配，runner 不可用');
    return;
  }

  // ---------- 配置深度合并（UI 设置的 QZone_Config 为部分结构，须逐级并入默认，避免丢失子项） ----------
  function mergeDeep(...sources) {
    const out = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
      for (const [key, val] of Object.entries(src)) {
        if (val && typeof val === 'object' && !Array.isArray(val) && out[key] && typeof out[key] === 'object') {
          out[key] = mergeDeep(out[key], val);
        } else {
          out[key] = val;
        }
      }
    }
    return out;
  }

  // ---------- 任务层临时垫片（P6 迁移：tasks/state.js） ----------
  window.__engineExportState = {
    running: false,
    paused: false,
    cancelled: false,
    currentModule: null,
    modules: [], // 本次备份勾选的模块（首页 SPA/HTML 判断依据）
  };

  async function checkExportState() {
    const s = window.__engineExportState;
    if (s.cancelled) {
      const err = new Error('[ExportState] 导出已取消');
      err.__exportCancelled = true;
      throw err;
    }
    return s.cancelled;
  }
  // api.js 及各模块通过全局 checkExportState() 调用
  window.checkExportState = checkExportState;

  // ---------- 任务层临时垫片（P6 迁移：tasks/progress.js） ----------
  // 接口对齐 content.js StatusIndicator（659-922）：setItem/setTotal/setIndex/setTotalPage/
  // setNextTip/addDownload/addFailed/addSuccess/setFailed/setSuccess/addSkip/setSkip/print/complete
  // 桌面端无提示 DOM，进度经 QZonePlatform.notify.progress 上报
  class StatusIndicator {
    constructor(key) {
      this.key = key || 'Default';
      this.total = 0;
      this.index = 0;
      this.pageSize = 0;
      this.totalPage = 0;
      this.downloaded = 0;
      this.downloading = 0;
      this.downloadFailed = 0;
      this.skip = 0;
      this.item = '';
      this.startTime = Date.now();
    }

    setTotal(total) {
      this.total = total;
      this._emit();
      return this;
    }

    setTotalPage(totalPage) {
      this.totalPage = totalPage;
      this._emit();
      return this;
    }

    setNextTip(tip) {
      // 桌面端仅记录，无 DOM 提示
      this.nextTip = String(tip == null ? '' : tip);
      this._emit();
      return this;
    }

    setItem(name) {
      this.item = String(name == null ? '' : name);
      this._emit();
      return this;
    }

    async setIndex(index) {
      this.index = typeof index === 'number' ? index : String(index);
      this._emit();
      // 检查点：暂停/取消语义与 content.js 一致
      if (await checkExportState()) {
        const err = new Error('[ExportState] 导出已取消');
        err.__exportCancelled = true;
        throw err;
      }
      return this;
    }

    addSuccess(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      else if (typeof item === 'number') count = item;
      this.downloaded += count;
      this.downloading = Math.max(0, this.downloading - count);
      this._emit();
      return this;
    }

    setSuccess(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      else if (typeof item === 'number') count = item;
      this.downloaded = count;
      this.downloading = 0;
      this._emit();
      return this;
    }

    addFailed(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      else if (item instanceof window.PageInfo) count = item.size || 1;
      this.downloadFailed += count;
      this.downloading = Math.max(0, this.downloading - count);
      this._emit();
      return this;
    }

    setFailed(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      else if (item instanceof window.PageInfo) count = item.size || 1;
      this.downloadFailed = count;
      this.downloading = 0;
      this._emit();
      return this;
    }

    addSkip(item) {
      let count = 1;
      if (Array.isArray(item)) count = item.length;
      this.skip += count;
      this._emit();
      return this;
    }

    setSkip(count) {
      if (Array.isArray(count)) count = count.length;
      this.skip = count;
      this._emit();
      return this;
    }

    addDownload(pageSize) {
      this.downloading = this.downloaded + pageSize;
      this._emit();
      return this;
    }

    print() {
      this._emit();
      return this;
    }

    complete() {
      this.index = this.total || this.index;
      this._emit('complete');
      return this;
    }

    _emit(status) {
      // 概要型 indicator（如 Messages_Row_Infos）无 total，无法计算百分比：
      // - running 态跳过，避免 0% 事件覆盖真实阶段进度
      // - complete 态补发 100% 事件，让进度行明确显示模块阶段已结束
      if (!this.total) {
        if (status !== 'complete') {
          return;
        }
        try {
          window.QZonePlatform.notify.progress({
            module: window.__engineExportState.currentModule,
            phase: this.key,
            done: 1,
            total: 1,
            percent: 100,
            extra: {
              success: this.downloaded,
              failed: this.downloadFailed,
              skip: this.skip,
              item: this.item,
              elapsed: Math.floor((Date.now() - this.startTime) / 1000),
            },
            status: 'complete',
          });
        } catch (e) {
          /* 进度上报失败不阻塞采集 */
        }
        return;
      }
      try {
        window.QZonePlatform.notify.progress({
          module: window.__engineExportState.currentModule,
          phase: this.key,
          done: this.downloaded || this.index || 0,
          total: this.total,
          percent: this.total ? Math.min(100, Math.round(((this.downloaded || this.index) / this.total) * 100)) : 0,
          extra: {
            success: this.downloaded,
            failed: this.downloadFailed,
            skip: this.skip,
            item: this.item,
            elapsed: Math.floor((Date.now() - this.startTime) / 1000),
          },
          status: status || 'running',
        });
      } catch (e) {
        /* 进度上报失败不阻塞采集 */
      }
    }
  }
  window.StatusIndicator = StatusIndicator;

  // ---------- 任务层临时垫片（迁移自 content.js:7-167，P6 → tasks/downloader.js） ----------
  // 各模块 getList 失败分支/迅雷链接导出依赖这些类；模块以全局名 `new PageInfo(...)` 调用，
  // 故必须挂到 window（class 声明默认是词法绑定，不挂 window）
  window.DownloadTask = class DownloadTask {
    constructor(module, dir, name, url, source) {
      this.module = module;
      this.dir = dir;
      this.name = name;
      this.url = url;
      this.downloadState = 'in_progress';
      this.source = source;
    }
    setState(downloadState) {
      this.downloadState = downloadState;
    }
  };

  window.ThunderTask = class ThunderTask {
    constructor(module, dir, name, url, source) {
      this.module = module;
      this.dir = dir;
      this.name = name;
      this.url = url;
      this.downloadState = 'in_progress';
      this.source = source;
    }
    setState(downloadState) {
      this.downloadState = downloadState;
    }
  };

  window.ThunderInfo = class ThunderInfo {
    constructor(taskGroupName, threadCount, tasks) {
      this.taskGroupName = taskGroupName;
      this.tasks = tasks || [];
      this.threadCount = threadCount;
      this.hideYunPan = '1';
      this.referer = 'https://user.qzone.qq.com/';
    }
    addTask(task) {
      this.tasks.push(task);
    }
    delTask(index) {
      this.tasks.splice(index, 1);
    }
    removeTask(url) {
      this.tasks.remove(url, 'url');
    }
  };

  window.BrowserTask = class BrowserTask {
    constructor(module, url, root, folder, name, source) {
      this.module = module;
      this.id = 0;
      this.url = url;
      this.dir = folder;
      this.name = name;
      this.filename = root + '/' + folder + '/' + name;
      this.downloadState = 'in_progress';
      this.source = source;
    }
    setId(id) {
      this.id = id;
    }
    setState(downloadState) {
      this.downloadState = downloadState;
    }
  };

  window.PageInfo = class PageInfo {
    constructor(index, size) {
      this.index = 0;
      this.size = 0;
    }
  };

  // ---------- 下载调度临时垫片（迁移自 content.js:1775-1895，P6 → tasks/downloader.js） ----------
  // 桌面端：媒体下载经 QZonePlatform.download.enqueue 交给主进程 DownloadManager（流式，M2b 完善断点）
  const downloadTasks = [];
  const browserTasks = [];
  const thunderInfo = new window.ThunderInfo();

  API.Utils.newDownloadTask = (module, url, folder, name, source, makeOrg) => {
    if (!url) {
      return;
    }
    url = makeOrg ? url : API.Utils.makeDownloadUrl(url, true);
    const dlUrl = API.Common.isFile() ? API.Utils.toHttps(url) : url;
    // 收集任务（兼容原数组 + 迅雷链接导出；迅雷链接保留 http）
    downloadTasks.push(new window.DownloadTask(module, folder, name, dlUrl, source));
    thunderInfo.addTask(new window.ThunderTask(module, folder, name, url, source));
    // 桌面端：入队主进程 DownloadManager（fire-and-forget，采集不阻塞）
    // 直连下载统一走 https（http 会被 Chromium 网络栈 ERR_BLOCKED_BY_CLIENT 拦截）
    try {
      window.QZonePlatform.download
        .enqueue({ module, url: API.Utils.toHttps(dlUrl), dir: folder, name })
        .catch((e) => console.warn('[desktop-runner] 下载入队失败', e && e.message));
    } catch (e) {
      console.warn('[desktop-runner] 下载入队失败', e && e.message);
    }
  };

  API.Utils.addDownloadTasks = async (module, item, url, module_dir, source, FILE_URLS, suffix) => {
    if (await checkExportState()) {
      const err = new Error('[ExportState] 导出已取消');
      err.__exportCancelled = true;
      throw err;
    }
    url = API.Utils.toHttp(url);
    item.custom_url = url;
    if (API.Common.isQzoneUrl()) {
      return;
    }
    let filename = FILE_URLS.get(url);
    if (!filename) {
      // URL 确定性哈希文件名（跨会话复用）
      filename = API.Utils.hashUrl(url);
      if (suffix) {
        filename = filename + suffix;
        item.custom_mimeType = suffix;
      } else {
        const autoSuffix = await API.Utils.autoFileSuffix(url);
        filename = filename + autoSuffix;
        item.custom_mimeType = autoSuffix;
      }
    }
    item.custom_filename = filename;
    item.custom_filepath = 'images/' + filename;
    if (!FILE_URLS.has(url)) {
      API.Utils.newDownloadTask(module, url, module_dir, filename, source, suffix);
      FILE_URLS.set(url, filename);
    }
  };

  API.Utils.downloadAllFiles = async () => {
    const downloadType = QZone_Config.Common.downloadType;
    if (downloadType === 'QZone') {
      return;
    }
    if (downloadTasks.length === 0 || thunderInfo.tasks.length === 0) {
      return;
    }
    switch (downloadType) {
      case 'Thunder_Link':
      case 'Thunder_Clipboard':
        // 迅雷：写入链接 txt（Clipboard 模式在桌面端同样落为链接文件，剪贴板由主进程管理）
        await API.Common.writeThunderTaskToFile(thunderInfo);
        break;
      default:
        // File/Aria2/Browser：桌面端媒体已由主进程 DownloadManager 流式下载（M2b 完善断点续传）
        break;
    }
  };

  API.Utils.getDownloadTasks = () => (QZone_Config.Common.downloadType === 'File' ? downloadTasks : []);

  // ---------- 模块序列执行 ----------
  async function runModule(mod) {
    if (mod === 'Statistics') {
      // Statistics 模块 = 其它信息收尾（等价扩展 OperatorType.OTHERS_INFO）：
      // 用户信息 / 头像 / 配置 / 备份清单 / index.html 首页与 SPA 入口
      window.QZonePlatform.notify.log({ level: 'info', message: `开始模块：${mod}` });
      await API.Common.exportOthers();
      window.QZonePlatform.notify.log({ level: 'info', message: `模块完成：${mod}` });
      window.QZonePlatform.notify.moduleDone({ module: mod });
      return;
    }
    // 注意：API 由 api.js 以 `const API` 声明（词法全局，不挂 window），此处直接引用
    const fn = API && API[mod] && API[mod].export;
    if (!fn) {
      window.QZonePlatform.notify.log({ level: 'warn', message: `模块 ${mod} 无导出入口` });
      return;
    }
    window.QZonePlatform.notify.log({ level: 'info', message: `开始模块：${mod}` });
    await fn();
    window.QZonePlatform.notify.log({ level: 'info', message: `模块完成：${mod}` });
    window.QZonePlatform.notify.moduleDone({ module: mod });
  }

  // ---------- __engineCommands ----------
  window.__engineCommands = {
    /**
     * 启动备份：装配配置 → 初始化身份 → 逐模块执行 export()
     * @param {{taskId:string, config?:object, modules:string[], targetDir:string}} payload
     */
    async start({ taskId, config, modules, targetDir }) {
      const P = window.QZonePlatform;
      P.setTargetDir(targetDir);

      // 装配配置：引擎默认打底 → 深度合入已保存 → 深度合入本次备份配置，并持久化
      // （UI 设置传部分结构（如 { Messages: { exportType } }），深度合并保留其余子项）
      if (config) {
        try {
          const saved = await P.storage.get('QZone_Config');
          const savedCfg = (saved && saved.QZone_Config) || {};
          window.QZone_Config = mergeDeep(window.QZone_Config || {}, savedCfg, config);
          await P.storage.set({ QZone_Config: window.QZone_Config });
        } catch (e) {
          console.error('[desktop-runner] 配置保存失败', e);
        }
      }

      // 初始化 QQ 身份（uin / g_tk）
      try {
        if (API && API.Utils && API.Utils.initUin) {
          API.Utils.initUin();
        }
      } catch (e) {
        console.warn('[desktop-runner] initUin 失败（不阻塞）', e);
      }

      const s = window.__engineExportState;
      s.running = true;
      s.paused = false;
      s.cancelled = false;
      P.notify.state({ taskId, state: 'running', modules });

      const results = {};
      const moduleList = modules || [];
      s.modules = moduleList;
      for (const mod of moduleList) {
        if (s.cancelled) break;
        s.currentModule = mod;
        try {
          await runModule(mod);
          results[mod] = 'ok';
        } catch (e) {
          results[mod] = 'error';
          P.notify.log({
            level: 'error',
            message: `模块 ${mod} 失败：${(e && e.message) || e}`,
          });
        }
      }
      // 收尾：未勾选 Statistics 时也补跑，确保生成 index.html 首页 / SPA 入口（等价扩展 OTHERS_INFO 阶段）
      if (!s.cancelled && !moduleList.includes('Statistics')) {
        s.currentModule = 'Statistics';
        try {
          await runModule('Statistics');
          results['Statistics'] = 'ok';
        } catch (e) {
          results['Statistics'] = 'error';
          P.notify.log({
            level: 'error',
            message: `模块 Statistics 失败：${(e && e.message) || e}`,
          });
        }
      }
      // 收尾：生成备份清单与统计报告（manifest.json / report.json）
      if (!s.cancelled) {
        try {
          if (window.QZonePackagers && QZonePackagers.Manifest) {
            await QZonePackagers.Manifest.generate();
          }
        } catch (e) {
          P.notify.log({ level: 'warn', message: `生成备份清单失败：${(e && e.message) || e}` });
        }
      }
      s.currentModule = null;
      s.running = false;
      P.notify.state({ taskId, state: 'completed', results });
      P.notify.log({ level: 'info', message: '备份完成' });
    },

    async pause() {
      const s = window.__engineExportState;
      s.paused = true;
      window.QZonePlatform.notify.state({ state: 'paused' });
    },

    async resume() {
      const s = window.__engineExportState;
      s.paused = false;
      window.QZonePlatform.notify.state({ state: 'running' });
    },

    async cancel() {
      const s = window.__engineExportState;
      s.cancelled = true;
      window.QZonePlatform.notify.state({ state: 'cancelled' });
    },

    async getLoginStatus() {
      try {
        const uin = (API.Utils.getCookie('uin') || '').replace(/\D/g, '');
        const targetUin = window.QZone.Common.Target && window.QZone.Common.Target.uin;
        let info = null;
        try {
          const data = await API.Common.getUserInfos();
          const d = data && (data.data || data);
          info = d && (d.userinfo || d.UserInfo || d);
        } catch (e) {
          console.warn('[desktop-runner] getUserInfos 失败', e);
        }
        return {
          loggedIn: !!uin || !!targetUin,
          qqNumber: (targetUin || uin).toString(),
          nickname: info && info.nickname,
          avatar: info && info.avatar,
        };
      } catch (e) {
        return { loggedIn: false, error: e.message };
      }
    },
  };

  console.info('[desktop-runner] 注入完成，__engineCommands 可用');
})();
