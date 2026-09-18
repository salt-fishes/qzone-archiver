/**
 * v4.9 §F 应用图标圆角（Win11 分档）+ §R2 splash 单测
 *
 * 分档半径（用户拍板，非单一比例）：<32px→2px、32px→4px、>32px→8px。
 * ⑦ 分档边界 ①②③④⑤ 各尺寸圆角生效 ⑥ ICO 结构 ⑧ 源图标必须已是圆角
 *   （防止有人换回直角素材后四处产物又变直角）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  decodePng, encodePng, encodeIco, resizeBilinear, roundCorners, radiusForSize, encodeBmp24,
} from '../../scripts/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

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

describe('§F⑦ radiusForSize 分档与边界', () => {
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

describe('§F①-④ roundCorners 各档生效', () => {
  it('2px 档（16/24）：角像素大幅裁掉（AA 部分覆盖），(3,3) 仍有内容，中心不透明', () => {
    for (const size of [16, 24]) {
      const img = roundCorners(solidImage(size), radiusForSize(size));
      // 半径 2 时角像素 (0,0) 部分落在圆外：alpha 显著低于 255 但不为 0（4×4 超采样抗锯齿）
      expect(alphaAt(img, 0, 0), `${size}px 角点`).toBeLessThan(128);
      expect(alphaAt(img, 0, 0), `${size}px 角点保留 AA 半透明`).toBeGreaterThan(0);
      expect(alphaAt(img, 3, 3), `${size}px (3,3)`).toBeGreaterThan(0);
      expect(alphaAt(img, Math.floor(size / 2), Math.floor(size / 2))).toBe(255);
    }
  });

  it('4px 档（32）：角点完全裁掉，圆弧穿过 (1,1)，(4,4) 起不透明', () => {
    const img = roundCorners(solidImage(32), radiusForSize(32));
    expect(alphaAt(img, 0, 0)).toBe(0); // 全部子样本在圆外
    expect(alphaAt(img, 1, 1)).toBeLessThan(255); // 圆弧穿过该像素（部分覆盖）
    expect(alphaAt(img, 1, 1)).toBeGreaterThan(0);
    expect(alphaAt(img, 4, 4)).toBe(255);
    expect(alphaAt(img, 8, 8)).toBe(255);
  });

  it('8px 档（48/512）：角点完全裁掉，圆弧穿过 (2,2)，(5,5) 起不透明，中心不透明', () => {
    for (const size of [48, 512]) {
      const img = roundCorners(solidImage(size), radiusForSize(size));
      expect(alphaAt(img, 0, 0), `${size}px 角点`).toBe(0);
      expect(alphaAt(img, 2, 2)).toBeLessThan(255); // 圆弧穿过（部分覆盖）
      expect(alphaAt(img, 2, 2)).toBeGreaterThan(0);
      expect(alphaAt(img, 5, 5)).toBe(255);
      expect(alphaAt(img, Math.floor(size / 2), Math.floor(size / 2))).toBe(255);
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
    const rounded = roundCorners(resizeBilinear(solidImage(128), 512, 512), radiusForSize(512));
    const png = encodePng(rounded);
    const decoded = decodePng(png);
    expect(decoded.width).toBe(512);
    expect(decoded.height).toBe(512);
    expect(alphaAt(decoded, 0, 0)).toBe(0);
    expect(alphaAt(decoded, 256, 256)).toBe(255);
  });

  it('ICO 容器装 6 个尺寸（16/32/48/64/128/256）', () => {
    const pngs = [16, 32, 48, 64, 128, 256].map((size) => ({
      size,
      png: encodePng(roundCorners(solidImage(Math.min(size, 64)), radiusForSize(size))),
    }));
    const ico = encodeIco(pngs);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(6);
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

  it('build/splash.bmp 已生成（本地构建产物存在时校验）', () => {
    const splash = join(ROOT, 'build/splash.bmp');
    if (!existsSync(splash)) return; // 全新 checkout 尚未构建时跳过（dist:win 会生成）
    const bmp = readFileSync(splash);
    expect(bmp.toString('ascii', 0, 2)).toBe('BM');
    expect(bmp.readUInt16LE(28)).toBe(24);
  });
});

describe('§F⑧ 源图标圆角守卫（防换回直角素材）', () => {
  it('src/main/icon.png 与渲染层 assets/icon.png 四角必须透明', () => {
    for (const rel of ['src/main/icon.png', 'src/renderer/src/assets/icon.png']) {
      const img = decodePng(readFileSync(join(ROOT, rel)));
      expect(alphaAt(img, 0, 0), `${rel} 左上角应为透明（圆角资源化）`).toBeLessThan(255);
      expect(alphaAt(img, img.width - 1, img.height - 1), `${rel} 右下角应为透明`).toBeLessThan(255);
      expect(
        alphaAt(img, Math.floor(img.width / 2), Math.floor(img.height / 2)),
        `${rel} 中心应不透明`
      ).toBe(255);
    }
  });
});
