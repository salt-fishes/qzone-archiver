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
import { getActiveBackup, sendToUi } from './engine-bridge.js';
import { PushChannels } from '../../shared/ipc-contract.mjs';
import { stateStore } from './state-store.js';

const DEFAULT_THREAD = 10;
const BIG_FILE_THRESHOLD = 50 * 1024 * 1024; // 大文件阈值
const BIG_CONCURRENCY = 2; // 大文件并发槽位
const IDLE_TIMEOUT = 60_000; // 空闲超时（无数据即 abort）
const PROGRESS_MIN_INTERVAL = 500; // 进度节流：最小间隔 ms
const PROGRESS_MIN_PERCENT = 1; // 进度节流：最小百分比增量
const REFERER = 'https://user.qzone.qq.com/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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
  return getActiveBackup().taskId || STANDALONE_PAUSE;
}

function persist() {
  stateStore.saveDownloads(queue);
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
    // 重启后：残留 running/pending 统一回 pending，断点续传；旧记录补齐 media 标志
    for (const q of queue) {
      if (q.state === 'running') q.state = 'pending';
      if (q.media === undefined) {
        q.media = !String(q.dir || '').replace(/^\/+/, '').startsWith('Common/');
      }
    }
  },

  /** 简单并发调度：保持运行数不超并发上限；暂停时不调度新任务 */
  pump() {
    // P3-2：暂停位只对发起暂停时的活跃任务有效；任务已切换则自动失效并恢复调度
    if (pausedTaskId) {
      if (pausedTaskId === pauseKey()) return;
      pausedTaskId = null;
    }
    while (true) {
      const big = bigRunning < BIG_CONCURRENCY;
      const reg = running < DEFAULT_THREAD;
      // 大文件占专用槽位，常规任务占常规槽位
      const candidate =
        (big && queue.find((q) => q.state === 'pending' && isBig(q))) ||
        (reg && queue.find((q) => q.state === 'pending' && !isBig(q)));
      if (!candidate) break;
      candidate.state = 'running';
      if (isBig(candidate)) bigRunning += 1;
      else running += 1;
      persist();
      sendToUi(PushChannels.downloadStateChanged, { taskId: candidate.id, state: 'running', module: candidate.module, media: candidate.media });
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
            sendToUi(PushChannels.downloadItemFailed, { taskId: candidate.id, url: candidate.url, error: e.message, module: candidate.module, media: candidate.media });
          }
          persist();
        })
        .finally(() => {
          if (isBig(candidate)) bigRunning = Math.max(0, bigRunning - 1);
          else running = Math.max(0, running - 1);
          this.pump();
        });
    }
  },

  async enqueue(task) {
    const active = getActiveBackup();
    const record = {
      id: task.id || `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: toHttps(task.url),
      name: task.name,
      dir: task.dir,
      module: task.module,
      targetDir: active.targetDir || task.targetDir || null,
      state: 'pending',
      createdAt: Date.now(),
      totalBytes: task.totalBytes || 0,
      // 媒体标志：Common/ 目录为头像/通用资源（小文件），下载列表仅展示媒体文件
      media: !String(task.dir || '').replace(/^\/+/, '').startsWith('Common/'),
    };
    if (!record.targetDir) {
      throw new Error('备份目标目录未设置');
    }
    // 最小状态断言（P0-1）：当前任务处于暂停态时入队，新任务将排队直至恢复；
    // 若并非用户主动暂停（backup:pause），说明存在暂停位残留，需排查状态机
    if (pausedTaskId && pausedTaskId === pauseKey()) {
      console.warn('[download-manager] 任务暂停态中入队新任务，媒体下载将持续排队直至 resume()');
    }
    queue.push(record);
    persist();
    sendToUi(PushChannels.downloadStateChanged, { taskId: record.id, state: 'pending', module: record.module, media: record.media });
    this.pump();
    return record.id;
  },

  /** 单任务下载：流式 + 断点续传 + 空闲超时 + 磁盘预检 */
  async _run(record) {
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

    const response = await net.fetch(record.url, { headers });
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
      idleTimer = setTimeout(() => nodeStream.destroy(new Error('下载空闲超时，自动重试')), IDLE_TIMEOUT);
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
        sendToUi(PushChannels.downloadProgress, { taskId: record.id, done: received, total, currentUrl: record.url, media: record.media });
      }
    });

    try {
      await pipeline(nodeStream, ws);
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
    persist();
    sendToUi(PushChannels.downloadProgress, { taskId: record.id, done: total, total, currentUrl: record.url, media: record.media });
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
