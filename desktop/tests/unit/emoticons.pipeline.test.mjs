/**
 * 内置表情流水线守卫（v4.7.5 回归）
 *
 * 背景：三个症状同源 —— `src/main/ipc/backup.js` 的 EMOTICONS_DIR 少写了一级 `..`，
 * 解析到并不存在的 `src/assets/emoticons`（真实目录是仓库根的 `assets/emoticons`）：
 *   1. `copyBuiltinEmoticons()` 静默复制 0 个 → 备份产物里内置表情整批缺失
 *      （引擎侧对内置库命中的 id 是跳过下载的，没人补就是彻底没有）
 *   2. `emoticons:get` 永远返回 null → 渲染层表情兜底链第一级直接失效，
 *      只能继续回落被 CSP 拦掉的 CDN，最终显示原始表情代码
 *
 * 这里用真实 assets/emoticons 目录跑真实代码（electron 仅 mock 掉 ipcMain/app），
 * 锁住「路径正确 → 复制到位 → IPC 能取到 data URL」整条链。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zoneexport-emoticons-'));

/** 捕获 ipcMain.handle 注册的处理器，测试可直接调用 */
const handlers = new Map();

vi.mock('electron', () => ({
  app: { getPath: () => tmpRoot },
  net: { fetch: vi.fn() },
  shell: { openExternal: vi.fn() },
  BrowserWindow: class {},
  ipcMain: {
    handle: (channel, fn) => handlers.set(channel, fn),
    on: () => {},
  },
}));

const { copyBuiltinEmoticons, registerBackupIpc } = await import('../../src/main/ipc/backup.js');

const SRC_QQ = path.join(ROOT, 'assets/emoticons/qq');
/** 经典表情（真实文件就是 .gif） */
const CLASSIC_ID = '100';
/** 魔法表情（真实文件是 .png，档案 SPA 却按 .gif 取） */
const MAGIC_ID = '327806';

let outDir;

beforeAll(() => {
  registerBackupIpc();
  outDir = path.join(tmpRoot, 'backup', 'Common', 'images');
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('内置表情目录与复制（EMOTICONS_DIR 路径回归）', () => {
  it('内置表情库真实存在（路径写错时本目录会找不到）', () => {
    expect(fs.existsSync(path.join(SRC_QQ, `e${CLASSIC_ID}.gif`))).toBe(true);
    expect(fs.existsSync(path.join(SRC_QQ, `e${MAGIC_ID}.png`))).toBe(true);
  });

  it('copyBuiltinEmoticons 真的复制了表情（此前恒为 0）', () => {
    const count = copyBuiltinEmoticons(path.join(tmpRoot, 'backup'));
    expect(count, '内置表情一个都没复制 —— 检查 EMOTICONS_DIR 相对层级').toBeGreaterThan(500);

    // 经典表情：真实文件名即 .gif，SPA 与静态模板都能取到
    const classic = path.join(outDir, `e${CLASSIC_ID}.gif`);
    expect(fs.existsSync(classic)).toBe(true);
    expect(fs.readFileSync(classic).equals(fs.readFileSync(path.join(SRC_QQ, `e${CLASSIC_ID}.gif`)))).toBe(true);

    // 魔法表情：真实文件名 .png（静态模板按 roster 引用它）
    const magicPng = path.join(outDir, `e${MAGIC_ID}.png`);
    expect(fs.existsSync(magicPng)).toBe(true);

    // 魔法表情还要有 .gif 别名（档案 SPA 写死按 .gif 取图）
    const magicGif = path.join(outDir, `e${MAGIC_ID}.gif`);
    expect(fs.existsSync(magicGif), '档案 SPA 按 .gif 取图，缺别名会导致魔法表情显示不出来').toBe(true);
    expect(fs.readFileSync(magicGif).equals(fs.readFileSync(magicPng))).toBe(true);
  });

  it('复制是幂等的（重复备份不重复计数/覆盖）', () => {
    expect(copyBuiltinEmoticons(path.join(tmpRoot, 'backup'))).toBe(0);
  });
});

describe('emoticons:get IPC（表情兜底第一级）', () => {
  it('内置库命中的 id 返回 data URL（此前恒为 null）', () => {
    const handler = handlers.get('emoticons:get');
    expect(handler, 'emoticons:get 未注册').toBeTypeOf('function');

    const classic = handler({}, { id: Number(CLASSIC_ID) });
    expect(classic.ok).toBe(true);
    expect(classic.dataUrl.startsWith('data:image/gif;base64,')).toBe(true);

    const magic = handler({}, { id: Number(MAGIC_ID) });
    expect(magic.ok).toBe(true);
    expect(magic.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('非法/空 id 不炸（返回 ok:false）', () => {
    const handler = handlers.get('emoticons:get');
    expect(handler({}, {}).ok).toBe(false);
    expect(handler({}, { id: 'abc' }).ok).toBe(false);
  });
});
