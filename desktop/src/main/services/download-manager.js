/**
 * 下载管理器（主进程）——M2b 实现
 * 流式下载（Readable.fromWeb → writeStream 背压 pipe）+ .part 断点续传 + Range。
 *
 * 设计（对照方案 §3.3）：
 * - 默认方案：net.fetch 流式 → 写盘背压，内存恒定（大文件零整块缓冲）
 * - 断点续传：失败/取消保留 .part + 已收字节；重试发 Range: bytes=N-；服务端不支持 Range 则全量重下
 * - 已存在跳过：目标存在且 Content-Length 一致 → 跳过（URL 哈希命名复用）
 * - 背压：pipeline 由写流 drain 自动暂停/恢复请求
 * - 磁盘预检：fs.statfs 剩余空间不足 → 标记失败并告警
 * - 空闲超时：60s 无数据自动 abort 重试
 * - 并发：常规 downloadThread（默认 10）；>50MB 大文件单独限流槽位（2）
 * - 进度节流：≥500ms 或 ≥1% 双阈值上报，IPC 不洪水
 * - 暂停/恢复/取消：暂停停止调度新任务；取消清空待处理并中断运行中任务（保留 .part 可续）
 *
 * 注意：qzone 媒体 URL 常为 http://，Chromium 网络栈会 ERR_BLOCKED_BY_CLIENT；
 * 直连下载统一升级 https（与渲染器 mixed-content 自动升级行为一致）。
 */
import { net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getActiveTaskContext, sendToUi } from './engine-bridge.js';
import { PushChannels } from '../../shared/ipc-contract.mjs';
import { stateStore } from './state-store.js';
import { logger } from './logger.js';

const DEFAULT_THREAD = 10;
const MAX_THREAD = 20; // 并发上限（防止配置误填打爆 CDN）
const BIG_FILE_THRESHOLD = 50 * 1024 * 1024; // 大文件阈值
const BIG_CONCURRENCY = 2; // 大文件并发槽位
const HEADER_TIMEOUT = 30_000; // 建连/首字节超时（响应头到达前）
const IDLE_TIMEOUT = 60_000; // 空闲超时（无数据即 abort）
const MAX_RETRY = 5; // 单任务重试上限（v4.7：与 P1 计划一致）
const RETRY_BASE_DELAY = 2_000; // 重试退避基数（2s/4s/8s…）
const PROGRESS_MIN_INTERVAL = 500; // 进度节流：最小间隔 ms
const PROGRESS_MIN_PERCENT = 1; // 进度节流：最小百分比增量
const SUMMARY_MIN_INTERVAL = 500; // 队列汇总节流 ms
const REFERER = 'https://user.qzone.qq.com/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * 媒体文件后缀白名单（v4.7：下载列表只展示多媒体文件）。
 * 目录约定（非 Common/ 即媒体）会把说说语音、日志附件等非媒体一并算进来，
 * 故改为按真实文件后缀判定；无后缀/未知后缀一律按非媒体处理（不进列表）。
 */
const MEDIA_EXT = new Set([
  // 图片
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif', 'avif', 'tif', 'tiff', 'svg',
  // 视频
  'mp4', 'm4v', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'webm', 'ts', '3gp', 'mpg', 'mpeg', 'rmvb',
  // 音频
  'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'amr', 'wma',
]);

/** 是否多媒体文件（按后缀判定；无后缀视为非媒体） */
function isMediaFile(name) {
  const n = String(name || '');
  const dot = n.lastIndexOf('.');
  if (dot < 0 || dot === n.length - 1) return false;
  return MEDIA_EXT.has(n.slice(dot + 1).toLowerCase());
}

let queue = [];
let running = 0; // 常规任务运行数
let bigRunning = 0; // 大文件任务运行数
// P3-2（§5.2）：任务级暂停位（P0-1 根因的模块级 paused 全局已删除）。
// 暂停位绑定发起 pause 时的活跃 taskId；pump 时若活跃任务已切换（新备份启动），
// 旧暂停位自动失效——杜绝"取消/换任务后 pump 永久短路，媒体下载静默排队"。
const STANDALONE_PAUSE = '__standalone__'; // 无活跃备份时的独立暂停（下载页手动暂停）
let pausedTaskId = null;
// v5.5 M1：任务级暂停集合——新任务启动时暂停旧任务；当前任务完成后 FIFO 恢复旧任务。
const pausedTaskIds = new Set();

/** 当前暂停位应绑定的任务标识：活跃备份 taskId，无则独立暂停哨兵 */
function pauseKey() {
  return getActiveTaskContext()?.taskId || STANDALONE_PAUSE;
}

function taskKeyOf(record) {
  return (record && record.taskId) || STANDALONE_PAUSE;
}

/** 某任务是否处于暂停（当前任务位 + 旧任务集合） */
function isTaskPaused(taskId) {
  const key = taskId || STANDALONE_PAUSE;
  return pausedTaskIds.has(key) || (!!pausedTaskId && pausedTaskId === key);
}

/**
 * v5.5 M1：任务下载排空回调。
 * 完成与下载解耦后，历史统计在完成瞬间记录，尾部媒体稍后落盘；
 * 队列排空时通知上层（ipc/engine 用它重算 files/size）。
 * 每个任务在一个排空周期内只通知一次；该任务新增记录后重新武装。
 */
const drainedTasks = new Set();
let drainListener = null;

function notifyTaskDrained(taskId) {
  if (!drainListener || !taskId || drainedTasks.has(taskId)) return false;
  const records = queue.filter((q) => q.taskId === taskId);
  if (!records.length) return false;
  if (records.some((q) => q.state === 'pending' || q.state === 'running')) return false;
  drainedTasks.add(taskId);
  try {
    drainListener(taskId);
  } catch (e) {
    logger.warn(`[download-manager] 任务下载排空回调失败：${e && e.message}`);
  }
  return true;
}

/**
 * 运行时设置（v4.7 P1）：并发与批间间隔改为从本次备份配置读取。
 * v4.6 之前这两个设置项只被无调用点的 downloadsByBrowser/downloadByAria2 读取，
 * 主进程下载器写死 10 并发且无间隔 —— 用户改设置无效（"哑巴设置"）。
 * @returns {{thread:number, sleepMs:number}} thread 常规并发；sleepMs 每轮槽位跑满后的停顿
 */
function settings() {
  const cfg = getActiveTaskContext()?.config || {};
  const common = cfg.Common || {};
  const rawThread = Number(common.downloadThread);
  const rawSleep = Number(common.downloadSleep);
  const thread = Number.isFinite(rawThread) && rawThread > 0
    ? Math.min(MAX_THREAD, Math.max(1, Math.floor(rawThread)))
    : DEFAULT_THREAD;
  const sleepMs = Number.isFinite(rawSleep) && rawSleep > 0 ? Math.round(rawSleep * 1000) : 0;
  return { thread, sleepMs };
}

/** 队列汇总节流（v4.7 P1：让用户看到"整体还剩多少"） */
let lastSummaryAt = 0;
function pushSummary(force) {
  const now = Date.now();
  if (!force && now - lastSummaryAt < SUMMARY_MIN_INTERVAL) return;
  lastSummaryAt = now;
  const counts = { pending: 0, running: 0, done: 0, failed: 0 };
  for (const q of queue) {
    if (counts[q.state] !== undefined) counts[q.state] += 1;
  }
  sendToUi(PushChannels.downloadStateChanged, {
    state: 'summary',
    summary: { ...counts, total: queue.length },
  });
}

function persist() {
  // v5.5 M0：立即落盘（终态/清理/退出路径用），同时取消挂起的节流写避免旧数据覆盖
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  stateStore.saveDownloads(queue);
}

/**
 * v5.5 M0：入队/派发高频路径的持久化节流——500ms 合并写一次。
 * 此前每条入队/派发都全量同步写 downloads.json（1 万条媒体 = 2 万次全量写盘），
 * 是主进程事件循环卡顿来源之一。终态转换仍走 persist() 立即落盘（M1 换 journal）。
 */
const PERSIST_DEBOUNCE_MS = 500;
let persistTimer = null;
function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    stateStore.saveDownloads(queue);
  }, PERSIST_DEBOUNCE_MS);
}

/** 立即冲刷挂起的节流写（退出前调用，防丢最近 500ms 变更） */
function flushPersist() {
  persist();
}

/**
 * v5.5 M0：可中断退避 sleep——pause()/cancel() 经 record._wakeSleep 立即唤醒，
 * 重试退避不再拖住暂停/取消（配合 AbortController 实现秒级中断在途任务）
 */
function interruptibleSleep(record, ms) {
  return new Promise((resolve) => {
    const done = () => {
      record._wakeSleep = null;
      resolve();
    };
    const timer = setTimeout(done, ms);
    record._wakeSleep = () => {
      clearTimeout(timer);
      done();
    };
  });
}

/** §K4：下载事件写任务日志（重试/放弃须含 URL 与原因）；无活跃任务落 main.log */
function downloadLog(level, msg) {
  const taskId = getActiveTaskContext()?.taskId;
  if (taskId) logger.task(taskId).log(level, msg);
  else logger.log(level, `[download-manager] ${msg}`);
}

function toHttps(url) {
  return String(url || '').replace(/^http:\/\//i, 'https://');
}

function resolveTarget(task) {
  // task.dir 为 Filer 相对路径（如 'Messages/images'）
  const dir = String(task.dir || '').replace(/^\/+/, '');
  const name = task.name || 'file';
  return path.join(task.targetDir || '', dir, name);
}

function isBig(record) {
  return !!record.totalBytes && record.totalBytes > BIG_FILE_THRESHOLD;
}

export const downloadManager = {
  load() {
    const { queue: saved } = stateStore.loadDownloads();
    queue = Array.isArray(saved) ? saved : [];
    // 重启后：残留 running/pending 统一回 pending，断点续传；
    // 按真实后缀重算媒体标志（v4.7：旧记录沿用目录口径会把非媒体算进来）
    for (const q of queue) {
      if (q.state === 'running') q.state = 'pending';
      q.media = isMediaFile(q.name);
      if (!Number.isFinite(q.retries)) q.retries = 0;
    }
  },

  /**
   * v4.9.2：新备份启动时清除**所有非当前任务**的下载记录（终态与 pending/running 一并清）。
   * v5.0 只清 done/failed，保留了旧任务遗留的 pending —— 但那些 pending 指向的
   * 是已过期的 psc 直链和旧目标目录，续传毫无意义，还会因 FIFO 先于当前任务的
   * 媒体被调度（实机：新备份前 2 分钟全在补下旧任务 1790 条，当前任务的 1077 条
   * 一条没轮到），下载列表也被灌成几千条。
   */
  purgeFinished() {
    const currentTaskId = getActiveTaskContext()?.taskId;
    const before = queue.length;
    // v5.5 M1：只清其他任务的终态记录；旧任务 pending/running 保留（新任务启动时暂停，稍后恢复）
    queue = queue.filter(
      (q) =>
        (!!q.taskId && q.taskId === currentTaskId) ||
        q.state === 'pending' ||
        q.state === 'running'
    );
    if (queue.length !== before) {
      persist();
      sendToUi(PushChannels.downloadStateChanged, { state: 'cleared' });
      logger.info(`[download-manager] 已清理历史任务下载记录 ${before - queue.length} 条（保留未完成）`);
    }
  },

  /** 并发调度：并发数与批间间隔来自本次备份配置；暂停时不调度新任务 */
  pump() {
    const { thread } = settings();
    let dispatched = 0;
    while (true) {
      const big = bigRunning < BIG_CONCURRENCY;
      const reg = running < thread;
      // 大文件占专用槽位，常规任务占常规槽位；跳过被暂停任务（旧任务/当前任务）
      const eligible = (q) => q.state === 'pending' && !isTaskPaused(q.taskId);
      const candidate =
        (big && queue.find((q) => eligible(q) && isBig(q))) ||
        (reg && queue.find((q) => eligible(q) && !isBig(q)));
      if (!candidate) break;
      candidate.state = 'running';
      // 槽位归属按「派发时」的大小判定并记账（v4.9.2）：_attempt 下载中会把
      // record.totalBytes 更新为真实大小，若 finally 再按 isBig 重新判定，
      // 首次发现是大文件的记录会去归还大文件槽位而漏还常规槽位——
      // 10 个大文件下完后 running 永久占满，队列静默冻结（实机 11:13 冻结根因）。
      candidate.slotBig = isBig(candidate);
      if (candidate.slotBig) bigRunning += 1;
      else running += 1;
      dispatched += 1;
      persistSoon(); // v5.5 M0：派发高频路径合并写盘
      sendToUi(PushChannels.downloadStateChanged, { taskId: candidate.id, state: 'running', module: candidate.module, media: candidate.media });
      pushSummary();
      this._run(candidate)
        .catch((e) => {
          if (candidate.pauseInterrupted) {
            // 暂停中断：保留 .part 断点，恢复后重新调度续传（不标记失败）
            candidate.pauseInterrupted = false;
            candidate.cancelRequested = false;
            candidate.state = 'pending';
            sendToUi(PushChannels.downloadStateChanged, { taskId: candidate.id, state: 'pending', module: candidate.module, media: candidate.media });
          } else {
            candidate.state = 'failed';
            candidate.error = e.message;
            // §K4：最终放弃必须落任务日志（URL + 原因）——这正是卡死排查时最需要的一行
            downloadLog(
              'error',
              `媒体下载最终放弃（已重试 ${MAX_RETRY} 次）：${candidate.url}（${e.message}）→ ${resolveTarget(candidate)}`
            );
            sendToUi(PushChannels.downloadItemFailed, { taskId: candidate.id, url: candidate.url, error: e.message, module: candidate.module, media: candidate.media });
          }
          persist();
        })
        .finally(() => {
          if (candidate.slotBig) bigRunning = Math.max(0, bigRunning - 1);
          else running = Math.max(0, running - 1);
          pushSummary();
          this.pump();
          // v5.5 M1：该任务最后一条下载结束（done/failed）→ 通知上层重算历史统计
          this.checkTaskDrained(candidate.taskId);
        });
    }
    // 本轮槽位跑满：按「下载间隔」停顿后再续（v4.7：1 万条媒体需给 CDN 喘息）
    if (dispatched > 0 && running >= thread && queue.some((q) => q.state === 'pending')) {
      const { sleepMs } = settings();
      if (sleepMs > 0) {
        setTimeout(() => this.pump(), sleepMs);
      }
    }
  },

  /**
   * 等待当前任务的下载队列排空（备份完成前的兜底，v5.2）。
   *
   * 背景：媒体/头像是采集期 fire-and-forget 入队的，引擎模块跑完就推
   * backup:completed —— 用户在完成页立刻打包 ZIP 或关机时，尾部小文件
   * （好友头像等）可能还没落盘，归档里 hasAvatar:true 却没有文件。
   *
   * 行为：
   * - 只等 pending/running 归零（done/failed/skipped 均为终态）
   * - 超时保底（默认 120s）：个别死链的重试不能无限拖住完成页
   * - 用户暂停态立即返回（completed 不会在暂停态触发，防御性处理）
   * - onTick({pending, running, total})：计数变化时回调（收尾状态透传 UI，
   *   队列很大时用户能看到"还剩多少"，不再只停在进度面板干等）
   * - 开始/收尾/超时三行同时写任务日志与 UI 日志（此前只有任务日志轨道，
   *   且上下文过早清理导致落到 main.log —— 见 ipc/engine.js 收尾链）
   *
   * @param {number} [timeoutMs] 等待上限
   * @param {(counts: {pending:number, running:number, total:number}) => void} [onTick] 计数变化回调
   * @returns {Promise<boolean>} true=队列已排空；false=超时/暂停退出
   */
  async waitIdle(timeoutMs = 120_000, onTick) {
    const startedAt = Date.now();
    let announced = false;
    let lastPending = -1;
    let lastRunning = -1;
    /** 计数变化才推送（500ms 轮询 × 大量完成事件，去重避免 IPC 洪水） */
    const emitTick = () => {
      if (typeof onTick !== 'function') return;
      let pending = 0;
      let runningCount = 0;
      for (const q of queue) {
        if (q.state === 'pending') pending += 1;
        else if (q.state === 'running') runningCount += 1;
      }
      if (pending === lastPending && runningCount === lastRunning) return;
      lastPending = pending;
      lastRunning = runningCount;
      try {
        onTick({ pending, running: runningCount, total: queue.length });
      } catch {
        /* UI 推送失败不影响收尾 */
      }
    };
    /** 收尾生命周期行：任务日志 + UI 日志双轨（其余逐条重试流水仍只进任务日志） */
    const logBoth = (level, msg) => {
      downloadLog(level, msg);
      sendToUi(PushChannels.backupLog, { level, message: msg });
    };
    while (Date.now() - startedAt < timeoutMs) {
      // 用户主动暂停：completed 流程不会在暂停态触发，避免死等
      if (isTaskPaused(pauseKey())) return false;
      const left = queue.filter((q) => q.state === 'pending' || q.state === 'running');
      if (left.length === 0) {
        if (announced) logBoth('info', '下载队列已收尾，全部媒体/头像落盘完成');
        emitTick();
        return true;
      }
      if (!announced) {
        announced = true;
        logBoth('info', `备份收尾：等待下载队列落盘（剩余 ${left.length} 项，上限 ${Math.round(timeoutMs / 1000)}s）…`);
      }
      emitTick();
      await new Promise((r) => setTimeout(r, 500));
    }
    const left = queue.filter((q) => q.state === 'pending' || q.state === 'running').length;
    logBoth('warn', `下载收尾等待超时（${Math.round(timeoutMs / 1000)}s），仍有 ${left} 项未落盘，备份继续完成（缺失文件可增量补采）`);
    emitTick();
    return false;
  },

  async enqueue(task) {
    const active = getActiveTaskContext();
    const record = {
      id: task.id || `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: toHttps(task.url),
      name: task.name,
      dir: task.dir,
      module: task.module,
      targetDir: active.targetDir || task.targetDir || null,
      // v5.0：归属任务（新备份启动时据此清理历史任务的已完成/失败记录）
      taskId: active.taskId || null,
      state: 'pending',
      createdAt: Date.now(),
      totalBytes: task.totalBytes || 0,
      retries: 0,
      // 媒体标志（v4.7）：按真实文件后缀判定，只有多媒体文件进下载列表
      media: isMediaFile(task.name),
    };
    if (!record.targetDir) {
      throw new Error('备份目标目录未设置');
    }
    // 最小状态断言（P0-1）：当前任务处于暂停态时入队，新任务将排队直至恢复；
    // 若并非用户主动暂停（backup:pause），说明存在暂停位残留，需排查状态机
    if (isTaskPaused(pauseKey())) {
      logger.warn('[download-manager] 任务暂停态中入队新任务，媒体下载将持续排队直至 resume()');
    }
    queue.push(record);
    if (record.taskId) drainedTasks.delete(record.taskId);
    persistSoon(); // v5.5 M0：入队高频路径合并写盘（派发/进度仍即时可见，落盘合并 500ms）
    sendToUi(PushChannels.downloadStateChanged, { taskId: record.id, state: 'pending', module: record.module, media: record.media });
    pushSummary();
    this.pump();
    return record.id;
  },

  /**
   * 单任务下载：流式 + 断点续传 + 建连/空闲超时 + 重试（v4.7 P1）
   * 失败按 MAX_RETRY 次退避重试；终态失败上抛由 pump() 标记 failed 并释放槽位。
   */
  async _run(record) {
    const maxAttempts = MAX_RETRY + 1;
    for (let attempt = 1; ; attempt++) {
      try {
        await this._attempt(record);
        return;
      } catch (e) {
        // 取消/暂停中断不重试（保留 .part 断点）
        if (record.cancelRequested || record.pauseInterrupted) throw e;
        if (attempt >= maxAttempts) {
          record.retries = attempt - 1;
          throw e;
        }
        record.retries = attempt;
        const delay = RETRY_BASE_DELAY * 2 ** (attempt - 1);
        // §K4：接口/媒体重试流水（含 URL 与错误原因）
        downloadLog(
          'warn',
          `媒体下载重试 ${attempt}/${MAX_RETRY}：${record.url}（${e && e.message}），${delay}ms 后重试`
        );
        sendToUi(PushChannels.downloadStateChanged, {
          taskId: record.id, state: 'pending', module: record.module, media: record.media, retry: attempt,
        });
        // v5.5 M0：退避 sleep 可被 pause()/cancel() 立即唤醒（record._wakeSleep）
        await interruptibleSleep(record, delay);
        if (record.cancelRequested || record.pauseInterrupted) throw e;
      }
    }
  },

  /** 单次尝试：请求 → 流式落盘 → 校验 → 改名 */
  async _attempt(record) {
    const dest = resolveTarget(record);
    const partFile = dest + '.part';
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    // 断点偏移：已有 .part 则从已收字节续传
    let offset = 0;
    if (fs.existsSync(partFile)) {
      offset = fs.statSync(partFile).size;
    } else if (fs.existsSync(dest)) {
      // 目标完整存在（上次已完成）：URL 哈希命名复用，直接跳过
      record.state = 'done';
      record.doneAt = Date.now();
      record.skipped = true;
      persist();
      sendToUi(PushChannels.downloadStateChanged, { taskId: record.id, state: 'done', module: record.module, media: record.media, skipped: true });
      return;
    }

    const headers = { Referer: REFERER, 'User-Agent': UA };
    if (offset > 0) headers.Range = `bytes=${offset}-`;

    // v4.7 P1：建连/首字节超时。此前 net.fetch 无 signal —— 请求若卡在
    // 连接/TLS/等响应头，会一直占着并发槽位（1 万条媒体场景下整个队列静止）。
    // v5.5 M0：controller 挂到 record 上——pause()/cancel() 立即 abort 在途请求，
    // 不再只依赖 data 回调的标志位检查（流静默无数据时旧机制永远等不到检查点）。
    const controller = new AbortController();
    record.abortController = controller;
    let headerTimer = setTimeout(() => controller.abort(), HEADER_TIMEOUT);
    let response;
    try {
      response = await net.fetch(record.url, { headers, signal: controller.signal });
    } catch (e) {
      if (record.cancelRequested || record.pauseInterrupted) throw new Error('已取消');
      const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
      throw new Error(aborted ? `请求超时（${HEADER_TIMEOUT / 1000}s 内未收到响应）` : `请求失败：${(e && e.message) || e}`);
    } finally {
      clearTimeout(headerTimer);
    }
    // 断点续传时服务端可能不支持 Range 返回 200（全量），此时回到 0 重下
    if (offset > 0 && response.status === 200) {
      offset = 0;
    } else if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const total = offset + contentLength;
    record.totalBytes = total;

    // 磁盘预检：剩余空间不足则暂停队列并告警
    try {
      const stat = fs.statfsSync(path.dirname(dest));
      const free = stat.bavail * stat.bsize;
      if (total > 0 && free < total) {
        throw new Error('磁盘剩余空间不足，请清理后重试');
      }
    } catch (e) {
      if (/磁盘剩余空间不足/.test(e.message)) throw e;
      /* 其它 statfs 失败（如网络盘）不阻塞 */
    }

    const ws = fs.createWriteStream(partFile, { flags: offset > 0 ? 'a' : 'w' });
    const nodeStream = Readable.fromWeb(/** @type {any} */ (response.body));

    let received = offset;
    let lastReport = 0;
    let lastPercent = -1;
    let idleTimer = null;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      // 空闲超时：中断响应体（同时中止底层请求），保留 .part 供下次续传
      idleTimer = setTimeout(() => {
        try { controller.abort(); } catch (_) { /* ignore */ }
        nodeStream.destroy(new Error('下载空闲超时'));
      }, IDLE_TIMEOUT);
    };
    resetIdle();
    nodeStream.on('data', (chunk) => {
      // 取消：中断当前流（.part 保留，下次续传）
      if (record.cancelRequested) {
        nodeStream.destroy(new Error('已取消'));
        return;
      }
      received += chunk.length;
      resetIdle();
      // 进度节流：≥500ms 或 ≥1% 才上报
      const now = Date.now();
      const percent = total > 0 ? Math.round((received / total) * 100) : 0;
      if (now - lastReport >= PROGRESS_MIN_INTERVAL || percent - lastPercent >= PROGRESS_MIN_PERCENT) {
        lastReport = now;
        lastPercent = percent;
        record.receivedBytes = received;
        sendToUi(PushChannels.downloadProgress, { taskId: record.id, done: received, total, currentUrl: record.url, media: record.media, module: record.module });
      }
    });

    try {
      await pipeline(nodeStream, ws);
    } catch (e) {
      if (record.cancelRequested || record.pauseInterrupted) throw new Error('已取消');
      throw e;
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
      record.abortController = null; // v5.5 M0：本次尝试结束，引用随手清理
    }

    // 完成：校验长度后 .part → 目标
    if (total > 0 && received !== total) {
      throw new Error(`文件不完整：${received}/${total}`);
    }
    fs.renameSync(partFile, dest);
    record.state = 'done';
    record.doneAt = Date.now();
    record.receivedBytes = received;
    record.retries = record.retries || 0;
    persist();
    sendToUi(PushChannels.downloadProgress, { taskId: record.id, done: total, total, currentUrl: record.url, media: record.media, module: record.module });
    sendToUi(PushChannels.downloadStateChanged, { taskId: record.id, state: 'done', module: record.module, media: record.media });
  },

  getState() {
    const done = queue.filter((q) => q.state === 'done');
    const failed = queue.filter((q) => q.state === 'failed');
    const inProgress = queue.filter((q) => q.state === 'running' || q.state === 'pending');
    return { queue, done, failed, inProgress, pausedTasks: [...pausedTaskIds] };
  },

  /** v5.5 M1：按任务统计下载数量（完成页/下载中心用） */
  getTaskCounts(taskId) {
    const counts = { pending: 0, running: 0, done: 0, failed: 0, total: 0 };
    for (const q of queue) {
      if (taskId && q.taskId !== taskId) continue;
      counts.total += 1;
      if (counts[q.state] !== undefined) counts[q.state] += 1;
    }
    return counts;
  },

  /** 暂停：停止调度 + 中断运行中任务（.part 保留断点，恢复后续传）——用户暂停期望立刻停止工作。
   * P3-2：暂停位绑定当前活跃任务（§5.2），新任务启动后自动失效 */
  async pause() {
    const key = pauseKey();
    pausedTaskId = key;
    pausedTaskIds.add(key);
    for (const q of queue) {
      if (q.state === 'running' && taskKeyOf(q) === key) {
        q.pauseInterrupted = true;
        q.cancelRequested = true;
        // v5.5 M0：立即中断在途请求 + 唤醒退避 sleep（秒级生效，不再等下一个 data 事件）
        try { q.abortController?.abort(); } catch (_) { /* ignore */ }
        if (typeof q._wakeSleep === 'function') q._wakeSleep();
      }
    }
  },

  /** 恢复：清当前任务暂停位，继续调度 */
  async resume() {
    const key = pauseKey();
    pausedTaskIds.delete(key);
    if (pausedTaskId === key) pausedTaskId = null;
    this.pump();
  },

  /**
   * v5.5 M1：暂停其他任务（新任务启动时调用）——保留 pending/.part，
   * 中断在途请求，当前任务独占下载槽位。
   */
  async pauseOthers(currentTaskId) {
    const current = currentTaskId || getActiveTaskContext()?.taskId;
    const keys = new Set();
    for (const q of queue) {
      if (q.taskId && q.taskId !== current) keys.add(q.taskId);
    }
    for (const key of keys) pausedTaskIds.add(key);
    for (const q of queue) {
      if (q.state === 'running' && q.taskId && q.taskId !== current) {
        q.pauseInterrupted = true;
        q.cancelRequested = true;
        try { q.abortController?.abort(); } catch (_) { /* ignore */ }
        if (typeof q._wakeSleep === 'function') q._wakeSleep();
      }
    }
    logger.info(`[download-manager] 已暂停 ${keys.size} 个旧任务下载队列（当前任务 ${current || '—'}）`);
    return [...keys];
  },

  /** v5.5 M1：新任务完成后恢复其他任务（FIFO；由调用方在 completed 后触发） */
  async resumeOthers(currentTaskId) {
    const current = currentTaskId || getActiveTaskContext()?.taskId;
    for (const key of [...pausedTaskIds]) {
      if (key !== current) pausedTaskIds.delete(key);
    }
    if (pausedTaskId && pausedTaskId !== current) pausedTaskId = null;
    this.pump();
    return [...pausedTaskIds];
  },

  /** 测试/清理用：解除所有任务暂停 */
  async resumeAll() {
    pausedTaskIds.clear();
    pausedTaskId = null;
    this.pump();
  },

  /** 取消：清空待处理任务；运行中任务中断（.part 保留，下次续传）。
   * P3-2：暂停位已绑定任务（§5.2），取消后即使不手动 resume，
   * 下一次备份启动（taskId 切换）也会令旧暂停位自动失效，P0-1 根因消除 */
  async cancel() {
    const pending = queue.filter((q) => q.state === 'pending');
    for (const q of pending) {
      q.state = 'failed';
      q.error = '已取消';
    }
    // v5.5 M1：当前任务取消后清掉自己的暂停位，避免残留影响下一次备份
    const current = pauseKey();
    pausedTaskIds.delete(current);
    if (pausedTaskId === current) pausedTaskId = null;
    persist();
    // 运行中任务标记 cancelRequested，abort 在途请求并销毁流（v5.5 M0：立即生效）
    for (const q of queue) {
      if (q.state === 'running') {
        q.cancelRequested = true;
        try { q.abortController?.abort(); } catch (_) { /* ignore */ }
        if (typeof q._wakeSleep === 'function') q._wakeSleep();
      }
    }
    sendToUi(PushChannels.downloadStateChanged, { state: 'cancelled' });
  },

  /** 清除已完成/失败任务（同步持久化，避免重启后残留） */
  async clearDone() {
    const before = queue.length;
    queue = queue.filter((q) => q.state === 'pending' || q.state === 'running');
    if (queue.length !== before) persist();
    sendToUi(PushChannels.downloadStateChanged, { state: 'cleared' });
  },

  /**
   * v5.5 M1：失败条目重新入队。
   * 保留 .part 断点（下次尝试续传），清空错误与重试计数后按正常调度重跑。
   * @param {string} [taskId] 只重试某次备份的下载；缺省 = 全部失败项
   * @returns {Promise<number>} 重置的条目数
   */
  async retryFailed(taskId) {
    const owner = taskId ? String(taskId) : null;
    const targets = queue.filter((q) => q.state === 'failed' && (!owner || q.taskId === owner));
    if (!targets.length) return 0;
    for (const q of targets) {
      q.state = 'pending';
      q.error = null;
      q.retries = 0;
      q.cancelRequested = false;
      q.pauseInterrupted = false;
      q.receivedBytes = 0;
      if (q.taskId) drainedTasks.delete(q.taskId);
      sendToUi(PushChannels.downloadStateChanged, {
        taskId: q.id,
        state: 'pending',
        module: q.module,
        media: q.media,
        retry: 0,
        // 清空渲染层残留的失败原因（合并更新不会自动删除旧字段）
        error: null,
      });
    }
    persist();
    pushSummary();
    this.pump();
    logger.info(`[download-manager] 已重新入队失败下载 ${targets.length} 条`);
    return targets.length;
  },

  /**
   * v5.5 M1：注册「某任务下载队列排空」回调（ipc/engine 用它重算历史统计）。
   * 传 null 取消注册。
   */
  setDrainListener(fn) {
    drainListener = typeof fn === 'function' ? fn : null;
  },

  /**
   * v5.5 M1：检查某任务是否已排空并触发回调。
   * pump 的每条下载收尾都会调用；导出便于单测与诊断。
   * @returns {boolean} 本次是否触发（同一排空周期只触发一次）
   */
  checkTaskDrained(taskId) {
    return notifyTaskDrained(taskId);
  },

  /**
   * v5.5 M0：立即冲刷挂起的节流持久化写（before-quit 调用）。
   * 只冲盘不改队列状态，失败由调用方兜底（退出路径不阻断）。
   */
  flushPersist() {
    flushPersist();
  },
};
