/**
 * v4.9 §K 日志双轨化单测
 *
 * 背景（§K 立项依据）：卡死故障时 main.log 132 行 100% 是引擎透传、主进程 0 行——
 * 应用日志没有调用者、备份日志挂在引擎窗生命周期上。本文件锁定双轨行为：
 *  ① logger.task(id) 写独立 backup-<id>.log 且带 taskId 前缀，与 main.log 互不串写
 *  ② 引擎附录行（TaskLogger.engine）写入任务文件
 *  ③ 落盘失败 → degraded 置位 + console.error 只报一次 + 不抛错（stdout 镜像仍在）
 *  ④ 任务文件轮转（注入小阈值）
 *  ⑤ disposeTask 释放句柄后 task() 可重建
 *  ⑥ sessionStart 会话自检行（应用日志链路的验收探针）
 * electron mock 到临时目录，文件读写全部落在临时目录内。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpGlobal;

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => tmpGlobal),
    getVersion: vi.fn(() => '9.9.9-test'),
  },
}));

const { logger } = await import('../../src/main/services/logger.js');

let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-dual-'));
  tmpGlobal = tmpDir;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  logger.minLevel = 1; // info
  logger._dir = null;
  logger._mainSink = null;
  vi.restoreAllMocks();
});

function silenceConsole() {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('双轨：任务日志独立文件', () => {
  it('task(id) 写 backup-<id>.log 且行带 taskId 前缀，main.log 不含任务行', () => {
    silenceConsole();
    logger.info('main-line-1');
    logger.task('task-d1').info('task-line-1');

    const main = fs.readFileSync(logger.file, 'utf8');
    const taskFile = path.join(logger.dir, 'backup-task-d1.log');
    expect(fs.existsSync(taskFile)).toBe(true);
    const task = fs.readFileSync(taskFile, 'utf8');
    expect(main).toContain('main-line-1');
    expect(main).not.toContain('task-line-1');
    expect(task).toContain('[task-d1] task-line-1');
    expect(task).not.toContain('main-line-1');
  });

  it('同一 taskId 重复 task() 返回同一 logger（追加同一文件不重建）', () => {
    silenceConsole();
    const a = logger.task('task-d2');
    a.info('first');
    const b = logger.task('task-d2');
    expect(b).toBe(a);
    b.warn('second');
    const task = fs.readFileSync(path.join(logger.dir, 'backup-task-d2.log'), 'utf8');
    expect(task).toContain('first');
    expect(task).toContain('second');
  });

  it('engine() 附录行写入任务文件，带 [engine] 标记与脚本定位', () => {
    silenceConsole();
    logger.task('task-d3').engine('info', '引擎内部日志', 'config.js:42');
    const task = fs.readFileSync(path.join(logger.dir, 'backup-task-d3.log'), 'utf8');
    expect(task).toContain('[engine] 引擎内部日志 @ config.js:42');
  });

  it('无 loc 时附录行不带 @ 定位后缀', () => {
    silenceConsole();
    logger.task('task-d4').engine('warn', '无定位信息');
    const task = fs.readFileSync(path.join(logger.dir, 'backup-task-d4.log'), 'utf8');
    expect(task).toMatch(/\[engine\] 无定位信息\n/);
  });
});

describe('双轨：句柄与降级', () => {
  it('disposeTask 释放句柄；再次 task() 重建且可继续写', () => {
    silenceConsole();
    logger.task('task-d5').info('before-dispose');
    logger.disposeTask('task-d5');
    logger.task('task-d5').info('after-dispose');
    const task = fs.readFileSync(path.join(logger.dir, 'backup-task-d5.log'), 'utf8');
    expect(task).toContain('before-dispose');
    expect(task).toContain('after-dispose');
  });

  it('落盘失败：degraded 置位、console.error 只报一次、不抛错、stdout 镜像仍在', () => {
    silenceConsole();
    const appendSpy = vi.spyOn(fs, 'appendFileSync').mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });
    expect(() => logger.info('boom-1')).not.toThrow();
    expect(() => logger.info('boom-2')).not.toThrow();
    // 只报一次（第二次起 append 直接短路，不再触碰 fs）
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error.mock.calls[0][0]).toContain('降级');
    // stdout 镜像不受降级影响
    expect(console.info).toHaveBeenCalledWith('[info] boom-2');
  });

  it('任务文件轮转：注入小阈值触发 .1 移位且不超过 maxArchives', () => {
    silenceConsole();
    const t = logger.task('task-rot', { maxBytes: 200, maxArchives: 2 });
    for (let i = 0; i < 12; i++) t.info(`rot-line-${i}-${'x'.repeat(30)}`);
    const dir = logger.dir;
    expect(fs.existsSync(path.join(dir, 'backup-task-rot.log'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'backup-task-rot.log.1'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'backup-task-rot.log.3'))).toBe(false);
  });
});

describe('会话自检行（§K2 验收探针）', () => {
  it('sessionStart 写入 v/pid/userData/level 且落在当天 main-*.log', () => {
    silenceConsole();
    logger.sessionStart();
    const main = fs.readFileSync(logger.file, 'utf8');
    expect(main).toMatch(
      /\[main\] 会话开始 v9\.9\.9-test pid=\d+ userData=.+ level=info/
    );
  });
});

describe('v5.0 日志分天与清理', () => {
  it('应用日志按天命名 main-YYYY-MM-DD.log', () => {
    expect(path.basename(logger.file)).toMatch(/^main-\d{4}-\d{2}-\d{2}\.log$/);
  });

  it('cleanup 删除超期应用日志与任务日志，任务日志超量删最旧', () => {
    silenceConsole();
    // 独立目录：此前与前面用例共用 tmpGlobal/logs，遗留的 backup-*（d1/rot 等
    // mtime=数秒前）会挤进「保留 20 个」的竞争，使断言依赖执行顺序（v5.3 CI 修复）
    const dir = path.join(tmpGlobal, 'cleanup-' + Date.now());
    fs.mkdirSync(dir, { recursive: true });
    logger._dir = dir;
    const old = Date.now() - 20 * 24 * 60 * 60 * 1000; // 20 天前
    // 超期应用日志（文件名日期在保留期外）
    fs.writeFileSync(path.join(dir, 'main-2020-01-01.log'), 'old');
    // 当天日志（不删）
    fs.writeFileSync(logger.file, 'today');
    // 超期任务日志
    const oldTask = path.join(dir, 'backup-task-old.log');
    fs.writeFileSync(oldTask, 'old-task');
    const utimes = new Date(old);
    fs.utimesSync(oldTask, utimes, utimes);
    // 22 个新鲜任务日志 → 超量 2 个删最旧
    // ⚠️ 每个文件显式设递增 mtime：同毫秒批量写入时 Linux（ext4/CI）mtime 粒度
    // 不足以区分先后，cleanup 的「mtime 降序保留 20 个」会变成字典序不定——
    // Windows NTFS 100ns 精度侥幸通过，CI 稳定失败（v5.3 装机修复）
    const fresh = [];
    const nowMs = Date.now();
    for (let i = 0; i < 22; i++) {
      const f = path.join(dir, `backup-task-keep-${String(i).padStart(2, '0')}.log`);
      fs.writeFileSync(f, 'x');
      fresh.push(f);
      const t = new Date(nowMs - (22 - i) * 60_000); // keep-00 最新，keep-21 最旧
      fs.utimesSync(f, t, t);
    }

    logger.sessionStart();

    expect(fs.existsSync(path.join(dir, 'main-2020-01-01.log'))).toBe(false);
    expect(fs.existsSync(logger.file)).toBe(true);
    expect(fs.existsSync(oldTask)).toBe(false);
    // 保留最近 20 个：最早的 keep-00/keep-01 被删（keep-00 被手动刷新过 mtime，删的是 keep-01、keep-02）
    const kept = fs.readdirSync(dir).filter((n) => n.startsWith('backup-task-keep-'));
    expect(kept.length).toBe(20);
    expect(kept).not.toContain('backup-task-keep-01.log');
  });
});
