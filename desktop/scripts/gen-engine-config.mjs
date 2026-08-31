/**
 * P4.2 配置单一来源：spec → 引擎 config.js（Default_Config 被覆盖字段的默认值）
 *
 * 读取 src/engine/config-spec.json，在沙箱中执行 config.js 取得运行时 Default_Config，
 * 对 spec 覆盖的字段逐叶比对：不一致则原位修补 config.js 中对应赋值行（保留行尾注释）。
 *
 * 用法：
 *   node scripts/gen-engine-config.mjs          # 修补模式：写入不一致项
 *   node scripts/gen-engine-config.mjs --check  # 校验模式：有不一致即退出码 1（CI/测试用）
 *
 * spec 未覆盖的字段（pageSize/randomSeconds/FilterKeyWords 等）保持手写，不参与比对。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const CHECK = process.argv.includes('--check');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = join(ROOT, 'src/engine/config-spec.json');
const CONFIG_PATH = join(ROOT, 'src/engine/config.js');

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
let src = readFileSync(CONFIG_PATH, 'utf8');

/** 沙箱执行 config.js，取运行时 Default_Config */
function evalDefaultConfig(code) {
  const sb = { console };
  sb.window = sb;
  sb.QZONE_MODULES = [{ key: 'Messages', zh: '说说', exportable: true }];
  vm.runInContext(code, vm.createContext(sb), { filename: 'config.js' });
  return vm.runInContext('Default_Config', sb);
}

/** dot 路径取值 */
function getPath(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** 引擎值与 spec 默认值是否等价（undefined 与 '' 视为不一致——统一收敛到 spec 值） */
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 定位 Default_Config 下模块块的 [start, end)（含花括号，brace 计数） */
function locateBlock(code, name, from = 0) {
  const re = new RegExp(`(^|\\n)(\\s*)${name}\\s*:\\s*\\{`);
  re.lastIndex = from;
  const m = re.exec(code);
  if (!m) return null;
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < code.length && depth > 0) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') depth--;
    i++;
  }
  return [m.index + m[0].length - 1, i];
}

/** 在 [start,end) 块内定位 leaf key 的赋值行（返回可替换的值区间） */
function locateLeaf(code, block, leaf) {
  const [start, end] = block;
  const re = new RegExp(`\\b${leaf}\\s*:\\s*([^,\\n}]+)`);
  const seg = code.slice(start, end);
  const m = re.exec(seg);
  if (!m) return null;
  const vStart = start + m.index + m[0].indexOf(m[1]);
  return [vStart, vStart + m[1].length];
}

/** 逐级定位 dotted 路径（除最后一段外逐层进子块），返回叶子值区间 */
function locatePath(code, module, dotted) {
  let block = locateBlock(code, module);
  if (!block) return null;
  const parts = dotted.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const sub = locateBlock(code, parts[i], block[0]);
    if (!sub || sub[0] >= block[1]) return null;
    block = [sub[0], Math.min(sub[1], block[1])];
  }
  return locateLeaf(code, block, parts[parts.length - 1]);
}

const formatValue = (v) => (typeof v === 'string' ? `'${v}'` : JSON.stringify(v));

/* ---- 比对 ---- */
const runtime = evalDefaultConfig(src);
const mismatches = [];
for (const [mod, group] of Object.entries(spec.groups)) {
  for (const item of group.items) {
    const path = `${mod}.${item.key}`;
    if (!same(getPath(runtime[mod], item.key), item.default)) {
      mismatches.push({ path, expected: item.default });
    }
  }
}

if (mismatches.length === 0) {
  console.log('[gen-engine-config] 引擎 Default_Config 与 spec 全量一致，无需修补');
  process.exit(0);
}

for (const { path, expected } of mismatches) {
  const [mod, ...rest] = path.split('.');
  const dotted = rest.join('.');
  if (CHECK) {
    console.error(`  ✗ ${path}：引擎=${JSON.stringify(getPath(runtime[mod], dotted))} spec=${JSON.stringify(expected)}`);
    continue;
  }
  const range = locatePath(src, mod, dotted);
  if (!range) {
    console.error(`  ✗ ${path}：config.js 中未定位到赋值行，请手工核对`);
    process.exitCode = 1;
    continue;
  }
  src = src.slice(0, range[0]) + formatValue(expected) + src.slice(range[1]);
  console.log(`  ~ ${path} → ${formatValue(expected)}`);
}

if (CHECK) {
  console.error(`[gen-engine-config] 引擎 Default_Config 与 spec 存在 ${mismatches.length} 处不一致`);
  process.exit(1);
}

/* 修补后复验 */
const after = evalDefaultConfig(src);
const remaining = [];
for (const [mod, group] of Object.entries(spec.groups)) {
  for (const item of group.items) {
    if (!same(getPath(after[mod], item.key), item.default)) remaining.push(`${mod}.${item.key}`);
  }
}
if (remaining.length) {
  console.error(`[gen-engine-config] 修补后仍不一致：${remaining.join(', ')}`);
  process.exit(1);
}
writeFileSync(CONFIG_PATH, src, 'utf8');
console.log(`[gen-engine-config] 已修补 ${mismatches.length} 处默认值 → ${CONFIG_PATH}`);
