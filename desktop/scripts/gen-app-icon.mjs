/**
 * 生成打包用应用图标（v4.7；v4.9 §F 圆角 + §R2 splash；v5.0 §F 返工）
 *
 * 背景：仓库内图标只有 128×128，而 electron-builder 要求 Windows 图标 ≥256×256，
 * 否则打包直接失败；NSIS 的 installerIcon/uninstallerIcon 还只接受 .ico。
 * 环境不便引入 sharp/canvas，故用 scripts/png.mjs 的纯 JS 解码 + 双线性放大。
 *   - build/icon.png    512×512 圆角（win.icon 用）
 *   - build/icon.ico    16/24/32/48/64/128/256 各尺寸圆角（安装向导与卸载项用）
 *   - build/splash.bmp  600×300 便携版启动 splash（§R2：portable.splashImage，24 位 BMP）
 *   - src/main/icon.png + src/renderer/src/assets/icon.png
 *                       128 圆角**成品**（窗口/任务栏/首页 hero 用，每次从母图确定性重画）
 *
 * v5.0 §F 返工（2026-09-19 拍板）：
 *   - **母图与成品分离**：src/main/icon-source.png 是方形直角母图，绝不圆角化、
 *     绝不被产物回写（v4.9 的 --write-source 把圆角图回写母图 → 每次构建重复圆角
 *     + 缩放摊薄，256px 半径仅剩 2.7% 边长，是"改了没生效"的根因）。
 *   - **半径按比例 15%**（launcherRadius），先缩放后圆角，每个尺寸独立执行。
 *   - 幂等判据改为**有效半径占边长比例**（<10% 视为旧产物 → 重建），
 *     不再用"四角 alpha<250"（旧产物也满足，永远跳过）。
 *
 * 用法：node scripts/gen-app-icon.mjs [--force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  decodePng, encodeIco, encodePng, encodeBmp24, resizeBilinear, roundCorners, launcherRadius,
} from './png.mjs';

const FORCE = process.argv.includes('--force');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = join(ROOT, 'src/main/icon-source.png'); // 方形母图（只读，绝不回写）
const RUNTIME_MAIN = join(ROOT, 'src/main/icon.png'); // 运行时成品（窗口/任务栏）
const RUNTIME_RENDERER = join(ROOT, 'src/renderer/src/assets/icon.png'); // 首页 hero / 侧栏
const OUT_DIR = join(ROOT, 'build');
const OUT_PNG = join(OUT_DIR, 'icon.png');
const OUT_ICO = join(OUT_DIR, 'icon.ico');
const OUT_SPLASH = join(OUT_DIR, 'splash.bmp');
const PNG_SIZE = 512;
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]; // v5.0：补 24px 档（§F 规范表原有）
const RUNTIME_SIZE = 128;
const SPLASH_W = 600;
const SPLASH_H = 300;
/** 幂等/达标判据：有效半径占边长低于该比例视为旧产物（直角）→ 重建 */
const MIN_RADIUS_RATIO = 0.1;

if (!existsSync(MASTER)) {
  console.error(`[gen-app-icon] 母图不存在：${MASTER}（方形直角母图，见 git 历史 a145565）`);
  process.exit(1);
}

/**
 * 有效圆角半径：顶边（第 0 行）从左起**首个完全不透明像素**的位置 = 顶边退让宽度。
 * 直角图 = 0；15% 圆角图 ≈12.5%~14.3%×边长（4×4 超采样 AA 使过渡像素略微前移）。
 * 用于幂等判据与"母图被污染"检测。注意不能用 alpha<128：AA 会把读数压低约 2pp，
 * 且 16px 小图只有 1px 退让、区分度不足。
 */
function effectiveRadiusRatio(img) {
  let x = 0;
  while (x < img.width && img.data[x * 4 + 3] < 250) x++;
  return x / img.width;
}

/** 从方形母图缩放到目标尺寸并按 15% 施加圆角（顺序不可颠倒） */
function makeProduct(master, size) {
  const scaled = size === master.width && size === master.height
    ? { width: master.width, height: master.height, data: Buffer.from(master.data) }
    : resizeBilinear(master, size, size);
  return roundCorners(scaled, launcherRadius(size));
}

if (!FORCE && existsSync(OUT_PNG) && existsSync(OUT_ICO) && existsSync(OUT_SPLASH)) {
  try {
    const existing = decodePng(readFileSync(OUT_PNG));
    const ico = readFileSync(OUT_ICO);
    const icoOk = ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= ICO_SIZES.length;
    const splashOk = readFileSync(OUT_SPLASH).toString('ascii', 0, 2) === 'BM';
    const runtimeOk = [RUNTIME_MAIN, RUNTIME_RENDERER].every((p) => {
      if (!existsSync(p)) return false;
      const img = decodePng(readFileSync(p));
      return img.data[3] < 250; // 运行时成品四角应透明（圆角）
    });
    // v5.0：按有效半径比例判达标（旧版 8px@512 仅 1.6% → 重建，不再被"四角透明"骗过）
    const ratioOk = existing.width >= 256 && effectiveRadiusRatio(existing) >= MIN_RADIUS_RATIO;
    if (ratioOk && icoOk && splashOk && runtimeOk) {
      console.log(`[gen-app-icon] 产物已达标（512 有效半径 ${(effectiveRadiusRatio(existing) * 100).toFixed(1)}% ≥ ${MIN_RADIUS_RATIO * 100}%、${ICO_SIZES.length} 尺寸 ICO、splash、运行时成品），跳过（--force 可重建）`);
      process.exit(0);
    }
  } catch {
    /* 产物损坏 → 重新生成 */
  }
}

/** §R2：便携版启动画面——品牌底色（界面主色暖陶）+ 居中圆角图标，24 位 BMP 无文字 */
function composeSplash(icon) {
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
  const ox = Math.floor((w - icon.width) / 2);
  const oy = Math.floor((h - icon.height) / 2);
  for (let y = 0; y < icon.height; y++) {
    for (let x = 0; x < icon.width; x++) {
      const si = (y * icon.width + x) * 4;
      const a = icon.data[si + 3] / 255;
      if (a <= 0) continue;
      const di = ((oy + y) * w + (ox + x)) * 4;
      for (let c = 0; c < 3; c++) {
        out[di + c] = Math.round(icon.data[si + c] * a + out[di + c] * (1 - a));
      }
    }
  }
  return { width: w, height: h, data: out };
}

const master = decodePng(readFileSync(MASTER));

// 反例守卫：母图必须是方形直角——有人把圆角图当母图会在此立刻失败（防再次摊薄）
if (effectiveRadiusRatio(master) > 0) {
  console.error(
    `[gen-app-icon] 母图 ${MASTER} 顶边已有圆角退让（${(effectiveRadiusRatio(master) * 100).toFixed(1)}%）` +
      '——母图必须是方形直角，禁止把成品/圆角图当母图'
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

// 运行时成品：128 的 15% 圆角版，从母图确定性重画（窗口/任务栏/hero 共用，不回写母图）
const runtime128 = makeProduct(master, RUNTIME_SIZE);
const png128 = encodePng(runtime128);
writeFileSync(RUNTIME_MAIN, png128);
writeFileSync(RUNTIME_RENDERER, png128);

// 主图（win.icon）：512，先缩放后按 15% 圆角
writeFileSync(OUT_PNG, encodePng(makeProduct(master, PNG_SIZE)));

// ICO：每个尺寸独立「缩放 → 15% 圆角」（顺序不可颠倒，否则半径被摊薄）
const icoImages = ICO_SIZES.map((size) => ({
  size,
  png: encodePng(makeProduct(master, size)),
}));
writeFileSync(OUT_ICO, encodeIco(icoImages));

// §R2：便携版启动 splash（24 位 BMP）
writeFileSync(OUT_SPLASH, encodeBmp24(composeSplash(runtime128)));

console.log(
  `[gen-app-icon] 已生成 build/icon.png（512/${launcherRadius(PNG_SIZE)}px 圆角）、` +
    `build/icon.ico（${ICO_SIZES.join('/')} 各 15% 圆角）、build/splash.bmp、` +
    'src/main/icon.png + src/renderer/src/assets/icon.png（128 成品）'
);
