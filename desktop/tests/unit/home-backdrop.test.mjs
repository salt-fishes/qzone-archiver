/**
 * v4.9 §I 首页动态背景静态守卫
 * 性能红线（计划 §I 验收）：不用 canvas、不用 setInterval 改样式、rAF 节流必须存在、
 * pointermove 必须 passive、reduced-motion 必须有降级分支、HomeView 已接入。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const COMPONENT = join(ROOT, 'src/renderer/src/components/home/HomeBackdrop.vue');
const HOME = join(ROOT, 'src/renderer/src/views/HomeView.vue');

describe('§I HomeBackdrop 静态守卫', () => {
  const code = readFileSync(COMPONENT, 'utf8');

  it('不用 canvas，不直接 setInterval 改样式', () => {
    expect(code).not.toMatch(/<canvas|createElement\('canvas'\)/);
    expect(code).not.toContain('setInterval');
  });

  it('rAF 节流存在（pointermove 高频事件一帧最多写一次 CSS 变量）', () => {
    expect(code).toContain('requestAnimationFrame');
    expect(code).toContain('cancelAnimationFrame');
    expect(code).toContain('--mx');
    expect(code).toContain('--my');
  });

  it('pointermove 监听必须 passive；pointerleave 回中', () => {
    expect(code).toMatch(/pointermove['"`]\s*,\s*onPointerMove\s*,\s*\{\s*passive:\s*true\s*\}/);
    expect(code).toContain('pointerleave');
    expect(code).toMatch(/setProperty\('--mx',\s*'0'\)/);
  });

  it('漂移只用 transform/opacity：@keyframes 存在且只动这两个属性', () => {
    const m = /@keyframes blob-drift \{([\s\S]*?)\n\}/.exec(code);
    expect(m, '未找到 blob-drift 关键帧').toBeTruthy();
    const body = m[1];
    expect(body).not.toMatch(/\b(width|height|top|left|margin|filter)\s*:/);
  });

  it('reduced-motion 降级 + document.hidden 暂停 + 深色模式降透明度', () => {
    expect(code).toContain('prefers-reduced-motion');
    expect(code).toContain('visibilitychange');
    expect(code).toContain('animation-play-state: paused');
    expect(code).toContain(':global(html.dark)');
  });
});

describe('§I HomeView 接入', () => {
  it('hero 内挂载 HomeBackdrop，色斑不溢出（overflow hidden）', () => {
    const code = readFileSync(HOME, 'utf8');
    expect(code).toContain('HomeBackdrop');
    expect(code).toMatch(/\.hero\s*\{[^}]*overflow:\s*hidden/);
  });
});
