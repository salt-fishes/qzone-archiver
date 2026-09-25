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

/** 当前暂停位应绑定的任务标识：活跃备份 taskId，无则独立暂停哨兵 */
function pauseKey() {
  return getActiveTaskContext()?.taskId || STANDALONE_PAUSE;
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
  stateStore.saveDownloads(queue);
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
    queue = queue.filter((q) => !!q.taskId && q.taskId === currentTaskId);
    if (queue.length !== before) {
      persist();
      sendToUi(PushChannels.downloadStateChanged, { state: 'cleared' });
      logger.info(`[download-manager] 已清理历史任务下载记录 ${before - queue.length} 条`);
    }
  },

  /** 并发调度：并发数与批间间隔来自本次备份配置；暂停时不调度新任务 */
  pump() {
    // P3-2：暂停位只对发起暂停时的活跃任务有效；任务已切换则自动失效并恢复调度
    if (pausedTaskId) {
      if (pausedTaskId === pauseKey()) return;
      pausedTaskId = null;
    }
    const { thread } = settings();
    let dispatched = 0;
    while (true) {
      const big = bigRunning < BIG_CONCURRENCY;
      const reg = running < thread;
      // 大文件占专用槽位，常规任务占常规槽位
      const candidate =
        (big && queue.find((q) => q.state === 'pending' && isBig(q))) ||
        (reg && queue.find((q) => q.state === 'pending' && !isBig(q)));
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
      persist();
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
    if (pausedTaskId && pausedTaskId === pauseKey()) {
      logger.warn('[download-manager] 任务暂停态中入队新任务，媒体下载将持续排队直至 resume()');
    }
    queue.push(record);
    persist();
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
        await new Promise((r) => setTimeout(r, delay));
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
    const controller = new AbortController();
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
    return { queue, done, failed, inProgress };
  },

  /** 暂停：停止调度 + 中断运行中任务（.part 保留断点，恢复后续传）——用户暂停期望立刻停止工作。
   * P3-2：暂停位绑定当前活跃任务（§5.2），新任务启动后自动失效 */
  async pause() {
    pausedTaskId = pauseKey();
    for (const q of queue) {
      if (q.state === 'running') {
        q.pauseInterrupted = true;
        q.cancelRequested = true;
      }
    }
  },

  /** 恢复：清任务暂停位，继续调度 */
  async resume() {
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
    persist();
    // 运行中任务标记 cancelRequested，data 回调发现后销毁流
    for (const q of queue) {
      if (q.state === 'running') q.cancelRequested = true;
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
};
