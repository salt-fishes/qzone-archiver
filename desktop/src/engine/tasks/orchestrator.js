/**
 * 任务层——编排（P6，迁移自 desktop-runner.js 垫片）
 * 模块序列执行 + __engineCommands（start/pause/resume/cancel/getLoginStatus）。
 * 主进程 engine-bridge 通过 window.__engineCommands 驱动备份流程。
 */
(function () {
  'use strict';

  const P = window.QZonePlatform;

  /** 模块中文名（日志展示用） */
  const MODULE_NAMES = {
    Messages: '说说', Blogs: '日志', Diaries: '日记', Photos: '相册', Videos: '视频',
    Boards: '留言', Favorites: '收藏', Shares: '分享', Friends: '好友',
    Visitors: '访客', Statistics: '统计',
  };
  function modName(mod) {
    return MODULE_NAMES[mod] || mod;
  }

  // ---------- 模块序列执行 ----------
  async function runModule(mod) {
    if (mod === 'Statistics') {
      // Statistics 模块 = 其它信息收尾（等价扩展 OperatorType.OTHERS_INFO）：
      // 用户信息 / 头像 / 配置 / 备份清单 / index.html 首页与 SPA 入口
      P.notify.log({ level: 'info', message: `开始模块：${modName(mod)}` });
      await API.Common.exportOthers();
      P.notify.log({ level: 'info', message: `模块完成：${modName(mod)}` });
      P.notify.moduleDone({ module: mod });
      return;
    }
    // 注意：API 由 api.js 以 `const API` 声明（词法全局，不挂 window），此处直接引用
    const fn = API && API[mod] && API[mod].export;
    if (!fn) {
      P.notify.log({ level: 'warn', message: `模块 ${modName(mod)} 无导出入口` });
      return;
    }
    P.notify.log({ level: 'info', message: `开始模块：${modName(mod)}` });
    await fn();
    P.notify.log({ level: 'info', message: `模块完成：${modName(mod)}` });
    P.notify.moduleDone({ module: mod });
  }

  // ---------- __engineCommands ----------
  window.__engineCommands = {
    /**
     * 启动备份：装配配置 → 初始化身份 → 逐模块执行 export()
     * @param {{taskId:string, config?:object, modules:string[], targetDir:string}} payload
     */
    async start({ taskId, config, modules, targetDir }) {
      P.setTargetDir(targetDir);

      // 装配配置：引擎默认打底 → 深度合入已保存 → 深度合入本次备份配置，并持久化
      // （UI 设置传部分结构（如 { Messages: { exportType } }），深度合并保留其余子项）
      if (config) {
        try {
          const saved = await P.storage.get('QZone_Config');
          const savedCfg = (saved && saved.QZone_Config) || {};
          window.QZone_Config = window.__mergeDeep(window.QZone_Config || {}, savedCfg, config);
          await P.storage.set({ QZone_Config: window.QZone_Config });
        } catch (e) {
          console.error('[tasks/orchestrator] 配置保存失败', e);
        }
      }

      // 初始化 QQ 身份（uin / g_tk）
      try {
        if (API && API.Utils && API.Utils.initUin) {
          API.Utils.initUin();
        }
      } catch (e) {
        console.warn('[tasks/orchestrator] initUin 失败（不阻塞）', e);
      }

      // 先重置导出状态（清空上次取消/暂停残留），再进入各采集环节
      const s = window.__engineExportState;
      s.running = true;
      s.paused = false;
      s.cancelled = false;
      s.pauseToken = null;
      s.pauseWaiters = [];

      // 重置各模块备份数据 + 初始化上次备份信息（等价扩展 INIT_USER_INFO 阶段）。
      // 缺失重置会让依赖 { items: [] } 结构的模块（日记/留言/收藏/访客）在读取 .items 时崩溃
      try {
        API.Common.resetQZoneBackupItems();
        await API.Common.initBackedUpItems();
      } catch (e) {
        console.warn('[tasks/orchestrator] 重置/初始化备份数据失败（不阻塞）', e);
      }

      // 相册选择：QZone_Config.Photos.albumSelect 三态语义
      //   undefined/未配置 = 备份全部相册；[] = 明确不备份相册；非空 = 按选择备份
      // 预取完整相册对象写入 QZone.Photos.Album.Select，initAlbums 会据此处理
      const selIds = window.QZone_Config.Photos && window.QZone_Config.Photos.albumSelect;
      const prevSuppress = s._suppressProgress;
      s._suppressProgress = true; // 预取列表不让进度/日志刷屏
      try {
        try {
          const all = await API.Photos.getAllAlbumList();
          if (Array.isArray(selIds) && selIds.length) {
            const ids = new Set(selIds.map(String));
            window.QZone.Photos.Album.Select = all.filter((a) => ids.has(String(a.id)));
            console.info(`[tasks/orchestrator] 按用户选择备份相册 ${window.QZone.Photos.Album.Select.length} 个`);
          } else if (Array.isArray(selIds)) {
            // 明确清空（空数组）= 不备份相册：Select 置空，initAlbums 对空数组不拉相册
            window.QZone.Photos.Album.Select = [];
            console.info('[tasks/orchestrator] 相册选择为空，本次不备份相册');
          } else {
            // 未配置（undefined）= 默认全部相册
            window.QZone.Photos.Album.Select = all;
          }
        } catch (e) {
          console.warn('[tasks/orchestrator] 预取相册列表失败，按全量备份', e);
          // 预取失败时置 null：initAlbums 对 null 走全量，避免相册全跳过
          window.QZone.Photos.Album.Select = null;
        }
      } finally {
        s._suppressProgress = prevSuppress;
      }

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
            message: `模块 ${modName(mod)} 失败：${(e && e.message) || e}`,
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
            message: `模块 ${modName('Statistics')} 失败：${(e && e.message) || e}`,
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
      if (s.cancelled || s.paused) return;
      s.paused = true;
      P.notify.state({ state: 'paused' });
    },

    async resume() {
      const s = window.__engineExportState;
      if (!s.paused) return;
      s.paused = false;
      // 唤醒全部挂起的检查点（并发任务可能同时撞上暂停，须逐个 resolve）
      const waiters = s.pauseWaiters || [];
      s.pauseWaiters = [];
      for (const resolve of waiters) {
        resolve();
      }
      if (s.pauseToken) {
        s.pauseToken.resolve();
        s.pauseToken = null;
      }
      P.notify.state({ state: 'running' });
    },

    async cancel() {
      const s = window.__engineExportState;
      s.cancelled = true;
      P.notify.state({ state: 'cancelled' });
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
          console.warn('[tasks/orchestrator] getUserInfos 失败', e);
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

    /**
     * 获取相册列表（供设置页相册多选用）
     * 静默执行：临时抑制进度/日志上报，避免设置页操作刷屏备份进度
     */
    async getAlbumList() {
      const s = window.__engineExportState;
      const prevSuppress = s._suppressProgress;
      s._suppressProgress = true;
      try {
        try {
          if (API && API.Utils && API.Utils.initUin) {
            API.Utils.initUin();
          }
        } catch (e) {
          console.warn('[tasks/orchestrator] initUin 失败（不阻塞）', e);
        }
        // 重置相册全局缓存，避免重复加载/换号导致数据累积
        // （unionItems 为 concat 无去重，getAllAlbumList 把结果并进 QZone.Photos.Album.Data，不重置会翻倍）
        if (window.QZone && window.QZone.Photos) {
          const prevSelect = (window.QZone.Photos.Album || {}).Select;
          window.QZone.Photos.Album = { Data: [], OLD_Data: [], total: 0 };
          if (prevSelect) window.QZone.Photos.Album.Select = prevSelect;
          window.QZone.Photos.Class = {};
        }
        const data = await API.Photos.getAllAlbumList();
        return (data || []).map((a) => ({
          id: a.id,
          name: a.name,
          classid: a.classid,
          className: a.className,
          total: a.total,
          pre: a.pre,
          url: a.url,
          desc: a.desc,
        }));
      } finally {
        s._suppressProgress = prevSuppress;
      }
    },
  };

  window.QZoneTasks = window.QZoneTasks || {};
  window.QZoneTasks.Orchestrator = { runModule };
})();
