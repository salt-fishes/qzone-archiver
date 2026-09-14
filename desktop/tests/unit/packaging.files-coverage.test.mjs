/**
 * 打包完整性守卫（v4.7 P0 回归）
 *
 * 背景：electron-builder.yml 的 files 白名单曾漏掉 src/shared/**，
 * 而 src/shared/ipc-contract.mjs 被 main（11 处）与 preload 直接 import，
 * 导致打包后主进程启动即抛 ERR_MODULE_NOT_FOUND（开发模式源码目录齐全，CI 无法发现）。
 *
 * 本测试不依赖 electron-builder，纯静态校验：
 *   1. main/preload 的所有相对 import 目标都被 files glob 覆盖；
 *   2. files 中出现的字面量目录真实存在（防止写错路径导致同样漏打）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 从 electron-builder.yml 提取顶层 files 列表（形如 "  - src/main/**\/*"） */
function readFilesGlobs() {
  const yml = fs.readFileSync(path.join(ROOT, 'electron-builder.yml'), 'utf8');
  const lines = yml.split(/\r?\n/);
  const start = lines.findIndex((l) => /^files:\s*$/.test(l));
  if (start === -1) throw new Error('electron-builder.yml 未找到顶层 files: 配置');
  const globs = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // 顶格 → 下一个顶层键，结束
    const m = /^\s*-\s*(.+?)\s*$/.exec(line);
    if (m) globs.push(m[1].replace(/^["']|["']$/g, ''));
  }
  return globs;
}

/** 把 electron-builder 风格 glob 转成正则（** 跨目录，* 单段） */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') i++;
        re += '(?:[^/]+/)*';
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + re + '$');
}

/** 递归收集目录下的 .js/.mjs 文件 */
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(mjs|js)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/** 提取文件内的相对 import/require 目标 */
function relativeImports(code) {
  const out = [];
  const patterns = [
    /(?:^|[\s;{(=])from\s*['"](\.[^'"]+)['"]/g, // import ... from './x'
    /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g, // 动态 import()
    /\brequire\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g, // require()
    /(?:^|[\s;])import\s*['"](\.[^'"]+)['"]/g, // 纯副作用 import
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) out.push(m[1]);
  }
  return out;
}

const globs = readFilesGlobs();
const matchers = globs.map((g) => ({ glob: g, re: globToRegExp(g) }));
const covered = (rel) => matchers.some((m) => m.re.test(rel));

describe('打包 files 白名单覆盖性', () => {
  /**
   * 构建产物：仓库不保存（.gitignore 排除），由 CI 的 build 步骤先生成，
   * 纯净 checkout 上不存在属正常，故豁免「目录必须存在」断言。
   */
  const BUILD_OUTPUT_GLOBS = new Set(['src/renderer/dist/**/*']);

  it('files 中的字面量目录真实存在（构建产物除外）', () => {
    const missing = [];
    for (const g of globs) {
      if (BUILD_OUTPUT_GLOBS.has(g)) continue;
      // 取 glob 中最长的非通配前缀作为目录
      const segs = g.split('/');
      const literal = [];
      for (const s of segs) {
        if (/[*?]/.test(s)) break;
        literal.push(s);
      }
      let dir = literal.join('/');
      if (!dir) continue;
      if (!fs.existsSync(path.join(ROOT, dir))) missing.push(`${g} → 目录不存在：${dir}`);
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('构建产物目录已被 .gitignore 排除（豁免前提成立）', () => {
    const ignore = fs.readFileSync(path.join(ROOT, '..', '.gitignore'), 'utf8');
    for (const g of BUILD_OUTPUT_GLOBS) {
      const dir = g.split('/').filter((s) => !/[*?]/.test(s)).join('/');
      expect(ignore, `.gitignore 未排除构建产物目录 ${dir}`).toContain(dir + '/');
    }
  });

  it('main 与 preload 的相对 import 全部被打包', () => {
    const files = [...walk(path.join(ROOT, 'src/main')), ...walk(path.join(ROOT, 'src/preload'))];
    expect(files.length).toBeGreaterThan(0);

    const uncovered = [];
    for (const file of files) {
      const code = fs.readFileSync(file, 'utf8');
      for (const spec of relativeImports(code)) {
        const abs = path.resolve(path.dirname(file), spec);
        const rel = path.relative(ROOT, abs).split(path.sep).join('/');
        if (!covered(rel)) {
          uncovered.push(`${path.relative(ROOT, file).split(path.sep).join('/')} → ${spec}（${rel}）`);
        }
      }
    }
    expect(
      uncovered,
      `以下模块未被打包配置覆盖，打包后将 ERR_MODULE_NOT_FOUND：\n${uncovered.join('\n')}`
    ).toEqual([]);
  });

  it('src/shared（IPC 契约）必须显式包含', () => {
    expect(globs.some((g) => g.startsWith('src/shared/'))).toBe(true);
  });

  /**
   * 打包图标（build/icon.png / icon.ico）是 scripts/gen-app-icon.mjs 的生成物，
   * 仓库不保存（.gitignore 排除），纯净 checkout 上必然不存在。
   * 所以这里分两段守：
   *   1. 配置与生成链路必须在位（icon 配了、生成器在、打包脚本会先跑 gen:icon）；
   *   2. 产物存在时（本地/打包机）再校验尺寸与结构。
   */
  const iconPng = path.join(ROOT, 'build/icon.png');
  const iconIco = path.join(ROOT, 'build/icon.ico');
  const hasGeneratedIcons = fs.existsSync(iconPng) && fs.existsSync(iconIco);

  it('打包图标已配置且由 gen:icon 在打包前自动生成（不依赖入库产物）', () => {
    const yml = fs.readFileSync(path.join(ROOT, 'electron-builder.yml'), 'utf8');
    const m = /^\s*icon:\s*(\S+)\s*$/m.exec(yml);
    expect(m, 'electron-builder.yml 未配置 win.icon（打出来的 exe 会用 Electron 默认图标）').toBeTruthy();
    expect(m[1].startsWith('build/'), `win.icon 应为生成产物：${m[1]}`).toBe(true);

    const refs = [...yml.matchAll(/^\s*(?:installerIcon|uninstallerIcon):\s*(\S+)\s*$/gm)].map((x) => x[1]);
    expect(refs.length, 'installerIcon / uninstallerIcon 未配置').toBeGreaterThan(0);
    for (const rel of refs) {
      expect(rel.startsWith('build/'), `NSIS 图标应为生成产物：${rel}`).toBe(true);
    }

    // 生成器存在，且打包脚本会先跑它（此前只写在注释里"打包前自动重建"，实际没接）
    expect(fs.existsSync(path.join(ROOT, 'scripts/gen-app-icon.mjs')), '缺少图标生成脚本').toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    for (const name of ['dist', 'dist:win']) {
      expect(pkg.scripts[name], `缺少 ${name} 脚本`).toBeTruthy();
      expect(pkg.scripts[name], `${name} 未接入 gen:icon，打包机会拿到不存在的图标`).toContain('gen:icon');
    }

    // 产物目录必须仍被 .gitignore 排除（否则会有人把二进制图标提交进来）
    const ignore = fs.readFileSync(path.join(ROOT, '..', '.gitignore'), 'utf8');
    expect(ignore, '.gitignore 未排除 build/ 生成产物目录').toContain('desktop/build/');
  });

  it.runIf(hasGeneratedIcons)('已生成的图标尺寸/结构满足 electron-builder 与 NSIS 要求', () => {
    const buf = fs.readFileSync(iconPng);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.subarray(0, 8).equals(pngSignature), '图标必须是 PNG').toBe(true);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(
      width >= 256 && height >= 256,
      `图标尺寸 ${width}×${height} 低于 electron-builder 的 256×256 下限`
    ).toBe(true);

    const ico = fs.readFileSync(iconIco);
    expect(ico.readUInt16LE(0), 'ICO reserved 字段必须为 0').toBe(0);
    expect(ico.readUInt16LE(2), 'ICO type 字段必须为 1').toBe(1);
    const count = ico.readUInt16LE(4);
    expect(count, 'ICO 至少应包含 1 张图像').toBeGreaterThan(0);
    // 每张图像的偏移/长度必须落在文件内，且内容为 PNG 或 BMP
    for (let i = 0; i < count; i++) {
      const base = 6 + i * 16;
      const length = ico.readUInt32LE(base + 8);
      const offset = ico.readUInt32LE(base + 12);
      expect(offset + length).toBeLessThanOrEqual(ico.length);
      const isPng = ico[offset] === 0x89 && ico[offset + 1] === 0x50;
      const isBmp = ico.readUInt32LE(offset) === 40;
      expect(isPng || isBmp, `第 ${i} 张图像既不是 PNG 也不是 BMP`).toBe(true);
    }
  });
});
