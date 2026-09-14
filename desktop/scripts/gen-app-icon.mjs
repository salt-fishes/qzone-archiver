/**
 * 生成打包用应用图标（v4.7）
 *
 * 背景：仓库内图标只有 128×128（src/main/icon.png），而 electron-builder 要求
 * Windows 图标 ≥256×256，否则打包直接失败；NSIS 的 installerIcon/uninstallerIcon
 * 还只接受 .ico（传 PNG 会报 invalid icon file）。
 * 环境不便引入 sharp/canvas，故用 scripts/png.mjs 的纯 JS 解码 + 双线性放大：
 *   - build/icon.png  512×512（win.icon 用）
 *   - build/icon.ico  16/32/48/64/128/256 多尺寸（安装向导与卸载项用）
 *
 * 用法：node scripts/gen-app-icon.mjs [--force]
 * 幂等：产物齐全且尺寸达标时跳过。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decodePng, encodeIco, encodePng, resizeBilinear } from './png.mjs';

const FORCE = process.argv.includes('--force');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'src/main/icon.png');
const OUT_DIR = join(ROOT, 'build');
const OUT_PNG = join(OUT_DIR, 'icon.png');
const OUT_ICO = join(OUT_DIR, 'icon.ico');
const PNG_SIZE = 512;
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

if (!existsSync(SOURCE)) {
  console.error(`[gen-app-icon] 源图标不存在：${SOURCE}`);
  process.exit(1);
}

if (!FORCE && existsSync(OUT_PNG) && existsSync(OUT_ICO)) {
  try {
    const existing = decodePng(readFileSync(OUT_PNG));
    const ico = readFileSync(OUT_ICO);
    const icoOk = ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= ICO_SIZES.length;
    if (existing.width >= 256 && existing.height >= 256 && icoOk) {
      console.log(`[gen-app-icon] 已存在 ${existing.width}×${existing.height} PNG 与多尺寸 ICO，跳过（--force 可重建）`);
      process.exit(0);
    }
  } catch {
    /* 产物损坏 → 重新生成 */
  }
}

const src = decodePng(readFileSync(SOURCE));
mkdirSync(OUT_DIR, { recursive: true });

// 主图（win.icon）：源图够大就直接复制，否则放大
const main = src.width >= PNG_SIZE && src.height >= PNG_SIZE ? src : resizeBilinear(src, PNG_SIZE, PNG_SIZE);
writeFileSync(OUT_PNG, encodePng(main));

// ICO：各尺寸独立缩放（小尺寸直接缩到目标，避免先放大再缩小产生模糊）
const icoImages = ICO_SIZES.map((size) => ({
  size,
  png: encodePng(size === main.width ? main : resizeBilinear(src, size, size)),
}));
writeFileSync(OUT_ICO, encodeIco(icoImages));

console.log(
  `[gen-app-icon] ${src.width}×${src.height} → build/icon.png(${main.width}×${main.height})` +
  ` + build/icon.ico(${ICO_SIZES.join('/')})`
);
