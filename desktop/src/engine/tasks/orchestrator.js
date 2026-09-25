/**
 * 任务层——编排（P6，迁移自 desktop-runner.js 垫片）
 * 模块序列执行 + __engineCommands（start/pause/resume/cancel/getLoginStatus）。
 * 主进程 engine-bridge 通过 window.__engineCommands 驱动备份流程。
 */
(function () {
  'use strict';

  const P = window.QZonePlatform;

  /** 模块中文名（日志展示用；P1-4 单一来源：复用 config.js 从 shared/modules.json 派生的全局映射） */
  function modName(mod) {
    return (typeof MODULE_NAME_MAPS === 'object' && MODULE_NAME_MAPS[mod]) || mod;
  }

  // ---------- 模块序列执行 ----------

  /** 他人空间不可见的隐私模块（与原版扩展 popup.js 的 privateTypeList 同源） */
  const PRIVATE_MODULES = ['Diaries', 'Friends', 'Favorites'];

  /**
   * v4.6 他人模式：显式指定采集目标。
   * 引擎的采集目标由引擎窗口所在空间页决定（initUin 从 URL 提取 Target），
   * 桌面版固定停在登录者空间，此处在其后覆写 Target，使「输入好友 QQ 号采集」成为可能。
   * Owner/Target 分离在 API 层早已就绪（采集列表用 Target.uin、鉴权用 Owner.uin），
   * 增量仓库亦按 Target.uin 分桶，覆写后天然隔离。
   * @param {string|number|undefined} targetUin 目标 QQ 号（缺省 = 引擎窗口所在空间 = 登录者）
   * @returns {boolean} 是否处于他人模式
   */
  function applyTargetUin(targetUin) {
    if (!targetUin) return false;
    const ownerUin = QZone.Common.Owner && QZone.Common.Owner.uin;
    const target = String(targetUin).replace(/\D/g, '');
    if (!target) return false;
    if (String(ownerUin) === target) return false; // 目标即登录者，等价本人模式
    const prev = QZone.Common.Target;
    QZone.Common.Target = {
      uin: target - 0,
      route: (prev && prev.route) || 102,
      title: `${targetUin} 的空间`,
      name: 'TA',
      nickname: 'TA',
    };
    return true;
  }

  /**
   * v4.6 他人模式：覆写 Target 后拉取对方资料，回填昵称/头像（不阻塞，失败保持占位）。
   * 用 USER_INFO_URL（uin=目标, vuin=登录者），code=-4009 表示无权限。
   */
  async function fetchTargetProfile() {
    try {
      const data = await API.Friends.getQZoneUserInfo();
      const d = data && (data.data || data);
      const info = d && (d.userinfo || d.UserInfo || d);
      if (info && (info.nickname || info.avatar)) {
        QZone.Common.Target.nickname = info.nickname || QZone.Common.Target.nickname;
        QZone.Common.Target.name = info.nickname || QZone.Common.Target.name;
        QZone.Common.Target.avatar = info.avatar;
      }
    } catch (e) {
      console.warn('[tasks/orchestrator] 获取目标用户资料失败（不阻塞）', e);
    }
  }

  /**
   * P0-3/P2-5：模块失败记录为结构化错误（随 completed 通知透传给渲染层展示）。
   * P2-5 起模块层抛 ModuleError（含 module/phase/code/cause），此处统一取结构化字段；
   * 兼容普通 Error（缺省 phase='run'、code='MODULE_FAILED'）。
   * @param {{errors?:Array}} s 引擎导出状态
   * @param {string} mod 模块名
   * @param {Error} e 捕获的异常
   */
  function recordModuleError(s, mod, e) {
    (s.errors = s.errors || []).push({
      module: mod,
      phase: (e && e.phase) || 'run',
      code: (e && e.code) || 'MODULE_FAILED',
      message: (e && (e.message || String(e))) || '未知错误',
    });
  }

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
     * @param {{taskId:string, config?:object, modules:string[], targetDir:string, targetUin?:string}} payload
     *        targetUin 为 v4.6 他人模式可选参数（缺省 = 备份本人空间，行为与旧版一致）
     */
    async start({ taskId, config, modules, targetDir, targetUin }) {
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

      // v4.6 他人模式：覆写采集目标（必须在 initBackedUpItems 之前——增量仓库按 Target.uin 分桶）
      const isOtherUser = applyTargetUin(targetUin);
      if (isOtherUser) {
        P.notify.log({ level: 'info', message: `他人模式：采集目标 ${targetUin}（登录 ${QZone.Common.Owner.uin}），仅采集对方公开内容` });
        await fetchTargetProfile();
      }
      // 立即上报一条启动日志：确认 notify 链路存活（排障锚点）
      P.notify.log({ level: 'info', message: `备份任务已启动（${taskId}）` });

      // 先重置导出状态（清空上次取消/暂停残留），再进入各采集环节
      const s = window.__engineExportState;
      s.running = true;
      s.paused = false;
      s.cancelled = false;
      s.pauseToken = null;
      s.pauseWaiters = [];
      s.errors = []; // P0-3：本次备份的模块级结构化错误，随 completed 通知透传

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
      // v4.6 他人模式忽略相册多选（选择列表基于登录者相册 ID，对他人空间无意义）→ 备份对方全部相册
      const selIds = isOtherUser ? undefined : window.QZone_Config.Photos && window.QZone_Config.Photos.albumSelect;
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
      let moduleList = modules || [];
      // v4.6 他人模式：剔除隐私模块（日记/好友/收藏，对方空间不可见）+ 强制开启照片详情（取原图/免权限地址）
      if (isOtherUser) {
        const blocked = moduleList.filter((m) => PRIVATE_MODULES.includes(m));
        if (blocked.length) {
          P.notify.log({
            level: 'warn',
            message: `他人模式下已跳过仅本人可见的内容：${blocked.map((m) => modName(m)).join('、')}`,
          });
        }
        moduleList = moduleList.filter((m) => !PRIVATE_MODULES.includes(m));
        const photos = (window.QZone_Config.Photos = window.QZone_Config.Photos || {});
        photos.Images = photos.Images || {};
        photos.Images.Info = photos.Images.Info || {};
        photos.Images.Info.isGet = true;
      }
      s.modules = moduleList;
      for (const mod of moduleList) {
        if (s.cancelled) break;
        s.currentModule = mod;
        try {
          await runModule(mod);
          results[mod] = 'ok';
        } catch (e) {
          results[mod] = 'error';
          recordModuleError(s, mod, e);
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
          recordModuleError(s, 'Statistics', e);
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
      // P0-3：errors 随 completed 通知透传（主进程 backup:completed 原样转发 → 成功页展示）
      // v4.6：附采集目标信息（他人模式档案页按目标分组展示）
      P.notify.state({
        taskId,
        state: 'completed',
        results,
        errors: s.errors || [],
        target: { uin: String(QZone.Common.Target.uin || ''), nickname: QZone.Common.Target.nickname || '' },
      });
      if (s.errors && s.errors.length) {
        P.notify.log({
          level: 'warn',
          message: `备份完成，但有 ${s.errors.length} 个模块失败：${s.errors.map((e) => modName(e.module)).join('、')}`,
        });
      }
      P.notify.log({ level: 'info', message: '备份完成' });
    },

    /**
     * v4.6 他人模式：获取登录者的好友列表（备份目标选择器数据源）
     * 直接走好友接口（登录者视角），不触碰 QZone.Common.Target，也不写进度。
     * 返回 { ok, friends?, error? }：getFriends 失败/为空时回退 getSortFriends，
     * 错误原样上报（未登录 / code / 异常），供 UI 展示并可重试。
     */
    async listFriends() {
      const s = window.__engineExportState;
      const prevSuppress = s ? s._suppressProgress : undefined;
      if (s) s._suppressProgress = true;
      try {
        try {
          if (API && API.Utils && API.Utils.initUin) {
            API.Utils.initUin();
          }
        } catch (e) {
          console.warn('[tasks/orchestrator] listFriends initUin 失败', e);
        }
        const owner = QZone.Common.Owner && QZone.Common.Owner.uin;
        if (!owner) {
          return { ok: false, error: '尚未登录 QQ 空间，请先扫码登录' };
        }
        try {
          if (API && API.Utils && API.Utils.initGtk) {
            API.Utils.initGtk();
          }
        } catch (_) { /* ignore */ }

        /** 解析响应：toJson 只接受字符串，兼容已解析对象 */
        const parse = (raw) => {
          let d = raw;
          if (typeof d === 'string') {
            d = API.Utils.toJson(d, /^_Callback\(/);
          }
          return d;
        };
        const mapItems = (items) =>
          items
            .filter((it) => it && it.uin)
            .map((it) => ({
              uin: String(it.uin),
              // v5.2 N1：接口返回 nick（从不返回 nickname）——三个别名容错，否则选择器昵称恒空
              nickname: it.nick || it.nickname || it.name || '',
              remark: it.remark || '',
              // v5.2 N3：接口已返回 searchField（"QQ号 备注 昵称 拼音 缩写"），供选择器整串可搜
              searchField: it.searchField || '',
              avatar: it.avatar || (it.uin ? `https://q1.qlogo.cn/g?b=qq&nk=${it.uin}&s=40` : ''),
            }));

        let lastErr = null;
        for (const fetcher of [API.Friends.getFriends, API.Friends.getSortFriends]) {
          try {
            const d = parse(await fetcher.call(API.Friends));
            if (d && d.code && d.code != 0) {
              lastErr = `接口返回 code ${d.code}${d.message ? `（${d.message}）` : ''}`;
              continue;
            }
            const list = (d && d.data && (d.data.items || d.data.list)) || [];
            if (list.length) {
              return { ok: true, friends: mapItems(list) };
            }
            lastErr = lastErr || '接口返回列表为空';
          } catch (e) {
            lastErr = (e && e.message) || String(e);
            console.warn('[tasks/orchestrator] 好友接口调用失败', e);
          }
        }
        return { ok: false, error: `获取好友列表失败：${lastErr || '未知原因'}` };
      } finally {
        if (s) s._suppressProgress = prevSuppress;
      }
    },

    /**
     * v4.6 他人模式：探测目标空间可访问性。
     * 临时覆写 Target 调 USER_INFO_URL（uin=目标, vuin=登录者），结束后还原。
     * 返回 { ok, isOwner, uin, nickname?, avatar?, error? }
     */
    async validateTarget(targetUin) {
      const clean = String(targetUin || '').replace(/\D/g, '');
      if (!clean) return { ok: false, error: 'QQ 号不能为空' };
      const ownerUin = QZone.Common.Owner && QZone.Common.Owner.uin;
      if (!ownerUin) {
        try {
          if (API && API.Utils && API.Utils.initUin) API.Utils.initUin();
        } catch (_) { /* ignore */ }
      }
      const owner = QZone.Common.Owner && QZone.Common.Owner.uin;
      if (!owner) return { ok: false, error: '尚未登录 QQ 空间，请先扫码登录' };
      if (String(owner) === clean) return { ok: true, isOwner: true, uin: clean };

      const prevTarget = QZone.Common.Target;
      QZone.Common.Target = { uin: clean - 0, route: (prevTarget && prevTarget.route) || 102 };
      try {
        try {
          if (API && API.Utils && API.Utils.initGtk) API.Utils.initGtk();
        } catch (_) { /* ignore */ }
        const raw = await API.Friends.getQZoneUserInfo();
        // v5.0：同 getLoginStatus——Utils.get 返回的是 JSONP 文本，先解析再取字段；
        // 原实现对字符串取 .code/.nickname 恒为空 → 资料卡昵称永远回退 QQ 号、notice 常驻
        const data = typeof raw === 'string' ? API.Utils.toJson(raw, /^_Callback\(/) : raw;
        const d = data && (data.data || data);
        const info = d && (d.userinfo || d.UserInfo || d);
        // §G：判定口径透明化——返回原始 code 供 UI 区分提示
        // code=-4009 无权限 / code<0 异常：对方空间对登录者不可见或接口拒绝
        if (data && data.code && data.code < 0) {
          return {
            ok: false,
            code: data.code,
            error: data.code === -4009 ? '对方空间不公开，或你无权限访问' : `探测失败（code ${data.code}）`,
          };
        }
        const nickname = (info && (info.nickname || info.nick)) || '';
        return {
          ok: true,
          isOwner: false,
          uin: clean,
          code: data ? data.code : undefined,
          nickname,
          avatar: (info && info.avatar) || `https://q1.qlogo.cn/g?b=qq&nk=${clean}&s=100`,
          // §G：接口通但公开资料读不到（如对方关闭资料展示）——允许继续，提示昵称将回退 QQ 号
          ...(nickname ? {} : { notice: '空间可访问，但未读到对方公开资料（昵称将显示为 QQ 号）' }),
        };
      } catch (e) {
        return { ok: false, error: `探测失败：${(e && e.message) || e}` };
      } finally {
        QZone.Common.Target = prevTarget;
      }
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
        // 登录态检测只报告【登录者本人】。此前 qqNumber 取 (targetUin || uin)、
        // getUserInfos 也按 Target 查询——他人备份期间 Target 被覆写为对方，
        // 会把对方的 QQ 号/昵称/头像推给 UI（顶栏变成对方的头像昵称）。
        const uin = (API.Utils.getCookie('uin') || '').replace(/\D/g, '');
        const ownerUin = String((window.QZone.Common.Owner && window.QZone.Common.Owner.uin) || uin || '');
        const targetUin = window.QZone.Common.Target && window.QZone.Common.Target.uin;
        let info = null;
        // 仅当采集目标即登录者（或未覆写）时才拉取公开资料；他人备份期间跳过，
        // UI 侧保留上一次的本人昵称/头像（推送过滤 undefined，不会清空）
        if (!targetUin || String(targetUin) === ownerUin) {
          try {
            const raw = await API.Common.getUserInfos();
            // v5.0：Utils.get 统一按文本返回（dataType:'text'，JSONP/JSON 字符串），
            // 必须先解析——原实现直接对字符串取 .data/.nickname 恒为 undefined，
            // 昵称永远为空 → 重试 8 次全空 → UI 永远回退 QQ 号（2026-09-22 装机发现）
            const data = typeof raw === 'string' ? API.Utils.toJson(raw, /^_Callback\(/) : raw;
            const d = data && (data.data || data);
            info = d && (d.userinfo || d.UserInfo || d);
          } catch (e) {
            console.warn('[tasks/orchestrator] getUserInfos 失败', e);
          }
        }
        return {
          loggedIn: !!ownerUin,
          qqNumber: ownerUin,
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
