/**
 * P6.1（§8.1）结构化日志 + v4.9 §K 日志双轨化
 *
 * 两条轨道（用途不同，互不依赖窗口生命周期）：
 *  - 应用日志  logs/main.log          主进程自身事件：会话自检、窗口生命周期、IPC 异常、状态机迁移
 *  - 任务日志  logs/backup-<id>.log   备份任务事件流水：任务开始/结束、模块开始/结束、
 *                                     接口重试与放弃（含 URL）、暂停/恢复/取消
 *
 * 架构原则（§K 确立）：可观测性的主路径不得经过任何窗口的生命周期。
 * 引擎 console 透传（index.js）从"备份日志唯一来源"降级为任务日志的补充来源（附录区段）。
 *
 * - 分级：debug < info < warn < error，默认 info（debug 仅显式 setLevel('debug') 时输出）
 * - 双写：stdout（console[level] 镜像）+ 文件；轮转：超过 maxBytes 时 .log→.1→.2… 移位，最旧删除
 * - 降级可见（§K3）：落盘失败 console.error 一次并置 degraded 停写文件——
 *   "日志坏了"必须可见，但日志失败不允许反过来打断备份主流程（stdout 镜像仍在）
 */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MAIN_MAX_BYTES = 10 * 1024 * 1024;
const MAIN_MAX_ARCHIVES = 3;
const TASK_MAX_BYTES = 5 * 1024 * 1024; // §K6：任务日志轮转 5MB × 2
const TASK_MAX_ARCHIVES = 2;

/**
 * 文件落地器：惰性目录由调用方保证 + 追加 + 轮转 + 降级可见（main 与任务日志共用）
 * @param {string} file 完整文件路径
 * @param {string} [label] 降级告警显示名
 * @param {Function} [rotation] 动态读轮转参数的函数，返回 {maxBytes, maxArchives}（main 日志经此注入实例属性，单测可改小阈值验证轮转）
 */
class FileSink {
  constructor(file, label, rotation) {
    this.file = file;
    this.label = label || path.basename(file);
    this._rotation = rotation || null;
    this.degraded = false;
  }

  get maxBytes() {
    return this._rotation ? this._rotation().maxBytes : TASK_MAX_BYTES;
  }

  get maxArchives() {
    return this._rotation ? this._rotation().maxArchives : TASK_MAX_ARCHIVES;
  }

  append(text) {
    if (this.degraded) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      this._rotateIfNeeded();
      fs.appendFileSync(this.file, text);
    } catch (e) {
      this.degraded = true;
      console.error(`[logger] ${this.label} 落盘失败，本次会话降级为仅终端输出：${e?.message || e}`);
    }
  }

  _rotateIfNeeded() {
    let size = 0;
    try {
      size = fs.statSync(this.file).size;
    } catch {
      return; // 文件尚不存在
    }
    if (size < this.maxBytes) return;
    try {
      const dir = path.dirname(this.file);
      const base = path.basename(this.file);
      const oldest = path.join(dir, `${base}.${this.maxArchives}`);
      if (fs.existsSync(oldest)) fs.rmSync(oldest, { force: true });
      for (let i = this.maxArchives - 1; i >= 1; i--) {
        const from = path.join(dir, `${base}.${i}`);
        if (fs.existsSync(from)) fs.renameSync(from, path.join(dir, `${base}.${i + 1}`));
      }
      fs.renameSync(this.file, path.join(dir, `${base}.1`));
    } catch {
      /* 轮转失败保留原文件继续追加 */
    }
  }
}

/**
 * 任务日志绑定 logger（§K）：backup-<taskId>.log 专用，行首带 taskId 前缀。
 * 任务文件按任务分文件而非集中一个 backup.log：与 checkpoints 任务粒度一致、
 * 单次备份记录不被轮转滚掉、用户反馈问题时只需提供这一个文件。
 */
class TaskLogger {
  /**
   * @param {string} taskId
   * @param {FileSink} sink
   */
  constructor(taskId, sink) {
    this.taskId = taskId;
    this._sink = sink;
    this.minLevel = LOG_LEVELS.info;
  }

  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) this.minLevel = LOG_LEVELS[level];
  }

  debug(msg) { this.log('debug', msg); }
  info(msg) { this.log('info', msg); }
  warn(msg) { this.log('warn', msg); }
  error(msg) { this.log('error', msg); }

  /** @param {string} level debug/info/warn/error 之外的级别忽略 */
  log(level, msg) {
    if (LOG_LEVELS[level] === undefined || LOG_LEVELS[level] < this.minLevel) return;
    const line = `[${level}] [${this.taskId}] ${msg}`;
    (level === 'debug' ? console.log : console[level] || console.log)(line);
    this._sink.append(`[${new Date().toISOString()}] ${line}\n`);
  }

  /** 引擎 console 透传的附录区段（§K5 补充轨道；loc = 注入脚本名:行号，定位引擎内部问题用） */
  engine(level, msg, loc) {
    if (LOG_LEVELS[level] === undefined || LOG_LEVELS[level] < this.minLevel) return;
    const line = `[${level}] [engine] ${msg}${loc ? ` @ ${loc}` : ''}`;
    (console[level] || console.log)(line);
    this._sink.append(`[${new Date().toISOString()}] ${line}\n`);
  }
}

class Logger {
  constructor() {
    this.minLevel = LOG_LEVELS.info;
    this._dir = null;
    this._mainSink = null;
    this._taskSinks = new Map();
    // 轮转参数实例化（单测可注入小阈值验证轮转行为）
    this.maxBytes = MAIN_MAX_BYTES;
    this.maxArchives = MAIN_MAX_ARCHIVES;
  }

  /** 输出目录惰性初始化（避免 import 期触碰 electron app，便于单测 mock） */
  get dir() {
    if (!this._dir) {
      this._dir = path.join(app.getPath('userData'), 'logs');
    }
    return this._dir;
  }

  get file() {
    return path.join(this.dir, 'main.log');
  }

  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) this.minLevel = LOG_LEVELS[level];
  }

  debug(msg) { this.log('debug', msg); }
  info(msg) { this.log('info', msg); }
  warn(msg) { this.log('warn', msg); }
  error(msg) { this.log('error', msg); }

  /** @param {string} level debug/info/warn/error 之外的级别忽略 */
  log(level, msg) {
    if (LOG_LEVELS[level] === undefined || LOG_LEVELS[level] < this.minLevel) return;
    // stdout 镜像（保持既有开发期习惯：终端可直接观察）
    const line = `[${level}] ${msg}`;
    (level === 'debug' ? console.log : console[level])(line);
    this._main.append(`[${new Date().toISOString()}] ${line}\n`);
  }

  get _main() {
    if (!this._mainSink) {
      this._mainSink = new FileSink(
        this.file,
        'main.log',
        () => ({ maxBytes: this.maxBytes, maxArchives: this.maxArchives })
      );
    }
    return this._mainSink;
  }

  /**
   * §K：任务日志轨道。同一 taskId 重复调用返回同一 logger（追加同一文件）。
   * @param {string} taskId
   * @param {{maxBytes?:number, maxArchives?:number}} [rotationOverride] 单测注入小阈值
   */
  task(taskId, rotationOverride) {
    const id = String(taskId || '').trim().replace(/[^\w.-]/g, '_');
    if (!id) throw new Error('logger.task 需要 taskId');
    let t = this._taskSinks.get(id);
    if (!t) {
      const file = path.join(this.dir, `backup-${id}.log`);
      const sink = new FileSink(
        file,
        `backup-${id}.log`,
        rotationOverride
          ? () => rotationOverride
          : () => ({ maxBytes: TASK_MAX_BYTES, maxArchives: TASK_MAX_ARCHIVES })
      );
      t = new TaskLogger(id, sink);
      this._taskSinks.set(id, t);
    }
    return t;
  }

  /** 任务终态后释放内存句柄（磁盘文件保留，用户反馈问题时可直接提供该文件） */
  disposeTask(taskId) {
    this._taskSinks.delete(String(taskId || '').trim().replace(/[^\w.-]/g, '_'));
  }

  /**
   * §K2 会话自检行：应用日志链路的验收探针——冷启动后 main.log 必有此行，
   * 缺失即代表"应用日志"链路断了（与 132 行全是引擎透传的故障形态直接对应）。
   */
  sessionStart() {
    const version = typeof app.getVersion === 'function' ? app.getVersion() : 'unknown';
    this.info(
      `[main] 会话开始 v${version} pid=${process.pid} userData=${app.getPath('userData')} ` +
        `level=${Object.keys(LOG_LEVELS).find((k) => LOG_LEVELS[k] === this.minLevel)}`
    );
  }
}

export const logger = new Logger();
