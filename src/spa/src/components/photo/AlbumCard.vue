<template>
  <ArchiveEntry :time="index.createTime" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-type-tag">相册</span>
    </template>

    <!-- 封面缩略图 -->
    <img
      v-if="index.hasCover && coverSrc"
      :src="coverSrc"
      class="album-cover"
      :alt="index.name || '相册封面'"
      loading="lazy"
    />

    <!-- 相册名 -->
    <p class="entry-text" :class="{ 'entry-text-empty': !index.name }">{{ displayName }}</p>

    <!-- 摘要（支持 2 行截断） -->
    <p v-if="displayDesc" class="entry-abstract">{{ displayDesc }}</p>

    <template #stats>
      <span v-if="index.className" class="entry-stat active" title="分类">
        <span class="entry-stat-icon">▣</span>
        <span class="entry-stat-num">{{ index.className }}</span>
      </span>
      <span v-if="index.photoCount > 0" class="entry-stat active" title="照片数量">
        <span class="entry-stat-icon">▤</span>
        <span class="entry-stat-num">照片 {{ index.photoCount }}</span>
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
import { stripFormatting, resolveModulePath } from '@/utils/formatContent'
import type { AlbumIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: AlbumIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: AlbumIndex] }>()

const MODULE = 'Albums'

// 无名称时显示占位文案
const displayName = computed(() => props.index.name || '(未命名相册)')
// 摘要去格式化后展示
const displayDesc = computed(() => stripFormatting(props.index.desc || ''))

/** 封面图地址：coverUrl 为相对 Albums/ 模块根的路径，经 resolveModulePath 转换 */
const coverSrc = computed(() => {
  if (!props.index.hasCover || !props.index.coverUrl) return ''
  return resolveModulePath(props.index.coverUrl, MODULE)
})

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>

<style scoped>
/* Photo 模块的类型标签用深色背景（与 Video 保持一致） */
.archive-entry :deep(.entry-type-tag) {
  color: var(--paper);
  background: var(--ink-2);
  border-color: var(--ink);
  padding: 1px 8px;
}

/* 相册封面缩略图：限制高度，object-fit 裁剪 */
.album-cover {
  display: block;
  width: 100%;
  max-height: 120px;
  object-fit: cover;
  border: var(--line);
  margin-bottom: var(--sp-2);
}
</style>
