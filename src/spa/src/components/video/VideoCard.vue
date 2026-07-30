<template>
  <ArchiveEntry :time="index.time" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-type-tag">视频</span>
      <span
        v-if="!index.hasLocalVideo"
        class="entry-badge entry-badge-external"
        title="外部视频无本地文件"
      >外部</span>
    </template>

    <!-- 标题 -->
    <p class="entry-text" :class="{ 'entry-text-empty': !index.title }">{{ displayTitle }}</p>

    <!-- 摘要（支持 2 行截断） -->
    <p v-if="displayDesc" class="entry-abstract">{{ displayDesc }}</p>

    <template #stats>
      <span v-if="index.hasCover" class="entry-stat active" title="含封面图">
        <span class="entry-stat-icon">▣</span>
        <span class="entry-stat-num">封面</span>
      </span>
      <span v-if="index.commentCount > 0" class="entry-stat active" title="评论数量">
        <span class="entry-stat-icon">✎</span>
        <span class="entry-stat-num">评论 {{ index.commentCount }}</span>
      </span>
      <span v-if="index.likeCount > 0" class="entry-stat active" title="点赞数量">
        <span class="entry-stat-icon">♡</span>
        <span class="entry-stat-num">赞 {{ index.likeCount }}</span>
      </span>
      <span v-if="clickable" class="entry-stat entry-stat-cta">
        查看详情 →
      </span>
    </template>
  </ArchiveEntry>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ArchiveEntry from '@/components/common/ArchiveEntry.vue'
import { stripFormatting } from '@/utils/formatContent'
import type { VideoIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: VideoIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: VideoIndex] }>()

// 无标题时显示占位文案
const displayTitle = computed(() => props.index.title || '(无标题)')
// 摘要去格式化后展示
const displayDesc = computed(() => stripFormatting(props.index.desc || ''))

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>

<style scoped>
/* Video 模块的类型标签用深色背景（与 Share 保持一致） */
.archive-entry :deep(.entry-type-tag) {
  color: var(--paper);
  background: var(--ink-2);
  border-color: var(--ink);
  padding: 1px 8px;
}

/* 外部视频警告徽章：琥珀色 */
.archive-entry :deep(.entry-badge-external) {
  color: #b8860b;
  border-color: #b8860b;
  background: rgba(184, 134, 11, 0.1);
}
</style>
