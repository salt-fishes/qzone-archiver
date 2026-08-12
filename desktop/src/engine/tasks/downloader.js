/**
 * 任务层——下载任务与调度（P6，迁移自 desktop-runner.js 垫片 / content.js:7-167,1775-1895）
 * 任务类（DownloadTask/ThunderTask/ThunderInfo/BrowserTask/PageInfo）+ 下载调度
 * （newDownloadTask/addDownloadTasks/downloadAllFiles）。
 * 各模块以全局名 `new PageInfo(...)` / `API.Utils.newDownloadTask(...)` 调用，
 * 故任务类须挂 window（class 声明默认词法绑定，不挂 window）。
 */
(function () {
  'use strict';

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

  // ---------- 下载调度 ----------
  // 桌面端：媒体下载经 QZonePlatform.download.enqueue 交给主进程 DownloadManager（流式）
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
        .catch((e) => console.warn('[tasks/downloader] 下载入队失败', e && e.message));
    } catch (e) {
      console.warn('[tasks/downloader] 下载入队失败', e && e.message);
    }
  };

  API.Utils.addDownloadTasks = async (module, item, url, module_dir, source, FILE_URLS, suffix) => {
    if (await window.checkExportState()) {
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
        // File/Aria2/Browser：桌面端媒体已由主进程 DownloadManager 流式下载
        break;
    }
  };

  API.Utils.getDownloadTasks = () => (QZone_Config.Common.downloadType === 'File' ? downloadTasks : []);

  window.QZoneTasks = window.QZoneTasks || {};
  window.QZoneTasks.Downloader = {
    DownloadTask: window.DownloadTask,
    ThunderTask: window.ThunderTask,
    ThunderInfo: window.ThunderInfo,
    BrowserTask: window.BrowserTask,
    PageInfo: window.PageInfo,
  };
})();
