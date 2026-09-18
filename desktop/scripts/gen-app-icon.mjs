/**
 * 生成打包用应用图标（v4.7；v4.9 §F 圆角 + §R2 splash）
 *
 * 背景：仓库内图标只有 128×128（src/main/icon.png），而 electron-builder 要求
 * Windows 图标 ≥256×256，否则打包直接失败；NSIS 的 installerIcon/uninstallerIcon
 * 还只接受 .ico（传 PNG 会报 invalid icon file）。
 * 环境不便引入 sharp/canvas，故用 scripts/png.mjs 的纯 JS 解码 + 双线性放大。
 *   - build/icon.png    512×512 圆角（win.icon 用）
 *   - build/icon.ico    16/32/48/64/128/256 各尺寸分档圆角（安装向导与卸载项用）
 *   - build/splash.bmp  600×300 便携版启动 splash（§R2：portable.splashImage，24 位 BMP）
 *
 * §F 圆角：按 Win11 规范分档半径（<32px→2px、32px→4px、>32px→8px，用户拍板），
 * 全部产物与窗口图标统一走资源圆角，界面不再二次加 border-radius。
 * --write-source：把 128 圆角版写回 src/main/icon.png 与渲染层 hero 图标（提交入库），
 * 使窗口 / 任务栏 / exe / 首屏四处一致。
 *
 * 用法：node scripts/gen-app-icon.mjs [--force] [--write-source]
 * 幂等：产物齐全且尺寸/圆角达标时跳过。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  decodePng, encodeIco, encodePng, encodeBmp24, resizeBilinear, roundCorners, radiusForSize,
} from './png.mjs';

const FORCE = process.argv.includes('--force');
const WRITE_SOURCE = process.argv.includes('--write-source');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'src/main/icon.png');
const RENDERER_ICON = join(ROOT, 'src/renderer/src/assets/icon.png');
const OUT_DIR = join(ROOT, 'build');
const OUT_PNG = join(OUT_DIR, 'icon.png');
const OUT_ICO = join(OUT_DIR, 'icon.ico');
const OUT_SPLASH = join(OUT_DIR, 'splash.bmp');
const PNG_SIZE = 512;
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const SPLASH_W = 600;
const SPLASH_H = 300;

if (!existsSync(SOURCE)) {
  console.error(`[gen-app-icon] 源图标不存在：${SOURCE}`);
  process.exit(1);
}

if (!FORCE && existsSync(OUT_PNG) && existsSync(OUT_ICO) && existsSync(OUT_SPLASH)) {
  try {
    const existing = decodePng(readFileSync(OUT_PNG));
    const ico = readFileSync(OUT_ICO);
    const icoOk = ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= ICO_SIZES.length;
    const splashOk = readFileSync(OUT_SPLASH).toString('ascii', 0, 2) === 'BM';
    // 圆角守卫：build 产物若还是直角（四角不透明）则视为旧版，重建
    const cornerAlpha = existing.data[3];
    if (existing.width >= 256 && existing.height >= 256 && cornerAlpha < 250 && icoOk && splashOk) {
      console.log(`[gen-app-icon] 已存在 ${existing.width}×${existing.height} 圆角 PNG、多尺寸 ICO 与 splash，跳过（--force 可重建）`);
      process.exit(0);
    }
  } catch {
    /* 产物损坏 → 重新生成 */
  }
}

/** §R2：便携版启动画面——品牌底色（界面主色暖陶）+ 居中圆角图标，24 位 BMP 无文字 */
function composeSplash(icon128) {
  const w = SPLASH_W;
  const h = SPLASH_H;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    // 纵向轻微渐变（#b45f3d → #a04c30）
    const t = y / (h - 1);
    const r = Math.round(0xb4 + (0xa0 - 0xb4) * t);
    const g = Math.round(0x5f + (0x4c - 0x5f) * t);
    const b = Math.round(0x3d + (0x30 - 0x3d) * t);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
  }
  const ox = Math.floor((w - icon128.width) / 2);
  const oy = Math.floor((h - icon128.height) / 2);
  for (let y = 0; y < icon128.height; y++) {
    for (let x = 0; x < icon128.width; x++) {
      const si = (y * icon128.width + x) * 4;
      const a = icon128.data[si + 3] / 255;
      if (a <= 0) continue;
      const di = ((oy + y) * w + (ox + x)) * 4;
      for (let c = 0; c < 3; c++) {
        out[di + c] = Math.round(icon128.data[si + c] * a + out[di + c] * (1 - a));
      }
    }
  }
  return { width: w, height: h, data: out };
}

const src = decodePng(readFileSync(SOURCE));
mkdirSync(OUT_DIR, { recursive: true });

// §F：128 基准图（先圆角——写回源图标 / splash 贴图共用同一份）
const base128 = roundCorners(
  src.width === 128 ? src : resizeBilinear(src, 128, 128),
  radiusForSize(128)
);

if (WRITE_SOURCE) {
  // 写回源图标并提交入库：窗口 / 任务栏 / 首屏 hero 四处一致（§F.3 统一走资源）
  const png128 = encodePng(base128);
  writeFileSync(SOURCE, png128);
  writeFileSync(RENDERER_ICON, png128);
  console.log('[gen-app-icon] 已写回圆角源图标：src/main/icon.png + src/renderer/src/assets/icon.png');
}

// 主图（win.icon）：512 + 分档圆角
const mainRaw = src.width >= PNG_SIZE && src.height >= PNG_SIZE ? src : resizeBilinear(src, PNG_SIZE, PNG_SIZE);
const main = roundCorners(mainRaw, radiusForSize(PNG_SIZE));
writeFileSync(OUT_PNG, encodePng(main));

// ICO：各尺寸独立缩放 + 独立分档圆角（小尺寸直接缩到目标，避免先放大再缩小产生模糊）
const icoImages = ICO_SIZES.map((size) => {
  const img = size === src.width ? src : resizeBilinear(src, size, size);
  return { size, png: encodePng(roundCorners(img, radiusForSize(size))) };
});
writeFileSync(OUT_ICO, encodeIco(icoImages));

// §R2：便携版启动 splash（24 位 BMP）
writeFileSync(OUT_SPLASH, encodeBmp24(composeSplash(base128)));

console.log(
  `[gen-app-icon] 已生成 build/icon.png（512 圆角）、build/icon.ico（${ICO_SIZES.join('/')} 分档圆角）、build/splash.bmp`
);
