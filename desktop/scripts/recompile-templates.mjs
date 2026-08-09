/**
 * 一次性脚本：重新预编译 templates/*.html → templates-compiled.js
 * 模板修改后需重跑（等价扩展端构建期的 precompile）
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ENGINE = path.resolve(import.meta.dirname, '../src/engine');
const TPL_DIR = path.join(ENGINE, 'templates');
const OUT_FILE = path.join(ENGINE, 'templates-compiled.js');

// UMD 加载 template.js（ESM 严格模式下 this 为 undefined，需 vm 沙箱提供全局）
const tplSrc = await fs.readFile(path.join(ENGINE, 'vendor/template/template.js'), 'utf8');
const sandbox = { module: { exports: {} }, exports: {} };
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(tplSrc, sandbox);
const template = sandbox.module.exports;

const NAMES = [
  'albums', 'bloginfo', 'bloginfo_static', 'blogs', 'boards', 'diaries',
  'diaryinfo', 'diaryinfo_static', 'favorites', 'friends', 'index',
  'messages', 'photos', 'shares', 'statistics', 'videos', 'visitors',
];

// 保留现有文件头部（注释 + __modifierMap__），只替换模板函数集合
const existing = await fs.readFile(OUT_FILE, 'utf8');
const headerEnd = existing.indexOf("window.__templates__ = window.__templates__ || {};");
if (headerEnd < 0) {
  console.error('未找到现有头部边界');
  process.exit(1);
}
const header = existing.slice(0, headerEnd + 'window.__templates__ = window.__templates__ || {};\n'.length);

let body = '';
for (const name of NAMES) {
  const html = await fs.readFile(path.join(TPL_DIR, name + '.html'), 'utf8');
  const fn = template.__compile(html);
  const code = fn.toString();
  body += `window.__templates__['${name}'] = function(__data__, __modifierMap__) {\n` +
    `    __modifierMap__ = __modifierMap__ || window.__modifierMap__ || {};\n` +
    `    var __code__ = "";\n` +
    `    with (__data__ || {}) {\n${code}\n    }\n` +
    `    return __code__;\n};\n\n`;
}

await fs.writeFile(OUT_FILE, header + body, 'utf8');
console.log(`templates-compiled.js 已重新生成（${NAMES.length} 个模板）`);
