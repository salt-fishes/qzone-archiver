/**
 * 下载「魔法表情」并并入内置表情库（v4.7 反馈 ② 的离线方案）
 *
 * 背景：QZone 昵称/内容里的表情代码分两类
 *   1. 经典 QQ 表情 e1~e320（本仓库 assets/emoticons/qq 已内置 310 个）
 *   2. 「魔法表情」e327xxx 一类（如 [em]e327806[/em]）—— id 稀疏，无法按区间推断，
 *      只能逐个探测；旧文档里的 /qzone/em/120/mb{id}.jpg 已 404，
 *      现在统一走 /qzone/em/e{id}.gif
 * 本脚本把第 2 类下载到 assets/emoticons/qq，并写入 manifest.json 的 qqMagic 数组，
 * 之后 `npm run gen:emoticons` 会把它们同步到应用界面，导出档案也会用本地文件。
 *
 * 用法（需要能访问外网，请在你自己机器上运行）：
 *   node scripts/fetch-magic-emoticons.mjs                  # 探测默认区间 327000-328000
 *   node scripts/fetch-magic-emoticons.mjs --ids 327806     # 只补指定 id
 *   node scripts/fetch-magic-emoticons.mjs --range 327000 328500
 *   node scripts/fetch-magic-emoticons.mjs --concurrency 12 --timeout 8000
 *
 * 幂等：已存在且校验通过的文件不重复下载；探测结果（命中集合）会并入 manifest，
 * 重复运行只会补充新命中的 id。
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const QQ_DIR = join(ROOT, 'assets/emoticons/qq');
const MANIFEST = join(ROOT, 'assets/emoticons/manifest.json');
const BASE = 'http://qzonestyle.gtimg.cn/qzone/em';

function parseArgs(argv) {
  const out = { ids: [], range: [327000, 328000], concurrency: 8, timeout: 8000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ids') {
      out.ids = String(argv[++i] || '')
        .split(/[,\s]+/)
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0);
    } else if (a === '--range') {
      out.range = [Number(argv[++i]), Number(argv[++i])].filter((v) => Number.isInteger(v));
    } else if (a === '--concurrency') {
      out.concurrency = Math.max(1, Number(argv[++i]) || 8);
    } else if (a === '--timeout') {
      out.timeout = Math.max(1000, Number(argv[++i]) || 8000);
    } else if (a === '--help' || a === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
      process.exit(0);
    }
  }
  if (out.range.length !== 2) out.range = [327000, 328000];
  return out;
}

/** 校验图片魔数，避免把 404 页面/HTML 当成图片存下来 */
function looksLikeImage(buf) {
  if (buf.length < 12) return false;
  const gif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46; // GIF8
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e; // PNG
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  return gif || png || jpg;
}

function extOf(buf) {
  if (buf[0] === 0x89) return 'png';
  if (buf[0] === 0xff) return 'jpg';
  return 'gif';
}

async function fetchEmoticon(id, timeout) {
  const url = `${BASE}/e${id}.gif`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!looksLikeImage(buf)) return null;
    return buf;
  } catch {
    return null; // 网络失败/超时：视为该 id 不存在，不中断整体流程
  } finally {
    clearTimeout(timer);
  }
}

const args = parseArgs(process.argv.slice(2));
if (!existsSync(QQ_DIR)) mkdirSync(QQ_DIR, { recursive: true });

const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : { qq: [], wx: [] };
const knownMagic = new Set((manifest.qqMagic || []).map(Number));

const ids = args.ids.length
  ? args.ids
  : Array.from({ length: args.range[1] - args.range[0] + 1 }, (_, i) => args.range[0] + i);

console.log(
  `[fetch-magic-emoticons] 待处理 ${ids.length} 个 id（并发 ${args.concurrency}，超时 ${args.timeout}ms）`
);
console.log(`[fetch-magic-emoticons] 目标目录：assets/emoticons/qq`);

let hit = 0;
let skipped = 0;
let miss = 0;

/** 该 id 的本地文件是否存在（扩展名可能是 gif/png/jpg） */
function localFileOf(id) {
  for (const ext of ['gif', 'png', 'jpg']) {
    const p = join(QQ_DIR, `e${id}.${ext}`);
    if (existsSync(p) && statSync(p).size > 0) return p;
  }
  return null;
}

/** 简单并发池：按 concurrency 分批推进，避免一次性打满连接 */
for (let i = 0; i < ids.length; i += args.concurrency) {
  const batch = ids.slice(i, i + args.concurrency);
  const results = await Promise.all(
    batch.map(async (id) => {
      // 已下载且文件非空：跳过网络
      if (localFileOf(id)) return { id, status: 'cached' };
      const buf = await fetchEmoticon(id, args.timeout);
      if (!buf) return { id, status: 'miss' };
      writeFileSync(join(QQ_DIR, `e${id}.${extOf(buf)}`), buf);
      // 落盘后再确认一次，避免写失败却记进清单
      return { id, status: localFileOf(id) ? 'hit' : 'miss' };
    })
  );
  for (const r of results) {
    if (r.status === 'hit') hit++;
    else if (r.status === 'cached') skipped++;
    else miss++;
  }
  const done = Math.min(i + args.concurrency, ids.length);
  if (done % (args.concurrency * 10) === 0 || done === ids.length) {
    console.log(
      `[fetch-magic-emoticons] 进度 ${done}/${ids.length}（命中 ${hit + skipped}，未命中 ${miss}）`
    );
  }
}

/**
 * 并入 manifest：qqMagic 只记录**本地确实存在文件**的 id。
 * 之前的实现把"已知 id"直接并入，文件缺失时界面会误以为可离线渲染，
 * 白白产生一次 404 再兜底，这里按磁盘实况重算。
 */
const magicOnDisk = [];
for (const id of new Set([...knownMagic, ...ids])) {
  if (localFileOf(id)) magicOnDisk.push(id);
}
const merged = magicOnDisk.sort((a, b) => a - b);
manifest.qqMagic = merged;
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(
  `[fetch-magic-emoticons] 完成：新下载 ${hit}，已有 ${skipped}，未命中 ${miss}；` +
  `manifest.qqMagic 记录本地可用 ${merged.length} 个`
);
console.log('[fetch-magic-emoticons] 下一步：npm run gen:emoticons 同步到应用界面');
