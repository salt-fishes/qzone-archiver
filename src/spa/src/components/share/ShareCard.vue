<template>
  <ArchiveEntry :time="index.time" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-type-tag" :title="`分享类型：${index.typeLabel}`">{{ index.typeLabel }}</span>
      <span v-if="index.nickname" class="entry-owner" :title="`分享人：${index.nickname}`">
        <span class="entry-owner-label">@</span>{{ displayNickname }}
      </span>
    </template>

    <!-- 描述 -->
    <p v-if="index.desc" class="entry-text" :title="index.desc">{{ displayDesc }}</p>
    <p v-else-if="index.sourceTitle" class="entry-text entry-text-empty" :title="index.sourceTitle">
      {{ displaySourceTitle }}
    </p>
    <p v-else class="entry-text entry-text-empty">（无描述）</p>

    <!-- 来源配图缩略图预览（最多 4 张） -->
    <EntryThumbs
      v-if="index.sourceThumbs?.length"
      :thumbs="index.sourceThumbs"
      module="Shares"
      :total="index.sourceImageCount"
    />

    <!-- 来源信息 -->
    <div v-if="index.sourceTitle || index.sourceFromName" class="entry-source">
      <span class="entry-source-label">来源</span>
      <span v-if="index.sourceFromName" class="entry-source-from">{{ index.sourceFromName }}</span>
      <span v-if="index.sourceCount > 0" class="entry-source-count">· 分享 {{ index.sourceCount }} 次</span>
    </div>

    <template #stats>
      <span v-if="index.sourceImageCount > 0" class="entry-stat active" title="配图数量">
        <span class="entry-stat-icon">▣</span>
        <span class="entry-stat-num">图 {{ index.sourceImageCount }}</span>
      </span>
      <span v-if="index.commentCount > 0" class="entry-stat active" title="评论数量">
        <span class="entry-stat-icon">✎</span>
        <span class="entry-stat-num">评论 {{ index.commentCount }}</span>
      </span>
      <span v-if="index.likeCount > 0" class="entry-stat active" title="点赞数量">
        <span class="entry-stat-icon">♡</span>
        <span class="entry-stat-num">赞 {{ index.likeCount }}</span>
      </span>
      <span v-if="index.visitorCount > 0" class="entry-stat" title="访问数量">
        <span class="entry-stat-icon">◉</span>
        <span class="entry-stat-num">访 {{ index.visitorCount }}</span>
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
import type { ShareIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: ShareIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: ShareIndex] }>()

const displayDesc = computed(() => stripFormatting(props.index.desc || ''))
const displaySourceTitle = computed(() => stripFormatting(props.index.sourceTitle || ''))
const displayNickname = computed(() => stripFormatting(props.index.nickname || ''))

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>

<style scoped>
/* Share 模块的类型标签也用深色背景（与 Favorite 保持一致） */
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

/* 来源信息中的「分享 N 次」用浅色 */
.archive-entry :deep(.entry-source-count) {
  color: var(--ink-3);
}
</style>
