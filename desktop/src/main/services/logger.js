/**
 * P6.1（§8.1）结构化日志：level 分级 + 文件轮转（10MB × 3）
 *
 * - 分级：debug < info < warn < error，默认 info（debug 仅显式 setLevel('debug') 时输出）
 * - 双写：stdout（console[level] 镜像）+ userData/logs/main.log
 * - 轮转：main.log 超过 10MB 时 main.log→main.log.1→.2→.3 依次移位，最旧删除
 * - 引擎 console 透传（index.js）经本模块落盘：只透传带 [e:level] 标记的引擎日志，
 *   qzone 页面噪音（JSONP 回调/CSP/遥测）无标记，整体降噪丢弃（原正则黑名单废除）
 *
 * 日志写入失败静默吞掉（不吞业务错误——写日志不能反过来打断备份主流程）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ARCHIVES = 3;

class Logger {
  constructor() {
    this.minLevel = LOG_LEVELS.info;
    this._dir = null;
    // 轮转参数实例化（单测可注入小阈值验证轮转行为）
    this.maxBytes = MAX_BYTES;
    this.maxArchives = MAX_ARCHIVES;
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
    this._append(`[${new Date().toISOString()}] ${line}\n`);
  }

  _append(text) {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      this._rotateIfNeeded();
      fs.appendFileSync(this.file, text);
    } catch {
      /* 日志落盘失败不影响业务 */
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
      const oldest = path.join(this.dir, `main.log.${this.maxArchives}`);
      if (fs.existsSync(oldest)) fs.rmSync(oldest, { force: true });
      for (let i = this.maxArchives - 1; i >= 1; i--) {
        const from = path.join(this.dir, `main.log.${i}`);
        if (fs.existsSync(from)) fs.renameSync(from, path.join(this.dir, `main.log.${i + 1}`));
      }
      fs.renameSync(this.file, path.join(this.dir, 'main.log.1'));
    } catch {
      /* 轮转失败保留原文件继续追加 */
    }
  }
}

export const logger = new Logger();
