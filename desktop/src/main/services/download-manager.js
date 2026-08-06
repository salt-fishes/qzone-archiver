/**
 * 下载管理器（主进程）
 * M2a/P1：基础下载（net.fetch → 写盘，自设 Referer/UA，串行）
 * M2b：升级为流式（Readable.fromWeb → writeStream 背压）+ .part 断点续传 + 并发限流
 */
import { net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { getActiveBackup, sendToUi } from './engine-bridge.js';
import { stateStore } from './state-store.js';

let queue = [];

function persist() {
  stateStore.saveDownloads(queue);
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

  async enqueue(task) {
    const active = getActiveBackup();
    const record = {
      id: task.id || `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: task.url,
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
    // 不阻塞引擎，异步执行
    this._run(record).catch((e) => {
      record.state = 'failed';
      record.error = e.message;
      persist();
      sendToUi('download:item-failed', { taskId: record.id, url: record.url, error: e.message });
    });
    return record.id;
  },

  async _run(record) {
    record.state = 'running';
    persist();
    sendToUi('download:state-changed', { taskId: record.id, state: 'running' });

    const dest = resolveTarget(record);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    const response = await net.fetch(record.url, {
      headers: {
        Referer: 'https://user.qzone.qq.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
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
