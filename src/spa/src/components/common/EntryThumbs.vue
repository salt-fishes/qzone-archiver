<template>
  <div v-if="items.length" class="entry-thumbs">
    <span
      v-for="(t, i) in items"
      :key="i"
      class="entry-thumb"
      :class="{ 'entry-thumb-error': errors[i] }"
      :title="t.caption"
    >
      <img
        v-if="!errors[i]"
        :src="t.src"
        loading="lazy"
        decoding="async"
        :alt="t.caption || ''"
        @error="errors[i] = true"
      />
      <span v-else class="thumb-placeholder">▣</span>
    </span>
    <span v-if="extra > 0" class="thumb-more">+{{ extra }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveModulePath } from '@/utils/formatContent'

/**
 * 列表条目缩略图横排组件
 *
 * 各模块 Card（说说/分享/收藏等）在列表里预览配图用：
 * 每张图 resolveModulePath 后以固定小方块展示，加载失败回退占位符，
 * 超过 max 张数时显示「+N」余量。用于替代纯文本的 ▣ 计数。
 */
const props = withDefaults(defineProps<{
  /** 缩略图地址数组（相对模块根路径或远程 URL） */
  thumbs: string[]
  /** 所属模块名（如 'Messages'，用于 resolveModulePath） */
  module: string
  /** 最多展示张数 */
  max?: number
  /** 图片总数（超过 max 时显示 +N；缺省用 thumbs.length） */
  total?: number
}>(), {
  max: 4
})

const errors = ref<boolean[]>([])

watch(() => props.thumbs, () => {
  errors.value = []
}, { immediate: true })

const items = computed(() =>
  props.thumbs.slice(0, props.max).map((raw, i) => ({
    src: resolveModulePath(raw, props.module),
    caption: (props.total ?? props.thumbs.length) > props.max && i === Math.min(props.max, props.thumbs.length) - 1
      ? `共 ${props.total ?? props.thumbs.length} 张`
      : ''
  }))
)

const extra = computed(() => {
  const total = props.total ?? props.thumbs.length
  return total > props.max ? total - props.max : 0
})
</script>

<style scoped>
.entry-thumbs {
  display: flex;
  gap: 4px;
  margin-bottom: var(--sp-2);
  align-items: center;
  flex-wrap: wrap;
}

.entry-thumb {
  display: block;
  width: 56px;
  height: 56px;
  border: var(--line);
  background: var(--paper-2);
  overflow: hidden;
  flex-shrink: 0;
}

.entry-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--ink-3);
  font-size: 0.9rem;
}

.thumb-more {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-3);
  margin-left: 4px;
}

@media (max-width: 600px) {
  .entry-thumb {
    width: 48px;
    height: 48px;
  }
}
</style>
