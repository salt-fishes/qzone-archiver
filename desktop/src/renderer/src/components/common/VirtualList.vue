<script setup lang="ts" generic="T">
/**
 * 定高虚拟列表（v4.7 P1）
 * 背景：下载明细在 1 万条媒体规模下用 v-for 全量渲染会把界面拖垮，
 * 项目未引入虚拟滚动依赖，这里用最小实现：只渲染可视区 + 上下缓冲。
 * 约定：每项等高（itemHeight），由 slot 负责渲染整行。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    items: T[];
    itemHeight?: number;
    buffer?: number;
  }>(),
  { itemHeight: 34, buffer: 6 }
);

const viewport = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportHeight = ref(0);
let ro: ResizeObserver | null = null;

function measure() {
  viewportHeight.value = viewport.value?.clientHeight || 0;
}

onMounted(() => {
  if (!viewport.value) return;
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure);
    ro.observe(viewport.value);
  } else {
    window.addEventListener('resize', measure);
  }
});

onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;
});

function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLElement).scrollTop;
}

const total = computed(() => props.items.length);
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.buffer)
);
const endIndex = computed(() =>
  Math.min(
    total.value,
    Math.ceil((scrollTop.value + viewportHeight.value) / props.itemHeight) + props.buffer
  )
);
const visible = computed(() =>
  props.items.slice(startIndex.value, endIndex.value).map((item, i) => ({
    item,
    index: startIndex.value + i,
  }))
);
const offsetY = computed(() => startIndex.value * props.itemHeight);
const spacerHeight = computed(() => total.value * props.itemHeight);
</script>

<template>
  <div
    ref="viewport"
    class="vlist"
    @scroll.passive="onScroll"
  >
    <div
      class="vlist-spacer"
      :style="{ height: spacerHeight + 'px' }"
    >
      <div
        class="vlist-window"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="row in visible"
          :key="row.index"
          class="vlist-item"
          :style="{ height: itemHeight + 'px' }"
        >
          <slot
            :item="row.item"
            :index="row.index"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vlist {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}
.vlist-spacer {
  position: relative;
  width: 100%;
}
.vlist-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}
.vlist-item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
}
</style>
