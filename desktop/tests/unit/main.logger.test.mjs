/**
 * P6.1（§8.1）：结构化日志单测——分级过滤 / 文件落盘 / 10MB×3 轮转（注入小阈值验证）。
 * electron 仅用到 app.getPath('userData')，mock 到临时目录。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => tmpGlobal) },
}));

let tmpGlobal;
const { logger } = await import('../../src/main/services/logger.js');

let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
  tmpGlobal = tmpDir;
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  logger.minLevel = 1; // info
  logger.maxBytes = 10 * 1024 * 1024;
  logger.maxArchives = 3;
  logger._dir = null;
  vi.restoreAllMocks();
});

describe('logger 分级过滤', () => {
  it('默认 info：debug 不输出，info/warn/error 输出', () => {
    const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const spyInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.debug('dbg');
    logger.info('inf');
    logger.warn('wrn');
    logger.error('err');
    expect(spyLog).not.toHaveBeenCalledWith('[debug] dbg');
    expect(spyInfo).toHaveBeenCalledWith('[info] inf');
    expect(spyWarn).toHaveBeenCalledWith('[warn] wrn');
    expect(spyErr).toHaveBeenCalledWith('[error] err');
  });

  it('setLevel(debug) 后 debug 放行', () => {
    logger.setLevel('debug');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('dbg');
    expect(spy).toHaveBeenCalledWith('[debug] dbg');
  });

  it('未知级别忽略且不抛错', () => {
    expect(() => logger.log('verbose', 'x')).not.toThrow();
  });
});

describe('logger 文件落盘与轮转', () => {
  it('写入 userData/logs/ 当天的 main-YYYY-MM-DD.log，含 ISO 时间与级别', () => {
    logger.info('hello-file');
    const content = fs.readFileSync(logger.file, 'utf8');
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T.+Z\] \[info\] hello-file\n/);
  });

  it('超过 maxBytes 触发轮转：当天文件→.1→.2，最旧删除（v5.0 起按天分文件）', () => {
    logger.maxBytes = 200;
    logger.maxArchives = 2;
    for (let i = 0; i < 12; i++) logger.info(`line-${i}-${'x'.repeat(30)}`);
    expect(fs.existsSync(logger.file)).toBe(true);
    // 12 行 × ~55B ≈ 660B → 至少完成一次移位（.1 存在）
    expect(fs.existsSync(logger.file + '.1')).toBe(true);
    // 最旧档案不超过 maxArchives
    expect(fs.existsSync(`${logger.file}.${logger.maxArchives + 1}`)).toBe(false);
  });

  it('轮转后当天文件从空开始继续追加', () => {
    logger.maxBytes = 200;
    logger.info('before-rotate');
    const size = fs.statSync(logger.file).size;
    expect(size).toBeLessThan(200);
    expect(fs.readFileSync(logger.file, 'utf8')).toContain('before-rotate');
  });
});

describe('stdout 断管保护（§K：镜像失败不得打断主流程）', () => {
  it('console 写入抛 EPIPE 时应用日志不抛错，文件轨道仍写入', () => {
    const before = fs.existsSync(logger.file) ? fs.readFileSync(logger.file, 'utf8') : '';
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('EPIPE: broken pipe, write');
    });
    expect(() => logger.error('[main] 断管演练')).not.toThrow();
    const after = fs.readFileSync(logger.file, 'utf8');
    expect(after.length).toBeGreaterThan(before.length);
    expect(after).toContain('断管演练');
  });

  it('任务日志/引擎透传同样受保护（2026-09-22 实机 EPIPE 崩溃回归）', () => {
    const t = logger.task('epipe-test');
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('EPIPE: broken pipe, write');
    });
    expect(() => t.error('任务断管演练')).not.toThrow();
    expect(() => t.engine('error', '引擎断管演练', 'x.js:1')).not.toThrow();
    const f = path.join(logger.dir, 'backup-epipe-test.log');
    const content = fs.readFileSync(f, 'utf8');
    expect(content).toContain('任务断管演练');
    expect(content).toContain('引擎断管演练');
    logger.disposeTask('epipe-test');
  });
});
