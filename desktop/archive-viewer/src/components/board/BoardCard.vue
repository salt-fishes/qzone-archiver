<template>
  <ArchiveEntry :time="index.time" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-num">№ {{ index.uin }}</span>
      <span v-if="index.secret" class="entry-stamp-tag" title="私密留言，仅彼此可见">私密</span>
    </template>

    <!-- 留言人 -->
    <p class="entry-text" :title="displayName">{{ displayName || '（匿名留言）' }}</p>

    <!-- 摘要 -->
    <p v-if="displayAbstract" class="entry-abstract">{{ displayAbstract }}</p>
    <p v-else class="entry-abstract entry-abstract-empty">（无内容）</p>

    <template #stats>
      <span v-if="index.replyCount > 0" class="entry-stat active" title="回复数量">
        <span class="entry-stat-icon">↳</span>
        <span class="entry-stat-num">回复 {{ index.replyCount }}</span>
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
import type { BoardIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: BoardIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: BoardIndex] }>()

const displayName = computed(() => stripFormatting(props.index.nickname || ''))
const displayAbstract = computed(() => stripFormatting(props.index.abstract || ''))

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>
