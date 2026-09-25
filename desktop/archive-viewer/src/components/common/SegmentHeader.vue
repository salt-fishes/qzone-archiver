<template>
  <div class="seg-head">
    <span class="seg-mark">▸</span>
    <h3 class="seg-title">{{ seg.label }}</h3>
    <span class="seg-count">{{ seg.count }} 条</span>
    <span class="seg-flex"></span>
    <DensityToggle :grid-available="gridAvailable" />
  </div>
</template>

<script setup lang="ts">
import DensityToggle from './DensityToggle.vue'

/** 分段头（§4.1）：网格密度下 sticky 悬停；流式下为分组分隔行
 *  （当前卷由 VirtualList 的常驻指示条负责） */
defineProps<{
  seg: { id: string; label: string; count: number }
  /** 该列表是否支持网格密度（超长列表回退流式时置 false） */
  gridAvailable?: boolean
}>()
</script>

<style scoped>
.seg-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-1) var(--sp-2);
  background: var(--paper-raised);
  border-bottom: var(--line-1);
}

/* 网格（非虚拟）模式下分段头 sticky 悬停于报头之下；
   流式（虚拟滚动）行由 transform 定位，sticky 不生效，由常驻指示条接管 */
:global(.vl-grid) .seg-head {
  position: sticky;
  top: 0;
  z-index: 5;
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
</style>
