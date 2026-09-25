/**
 * v4.9 §F 应用图标圆角 + v5.0 §F 返工 + §R2 splash 单测
 *
 * v5.0 返工要点（2026-09-19 拍板）：
 *  - 母图/成品分离：src/main/icon-source.png 方形母图（只读），
 *    src/main/icon.png 与渲染层 icon.png 是 128 的 15% 圆角成品（每次从母图重画）。
 *  - 启动器半径按比例 15%（launcherRadius），先缩放后圆角；UI 元素分档 radiusForSize 保留。
 *  - 硬判据：build/icon.png 有效半径 ≥70px（512）；build/icon.ico 每档 ≥12% 边长。
 *    有效半径 = 顶边首个完全不透明像素（alpha<250 退让），旧版 256 档仅 2.7% → 必须失败。
 *  - 幂等：gen-app-icon.mjs 连续两次 --force 运行产物字节一致，且母图不被回写。
 *  - 反例守卫：把圆角图当母图会被"母图顶边退让=0"判据拒绝。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  decodePng, encodePng, encodeIco, resizeBilinear, roundCorners, radiusForSize,
  launcherRadius, RADIUS_RATIO, encodeBmp24,
} from '../../scripts/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** 生成纯色不透明 RGBA 测试图 */
function solidImage(size, [r, g, b] = [180, 95, 61]) {
  const data = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width: size, height: size, data };
}

function alphaAt(img, x, y) {
  return img.data[(y * img.width + x) * 4 + 3];
}

/** 有效圆角半径：顶边首个完全不透明像素的位置（与 gen-app-icon 幂等判据同口径） */
function topEdgeRetreat(img) {
  let x = 0;
  while (x < img.width && img.data[x * 4 + 3] < 250) x++;
  return x;
}

/** 解析 PNG 压缩型 ICO → [{size, img}] */
function parseIco(buf) {
  const count = buf.readUInt16LE(4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const b = 6 + i * 16;
    const size = buf[b] || 256;
    const len = buf.readUInt32LE(b + 8);
    const off = buf.readUInt32LE(b + 12);
    out.push({ size, img: decodePng(buf.subarray(off, off + len)) });
  }
  return out;
}

describe('§F⑦ radiusForSize UI 元素分档与边界（保留不动）', () => {
  it('31→2、32→4、33→8；16/24→2；48/64/128/256→8', () => {
    expect(radiusForSize(31)).toBe(2);
    expect(radiusForSize(32)).toBe(4);
    expect(radiusForSize(33)).toBe(8);
    expect(radiusForSize(16)).toBe(2);
    expect(radiusForSize(24)).toBe(2);
    expect(radiusForSize(48)).toBe(8);
    expect(radiusForSize(64)).toBe(8);
    expect(radiusForSize(128)).toBe(8);
    expect(radiusForSize(256)).toBe(8);
  });
});

describe('v5.0 §F launcherRadius 按比例 15%（启动器/窗口图标）', () => {
  it('拍板值：RADIUS_RATIO = 0.15', () => {
    expect(RADIUS_RATIO).toBe(0.15);
  });

  it('各档半径：16→2、24→4、32→5、48→7、64→10、128→19、256→38、512→77', () => {
    expect(launcherRadius(16)).toBe(2);
    expect(launcherRadius(24)).toBe(4);
    expect(launcherRadius(32)).toBe(5);
    expect(launcherRadius(48)).toBe(7);
    expect(launcherRadius(64)).toBe(10);
    expect(launcherRadius(128)).toBe(19);
    expect(launcherRadius(256)).toBe(38);
    expect(launcherRadius(512)).toBe(77);
  });

  it('小尺寸保底 2px；全部档位半径占边长 ≥12%（16px 除外保底取整）', () => {
    for (const size of ICO_SIZES.concat(512)) {
      const r = launcherRadius(size);
      expect(r, `${size}px 半径`).toBeGreaterThanOrEqual(2);
      if (size >= 24) {
        expect(r / size, `${size}px 半径占比`).toBeGreaterThanOrEqual(0.12);
      }
    }
  });
});

describe('§F roundCorners 生效（launcherRadius 口径）', () => {
  it('各档：角点透明、圆弧过渡、中心不透明', () => {
    for (const size of ICO_SIZES.concat(512)) {
      const img = roundCorners(solidImage(size), launcherRadius(size));
      expect(alphaAt(img, 0, 0), `${size}px 角点`).toBeLessThan(128);
      expect(alphaAt(img, Math.floor(size / 2), Math.floor(size / 2)), `${size}px 中心`).toBe(255);
      // 圆弧穿过渡带：首个不透明像素前移量与半径同量级（口径同幂等判据）
      expect(topEdgeRetreat(img) / size, `${size}px 有效半径占比`).toBeGreaterThanOrEqual(0.12);
    }
  });

  it('半径 0 原样返回（不施圆角）', () => {
    const img = solidImage(16);
    const out = roundCorners(img, 0);
    expect(alphaAt(out, 0, 0)).toBe(255);
  });
});

describe('§F⑤⑥ 产物结构', () => {
  it('512 PNG 编解码后四角透明、尺寸保持', () => {
    const rounded = roundCorners(resizeBilinear(solidImage(128), 512, 512), launcherRadius(512));
    const png = encodePng(rounded);
    const decoded = decodePng(png);
    expect(decoded.width).toBe(512);
    expect(decoded.height).toBe(512);
    expect(alphaAt(decoded, 0, 0)).toBe(0);
    expect(alphaAt(decoded, 256, 256)).toBe(255);
  });

  it('ICO 容器装 7 个尺寸（v5.0 补 24px 档：16/24/32/48/64/128/256）', () => {
    const pngs = ICO_SIZES.map((size) => ({
      size,
      png: encodePng(roundCorners(solidImage(Math.min(size, 64)), launcherRadius(size))),
    }));
    const ico = encodeIco(pngs);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(7);
    expect(parseIco(ico).map((e) => e.size)).toEqual(ICO_SIZES);
  });
});

describe('§R2 24 位 BMP（portable splash）', () => {
  it('BM 头 / 24bpp / 尺寸正确 / 底色为品牌暖陶', () => {
    const img = solidImage(8, [180, 95, 61]);
    const bmp = encodeBmp24(img);
    expect(bmp.toString('ascii', 0, 2)).toBe('BM');
    expect(bmp.readUInt32LE(2)).toBe(bmp.length);
    expect(bmp.readUInt16LE(28)).toBe(24);
    expect(bmp.readInt32LE(18)).toBe(8);
    expect(bmp.readInt32LE(22)).toBe(8);
    // BMP 自底向上：首像素行 = 源图最后一行；RGB→BGR
    expect(bmp[54 + 0]).toBe(61); // B
    expect(bmp[54 + 1]).toBe(95); // G
    expect(bmp[54 + 2]).toBe(180); // R
  });
});

describe('v5.0 §F 硬判据（装机产物像素级验收，写成单测）', () => {
  it('build/icon.png（512）有效半径 ≥70px', () => {
    const p = join(ROOT, 'build/icon.png');
    if (!existsSync(p)) return; // 全新 checkout 尚未构建时跳过（dist:win 会生成）
    const img = decodePng(readFileSync(p));
    expect(img.width).toBe(512);
    const retreat = topEdgeRetreat(img);
    expect(retreat, `512 有效半径 ${retreat}px 应 ≥70px（旧版仅 8px）`).toBeGreaterThanOrEqual(70);
  });

  it('build/icon.ico 每个尺寸有效半径占边长 ≥12%（旧版 256 档仅 2.7%）', () => {
    const p = join(ROOT, 'build/icon.ico');
    if (!existsSync(p)) return; // 同上
    const entries = parseIco(readFileSync(p));
    expect(entries.map((e) => e.size)).toEqual(ICO_SIZES);
    for (const { size, img } of entries) {
      const ratio = topEdgeRetreat(img) / size;
      expect(ratio, `${size}px 有效半径 ${(ratio * 100).toFixed(1)}% 应 ≥12%`).toBeGreaterThanOrEqual(0.12);
    }
  });

  it('build/splash.bmp 已生成（本地构建产物存在时校验）', () => {
    const splash = join(ROOT, 'build/splash.bmp');
    if (!existsSync(splash)) return;
    const bmp = readFileSync(splash);
    expect(bmp.toString('ascii', 0, 2)).toBe('BM');
    expect(bmp.readUInt16LE(28)).toBe(24);
  });
});

describe('v5.0 §F 母图/成品分离守卫', () => {
  it('母图 icon-source.png 必须是方形直角（顶边零退让）——反例：圆角图当母图会失败', () => {
    const img = decodePng(readFileSync(join(ROOT, 'src/main/icon-source.png')));
    expect(topEdgeRetreat(img), '母图顶边必须无圆角退让').toBe(0);
    expect(alphaAt(img, 0, 0), '母图左上角必须不透明').toBe(255);
    expect(alphaAt(img, img.width - 1, 0), '母图右上角必须不透明').toBe(255);
  });

  it('运行时成品（窗口/任务栏/hero）四角透明、圆角占比达标', () => {
    for (const rel of ['src/main/icon.png', 'src/renderer/src/assets/icon.png']) {
      const img = decodePng(readFileSync(join(ROOT, rel)));
      expect(alphaAt(img, 0, 0), `${rel} 左上角应为透明（圆角成品）`).toBeLessThan(250);
      expect(alphaAt(img, img.width - 1, img.height - 1), `${rel} 右下角应为透明`).toBeLessThan(250);
      expect(alphaAt(img, Math.floor(img.width / 2), Math.floor(img.height / 2)), `${rel} 中心应不透明`).toBe(255);
      expect(topEdgeRetreat(img) / img.width, `${rel} 有效半径占比 ≥12%`).toBeGreaterThanOrEqual(0.12);
    }
  });
});

describe('v5.0 §F 幂等（计划验收：连续两次生成产物一致、母图不被回写）', () => {
  const GEN = join(ROOT, 'scripts/gen-app-icon.mjs');
  const hashTargets = [
    'build/icon.png',
    'build/icon.ico',
    'build/splash.bmp',
    'src/main/icon.png',
    'src/renderer/src/assets/icon.png',
    'src/main/icon-source.png',
  ];
  const sha = (rel) => createHash('sha256').update(readFileSync(join(ROOT, rel))).digest('hex');

  it('两次 --force 运行：产物字节一致，母图 hash 不变', () => {
    execFileSync(process.execPath, [GEN, '--force'], { cwd: ROOT, stdio: 'pipe' });
    const first = hashTargets.map(sha);
    execFileSync(process.execPath, [GEN, '--force'], { cwd: ROOT, stdio: 'pipe' });
    const second = hashTargets.map(sha);
    for (let i = 0; i < hashTargets.length; i++) {
      expect(second[i], `${hashTargets[i]} 两次生成应字节一致`).toBe(first[i]);
    }
    // 母图不得被产物回写（v4.9 --write-source 的教训）
    expect(second[5]).toBe(first[5]);
  }, 60000);

  it('不带 --force 的第二次运行识别达标产物直接跳过（幂等判据不被旧产物骗过）', () => {
    const out = execFileSync(process.execPath, [GEN], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toContain('跳过');
  }, 30000);
});
