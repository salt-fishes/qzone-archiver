/**
 * 备份 store（P4.1 真 Pinia 化：defineStore setup 写法）
 * 职责：备份运行状态（busy/paused/progress）、运行日志（logs）、下载列表（downloads）
 *       + 主进程事件订阅 + start/pause/resume/cancel + 日志导出
 * 依赖 config store（selectedModules/targetDir/buildEngineConfig），store 内组合而非模块 import。
 */
import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useConfigStore, MODULE_META } from './config';

/* ============ 运行状态 ============
 * P3-1：主进程任务状态机为唯一事实源（backup:state-changed 派生），
 * 渲染层删除乐观置位——busy/paused 均为只读 computed，任何组件不得直接赋值。
 */

export type TaskState =
  | 'idle' | 'preparing' | 'running' | 'paused'
  | 'completed' | 'cancelled' | 'failed';

/** 模块级失败信息（P0-3：部分模块备份失败时在成功页显著提示） */
export type BackupModuleError = { module: string; message?: string };

export type BackupResult = {
  completedAt?: number;
  targetDir?: string;
  name?: string;
  total?: number;
  size?: number;
  files?: number;
  moduleCounts?: Record<string, number>;
  errors?: BackupModuleError[];
  /** 采集目标（v4.6：他人模式档案展示；缺省/旧记录 = 本人） */
  target?: { uin: string; nickname?: string };
};

export type DownloadItem = {
  id: string; name?: string; url: string; state: string; module?: string; error?: string;
  received?: number; total?: number; percent?: number; skipped?: boolean; media?: boolean;
};

export const DL_STATES: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '排队' },
  { key: 'running', label: '下载中' },
  { key: 'done', label: '完成' },
  { key: 'failed', label: '失败' },
];

export const useBackupStore = defineStore('backup', () => {
  const cfg = useConfigStore();

  /* -------- 运行状态 -------- */

  const taskState = ref<TaskState>('idle');
  const busy = computed(() => ['preparing', 'running', 'paused'].includes(taskState.value));
  const paused = computed(() => taskState.value === 'paused');
  const engineReady = ref(false);
  /** 引擎加载超时/失败标记（顶栏提示「连接失败」并可重试） */
  const engineFailed = ref(false);

  /** 重试引擎连接：重新注入全部引擎脚本 */
  async function retryEngine() {
    engineFailed.value = false;
    try {
      const r = await window.api.backup.engineInject();
      if (r?.ok) {
        pushLog('info', '引擎重连成功');
        return true;
      }
      engineFailed.value = true;
      pushLog('error', `引擎重连失败：${r?.error || '未知错误'}`);
      return false;
    } catch (e: any) {
      engineFailed.value = true;
      pushLog('error', `引擎重连异常：${e?.message || e}`);
      return false;
    }
  }
  const progress = ref<{
    module?: string; phase?: string; tip?: string; percent?: number;
    extra?: { success?: number; failed?: number; skip?: number; elapsed?: number };
  }>({});

  /* -------- 用时计时器 --------
   * 放在 store 而非组件内：备份跨路由/跨组件实例时计时不中断；
   * watch 加 immediate，组件在任何时机挂载都能按当前 busy/paused 正确启动。
   * 时间戳基准：setInterval 只负责刷新显示，秒数由 Date.now 差值计算，
   * 避免窗口后台节流 / 事件风暴时累加丢拍。
   */
  const elapsedSec = ref(0);
  let tickBase = 0;   // 已累计的运行秒（暂停时结算）
  let tickStart = 0;  // 当前运行段起点时间戳
  let tickTimer: number | undefined;
  function tickStop() {
    window.clearInterval(tickTimer);
    tickTimer = undefined;
    if (tickStart) {
      tickBase += Math.floor((Date.now() - tickStart) / 1000);
      tickStart = 0;
    }
  }
  function tickStartRun() {
    tickStart = Date.now();
    tickTimer = window.setInterval(() => {
      elapsedSec.value = tickBase + Math.floor((Date.now() - tickStart) / 1000);
    }, 500);
  }
  watch(
    [busy, paused],
    ([b, p]) => {
      tickStop();
      if (b && !p) tickStartRun();
    },
    { immediate: true }
  );

  /* -------- 运行日志 -------- */

  const logs = ref<{ time: string; level: string; message: string }[]>([]);

  function pushLog(level: string, message: string) {
    const time = new Date().toLocaleTimeString();
    logs.value.push({ time, level, message });
    if (logs.value.length > 600) logs.value.splice(0, logs.value.length - 600);
  }

  /** 导出运行日志：选择保存位置 → 写入 txt → 自动打开 */
  async function exportLogs() {
    if (logs.value.length === 0) {
      pushLog('warn', '暂无日志可导出');
      return;
    }
    const now = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
    try {
      const r = await window.api.fs.saveDialog({ title: '导出运行日志', defaultPath: `运行日志-${stamp}.txt` });
      if (r.canceled || !r.path) return;
      const content = [
        'QQ空间档案备份 运行日志',
        `导出时间：${now.toLocaleString()}`,
        `共 ${logs.value.length} 条`,
        '='.repeat(42),
        ...logs.value.map((l) => `[${l.time}] [${l.level}] ${l.message}`),
      ].join('\n');
      const w = await window.api.fs.writeText(r.path, content);
      if (w.ok) {
        pushLog('success', `日志已导出：${r.path}`);
        window.api.fs.openPath(r.path); // 导出后自动打开
      } else {
        pushLog('error', `日志导出失败：${w.error || '未知错误'}`);
      }
    } catch (e: any) {
      console.error('导出日志异常', e);
      pushLog('error', `日志导出异常：${e?.message || e}`);
    }
  }

  /* -------- 下载列表 -------- */

  const downloads = ref<Record<string, DownloadItem>>({});
  const downloadFilter = ref('all');
  const downloadModule = ref('all');

  /** 取消备份后置位：中断任务的失败事件不再重建列表（否则取消后残留失败条目） */
  let ignoreAfterCancel = false;

  /* -------- 备份结果（成功页数据） -------- */

  /** 最近一次备份完成记录（备份完成后置位，成功页展示；再次备份/返回时清空） */
  const lastResult = ref<BackupResult | null>(null);

  /** 本次任务已完成的模块（module-done 事件收集，进行中面板逐模块清单展示） */
  const doneModules = ref<string[]>([]);

  function resetResult() {
    lastResult.value = null;
  }

  /** 媒体文件任务（头像/通用资源等小文件不入列表，聚焦多媒体下载） */
  const mediaDownloads = computed(() => Object.values(downloads.value).filter((d) => d.media !== false));

  const filteredDownloads = computed(() => {
    const list = mediaDownloads.value;
    const byState = downloadFilter.value === 'all' ? list : list.filter((d) => d.state === downloadFilter.value);
    const byModule = downloadModule.value === 'all' ? byState : byState.filter((d) => d.module === downloadModule.value);
    return byModule.reverse();
  });
  const dlCount = computed(() => mediaDownloads.value.length);
  const dlFilterCount = computed(() => filteredDownloads.value.length);

  function downloadName(url: string) {
    try {
      // 去掉查询参数后再解析，避免 ? 后内容混入文件名
      const clean = String(url || '').split('?')[0];
      const u = new URL(clean);
      const segs = u.pathname.split('/').filter(Boolean);
      const last = segs.pop() || '';
      // psc/psb/psd 等相册 CDN 路径没有真实文件名（如 r.photo.store.qq.com/psc?/xxx）
      if (!last || /^ps[a-z]$/i.test(last)) {
        const key = segs.pop() || 'img';
        return `${u.hostname.replace(/\./g, '-')}-${key.slice(0, 8) || 'img'}`;
      }
      return last;
    } catch {
      return url;
    }
  }

  function applyDownloadState(item: DownloadItem) {
    const prev = downloads.value[item.id];
    downloads.value[item.id] = { ...(prev || {}), ...item };
    if (item.module && !prev?.module) downloads.value[item.id].module = item.module;
  }

  function stateLabel(s: string) {
    return { pending: '排队', running: '下载中', done: '完成', failed: '失败' }[s] || s;
  }

  function formatBytes(n?: number) {
    if (!n) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function clearDoneDownloads() {
    // 同步清除主进程持久化队列（否则重启后残留）
    window.api.download
      .clearDone()
      .catch((e: any) => console.warn('清除下载队列失败', e));
    // 白名单重建：仅保留排队/下载中，其余（完成/失败/异常/幽灵条目）全部清除
    const next: Record<string, DownloadItem> = {};
    for (const [key, d] of Object.entries(downloads.value)) {
      if (d.state === 'pending' || d.state === 'running') next[key] = d;
    }
    downloads.value = next;
    pushLog('info', '已清除完成/失败的下载记录');
  }

  /* -------- 备份控制 -------- */

  async function startBackup(targetUin?: string) {
    const modules = cfg.selectedModules;
    if (!cfg.targetDir) {
      pushLog('warn', '请先选择备份目标目录');
      return false;
    }
    // P3-1：不再乐观置位 busy——状态由主进程 backup:state-changed 派生
    progress.value = { module: modules[0] || '', phase: '启动', percent: 0 };
    doneModules.value = [];
    // 新任务清空上一轮日志，避免看起来"日志没在更新"
    logs.value = [];
    // 生成本次备份任务 ID：主进程检查点/状态推送均以 taskId 关联，缺失会导致日志显示 undefined 且无法精确追踪
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const targetLabel = targetUin ? `好友 ${targetUin} 的公开内容` : '我的空间';
    pushLog('info', `开始备份：${targetLabel} · ${modules.map((m) => MODULE_META[m]?.label || m).join('、')} → ${cfg.targetDir}`);
    try {
      // v4.6：targetUin 为可选他人模式参数，缺省 undefined 时引擎行为与旧版一致
      const r = await window.api.backup.start({ taskId, modules, targetDir: cfg.targetDir, config: cfg.buildEngineConfig(), targetUin });
      if (!r.ok) {
        pushLog('error', `启动失败：${r.error}`);
        return false;
      }
      return true;
    } catch (e: any) {
      console.error('startBackup 异常', e);
      pushLog('error', `备份启动异常：${e?.message || e}`);
      return false;
    }
  }

  async function pause() {
    // P3-1：状态机 guard 在主进程侧，非法转移直接返回拒绝；不再乐观置位
    try {
      const r = await window.api.backup.pause();
      if (r?.ok) pushLog('info', '已暂停');
      else pushLog('warn', `暂停被拒绝：${r?.error || '未知原因'}`);
    } catch (e: any) {
      console.error('暂停请求失败', e);
      pushLog('error', `暂停失败：${e?.message || e}`);
    }
  }
  async function resume() {
    try {
      const r = await window.api.backup.resume();
      if (r?.ok) pushLog('info', '已恢复');
      else pushLog('warn', `恢复被拒绝：${r?.error || '未知原因'}`);
    } catch (e: any) {
      console.error('恢复请求失败', e);
      pushLog('error', `恢复失败：${e?.message || e}`);
    }
  }
  async function cancel() {
    try {
      const r = await window.api.backup.cancel();
      if (r?.ok) pushLog('info', '已取消');
      else pushLog('warn', `取消被拒绝：${r?.error || '未知原因'}`);
    } catch (e: any) {
      pushLog('error', `取消失败：${e?.message || e}`);
    }
  }

  /* -------- 事件订阅（App.vue onMounted 调 init，onBeforeUnmount 调 dispose） -------- */

  let unsubs: (() => void)[] = [];

  function initBackup() {
    if (unsubs.length) return;
    unsubs.push(
      window.api.on('backup:state-changed', (p) => {
        if (p.state === 'engine-ready') {
          engineReady.value = true;
          pushLog('success', '引擎注入完成，五层采集链路就绪');
          return;
        }
        // P3-1：状态机快照是唯一事实源，渲染层只派生（idle 之外全量采纳）
        if (p.state) taskState.value = p.state;
        if (p.state === 'running') {
          ignoreAfterCancel = false; // 新备份开始，恢复下载事件接收
          pushLog('info', '开始备份');
        }
        if (p.state === 'paused') {
          pushLog('warn', '已暂停，可点击「恢复」继续');
        }
      }),
      window.api.on('backup:progress', (p) => {
        progress.value = p;
      }),
      window.api.on('backup:log', (p) => {
        pushLog(p.level || 'info', p.message || '');
      }),
      window.api.on('backup:module-done', (p) => {
        if (p.module && !doneModules.value.includes(p.module)) doneModules.value.push(p.module);
        pushLog('success', `模块完成：${MODULE_META[p.module]?.label || p.module}`);
      }),
      window.api.on('backup:completed', async (p) => {
        // P3-1：busy/paused 复位已由 state-changed(completed) 派生，此处只处理结果数据
        // P0-3：模块失败不再静默——日志面板与成功页均显著可见
        const errs: BackupModuleError[] = Array.isArray(p?.errors) ? p.errors : [];
        if (errs.length) {
          const names = errs.map((e) => MODULE_META[e.module]?.label || e.module).join('、');
          pushLog('warn', `部分模块备份失败：${names}（详见成功页提示）`);
        } else {
          pushLog('success', '备份完成');
        }
        if (cfg.targetDir) {
          pushLog('info', `入口文件：${cfg.targetDir}\\index.html（双击浏览备份）`);
        }
        // 拉取最新一条备份记录作为成功页数据（主进程已落盘 backup-history.json）
        try {
          const r = await window.api.backup.getHistory();
          // v4.6：target 取完成事件附带的采集目标（历史记录亦已落 target 字段）
          lastResult.value = { ...((r?.history && r.history[0]) || { targetDir: cfg.targetDir }), errors: errs, target: p?.target };
        } catch (e) {
          console.warn('读取备份结果失败', e);
          lastResult.value = { targetDir: cfg.targetDir, errors: errs, target: p?.target };
        }
      }),
      window.api.on('download:state-changed', (p) => {
        // 全局状态事件（cleared/cancelled）不带 taskId：同步本地列表，与主进程保持一致
        if (!p.taskId) {
          if (p.state === 'cleared') {
            // 仅清除完成/失败（与主进程 clearDone 语义一致，保留排队/下载中）
            const next: Record<string, DownloadItem> = {};
            for (const [k, d] of Object.entries(downloads.value)) {
              if (d.state === 'pending' || d.state === 'running') next[k] = d;
            }
            downloads.value = next;
          } else if (p.state === 'cancelled') {
            downloads.value = {};
            ignoreAfterCancel = true; // 取消后中断任务的失败事件不再重建列表
          }
          return;
        }
        if (ignoreAfterCancel) return;
        // 下载文件详情在「下载列表」展示，不写日志（避免刷屏）
        applyDownloadState({ id: p.taskId, state: p.state, url: p.url || '', module: p.module, skipped: p.skipped, error: p.error });
      }),
      window.api.on('download:progress', (p) => {
        if (ignoreAfterCancel) return;
        if (p.currentUrl) {
          applyDownloadState({
            id: p.taskId, url: p.currentUrl, state: 'running', module: p.module,
            received: p.done, total: p.total,
            percent: p.total ? Math.round((p.done / p.total) * 100) : 0,
          });
        }
      }),
      window.api.on('download:item-failed', (p) => {
        if (ignoreAfterCancel) return;
        applyDownloadState({ id: p.taskId, url: p.url, state: 'failed', error: p.error, module: p.module });
        pushLog('error', `下载失败：${downloadName(p.url)} - ${p.error}`);
      })
    );

    // 下载列表初始化（恢复历史队列）
    window.api.download
      .getState()
      .then((st) => {
        for (const q of st?.queue || []) {
          applyDownloadState({ id: q.id, url: q.url, state: q.state, error: q.error, module: q.module, media: q.media });
        }
      })
      .catch((e) => console.warn('读取下载队列失败', e));
  }

  function disposeBackup() {
    unsubs.forEach((fn) => fn());
    unsubs = [];
  }

  return {
    // 状态
    taskState, busy, paused, engineReady, engineFailed, progress, elapsedSec, logs, downloads,
    lastResult, resetResult, doneModules,
    downloadFilter, downloadModule, mediaDownloads, filteredDownloads,
    dlCount, dlFilterCount, DL_STATES,
    // 函数
    retryEngine, pushLog, exportLogs, downloadName, applyDownloadState, stateLabel,
    formatBytes, clearDoneDownloads, startBackup, pause, resume, cancel,
    initBackup, disposeBackup,
  };
});
