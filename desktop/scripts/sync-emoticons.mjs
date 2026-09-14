/**
 * 同步内置表情到渲染层 public（v4.7 反馈 ②）
 *
 * 背景：QZone 昵称/内容里的表情是 `[em]e327806[/em]` 代码，应用界面需要把它渲染成图。
 * 内置表情库在 desktop/assets/emoticons（随包分发，导出档案用），
 * 但渲染层产物（src/renderer/dist）不包含它；为了界面也能离线显示表情，
 * 这里把表情复制到渲染层 public/emoticons，Vite 构建时原样带进产物。
 *
 * 用法：node scripts/sync-emoticons.mjs [--check]
 * 幂等：逐文件比对大小，只补缺失/变化的文件。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CHECK = process.argv.includes('--check');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets/emoticons');
const DEST = join(ROOT, 'src/renderer/public/emoticons');
/** 渲染层也要一份清单（组件据此判断哪些 id 可离线渲染），放在 src 内便于 TS 解析 */
const MANIFEST_SRC = join(SRC, 'manifest.json');
const MANIFEST_DEST = join(ROOT, 'src/renderer/src/assets/emoticons-manifest.json');

function filesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? filesIn(p) : [p];
  });
}

if (!existsSync(SRC)) {
  console.error(`[sync-emoticons] 源目录不存在：${SRC}`);
  process.exit(1);
}

const srcFiles = filesIn(SRC);
let copied = 0;
let skipped = 0;
const missing = [];

for (const file of srcFiles) {
  const rel = file.slice(SRC.length + 1);
  const target = join(DEST, rel);
  const same =
    existsSync(target) && statSync(target).size === statSync(file).size;
  if (same) {
    skipped++;
    continue;
  }
  if (CHECK) {
    missing.push(rel);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
  copied++;
}

if (CHECK) {
  if (missing.length) {
    console.error(
      `[sync-emoticons] 渲染层缺少 ${missing.length} 个表情文件（示例：${missing.slice(0, 5).join(', ')}）`
    );
    console.error('[sync-emoticons] 请运行 npm run gen:emoticons');
    process.exit(1);
  }
  if (!existsSync(MANIFEST_DEST)) {
    console.error('[sync-emoticons] 渲染层清单缺失，请运行 npm run gen:emoticons');
    process.exit(1);
  }
  console.log(`[sync-emoticons] 渲染层表情与内置库一致（${skipped} 个文件）`);
  process.exit(0);
}

// 清单同步到渲染层 src（组件按它区分"可离线渲染"与"回落 CDN"）
mkdirSync(dirname(MANIFEST_DEST), { recursive: true });
copyFileSync(MANIFEST_SRC, MANIFEST_DEST);

console.log(`[sync-emoticons] 复制 ${copied} 个、跳过 ${skipped} 个 → src/renderer/public/emoticons`);
