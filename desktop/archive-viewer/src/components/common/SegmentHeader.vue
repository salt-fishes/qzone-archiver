<template>
  <div class="seg-head">
    <span class="seg-mark">▸</span>
    <h3 class="seg-title">{{ seg.label }}</h3>
    <span class="seg-count">{{ seg.count }} 条</span>
    <span class="seg-flex"></span>
    <div class="seg-density" role="group" aria-label="阅读密度">
      <button
        type="button"
        class="seg-density-btn"
        :class="{ active: density === 'stream' }"
        :disabled="!gridAvailable"
        @click="set('stream')"
      >流式</button>
      <span class="seg-density-sep">／</span>
      <button
        type="button"
        class="seg-density-btn"
        :class="{ active: density === 'grid' }"
        :disabled="!gridAvailable"
        @click="set('grid')"
      >网格</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDensity } from '@/composables/useDensity'
import { yearLabel } from '@/utils/yearLabel'

/** 分段头（§4.1）：sticky 悬停于报头之下；右侧密度切换 */
defineProps<{
  seg: { id: string; label: string; count: number }
  /** 该列表是否支持网格密度（超长列表回退流式时置 false） */
  gridAvailable?: boolean
}>()

const { density, set } = useDensity()
</script>

<style scoped>
.seg-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  position: sticky;
  top: 0;
  z-index: 5;
  padding: var(--sp-1) var(--sp-2);
  background: var(--paper-raised);
  border-bottom: var(--line-1);
}

.seg-mark {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--vermilion);
}

.seg-title {
  font-family: var(--font-serif-cn);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.4;
}

.seg-count {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--ink-muted);
  letter-spacing: 0.05em;
}

.seg-flex { flex: 1; }

.seg-density {
  display: flex;
  align-items: center;
  gap: 2px;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--ink-muted);
}

.seg-density-btn {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  background: transparent;
  border: none;
  color: var(--ink-muted);
  cursor: pointer;
  padding: 2px 4px;
  transition: color var(--dur-1) var(--ease-out);
}

.seg-density-btn:hover:not(:disabled) { color: var(--vermilion); }

.seg-density-btn.active {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--vermilion);
}

.seg-density-btn:disabled { cursor: default; opacity: 0.5; }
</style>
