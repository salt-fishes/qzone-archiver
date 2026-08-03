<template>
  <ArchiveEntry :time="index.createTime" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-type-tag">相册</span>
    </template>

    <!-- 多照片预览网格：按需加载相册前 4 张；加载中/无数据时显示占位格，单张不再拉伸 -->
    <div v-if="previews.length" class="album-grid" :class="`album-grid-${previews.length}`">
      <span v-for="(p, i) in previews" :key="i" class="album-grid-cell-wrap">
        <img
          v-if="!photoErrors[i]"
          :src="p"
          class="album-grid-cell"
          :alt="index.name || '相册照片'"
          loading="lazy"
          decoding="async"
          @error="photoErrors[i] = true"
        />
        <span v-else class="album-grid-cell album-grid-cell-fallback">▣</span>
      </span>
    </div>
    <div v-else class="album-grid album-grid-4">
      <span v-for="n in 4" :key="n" class="album-grid-cell album-grid-cell-ph"></span>
    </div>

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
import { computed, ref, watch } from 'vue'
import ArchiveEntry from '@/components/common/ArchiveEntry.vue'
import { usePhotosStore } from '@/stores/photos'
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
const photosStore = usePhotosStore()

// 无名称时显示占位文案
const displayName = computed(() => props.index.name || '(未命名相册)')
// 摘要去格式化后展示
const displayDesc = computed(() => stripFormatting(props.index.desc || ''))

/** 封面图地址（仅作为相册详情加载失败时的回退） */
const coverSrc = computed(() => {
  if (!props.index.hasCover || !props.index.coverUrl) return ''
  return resolveModulePath(props.index.coverUrl, MODULE)
})

/** 多照片预览（前 4 张，正方形网格展示） */
const previews = ref<string[]>([])
const photoErrors = ref<boolean[]>([])

// 相册切换时按需加载详情取前 4 张；详情缺失时回退单张封面
let reqId = 0
watch(() => props.index.albumId, async (id) => {
  const cur = ++reqId
  previews.value = []
  photoErrors.value = []
  if (!id) return
  const album = await photosStore.getAlbumById(String(id))
  if (cur !== reqId) return // 快速滚动时丢弃过期结果
  const list = album?.photoList || []
  if (list.length) {
    previews.value = list.slice(0, 4).map(p => {
      const raw = p.custom_filepath || p.s_url || p.t_url || p.custom_url || ''
      return raw ? resolveModulePath(raw, MODULE) : ''
    }).filter(Boolean)
  } else if (props.index.hasCover && coverSrc.value) {
    previews.value = [coverSrc.value]
  }
}, { immediate: true })

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

/* 多照片预览网格：固定行高，避免虚拟滚动高度抖动 */
.album-grid {
  display: grid;
  gap: 4px;
  margin-bottom: var(--sp-2);
}

.album-grid-4 { grid-template-columns: repeat(4, 1fr); }
.album-grid-3 { grid-template-columns: repeat(3, minmax(0, 96px)); }
.album-grid-2 { grid-template-columns: repeat(2, minmax(0, 96px)); }
.album-grid-1 { grid-template-columns: repeat(1, minmax(0, 96px)); }

.album-grid-cell-wrap {
  display: block;
  aspect-ratio: 1;
  min-width: 0;
}

.album-grid-cell {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border: var(--line);
  background: var(--paper-2);
  overflow: hidden;
  transition: transform 0.25s var(--ease-out), border-color 0.2s;
}

.album-grid-cell-wrap:hover .album-grid-cell {
  transform: scale(1.04);
  border-color: var(--vermilion);
}

/* 加载失败/加载中的占位格 */
.album-grid-cell-fallback,
.album-grid-cell-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper-2);
  border: var(--line-dot);
  color: var(--ink-3);
  font-size: 1.1rem;
}
</style>
