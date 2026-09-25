<template>
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
</template>

<script setup lang="ts">
// 阅读密度切换（§4.2）：流式 / 网格；分段头与当前卷指示条共用
import { useDensity } from '@/composables/useDensity'

defineProps<{ gridAvailable?: boolean }>()

const { density, set } = useDensity()
</script>

<style scoped>
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
