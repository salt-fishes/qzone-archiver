/**
 * 任务状态存储（userData/state/）
 * - checkpoints/{taskId}.json   备份任务检查点（模块/配置/目标目录/进度）
 * - downloads.json              下载队列（待 M2b 完整断点续传）
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function stateDir() {
  return path.join(app.getPath('userData'), 'state');
}

function checkpointsDir() {
  return path.join(stateDir(), 'checkpoints');
}

function downloadsFile() {
  return path.join(stateDir(), 'downloads.json');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error('[state-store] 读取失败', file, e);
  }
  return fallback;
}

function writeJson(file, data, replacer) {
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, replacer ?? null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

export const stateStore = {
  /** 保存备份任务检查点 */
  saveCheckpoint(taskId, data) {
    const file = path.join(checkpointsDir(), `${taskId}.json`);
    writeJson(file, data);
    return file;
  },
  loadCheckpoint(taskId) {
    return readJson(path.join(checkpointsDir(), `${taskId}.json`), null);
  },
  clearCheckpoint(taskId) {
    try {
      fs.rmSync(path.join(checkpointsDir(), `${taskId}.json`), { force: true });
    } catch (e) {
      /* ignore */
    }
  },
  listCheckpoints() {
    try {
      if (!fs.existsSync(checkpointsDir())) return [];
      return fs
        .readdirSync(checkpointsDir())
        .filter((f) => f.endsWith('.json'))
        .map((f) => readJson(path.join(checkpointsDir(), f), null))
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  },
  /**
   * 下载队列。
   * v5.5 M0：过滤运行时瞬态字段（abortController/_wakeSleep 等下划线前缀）——
   * 这些字段不可克隆、重启后无意义，落盘会让 JSON 膨胀且加载出垃圾对象。
   */
  saveDownloads(queue) {
    writeJson(
      downloadsFile(),
      { queue: queue || [] },
      (key, value) => (key === 'abortController' || key.startsWith('_') ? undefined : value)
    );
  },
  loadDownloads() {
    return readJson(downloadsFile(), { queue: [] });
  },
};
