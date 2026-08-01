<template>
  <ArchiveEntry :time="index.createTime" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-type-tag">相册</span>
    </template>

    <!-- 封面缩略图：文件缺失时显示占位符，避免 broken image 影响虚拟滚动高度 -->
    <img
      v-if="index.hasCover && coverSrc && !coverError"
      :src="coverSrc"
      class="album-cover"
      :alt="index.name || '相册封面'"
      loading="lazy"
      @error="coverError = true"
    />
    <div v-else class="album-cover album-cover-placeholder">
      <span class="album-cover-icon">▣</span>
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

/** 封面图加载失败标志：文件缺失或路径错误时显示占位符 */
const coverError = ref(false)
watch(coverSrc, () => { coverError.value = false })

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

/* 相册封面缩略图：固定高度预留空间，避免图片异步加载导致高度变化
   造成 vue-virtual-scroller 的 DynamicScrollerItem 定位错乱重叠 */
.album-cover {
  display: block;
  width: 100%;
  height: 120px;
  object-fit: cover;
  border: var(--line);
  margin-bottom: var(--sp-2);
}

/* 封面图缺失时的占位符：保持相同高度，避免虚拟滚动抖动 */
.album-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper-2);
  border: var(--line-dot);
}

.album-cover-icon {
  font-size: 2rem;
  color: var(--ink-3);
  opacity: 0.5;
}
</style>
