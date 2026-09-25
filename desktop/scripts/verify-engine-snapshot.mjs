// ENGINE_SCRIPTS 注入脚本集合 sha256 快照对比（架构改造计划 §4 P2 铁律）
// 用法：node scripts/verify-engine-snapshot.mjs [--baseline <commit>] [--strict]
//   基线默认 63967a1（P2 开始前最后一个 commit，v4.0.0 发布）。
//   --strict：所有变化必须落在下方 EXPECTED_* 清单内，否则退出码 1。
// 换行符归一化（CRLF→LF）后按内容计算 sha256，避免 autocrlf 干扰。
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const baseIdx = args.indexOf('--baseline');
const BASE = baseIdx > -1 ? args[baseIdx + 1] : '63967a1';

// 1. 从 engine-bridge.js 解析当前注入脚本集合
const bridge = readFileSync(join(root, 'src/main/services/engine-bridge.js'), 'utf8');
const m = bridge.match(/const ENGINE_SCRIPTS = \[([\s\S]*?)\];/);
if (!m) {
  console.error('错误：engine-bridge.js 中未找到 ENGINE_SCRIPTS 数组');
  process.exit(2);
}
const scripts = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);

// 2. sha256（内容归一化 CRLF→LF）
const sha = (s) => createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
const currentOf = (rel) => {
  try {
    return sha(readFileSync(join(root, 'src/engine', rel), 'utf8'));
  } catch {
    return null;
  }
};
const baselineOf = (rel) => {
  try {
    return sha(execSync(`git show ${BASE}:desktop/src/engine/${rel}`, { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));
  } catch {
    return null;
  }
};

// 3. 预期变化清单（P2-1 拆分 + P2-2~P2-4 逐字搬迁挂接产物）
const MODS11 = ['blogs', 'boards', 'common', 'diaries', 'favorites', 'friends', 'messages', 'photos', 'shares', 'videos', 'visitors'];
const EXPECTED_ADDED = new Set([
  // P2-1：api.js 单体拆分 → api/ 命名空间层
  ...['rest-urls', 'network', 'fs-utils', 'utils', 'common'].map((x) => `api/${x}.js`),
  ...MODS11.map((x) => `api/modules/${x}.js`),
  'api/modules/statistics.js',
  // P2-4：collectors/Common 新建（下载执行/翻页驱动/头像采集等 16 方法）
  'collectors/common.js',
  // P2-5：模块级错误协议
  'module-error.js',
  // P2-3/P2-4：repos 增量层补齐
  'repos/modules/friends.js',
  'repos/modules/photos.js',
]);
const EXPECTED_MODIFIED = new Set([
  'api.js', // P2-1：顶部注入五层注册表 require
  'config.js',
  ...MODS11.map((x) => `modules/${x}.js`), // P2-4：瘦身为纯编排
  ...['blogs', 'boards', 'diaries', 'favorites', 'messages', 'photos', 'shares', 'videos', 'visitors'].map((x) => `collectors/${x}.js`),
  'collectors/friends.js', // v5.0 F4：特别关心循环 undefined.care 崩溃修复
  ...MODS11.map((x) => `exporters/${x}.js`),
  'repos/incremental.js', // P2-3/P2-4：增量判定方法补齐
  'tasks/orchestrator.js',
]);
const EXPECTED_DELETED = new Set([]);

// 4. 逐文件对比
const added = [];
const deleted = [];
const modified = [];
const unchanged = [];
for (const s of scripts) {
  const b = baselineOf(s);
  const c = currentOf(s);
  if (b === null && c !== null) added.push(s);
  else if (b !== null && c === null) deleted.push(s);
  else if (b !== c) modified.push(s);
  else unchanged.push(s);
}

// 5. 报告
console.log(`基线 ${BASE} → 工作区，注入脚本集合共 ${scripts.length} 个：`);
console.log(`  unchanged: ${unchanged.length}`);
console.log(`  added:     ${added.length}   ${added.join(', ')}`);
console.log(`  modified:  ${modified.length} ${modified.join(', ')}`);
console.log(`  deleted:   ${deleted.length} ${deleted.join(', ')}`);

if (!strict) process.exit(0);

const bad = [
  ...added.filter((x) => !EXPECTED_ADDED.has(x)).map((x) => `added 未预期: ${x}`),
  ...modified.filter((x) => !EXPECTED_MODIFIED.has(x)).map((x) => `modified 未预期: ${x}`),
  ...deleted.filter((x) => !EXPECTED_DELETED.has(x)).map((x) => `deleted 未预期: ${x}`),
];
if (bad.length) {
  console.error('\n[strict] 存在预期外变化：');
  bad.forEach((x) => console.error('  ' + x));
  process.exit(1);
}
console.log('\n[strict] 全部变化均在预期清单内（仅文件拆分/移动/挂接）');
