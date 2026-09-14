/**
 * 生成引擎侧表情清单（v4.7.2）
 *
 * 产出：desktop/src/engine/emoticons.js —— 定义 window.__EMOTICONS_MANIFEST
 *   {
 *     qq:     [1, 2, ...],         经典表情 id（向后兼容旧消费方）
 *     wx:     ['2_02', ...],       微信表情名
 *     roster: { "1": "e1.gif", "327806": "e327806.png", ... }   id → 真实文件名
 *   }
 *
 * 为什么需要 roster：魔法表情（e327xxx）多为 .png，而经典表情是 .gif。
 * 引擎此前处处写死 .gif：既导致内置表情复制不全（png 被漏掉），
 * 也让导出档案里的表情路径指向不存在的文件 —— 界面与档案都显示不出来。
 *
 * 用法：node scripts/gen-emoticons-manifest.mjs
 * 幂等：内容有变化才写盘。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QQ_DIR = join(ROOT, 'assets/emoticons/qq');
const MANIFEST = join(ROOT, 'assets/emoticons/manifest.json');
const OUT = join(ROOT, 'src/engine/emoticons.js');

if (!existsSync(MANIFEST)) {
  console.error(`[gen-emoticons] 缺少 ${MANIFEST}`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

/** 扫描表情目录：排除 manifest.json 等非表情文件 */
function scanRoster() {
  const roster = {};
  if (!existsSync(QQ_DIR)) return roster;
  for (const e of readdirSync(QQ_DIR, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    const m = /^e(\d+)\.(gif|png|jpe?g)$/i.exec(e.name);
    if (m) roster[m[1]] = e.name;
  }
  return roster;
}

const roster = scanRoster();
const qq = Object.keys(roster)
  .map(Number)
  .filter((n) => Number.isInteger(n))
  .sort((a, b) => a - b);
const wx = manifest.wx || [];
const magic = qq.filter((n) => n > 320);

const content = `/* 内置表情库清单（由 scripts/gen-emoticons-manifest.mjs 从 assets/emoticons 生成，勿手改） */
window.__EMOTICONS_MANIFEST = ${JSON.stringify({ qq, wx, roster })};
`;

let prev = '';
try {
  prev = readFileSync(OUT, 'utf8');
} catch {
  /* 首次生成 */
}

if (prev === content) {
  console.log(`[gen-emoticons] 无需变更（经典 ${qq.length - magic.length} + 魔法 ${magic.length}，roster ${Object.keys(roster).length} 项）`);
  process.exit(0);
}

writeFileSync(OUT, content, 'utf8');
console.log(
  `[gen-emoticons] 已生成 src/engine/emoticons.js：` +
  `经典 ${qq.length - magic.length} + 魔法 ${magic.length}，微信 ${wx.length}，roster ${Object.keys(roster).length} 项`
);
