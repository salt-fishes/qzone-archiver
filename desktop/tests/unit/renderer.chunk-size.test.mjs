/**
 * v5.1 P3 渲染层体积守卫（R3 拆包后的防反弹断言）
 *
 * 基线（2026-09-25 拆包后实测，未压缩字节）：
 *   index（首屏业务 chunk）   112.86 KB  ← 目标 < 500 KB（vite 警告线）
 *   vendor-vue               109.07 KB  ← vue/@vue/vue-router/pinia 必须同 chunk（循环引用）
 *   vendor-motion-v          130.64 KB  ← motion-v + framer-motion/motion-dom 同组（循环引用）
 *   vendor-misc               34.51 KB
 *   vendor-naive-ui          668.38 KB  ← naive-ui 全量引入的体积，暂不强制拆分
 *
 * 拆包前主 chunk 为 1,047 KB（v4.9 实测 1,035 KB + v5.0 增量）；本守卫锁的是拆包后的形态。
 * 产物由 `npm run build:renderer` 生成（dist 不入库），缺失时显式跳过并打印原因。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ASSETS = join(ROOT, 'src/renderer/dist/assets');

/** 体积上限（KB，未压缩）——vendor 各组为「基线 + 少量余量」，防悄悄反弹 */
const LIMITS = {
  index: 500, // v5.1 P0 目标线
  'vendor-vue': 150,
  'vendor-motion-v': 170,
  'vendor-misc': 60,
  'vendor-naive-ui': 700,
};

function chunkSize(prefix) {
  const file = readdirSync(ASSETS).find((f) => f.startsWith(`${prefix}-`) && f.endsWith('.js'));
  if (!file) return null;
  return readFileSync(join(ASSETS, file)).length;
}

describe('v5.1 P3 渲染层 chunk 体积守卫', () => {
  const distReady = existsSync(ASSETS);

  it.skipIf(!distReady)('主业务 chunk < 500 KB（R3 拆包目标）', () => {
    const size = chunkSize('index');
    expect(size, '未找到 index-*.js——构建产物异常').not.toBeNull();
    expect(size).toBeLessThan(LIMITS.index * 1024);
  });

  it.skipIf(!distReady)('vendor 分包各组不超上限（防反弹）', () => {
    for (const [prefix, limit] of Object.entries(LIMITS)) {
      if (prefix === 'index') continue;
      const size = chunkSize(prefix);
      expect(size, `缺少 ${prefix} 分包——manualChunks 分组被破坏`).not.toBeNull();
      expect(size, `${prefix} 超过 ${limit} KB 上限`).toBeLessThan(limit * 1024);
    }
  });

  it('产物缺失时打印跳过原因（不静默）', () => {
    if (!distReady) {
      console.warn('[chunk-size] src/renderer/dist/assets 不存在——先跑 npm run build:renderer');
    }
    expect(true).toBe(true);
  });
});
