<template>
  <ArchiveEntry :time="index.time" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-type-tag" :title="`收藏类型：${index.typeLabel}`">{{ index.typeLabel }}</span>
      <span v-if="index.ownerName" class="entry-owner" :title="`源作者：${index.ownerName}`">
        <span class="entry-owner-label">@</span>{{ displayOwner }}
      </span>
    </template>

    <!-- 标题（优先展示 title，其次展示摘要首行） -->
    <p v-if="index.title" class="entry-text" :title="stripTitle">{{ displayTitle }}</p>
    <p v-else-if="index.abstract" class="entry-text entry-abstract" :title="stripAbstract">
      {{ displayAbstract }}
    </p>
    <p v-else class="entry-text entry-text-empty">（无标题）</p>

    <!-- 配图缩略图预览（最多 4 张） -->
    <EntryThumbs
      v-if="index.thumbs?.length"
      :thumbs="index.thumbs"
      module="Favorites"
      :total="index.imageCount"
    />

    <template #stats>
      <span v-if="index.imageCount > 0" class="entry-stat active" title="配图数量">
        <span class="entry-stat-icon">▣</span>
        <span class="entry-stat-num">图 {{ index.imageCount }}</span>
      </span>
      <span v-if="index.videoCount > 0" class="entry-stat active" title="视频数量">
        <span class="entry-stat-icon">▶</span>
        <span class="entry-stat-num">视频 {{ index.videoCount }}</span>
      </span>
      <span v-if="index.audioCount > 0" class="entry-stat active" title="音频数量">
        <span class="entry-stat-icon">♪</span>
        <span class="entry-stat-num">音频 {{ index.audioCount }}</span>
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
import EntryThumbs from '@/components/common/EntryThumbs.vue'
import { stripFormatting } from '@/utils/formatContent'
import type { FavoriteIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: FavoriteIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: FavoriteIndex] }>()

const displayTitle = computed(() => stripFormatting(props.index.title || ''))
const stripTitle = computed(() => stripFormatting(props.index.title || ''))
const displayAbstract = computed(() => stripFormatting(props.index.abstract || ''))
const stripAbstract = computed(() => stripFormatting(props.index.abstract || ''))
const displayOwner = computed(() => stripFormatting(props.index.ownerName || ''))

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>

<style scoped>
/* Favorite 模块的类型标签采用深色背景样式（区别于其他模块的描边样式） */
.archive-entry :deep(.entry-type-tag) {
  color: var(--paper);
  background: var(--ink-2);
  border-color: var(--ink);
  padding: 1px 8px;
}

.archive-entry :deep(.entry-owner) {
  font-family: var(--font-serif-cn);
  font-size: 0.8rem;
  color: var(--ink-3);
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
}

.archive-entry :deep(.entry-text-abstract) {
  font-size: 0.9rem;
  color: var(--ink-2);
  font-style: italic;
}
</style>
