<template>
  <div class="video-card">
    <!-- 网格形态（视频列表铺开）：小封面 + 标题 + 紧凑统计 -->
    <button
      v-if="variant === 'grid'"
      type="button"
      class="video-grid-card"
      @click="handleClick"
    >
      <span class="video-grid-thumb">
        <VideoCover
          v-if="index.hasCover"
          :src="coverSrc"
          :video-src="videoSrc"
          size="fill"
          placeholder-icon="▶"
          :alt="displayTitle"
        />
        <span v-else class="video-grid-thumb-empty">▶</span>
        <span v-if="!index.hasLocalVideo" class="video-grid-ext" title="外部视频无本地文件">外链</span>
      </span>
      <span class="video-grid-title" :title="displayTitle">{{ displayTitle }}</span>
      <span class="video-grid-stats">
        <span v-if="index.commentCount > 0" class="video-grid-stat">✎ {{ index.commentCount }}</span>
        <span v-if="index.likeCount > 0" class="video-grid-stat">♡ {{ index.likeCount }}</span>
      </span>
    </button>

    <!-- 列表形态（默认）：沿用 ArchiveEntry 整行卡片 -->
    <ArchiveEntry v-else :time="index.time" :clickable="clickable" @click="handleClick">
      <template #head>
        <span class="entry-type-tag">视频</span>
        <span
          v-if="!index.hasLocalVideo"
          class="entry-badge entry-badge-external"
          title="外部视频无本地文件"
        >外部</span>
      </template>

      <!-- 封面缩略图：黑帧封面自动用本地视频首帧替换；文件缺失显示占位符 -->
      <VideoCover
        v-if="index.hasCover"
        :src="coverSrc"
        :video-src="videoSrc"
        size="wide"
        placeholder-icon="▶"
        :alt="displayTitle"
      />

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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ArchiveEntry from '@/components/common/ArchiveEntry.vue'
import VideoCover from '@/components/common/VideoCover.vue'
import { stripFormatting, resolveModulePath } from '@/utils/formatContent'
import type { VideoIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: VideoIndex
  clickable?: boolean
  /** 形态：list=整行卡片（默认），grid=紧凑网格卡片 */
  variant?: 'list' | 'grid'
}>(), {
  clickable: true,
  variant: 'list'
})

const emit = defineEmits<{ open: [index: VideoIndex] }>()

const MODULE = 'Videos'

// 无标题时显示占位文案
const displayTitle = computed(() => props.index.title || '(无标题)')
// 摘要去格式化后展示
const displayDesc = computed(() => stripFormatting(props.index.desc || ''))

/** 封面图地址：本地路径优先（经 resolveModulePath 转换），远程 URL 原样返回 */
const coverSrc = computed(() => {
  if (!props.index.hasCover || !props.index.coverUrl) return ''
  return resolveModulePath(props.index.coverUrl, MODULE)
})

/** 本地视频文件地址：用于黑封面时提取首帧替换 */
const videoSrc = computed(() => {
  if (!props.index.videoSrc) return ''
  return resolveModulePath(props.index.videoSrc, MODULE)
})

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

/* ============ 网格形态 ============ */
.video-grid-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.video-grid-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--paper-2);
  border: var(--line);
  transition: border-color 0.15s;
}

.video-grid-thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--ink-3);
  font-size: 1.2rem;
  opacity: 0.5;
}

/* 外链角标：覆盖在封面右上角 */
.video-grid-ext {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  color: #b8860b;
  background: rgba(242, 239, 231, 0.85);
  border: 1px solid #b8860b;
  padding: 0 5px;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  line-height: 1.4;
}

.video-grid-title {
  font-family: var(--font-serif-cn);
  font-size: 0.85rem;
  color: var(--ink);
  line-height: 1.4;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color 0.15s;
}

.video-grid-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 1em;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--ink-3);
}

.video-grid-card:hover .video-grid-thumb {
  border-color: var(--vermilion);
}

.video-grid-card:hover .video-grid-title {
  color: var(--vermilion);
}
</style>
