<template>
  <ArchiveEntry :time="index.time" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-num">№ {{ index.tid }}</span>
      <span v-if="stampText" class="entry-stamp-tag">{{ stampText }}</span>
    </template>

    <!-- 标题/内容预览（[em] 表情代码替换为「[表情]」占位，避免字面文本暴露） -->
    <p class="entry-text" :title="displayTitle">{{ displayTitle || '（无标题）' }}</p>

    <!-- 缩略图预览（最多 4 张，本地/远程自动解析，失败回退占位符） -->
    <EntryThumbs
      v-if="index.thumbs?.length"
      :thumbs="index.thumbs"
      module="Messages"
      :total="index.imgCount"
    />
    <div v-else-if="index.imgCount > 0" class="entry-thumbs">
      <span class="thumb-placeholder" v-for="n in Math.min(index.imgCount, 4)" :key="n">▣</span>
      <span v-if="index.imgCount > 4" class="thumb-more">+{{ index.imgCount - 4 }}</span>
    </div>

    <template #stats>
      <span class="entry-stat" :class="{ active: index.likeCount > 0 }">
        <span class="entry-stat-icon">♡</span>
        <span class="entry-stat-num">{{ index.likeCount }}</span>
      </span>
      <span class="entry-stat" :class="{ active: index.commentCount > 0 }">
        <span class="entry-stat-icon">✎</span>
        <span class="entry-stat-num">{{ index.commentCount }}</span>
      </span>
      <span class="entry-stat" :class="{ active: index.imgCount > 0 }">
        <span class="entry-stat-icon">▣</span>
        <span class="entry-stat-num">{{ index.imgCount }}</span>
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
import type { MessageIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: MessageIndex
  clickable?: boolean
  /** 重要说说标记文本（如「置顶」「精选」），为空则不显示印章 */
  stampText?: string
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: MessageIndex] }>()

// 列表项预览文本：把 [em]eXXX[/em] 替换为「[表情]」占位，@ 提及提取为 @昵称
const displayTitle = computed(() => stripFormatting(props.index.title || ''))

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>
