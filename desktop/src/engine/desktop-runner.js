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

  // ---------- 任务层临时垫片（P6 迁移：tasks/state.js） ----------
  window.__engineExportState = {
    running: false,
    paused: false,
    cancelled: false,
    currentModule: null,
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
  class StatusIndicator {
    constructor(key) {
      this.key = key || 'Default';
      this.current = 0;
      this.total = 0;
      this.success = 0;
      this.failed = 0;
      this.skip = 0;
    }

    setTotal(total) {
      this.total = total;
      return this;
    }

    setIndex(index) {
      this.current = index;
      this._emit();
      return Promise.resolve(this);
    }

    addSuccess(step) {
      this.success += step || 1;
      this._emit();
      return this;
    }

    addFailed(step) {
      this.failed += step || 1;
      this._emit();
      return this;
    }

    addSkip(step) {
      this.skip += step || 1;
      this._emit();
      return this;
    }

    addDownload(step) {
      // 桌面端下载由主进程 DownloadManager 执行，无需计数
    }

    print() {
      this._emit();
      return this;
    }

    complete() {
      this.current = this.total || this.current;
      this._emit('complete');
      return this;
    }

    _emit(status) {
      try {
        window.QZonePlatform.notify.progress({
          module: window.__engineExportState.currentModule,
          phase: this.key,
          done: this.current,
          total: this.total,
          percent: this.total ? Math.min(100, Math.round((this.current / this.total) * 100)) : 0,
          extra: { success: this.success, failed: this.failed, skip: this.skip },
          status: status || 'running',
        });
      } catch (e) {
        /* 进度上报失败不阻塞采集 */
      }
    }
  }
  window.StatusIndicator = StatusIndicator;

  // ---------- 模块序列执行 ----------
  async function runModule(mod) {
    const fn = window.API && window.API[mod] && window.API[mod].export;
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

      // 装配配置：合入默认值并持久化（等价 chrome.storage.sync.set(QZone_Config)）
      if (config) {
        try {
          const saved = await P.storage.get('QZone_Config');
          const merged = Object.assign({}, (saved && saved.QZone_Config) || {}, config);
          window.QZone_Config = merged;
          await P.storage.set({ QZone_Config: merged });
        } catch (e) {
          console.error('[desktop-runner] 配置保存失败', e);
        }
      }

      // 初始化 QQ 身份（uin / g_tk）
      try {
        if (window.API && window.API.Utils && window.API.Utils.initUin) {
          window.API.Utils.initUin();
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
      for (const mod of modules || []) {
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
        const uin = (window.API.Utils.getCookie('uin') || '').replace(/\D/g, '');
        const targetUin = window.QZone.Common.Target && window.QZone.Common.Target.uin;
        let info = null;
        try {
          const data = await window.API.Common.getUserInfos();
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
