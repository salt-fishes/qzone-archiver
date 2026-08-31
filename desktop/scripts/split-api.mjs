/**
 * P2-1 一次性机械切分：api.js → api/ 五类文件 + api.js 装配器
 *
 * 铁律：逐字搬迁。脚本仅做"文件拆分/移动"，方法体文本零修改；
 * 内置重组校验：原文件每个非空行恰好被一个产物项覆盖且顺序保持，否则中止。
 *
 * 产物：
 *   api/rest-urls.js  REST_URLS + 表情表 + parseEmoji
 *   api/network.js    get/post/send/toJson、WAF 检测、鉴权、sleep/randomSeconds
 *   api/fs-utils.js   createFolder/writeText/writeFile/fileExists、hashUrl/autoFileSuffix
 *   api/utils.js      Utils 其余方法
 *   api/common.js     API.Common 公共逻辑
 *   api/modules/*.js  11 个模块分组（shares.js 额外含 ShareSource/ShareInfo/ShareData）
 *   api.js            骨架 + 装配器
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(__dirname, '../src/engine');

const src = readFileSync(path.join(ENGINE, 'api.js'), 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';
const lines = src.split(/\r?\n/);
if (lines[lines.length - 1] === '') lines.pop(); // 去掉结尾空串

const N = lines.length;

// ---------- 锚定正则 ----------
const RE_GROUP_START = /^API\.([A-Za-z_$][\w$]*)\s*=\s*\{\s*$/;
const RE_GROUP_END = /^\};?\s*$/;
const RE_SKELETON_START = /^const API\s*=\s*\{\s*$/;
const RE_METHOD = /^    (?:async )?([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{\s*$/;
const RE_METHOD_ARROW = /^    ([A-Za-z_$][\w$]*)\s*:\s*\(([^()]*)\)\s*=>\s*\{\s*$/;
const RE_METHOD_END = /^    \},?\s*$/;
const RE_CLASS = /^class\s+([A-Za-z_$][\w$]*)\s*\{\s*$/;
const RE_BLOCK_COMMENT_OPEN = /^(\s*)\/\*\*.*$/;
const RE_BLOCK_COMMENT_CLOSE = /^\s*\*\/\s*$/;
const RE_LINE_COMMENT = /^\s*\/\//;

const isBlank = (s) => s.trim() === '';

/**
 * 从行 idx（项首行）向上收集紧邻的头注释块（JSDoc 或 // 行），返回注释起始行。
 * 规则：向上逐行，遇到块注释结束行则继续向上找注释起点；遇到 // 行继续向上；
 * 空行或其它代码行即停止。
 */
function withLeadingComment(start) {
  let i = start - 1;
  if (i < 0) return start;
  if (RE_BLOCK_COMMENT_CLOSE.test(lines[i])) {
    let j = i;
    while (j >= 0 && !RE_BLOCK_COMMENT_OPEN.test(lines[j])) j--;
    // 确认注释块向上连续（中间无空行/代码）
    let ok = true;
    for (let k = j; k <= i; k++) {
      if (isBlank(lines[k])) { ok = false; break; }
    }
    return ok ? j : start;
  }
  if (RE_LINE_COMMENT.test(lines[i])) {
    let j = i;
    while (j >= 0 && RE_LINE_COMMENT.test(lines[j])) j--;
    return j + 1;
  }
  return start;
}

// ---------- 项收集 ----------
/** item: { kind:'range', from, to, text, label } 文本 = lines[from..to] */
const items = [];
const covered = new Set(); // 已覆盖行索引
function take(from, to, label) {
  for (let k = from; k <= to; k++) {
    if (covered.has(k)) throw new Error(`行 ${k + 1} 重复覆盖（${label}）`);
    covered.add(k);
  }
  items.push({ from, to, label, text: lines.slice(from, to + 1) });
}
function skipBlank(idx) {
  covered.add(idx);
}

// ---------- 1) 头部区（REST_URLS/表情/parseEmoji）直到骨架声明前 ----------
let i = 0;
{
  let skeletonAt = -1;
  for (let k = 0; k < N; k++) {
    if (RE_SKELETON_START.test(lines[k])) { skeletonAt = k; break; }
  }
  if (skeletonAt < 0) throw new Error('未找到 const API 骨架声明');
  // 头注释（L0）+ REST_URLS…parseEmoji 全部归 rest-urls
  take(0, skeletonAt - 1, 'rest-urls');
  // 骨架块（const API = { … };）
  let end = skeletonAt;
  while (end < N && !RE_GROUP_END.test(lines[end])) end++;
  take(skeletonAt, end, 'skeleton');
  i = end + 1;
}

// ---------- 2) 顶层项循环 ----------
const groupMethods = new Map(); // name → { kind:'methods'|'block', items:[...] }
const RE_COMMENTISH = /^\s*(\/\/|\/\*|\*)/; // 顶层注释行（JSDoc 首/中/尾、// 行）
while (i < N) {
  if (isBlank(lines[i])) { skipBlank(i); i++; continue; }

  if (RE_COMMENTISH.test(lines[i])) {
    // 顶层注释：向后看第一个有效行，若是分组/class 声明则跳到该行（注释由 withLeadingComment 收编）
    let k = i + 1;
    while (k < N && (isBlank(lines[k]) || RE_COMMENTISH.test(lines[k]))) k++;
    if (k < N && (RE_GROUP_START.test(lines[k]) || RE_CLASS.test(lines[k]))) { i = k; continue; }
    throw new Error(`未识别的顶层注释 L${i + 1}: ${lines[i]}`);
  }

  if (RE_CLASS.test(lines[i])) {
    const start = withLeadingComment(i);
    let end = i;
    while (end < N && !RE_GROUP_END.test(lines[end])) end++;
    take(start, end, `class:${lines[i].match(RE_CLASS)[1]}`);
    (groupMethods.get('__classes__') ?? groupMethods.set('__classes__', { kind: 'block', items: [] }).get('__classes__')).items.push(`class:${start}-${end}`);
    i = end + 1;
    continue;
  }

  const gm = lines[i].match(RE_GROUP_START);
  if (gm) {
    const name = gm[1];
    const start = withLeadingComment(i);
    if (name === 'Utils' || name === 'Common') {
      // 组头注释与 API.X = { 开行：结构性内容，重组时由生成头替代，仅标记覆盖
      for (let k = start; k <= i; k++) {
        if (covered.has(k)) throw new Error(`行 ${k + 1} 重复覆盖（${name} 组头）`);
        covered.add(k);
      }
      // 组内方法切分
      const methods = [];
      let j = i + 1;
      while (j < N) {
        if (isBlank(lines[j])) { skipBlank(j); j++; continue; }
        if (RE_GROUP_END.test(lines[j])) break;
        // j 为方法首行或其紧邻头注释块首行；统一推进到方法首行，mStart 记录注释起点
        let mStart;
        if (RE_COMMENTISH.test(lines[j])) {
          mStart = j;
          let k = j + 1;
          while (k < N && (RE_COMMENTISH.test(lines[k]) || isBlank(lines[k]))) k++;
          j = k;
        } else {
          mStart = withLeadingComment(j);
        }
        const mm = lines[j].match(RE_METHOD) || lines[j].match(RE_METHOD_ARROW);
        if (!mm) throw new Error(`${name} 内未识别的方法首行 L${j + 1}: ${lines[j]}`);
        let mEnd = j;
        while (mEnd < N && !RE_METHOD_END.test(lines[mEnd])) mEnd++;
        if (mEnd >= N) throw new Error(`${name}.${mm[1]} 未找到方法结束锚`);
        take(mStart, mEnd, `${name}.${mm[1]}`);
        methods.push({ name: mm[1], from: mStart, to: mEnd });
        j = mEnd + 1;
      }
      // 分组结束行本身跳过（重组中它由装配器重新生成）
      covered.add(j);
      groupMethods.set(name, { kind: 'methods', items: methods });
      i = j + 1;
      continue;
    }
    // 其它分组：整块（首行 API.X = { 替换为 const 声明）
    let end = i;
    while (end < N && !RE_GROUP_END.test(lines[end])) end++;
    take(start, end, `group:${name}`);
    groupMethods.set(name, { kind: 'block', from: start, to: end, openLine: i });
    i = end + 1;
    continue;
  }

  throw new Error(`未识别的顶层行 L${i + 1}: ${lines[i]}`);
}

// ---------- 3) 覆盖校验：每个非空行恰好覆盖一次 ----------
for (let k = 0; k < N; k++) {
  if (!covered.has(k) && !isBlank(lines[k])) {
    throw new Error(`行 ${k + 1} 未被任何产物覆盖: ${lines[k]}`);
  }
}
console.log(`[verify] 覆盖校验通过：${N} 行，全部非空行恰好覆盖一次`);

// ---------- 4) 生成产物 ----------
const stripTrailingComma = (arr) => {
  const out = [...arr];
  out[out.length - 1] = out[out.length - 1].replace(/,\s*$/, '');
  return out;
};
const header = (t) => `/**\n * ${t}\n * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。\n */\n`;

function methodsBody(methods) {
  // 取原行区间并按方法聚合文本，方法间以 ',\n\n' 连接，保留组内空行
  const parts = methods.map((m) => stripTrailingComma(lines.slice(m.from, m.to + 1)).join(EOL));
  return parts.join(',' + EOL + EOL);
}

mkdirSync(path.join(ENGINE, 'api/modules'), { recursive: true });

const U = groupMethods.get('Utils').items;
const C = groupMethods.get('Common').items;
const pick = (names, label) => {
  const sel = U.filter((m) => names.includes(m.name));
  if (sel.length !== names.length) {
    const miss = names.filter((n) => !U.some((m) => m.name === n));
    throw new Error(`${label} 缺方法: ${miss.join(', ')}`);
  }
  return sel;
};

// 4.1 rest-urls.js
writeFileSync(path.join(ENGINE, 'api/rest-urls.js'), items.find((x) => x.label === 'rest-urls').text.join(EOL) + EOL, 'utf8');

// 4.2 network.js
const NET_NAMES = ['buildNetworkErrorMessage', 'send', 'downloadFile', 'get', 'post',
  'getCookie', 'getQZoneToken', 'initUin', 'initGtk', 'sleep', 'timeoutPromise',
  'toJson', 'randomSeconds'];
const netMethods = pick(NET_NAMES, 'network');
writeFileSync(path.join(ENGINE, 'api/network.js'),
  header('网络层：请求方法、WAF 检测、g_tk/uin 鉴权、重试/稍候') +
  `const API_NETWORK_METHODS = {${EOL}${methodsBody(netMethods)}${EOL}};${EOL}`, 'utf8');

// 4.3 fs-utils.js
const FS_NAMES = ['getFileSuffixByUrl', 'getFileSuffix', 'autoFileSuffix', 'writeText',
  'writeFile', 'downloadToFile', 'hashUrl', 'fileExists', 'createFolder'];
const fsMethods = pick(FS_NAMES, 'fs-utils');
writeFileSync(path.join(ENGINE, 'api/fs-utils.js'),
  header('文件系统工具：建目录/写文本/写文件/断点、后缀探测、hashUrl') +
  `const API_FS_METHODS = {${EOL}${methodsBody(fsMethods)}${EOL}};${EOL}`, 'utf8');

// 4.4 utils.js（Utils 剩余）
const usedNames = new Set([...NET_NAMES, ...FS_NAMES]);
const restMethods = U.filter((m) => !usedNames.has(m.name));
writeFileSync(path.join(ENGINE, 'api/utils.js'),
  header('通用工具：格式化/分组/编码/下载器适配等（Utils 其余方法）') +
  `const API_UTILS_METHODS = {${EOL}${methodsBody(restMethods)}${EOL}};${EOL}`, 'utf8');

// 4.5 common.js（Common 整组方法）
writeFileSync(path.join(ENGINE, 'api/common.js'),
  header('公共模块：账号/名片/点赞/头像/表情/坐标等公共逻辑') +
  `const API_COMMON = {${EOL}${methodsBody(C)}${EOL}};${EOL}`, 'utf8');

// 4.6 modules/*.js
const MODULES = ['Blogs', 'Diaries', 'Friends', 'Messages', 'Boards', 'Photos',
  'Videos', 'Favorites', 'Shares', 'Visitors', 'Statistics'];
for (const mod of MODULES) {
  const g = groupMethods.get(mod);
  if (!g) throw new Error(`缺少分组 ${mod}`);
  const constName = `API_MODULE_${mod.toUpperCase()}`;
  let body;
  if (g.kind === 'block') {
    const inner = lines.slice(g.openLine + 1, g.to); // 头注释与首行 API.X = { 丢弃，结束 } 由包装重新生成
    body = inner.join(EOL);
  } else {
    body = methodsBody(g.items);
  }
  let file = header(`${mod} 模块接口`);
  if (mod === 'Shares') {
    // class 归属 shares（重组校验保证无重复覆盖）
    const classItem = items.filter((x) => x.label.startsWith('class:'));
    if (classItem.length !== 3) throw new Error(`class 数量异常: ${classItem.length}`);
    file += classItem.map((c) => c.text.join(EOL)).join(EOL + EOL) + EOL + EOL;
  }
  file += `const ${constName} = {${EOL}${body}${EOL}};${EOL}`;
  writeFileSync(path.join(ENGINE, `api/modules/${mod.toLowerCase()}.js`), file, 'utf8');
}

// 4.7 api.js 装配器
const skeleton = items.find((x) => x.label === 'skeleton').text.join(EOL);
const assigns = [
  `// 网络层、文件工具与通用工具统一合回 API.Utils（保持方法内 this 域不变）`,
  `Object.assign(API.Utils, API_UTILS_METHODS, API_NETWORK_METHODS, API_FS_METHODS);`,
  ``,
  `API.Common = API_COMMON;`,
  ...MODULES.map((m) => `API.${m} = API_MODULE_${m.toUpperCase()};`),
].join(EOL);
writeFileSync(path.join(ENGINE, 'api.js'),
  header('API 装配器：P2-1 拆分后在此按序组装（方法体在 api/ 目录，逐字搬迁）') +
  EOL + skeleton + EOL + EOL + assigns + EOL, 'utf8');

// ---------- 5) 报告 ----------
const countOf = (arr) => `${arr.length} 方法`;
console.log(`api/rest-urls.js  （常量+表情）`);
console.log(`api/network.js    ${countOf(netMethods)}`);
console.log(`api/fs-utils.js   ${countOf(fsMethods)}`);
console.log(`api/utils.js      ${countOf(restMethods)}`);
console.log(`api/common.js     ${countOf(C)}`);
for (const m of MODULES) {
  const g = groupMethods.get(m);
  console.log(`api/modules/${m.toLowerCase()}.js  ${g.kind === 'methods' ? countOf(g.items) : '整块'}`);
}
console.log('api.js            装配器');
console.log('[done] 全部产物已写入');
