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
  it('files 中的字面量目录真实存在', () => {
    const missing = [];
    for (const g of globs) {
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
});
