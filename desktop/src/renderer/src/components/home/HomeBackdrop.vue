<script setup lang="ts">
/**
 * §I：首页 hero 动态背景（反馈 #10）——只作用于首页主视觉，不铺满整个应用
 *
 *  - 4 个高斯模糊色斑（品牌暖陶 ×2 + 冷色对比 + 高光），20~40s 缓慢漂移（@keyframes）
 *  - 鼠标轻微互动：pointermove（passive）→ rAF 节流写 CSS 变量 --mx/--my（-1..1）→
 *    外层位移 ≤10px 视差；移出回中（transition 缓动，不做跟随光斑）
 *  - 只动 transform/opacity（无 canvas、无布局抖动）；document.hidden 暂停动画
 *  - prefers-reduced-motion → 完全静态（不绑事件、动画关闭）
 *  - 深色模式整体降透明度（:global(html.dark)）
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';

const el = ref<HTMLElement | null>(null);

const reducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let rafId = 0;
let pending: { x: number; y: number } | null = null;

function applyPointer() {
  rafId = 0;
  const node = el.value;
  const p = pending;
  pending = null;
  if (!node || !p) return;
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const mx = ((p.x - rect.left) / rect.width) * 2 - 1; // -1..1
  const my = ((p.y - rect.top) / rect.height) * 2 - 1;
  node.style.setProperty('--mx', mx.toFixed(3));
  node.style.setProperty('--my', my.toFixed(3));
}

/** rAF 节流：一帧最多写一次 CSS 变量（事件高频也不抖） */
function onPointerMove(e: PointerEvent) {
  pending = { x: e.clientX, y: e.clientY };
  if (!rafId) rafId = requestAnimationFrame(applyPointer);
}

function onPointerLeave() {
  pending = null;
  const node = el.value;
  if (!node) return;
  node.style.setProperty('--mx', '0');
  node.style.setProperty('--my', '0');
}

/** 页面不可见暂停漂移动画（CPU 让位；恢复可见继续） */
function onVisibility() {
  const node = el.value;
  if (!node) return;
  node.classList.toggle('is-paused', document.hidden);
}

onMounted(() => {
  const node = el.value;
  if (!node || reducedMotion) return;
  // v5.0 修复：背景层是 pointer-events:none 的纯装饰，自己永远收不到鼠标事件——
  // 监听挂在宿主容器（hero）上，色斑照样能动
  const host = node.parentElement || node;
  host.addEventListener('pointermove', onPointerMove, { passive: true });
  host.addEventListener('pointerleave', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibility);
});

onBeforeUnmount(() => {
  const node = el.value;
  if (node) {
    const host = node.parentElement || node;
    host.removeEventListener('pointermove', onPointerMove);
    host.removeEventListener('pointerleave', onPointerLeave);
  }
  document.removeEventListener('visibilitychange', onVisibility);
  if (rafId) cancelAnimationFrame(rafId);
});
</script>

<template>
  <div
    ref="el"
    class="home-backdrop"
    :class="{ 'is-static': reducedMotion }"
    aria-hidden="true"
  >
    <span
      class="blob-wrap"
      style="--px: 16px; --dur: 26s; --dx: -6%; --dy: -10%"
    >
      <span class="blob blob-a" />
    </span>
    <span
      class="blob-wrap"
      style="--px: -13px; --dur: 34s; --dx: 30%; --dy: 6%"
    >
      <span class="blob blob-b" />
    </span>
    <span
      class="blob-wrap"
      style="--px: 10px; --dur: 40s; --dx: -24%; --dy: 24%"
    >
      <span class="blob blob-c" />
    </span>
    <span
      class="blob-wrap"
      style="--px: -8px; --dur: 22s; --dx: 16%; --dy: -22%"
    >
      <span class="blob blob-d" />
    </span>
  </div>
</template>

<style scoped>
.home-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none; /* 纯装饰：不挡 hero 内任何交互 */
  z-index: 0;
}
.blob-wrap {
  position: absolute;
  /* 视差：外层吃 --mx/--my（JS rAF 写入，-1..1）× 各自位移幅度 --px；移出回中靠 transition 缓动 */
  left: calc(50% + var(--dx, 0%));
  top: calc(50% + var(--dy, 0%));
  transform: translate3d(calc(var(--mx, 0) * var(--px, 0px)), calc(var(--my, 0) * var(--py, var(--px, 0px))), 0);
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
.blob {
  display: block;
  width: 300px;
  height: 300px;
  margin: -150px 0 0 -150px; /* 以 wrap 锚点为圆心 */
  border-radius: 50%;
  filter: blur(52px);
  opacity: 0.3;
  animation: blob-drift var(--dur, 30s) ease-in-out infinite alternate;
}
.blob-a {
  background: #b45f3d; /* 品牌暖陶 */
}
.blob-b {
  width: 340px;
  height: 340px;
  background: #d98e4a; /* 暖橙 */
  opacity: 0.22;
}
.blob-c {
  width: 280px;
  height: 280px;
  background: #5b7fa6; /* 冷色对比 */
  opacity: 0.16;
}
.blob-d {
  width: 220px;
  height: 220px;
  background: #e8b04b; /* 高光 */
  opacity: 0.18;
}
@keyframes blob-drift {
  0% {
    transform: translate3d(-4%, -2%, 0) scale(1) rotate(0deg);
  }
  50% {
    transform: translate3d(3%, 4%, 0) scale(1.08) rotate(6deg);
  }
  100% {
    transform: translate3d(5%, -3%, 0) scale(0.96) rotate(-4deg);
  }
}
/* 页面不可见：暂停漂移（保留当前帧） */
.home-backdrop.is-paused .blob {
  animation-play-state: paused;
}
/* 减少动态效果：完全静态（色斑仍在，作为渐变装饰） */
.home-backdrop.is-static .blob {
  animation: none;
}
/* 深色模式：整体降透明度，避免暗环境刺眼/过亮 */
:global(html.dark) .home-backdrop .blob {
  opacity: 0.14;
}
</style>
