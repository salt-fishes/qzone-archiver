/**
 * TaskStore（v5.5 M1）：任务持久化单一入口
 *
 * 目录：userData/tasks/<taskId>/
 *   task.json        不可变计划（targetDir/modules/config/targetUin/appVersion）
 *   journal.jsonl    append-only 事件流水（seq/ts/type/data）
 *   checkpoint.json  最近一次模块/阶段检查点（原子写）
 *   summary.json     终态摘要（原子写）
 *
 * 设计：
 * - 不 import 业务模块；只做文件读写 + scan/prune，便于单测与复用。
 * - taskId 只允许 [A-Za-z0-9._-]，拒绝 `..`/路径分隔符（防目录穿越）。
 * - journal 的 seq 单调递增；进程内缓存，重启后从文件末行恢复。
 * - 所有 JSON 写入走 tmp → rename，避免半截文件。
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  TASK_PROTOCOL_VERSION,
  isActiveTaskState,
  isTerminalTaskState,
} from '../../shared/task-protocol.mjs';

const TASK_ID_RE = /^[A-Za-z0-9._-]+$/;
const DEFAULT_KEEP = 20;
const DEFAULT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * 校验/规范化 taskId：只接受安全字符，拒绝路径穿越。
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeTaskId(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s === '.' || s === '..' || s.includes('..') || !TASK_ID_RE.test(s)) {
    throw new Error(`非法 taskId：${raw}`);
  }
  return s;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('[task-store] 读取失败', file, e?.message || e);
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * 创建 TaskStore（依赖注入 baseDir，便于单测；生产用文末单例）
 * @param {{baseDir?: string|(()=>string), now?: ()=>number, maxTasks?: number, maxAgeMs?: number}} [opts]
 */
export function createTaskStore(opts = {}) {
  if (!opts.baseDir) throw new Error('createTaskStore 需要 baseDir');
  const now = opts.now || (() => Date.now());
  const maxTasks = Number.isFinite(opts.maxTasks) ? opts.maxTasks : DEFAULT_KEEP;
  const maxAgeMs = Number.isFinite(opts.maxAgeMs) ? opts.maxAgeMs : DEFAULT_MAX_AGE_MS;
  const seqCache = new Map();

  function resolveBase() {
    return path.resolve(typeof opts.baseDir === 'function' ? opts.baseDir() : opts.baseDir);
  }

  function taskDir(taskId) {
    return path.join(resolveBase(), sanitizeTaskId(taskId));
  }

  function taskFile(taskId) {
    return path.join(taskDir(taskId), 'task.json');
  }
  function journalFile(taskId) {
    return path.join(taskDir(taskId), 'journal.jsonl');
  }
  function checkpointFile(taskId) {
    return path.join(taskDir(taskId), 'checkpoint.json');
  }
  function summaryFile(taskId) {
    return path.join(taskDir(taskId), 'summary.json');
  }

  function readLastSeq(file) {
    try {
      if (!fs.existsSync(file)) return 0;
      const text = fs.readFileSync(file, 'utf8').trim();
      if (!text) return 0;
      const last = text.slice(text.lastIndexOf('\n') + 1);
      const seq = Number(JSON.parse(last).seq);
      return Number.isFinite(seq) ? seq : 0;
    } catch {
      return 0;
    }
  }

  function nextSeq(taskId) {
    let seq = seqCache.get(taskId);
    if (seq == null) {
      seq = readLastSeq(journalFile(taskId));
    }
    const next = seq + 1;
    seqCache.set(taskId, next);
    return next;
  }

  /**
   * 创建任务（幂等：已存在直接返回）。task.json 一旦写入不再覆盖。
   * @param {object} plan 至少包含 taskId
   */
  function createTask(plan = {}) {
    const taskId = sanitizeTaskId(plan.taskId);
    const file = taskFile(taskId);
    const existing = readJson(file, null);
    if (existing) return existing;
    const task = {
      protocol: TASK_PROTOCOL_VERSION,
      ...plan,
      taskId,
      createdAt: plan.createdAt || now(),
    };
    writeJsonAtomic(file, task);
    appendJournal(taskId, {
      type: 'task-created',
      data: {
        targetDir: task.targetDir || null,
        modules: Array.isArray(task.modules) ? task.modules : [],
        targetUin: task.targetUin || null,
        runId: task.runId || null,
      },
    });
    return task;
  }

  /**
   * 追加 journal 事件。
   * @param {string} taskId
   * @param {{type?: string, runId?: string, data?: object}} [event]
   */
  function appendJournal(taskId, event = {}) {
    const id = sanitizeTaskId(taskId);
    if (!event.type) throw new Error('appendJournal 需要 type');
    const dir = taskDir(id);
    ensureDir(dir);
    const record = {
      ...event,
      taskId: id,
      seq: nextSeq(id),
      ts: now(),
    };
    fs.appendFileSync(journalFile(id), JSON.stringify(record) + '\n', 'utf8');
    return record;
  }

  /** 保存检查点（模块/阶段粒度；调用方负责节流） */
  function saveCheckpoint(taskId, data = {}) {
    const id = sanitizeTaskId(taskId);
    const checkpoint = { ...data, taskId: id, updatedAt: data.updatedAt || now() };
    writeJsonAtomic(checkpointFile(id), checkpoint);
    return checkpoint;
  }

  function loadCheckpoint(taskId) {
    return readJson(checkpointFile(taskId), null);
  }

  /** 保存终态摘要 */
  function saveSummary(taskId, data = {}) {
    const id = sanitizeTaskId(taskId);
    const summary = { ...data, taskId: id, finishedAt: data.finishedAt || now() };
    writeJsonAtomic(summaryFile(id), summary);
    return summary;
  }

  function loadSummary(taskId) {
    return readJson(summaryFile(taskId), null);
  }

  /** 读取单个任务（task/checkpoint/summary） */
  function readTask(taskId) {
    const id = sanitizeTaskId(taskId);
    return {
      taskId: id,
      dir: taskDir(id),
      task: readJson(taskFile(id), null),
      checkpoint: readJson(checkpointFile(id), null),
      summary: readJson(summaryFile(id), null),
    };
  }

  /** 列出全部任务（createdAt 倒序） */
  function listTasks() {
    const base = resolveBase();
    if (!fs.existsSync(base)) return [];
    let names = [];
    try {
      names = fs
        .readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      return [];
    }
    return names
      .map((name) => {
        try {
          return readTask(name);
        } catch {
          return null;
        }
      })
      .filter((t) => t && t.task)
      .sort((a, b) => (b.task.createdAt || 0) - (a.task.createdAt || 0));
  }

  /**
   * 启动扫描：给 UI 的「可恢复任务」列表。
   * - 有 summary → 终态
   * - 无 summary + checkpoint → 按 checkpoint.state / interrupted 标记
   * - 只有 task.json → interrupted
   */
  function scan() {
    return listTasks().map((t) => {
      const cp = t.checkpoint;
      const state = (t.summary && t.summary.state) || (cp && cp.state) || 'interrupted';
      const recoverable =
        !t.summary &&
        (cp ? isActiveTaskState(cp.state) || cp.interrupted === true : true);
      return {
        taskId: t.taskId,
        createdAt: t.task.createdAt || null,
        updatedAt: (cp && cp.updatedAt) || t.task.createdAt || null,
        state,
        recoverable,
        interrupted: !!(cp && cp.interrupted),
        targetDir: t.task.targetDir || null,
        modules: Array.isArray(t.task.modules) ? t.task.modules : [],
        module: (cp && cp.module) || null,
        phase: (cp && cp.phase) || null,
        runId: (cp && cp.runId) || t.task.runId || null,
      };
    });
  }

  /** 标记任务被中断（应用被杀/退出时调用；保留 module/phase 供恢复） */
  function markInterrupted(taskId, reason = 'app-exit') {
    const id = sanitizeTaskId(taskId);
    const cp = loadCheckpoint(id) || {};
    saveCheckpoint(id, {
      ...cp,
      state: cp.state || 'running',
      interrupted: true,
      interruptedReason: reason,
    });
    appendJournal(id, { type: 'interrupted', data: { reason } });
    return loadCheckpoint(id);
  }

  /** 读取 journal 末尾 N 条（诊断用；损坏行跳过） */
  function readJournal(taskId, limit = 200) {
    const file = journalFile(taskId);
    if (!fs.existsSync(file)) return [];
    let lines = [];
    try {
      lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {
      return [];
    }
    const out = [];
    for (const line of lines) {
      try {
        out.push(JSON.parse(line));
      } catch {
        /* 损坏行跳过 */
      }
    }
    return limit > 0 ? out.slice(-limit) : out;
  }

  /**
   * 清理终态任务：保留最近 maxTasks 个且不超过 maxAgeMs；活跃/可恢复任务永不删除。
   * @returns {{removed: string[], kept: number}}
   */
  function prune() {
    const all = listTasks();
    const terminal = all
      .filter((t) => t.summary && isTerminalTaskState(t.summary.state))
      .sort(
        (a, b) =>
          (b.summary.finishedAt || b.task.createdAt || 0) -
          (a.summary.finishedAt || a.task.createdAt || 0)
      );
    const keepSet = new Set(terminal.slice(0, maxTasks).map((t) => t.taskId));
    const removed = [];
    for (const t of terminal) {
      const finishedAt = t.summary.finishedAt || t.task.createdAt || 0;
      const tooOld = now() - finishedAt > maxAgeMs;
      if (!keepSet.has(t.taskId) || tooOld) {
        try {
          fs.rmSync(t.dir, { recursive: true, force: true });
          removed.push(t.taskId);
        } catch {
          /* 单个删除失败跳过，下次再试 */
        }
      }
    }
    return { removed, kept: all.length - removed.length };
  }

  return {
    baseDir: resolveBase,
    taskDir,
    createTask,
    appendJournal,
    saveCheckpoint,
    loadCheckpoint,
    saveSummary,
    loadSummary,
    readTask,
    listTasks,
    scan,
    markInterrupted,
    readJournal,
    prune,
  };
}

/** 生产单例：目录延迟解析（避免 import 期 app 未 ready） */
export const taskStore = createTaskStore({
  baseDir: () => path.join(app.getPath('userData'), 'tasks'),
});
