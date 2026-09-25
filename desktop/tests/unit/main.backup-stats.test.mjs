/**
 * P3-4 单测（§5.4）：主进程统计异步化
 * - dirBytes / countFiles：fs.promises 异步遍历，语义（求和/计数/截断）不变
 * - recordBackup：async 化后历史落盘 / manifest 计数 / 同 taskId 幂等 / 失败明细
 * electron 仅用到 app.getPath，mock 后真实 fs 操作临时目录。
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zoneexport-stats-'));

vi.mock('electron', () => ({
  app: { getPath: () => tmpRoot },
}));

const { backupStats, dirBytes, countFiles } = await import('../../src/main/services/backup-stats.js');

/** 构造目录树：a.txt(3B) + sub/b.txt(5B) + sub/c.log(7B)，返回根 */
function makeTree(root) {
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(root, 'a.txt'), 'abc');
  fs.writeFileSync(path.join(root, 'sub', 'b.txt'), '12345');
  fs.writeFileSync(path.join(root, 'sub', 'c.log'), '1234567');
  return root;
}

let historyFileBefore;

beforeAll(() => {
  historyFileBefore = path.join(tmpRoot, 'state', 'backup-history.json');
});

beforeEach(() => {
  fs.rmSync(path.join(tmpRoot, 'state'), { recursive: true, force: true });
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('dirBytes / countFiles 异步语义（P3-4 §5.4）', () => {
  it('dirBytes 求和所有文件字节数（含子目录）', async () => {
    const root = makeTree(path.join(tmpRoot, 'tree-bytes'));
    expect(await dirBytes(root)).toBe(3 + 5 + 7);
  });

  it('countFiles 计数所有文件（含子目录）', async () => {
    const root = makeTree(path.join(tmpRoot, 'tree-count'));
    expect(await countFiles(root, 0, 20000)).toBe(3);
  });

  it('countFiles limit 截断生效', async () => {
    const root = makeTree(path.join(tmpRoot, 'tree-limit'));
    expect(await countFiles(root, 0, 2)).toBe(2);
  });

  it('目录不可读时返回 0 / 既有计数（不抛错）', async () => {
    expect(await dirBytes(path.join(tmpRoot, 'no-such-dir'))).toBe(0);
    expect(await countFiles(path.join(tmpRoot, 'no-such-dir'))).toBe(0);
    expect(await countFiles(path.join(tmpRoot, 'no-such-dir'), 5)).toBe(5);
  });
});

describe('v5.0 sinceMs 只统计本次任务写入的文件', () => {
  it('dirBytes/countFiles 传入 sinceMs 时跳过旧文件', async () => {
    const root = makeTree(path.join(tmpRoot, 'since-root'));
    const old = path.join(root, 'old.txt');
    fs.writeFileSync(old, 'old-data');
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(old, past, past); // 旧文件：1 分钟前

    const allBytes = await dirBytes(root);
    const newOnlyBytes = await dirBytes(root, 5000, Date.now() - 30_000);
    expect(newOnlyBytes).toBeLessThan(allBytes);
    expect(newOnlyBytes).toBe(3 + 5 + 7); // a/b/c 三个新文件，old.txt 不计

    const allCount = await countFiles(root);
    const newOnlyCount = await countFiles(root, 0, 20000, Date.now() - 30_000);
    expect(newOnlyCount).toBe(allCount - 1);
  });

  it('recordBackup 带 startedAt：文件数/体积只含本次写入', async () => {
    const dir = makeTree(path.join(tmpRoot, 'reuse-root'));
    const old = path.join(dir, 'leftover.bin');
    fs.writeFileSync(old, 'x'.repeat(1000));
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(old, past, past);
    const manifest = JSON.stringify({ modules: { Messages: { count: 3 } }, createdAt: 1 });
    fs.writeFileSync(path.join(dir, 'manifest.json'), manifest);

    const entry = await backupStats.recordBackup({
      taskId: 'task-since-1',
      targetDir: dir,
      modules: ['Messages'],
      results: {},
      startedAt: Date.now() - 30_000,
    });
    expect(entry.total).toBe(3); // manifest 口径不变
    expect(entry.files).toBe(4); // a/b/c + manifest（leftover 不计）
    expect(entry.size).toBe(3 + 5 + 7 + manifest.length);
  });
});

describe('recordBackup 异步落盘（P3-4 §5.4）', () => {
  it('记录历史：manifest 计数 + 目录统计 + 落盘，返回 entry', async () => {
    const dir = makeTree(path.join(tmpRoot, 'backup-1'));
    fs.writeFileSync(
      path.join(dir, 'manifest.json'),
      JSON.stringify({ createdAt: '2026-08-28T00:00:00.000Z', modules: { Messages: { count: 12 }, Photos: { count: 3 } } }),
    );

    const entry = await backupStats.recordBackup({ taskId: 't1', targetDir: dir, modules: ['Messages'] });

    expect(entry.total).toBe(15);
    expect(entry.moduleCounts).toEqual({ Messages: 12, Photos: 3 });
    // 目录统计含 manifest.json 本身（统计口径：目录内全部文件）
    const manifestSize = fs.statSync(path.join(dir, 'manifest.json')).size;
    expect(entry.size).toBe(15 + manifestSize);
    expect(entry.files).toBe(4);
    // 落盘（最新在前）
    const history = JSON.parse(fs.readFileSync(historyFileBefore, 'utf8'));
    expect(history).toHaveLength(1);
    expect(history[0].taskId).toBe('t1');
  });

  it('同 taskId 幂等去重，最新记录置顶', async () => {
    const dir = makeTree(path.join(tmpRoot, 'backup-2'));
    await backupStats.recordBackup({ taskId: 't2', targetDir: dir });
    await backupStats.recordBackup({ taskId: 't2', targetDir: dir });
    const history = JSON.parse(fs.readFileSync(historyFileBefore, 'utf8'));
    expect(history).toHaveLength(1);
  });

  it('模块级失败明细落库（P0-3），全成功不落字段', async () => {
    const dir = makeTree(path.join(tmpRoot, 'backup-3'));
    const withErrors = await backupStats.recordBackup({
      taskId: 't3',
      targetDir: dir,
      errors: [{ module: 'Videos', phase: 'export', code: 'NET', message: '超时' }],
    });
    expect(withErrors.errors).toEqual([{ module: 'Videos', phase: 'export', code: 'NET', message: '超时' }]);

    const ok = await backupStats.recordBackup({ taskId: 't4', targetDir: dir });
    expect(ok.errors).toBeUndefined();
  });

  it('targetDir 缺失时返回 null 不落盘', async () => {
    expect(await backupStats.recordBackup({ taskId: 't5', targetDir: '' })).toBeNull();
    expect(fs.existsSync(historyFileBefore)).toBe(false);
  });
});
