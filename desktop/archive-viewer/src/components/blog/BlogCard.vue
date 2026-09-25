<template>
  <ArchiveEntry :time="index.time" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-type-tag">日志</span>
      <span
        v-if="index.category"
        class="entry-badge entry-badge-category"
        :title="`分类：${index.category}`"
      >{{ index.category }}</span>
    </template>

    <!-- 标题 -->
    <p class="entry-text" :class="{ 'entry-text-empty': !index.title }">{{ displayTitle }}</p>

    <!-- 摘要（支持 2 行截断） -->
    <p v-if="displayDesc" class="entry-abstract">{{ displayDesc }}</p>

    <template #stats>
      <span v-if="index.hasContent" class="entry-stat active" title="含正文">
        <span class="entry-stat-icon">¶</span>
        <span class="entry-stat-num">正文</span>
      </span>
      <span v-if="index.hasImages" class="entry-stat active" title="含配图">
        <span class="entry-stat-icon">▣</span>
        <span class="entry-stat-num">配图</span>
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
import type { BlogIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: BlogIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: BlogIndex] }>()

// 无标题时显示占位文案
const displayTitle = computed(() => props.index.title || '(无标题)')
// 摘要去格式化后展示
const displayDesc = computed(() => stripFormatting(props.index.desc || ''))

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>

<style scoped>
/* Blog 模块的类型标签：朱砂色填充，区别于视频的深色填充 */
.archive-entry :deep(.entry-type-tag) {
  color: var(--paper);
  background: var(--vermilion);
  border-color: var(--vermilion);
  padding: 1px 8px;
}

/* 分类徽章：墨色细边，超长截断 */
.archive-entry :deep(.entry-badge-category) {
  color: var(--ink-2);
  border-color: var(--ink-3);
  background: rgba(43, 74, 111, 0.04);
  max-width: 14em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
