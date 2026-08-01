/**
 * 多媒体文件重命名修复工具
 *
 * 问题背景：迅雷下载链接导入时忽略了 thunderx:// JSON 里的 name 字段，
 * 所有图片被保存为 default.jpeg / default(1).jpeg ...（服务器默认文件名）。
 * 而备份数据文件（data/*.js）里引用的是扩展生成的规范文件名，导致页面无法显示图片。
 *
 * 原理：
 *  - 数据文件为权威：从 data/*.js 提取每个磁盘目录的目标文件名（按首次出现顺序去重）；
 *  - 视频/音频任务文件名正确（从 URL 命名），不参与重命名，仅处理图片类 default 文件；
 *  - 磁盘 default(N).jpeg 的编号顺序假定与图片任务添加顺序一致，按顺序重命名。
 *
 * 用法：
 *  node rename-media.js "<备份目录>"            # 干跑，仅输出匹配报告
 *  node rename-media.js "<备份目录>" --apply    # 校验通过后真正重命名
 *
 * 注意：
 *  - 相册等按相册分文件的目录顺序可靠；
 *  - 说说/视频按年份分文件，跨年顺序可能与下载顺序不一致，存在张冠李戴风险，
 *    请先看干跑报告，确认匹配质量后再决定是否 --apply。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const APPLY = process.argv.includes('--apply');
const ONLY = process.argv.indexOf('--only') > -1 ? process.argv[process.argv.indexOf('--only') + 1] : '';
if (!ROOT || !fs.existsSync(ROOT)) {
  console.error('用法: node rename-media.js "<备份目录>" [--apply] [--only 目录前缀]');
  process.exit(1);
}

/** 视频/音频扩展名（这些文件按 URL 命名，文件名正确，不参与重命名） */
const MEDIA_RE = /\.(mp4|avi|mov|flv|webm|mkv|m3u8|mp3|m4a|wav|ogg|aac)$/i;

/** 递归收集所有 data 目录下的 .js 文件 */
function walkDataFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.js') && path.basename(path.dirname(p)) === 'data') out.push(p);
    }
  })(dir);
  return out;
}

/** 从数据文件中提取磁盘相对路径序列（模块相对 → 根相对），按出现顺序去重 */
function collectTargets(dir) {
  const targets = new Map(); // diskRelDir -> string[]
  for (const file of walkDataFiles(dir)) {
    const moduleName = path.basename(path.dirname(path.dirname(file))); // {ROOT}/{Module}/data/x.js
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    const re = /"custom_(?:pre_)?filepath":"([^"]+)"/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      const fp = m[1].replace(/\\/g, '/');
      const base = path.posix.basename(fp);
      if (MEDIA_RE.test(base)) continue; // 视频/音频跳过
      // 模块相对路径统一为根相对：Messages 的 images/xxx → Messages/images/xxx
      const rootRel = fp.startsWith(moduleName + '/') ? fp : (moduleName + '/' + fp);
      const diskDir = path.posix.dirname(rootRel);
      if (!targets.has(diskDir)) targets.set(diskDir, []);
      const list = targets.get(diskDir);
      if (!list.includes(base)) list.push(base);
    }
  }
  return targets;
}

/** 扫描目录下的 default 文件，按编号排序 */
function scanDefaultFiles(absDir) {
  let entries = [];
  try { entries = fs.readdirSync(absDir, { withFileTypes: true }); } catch (e) { return null; }
  return entries
    .filter(e => e.isFile() && /^default(?:\((\d+)\))?\.\w+$/i.test(e.name))
    .map(e => {
      const mm = /^default(?:\((\d+)\))?\.(\w+)$/i.exec(e.name);
      return { name: e.name, idx: mm[1] === undefined ? 0 : parseInt(mm[1], 10), ext: mm[2] };
    })
    .sort((a, b) => a.idx - b.idx);
}

const targets = collectTargets(ROOT);
console.log('=== 目录匹配报告（图片类 default 文件） ===');
let totalDefault = 0, totalOk = 0, totalBad = 0, totalSkip = 0;

for (const [diskDir, targetList] of targets) {
  if (ONLY && !diskDir.startsWith(ONLY)) continue; // 仅处理指定前缀目录
  const absDir = path.join(ROOT, diskDir.replace(/\//g, path.sep));
  const defaults = scanDefaultFiles(absDir);
  if (!defaults) continue;
  if (defaults.length === 0) { totalSkip++; continue; } // 无 default 文件，无需处理
  const need = targetList.length;
  const have = defaults.length;
  totalDefault += have;
  const ok = have === need;
  if (ok) totalOk++; else totalBad++;
  console.log(`[${ok ? 'OK ' : 'MISMATCH'}] ${diskDir}\n        default 文件 ${have} 个 vs 数据目标 ${need} 个${ok ? ' ✓' : ' ✗ 跳过'}`);
}

console.log('\n=== 统计 ===');
console.log(`可重命名目录: ${totalOk}，不匹配(跳过): ${totalBad}，无需处理: ${totalSkip}，default 文件合计: ${totalDefault}`);

if (!APPLY) {
  console.log('\n[干跑] 未执行重命名。确认报告无误后，加 --apply 执行。');
  process.exit(0);
}

let renamed = 0, failed = 0;
for (const [diskDir, targetList] of targets) {
  if (ONLY && !diskDir.startsWith(ONLY)) continue; // 仅处理指定前缀目录
  const absDir = path.join(ROOT, diskDir.replace(/\//g, path.sep));
  const defaults = scanDefaultFiles(absDir);
  if (!defaults || defaults.length === 0 || defaults.length !== targetList.length) continue;
  for (let i = 0; i < defaults.length; i++) {
    const src = path.join(absDir, defaults[i].name);
    const dst = path.join(absDir, targetList[i]);
    if (src === dst) continue;
    try {
      fs.renameSync(src, dst);
      console.log(`  重命名: ${diskDir}/${defaults[i].name} -> ${diskDir}/${targetList[i]}`);
      renamed++;
    } catch (e) {
      console.error(`  失败: ${src} -> ${dst}: ${e.message}`);
      failed++;
    }
  }
}
console.log(`\n完成：成功重命名 ${renamed} 个文件，失败 ${failed} 个。`);
console.log('提示：说说/视频模块若存在跨年顺序问题，请用 dry-run 抽查验证后处理。');
