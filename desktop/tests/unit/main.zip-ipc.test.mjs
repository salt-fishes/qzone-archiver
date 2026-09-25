/**
 * v5.0 Z 压缩"报成功却没有文件"单测
 *
 * 根因回顾：IPC 把失败编码进 {ok:false} 而不 throw（ipc/zip.js），渲染层
 * 却丢弃返回值无条件报"已压缩"（ArchivesView.vue）→ 压缩失败 100% 假成功，
 * 且 zip 路径零日志、失败无痕迹。本文件锁定修复后的行为：
 *  ① handler 成功 → {ok:true, path, bytes>0, files>0} 且 logger.info 留痕
 *  ② 目标已存在 → 拒绝覆盖（拍板：报错让用户处理）→ {ok:false} + 日志
 *  ③ 源目录不存在 → {ok:false} + 失败必写 logger.error
 *  ④ 渲染层守卫：zip() 必须校验 ok，禁止无条件报成功
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const { handlers, loggerMock } = vi.hoisted(() => ({
  handlers: new Map(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel, fn) => handlers.set(channel, fn),
  },
}));

vi.mock('../../src/main/services/logger.js', () => ({ logger: loggerMock }));
vi.mock('../../src/main/services/engine-bridge.js', () => ({
  engineBridge: {},
  sendToUi: vi.fn(),
  getActiveTaskContext: () => null,
}));

const { registerZipIpc } = await import('../../src/main/ipc/zip.js');
const { Channels } = await import('../../src/shared/ipc-contract.mjs');

registerZipIpc();
const zipCreate = handlers.get(Channels.zip.create);

let tmpDir;
let srcDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-ipc-'));
  srcDir = path.join(tmpDir, 'QQ空间备份_测试');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, '中文文件.txt'), '内容');
  fs.mkdirSync(path.join(srcDir, '子目录'), { recursive: true });
  fs.writeFileSync(path.join(srcDir, '子目录', 'a.bin'), Buffer.alloc(1024, 7));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Z① handler 成功路径', () => {
  it('正常压缩 → {ok:true} 且产物真实落地非空，logger.info 留痕', async () => {
    const dest = path.join(tmpDir, 'ok', 'out.zip');
    const r = await zipCreate({}, { srcDir, destPath: dest });
    expect(r.ok).toBe(true);
    expect(r.path).toBe(dest);
    expect(r.bytes).toBeGreaterThan(0);
    expect(r.files).toBeGreaterThanOrEqual(2);
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.statSync(dest).size).toBeGreaterThan(0);
    const infoMsg = loggerMock.info.mock.calls.map((c) => c[0]).join('\n');
    expect(infoMsg).toContain('[zip]');
    expect(infoMsg).toContain(dest);
  });
});

describe('Z② 目标已存在 → 拒绝覆盖（2026-09-19 拍板）', () => {
  it('destPath 已存在 → {ok:false} 报"目标已存在"，原文件不被改动', async () => {
    const dest = path.join(tmpDir, 'exists.zip');
    fs.writeFileSync(dest, '手工产物，不可覆盖');
    const r = await zipCreate({}, { srcDir, destPath: dest });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('目标已存在');
    expect(fs.readFileSync(dest, 'utf8')).toBe('手工产物，不可覆盖');
    // 拒绝时必须留痕（warn + error 各一条）
    const warnMsg = loggerMock.warn.mock.calls.map((c) => c[0]).join('\n');
    expect(warnMsg).toContain('目标已存在');
    const errMsg = loggerMock.error.mock.calls.map((c) => c[0]).join('\n');
    expect(errMsg).toContain('[zip] 失败');
  });
});

describe('Z③ 失败必写日志（§K：关键用户操作不得零日志）', () => {
  it('源目录不存在 → {ok:false} + logger.error 带 src/dest', async () => {
    const dest = path.join(tmpDir, 'no-src.zip');
    const r = await zipCreate(
      {},
      { srcDir: path.join(tmpDir, '不存在的目录'), destPath: dest },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain('源目录不存在');
    const errMsg = loggerMock.error.mock.calls.map((c) => c[0]).join('\n');
    expect(errMsg).toContain('[zip] 失败');
    expect(errMsg).toContain('src=');
    expect(errMsg).toContain('dest=');
    expect(fs.existsSync(dest)).toBe(false);
  });
});

describe('Z④ 渲染层守卫（zip() 必须校验 ok）', () => {
  const view = fs.readFileSync(join(ROOT, 'src/renderer/src/views/ArchivesView.vue'), 'utf8');

  it('ArchivesView 必须校验返回值 ok，失败 throw 而非无条件报成功', () => {
    expect(view).toContain('!r?.ok');
    expect(view).toMatch(/throw new Error\(r\?\.error/);
  });

  it('成功提示须附「打开所在文件夹」定位动作', () => {
    expect(view).toContain('打开所在文件夹');
    expect(view).toContain('showInFolder(dest)');
  });

  it('失败提示展示具体原因并延长可见时间', () => {
    expect(view).toMatch(/压缩失败：\$\{e\?\.message \|\| e\}/);
  });
});
