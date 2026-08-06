/**
 * 下载管理器（主进程）
 * M2a/P1：基础下载（net.fetch → 写盘，自设 Referer/UA，并发上限 downloadThread）
 * M2b：升级为流式（Readable.fromWeb → writeStream 背压）+ .part 断点续传
 *
 * 注意：qzone 媒体 URL 常为 http://，Chromium 网络栈会 ERR_BLOCKED_BY_CLIENT；
 * 直连下载统一升级 https（与渲染器 mixed-content 自动升级行为一致）。
 */
import { net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { getActiveBackup, sendToUi } from './engine-bridge.js';
import { stateStore } from './state-store.js';

const CONCURRENCY = 10;
const REFERER = 'https://user.qzone.qq.com/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

let queue = [];
let running = 0;

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

export const downloadManager = {
  load() {
    const { queue: saved } = stateStore.loadDownloads();
    queue = Array.isArray(saved) ? saved : [];
  },

  /** 简单并发调度：队列中 pending 项逐个启动，保持运行数 <= CONCURRENCY */
  pump() {
    while (running < CONCURRENCY) {
      const idx = queue.findIndex((q) => q.state === 'pending');
      if (idx === -1) break;
      const record = queue[idx];
      record.state = 'running';
      running += 1;
      persist();
      sendToUi('download:state-changed', { taskId: record.id, state: 'running' });
      this._run(record)
        .catch((e) => {
          record.state = 'failed';
          record.error = e.message;
          persist();
          sendToUi('download:item-failed', { taskId: record.id, url: record.url, error: e.message });
        })
        .finally(() => {
          running = Math.max(0, running - 1);
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
    };
    if (!record.targetDir) {
      throw new Error('备份目标目录未设置');
    }
    queue.push(record);
    persist();
    sendToUi('download:state-changed', { taskId: record.id, state: 'pending' });
    this.pump();
    return record.id;
  },

  async _run(record) {
    const dest = resolveTarget(record);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const response = await net.fetch(record.url, {
      headers: { Referer: REFERER, 'User-Agent': UA },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);

    record.state = 'done';
    record.doneAt = Date.now();
    persist();
    sendToUi('download:progress', { taskId: record.id, done: 1, total: 1, currentUrl: record.url });
    sendToUi('download:state-changed', { taskId: record.id, state: 'done' });
  },

  getState() {
    const done = queue.filter((q) => q.state === 'done');
    const failed = queue.filter((q) => q.state === 'failed');
    const inProgress = queue.filter((q) => q.state === 'running' || q.state === 'pending');
    return { queue, done, failed, inProgress };
  },

  async pause() {
    /* M2b：暂停未完成任务 */
  },
  async resume() {
    /* M2b */
  },
  async cancel() {
    /* M2b */
  },
};
