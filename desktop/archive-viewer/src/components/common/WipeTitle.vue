<template>
  <span ref="rootRef" class="wipe-title">
    <span ref="textRef" class="wipe-text"><slot /></span>
    <span ref="blockRef" class="wipe-block" aria-hidden="true"></span>
  </span>
</template>

<script setup lang="ts">
// 朱砂扫版（§3.1①，标题级）：色块沿文字区域左→右扫过，
// 扫过处文字自墨后显影（opacity 0→1 + 8px 上移）。
// 时长/缓动一律取自动效令牌（useMotion），reduced-motion 直切。
import { onMounted, ref } from 'vue'
import { animate } from 'animejs'
import { useMotion } from '@/composables/useMotion'

const rootRef = ref<HTMLElement | null>(null)
const textRef = ref<HTMLElement | null>(null)
const blockRef = ref<HTMLElement | null>(null)

const { reduced, dur, ease } = useMotion()

onMounted(() => {
  const text = textRef.value
  const block = blockRef.value
  if (!text || !block) return
  if (reduced.value) return // CSS 已显示原文，直切
  if (rootRef.value && rootRef.value.closest('[data-wipe-skip]')) return

  const sweep = dur('dur-4')
  const land = dur('dur-3')
  const retreat = dur('dur-2')

  animate(block, {
    scaleX: [0, 1],
    duration: sweep,
    ease: ease('sweep'),
    onComplete: () => {
      block.style.transformOrigin = 'right center'
      animate(block, { scaleX: [1, 0], duration: retreat, ease: ease('sweep') })
    },
  })
  animate(text, {
    opacity: [0, 1],
    translateY: [8, 0],
    duration: land,
    delay: sweep * 0.45,
    ease: ease('out'),
  })
})
</script>

<style scoped>
.wipe-title {
  position: relative;
  display: inline-block;
}

.wipe-text {
  display: inline-block;
  will-change: transform, opacity;
}

.wipe-block {
  position: absolute;
  inset: -4% -2%;
  background: var(--vermilion);
  transform: scaleX(0);
  transform-origin: left center;
  pointer-events: none;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  .wipe-block { display: none; }
}
</style>
