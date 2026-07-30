<template>
  <ArchiveEntry :time="index.time" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="entry-num">№ {{ index.uin }}</span>
      <span v-if="index.isHideVisit" class="entry-stamp-tag" title="隐身访问">隐身</span>
      <span v-if="index.supervip > 0" class="entry-badge entry-badge-svip" title="超级会员">SVIP</span>
      <span v-else-if="index.yellow > 0" class="entry-badge entry-badge-yellow" title="黄钻">黄钻</span>
    </template>

    <!-- 访客名称 -->
    <p class="entry-text" :title="displayName">{{ displayName || '（匿名访客）' }}</p>

    <!-- 来源信息 -->
    <div v-if="sourceText" class="entry-source">
      <span class="entry-source-label">来源</span>
      <span class="entry-source-text">{{ sourceText }}</span>
    </div>

    <template #stats>
      <span v-if="index.shuoshuoCount > 0" class="entry-stat active" title="查看了说说">
        <span class="entry-stat-icon">✎</span>
        <span class="entry-stat-num">说说 {{ index.shuoshuoCount }}</span>
      </span>
      <span v-if="index.blogCount > 0" class="entry-stat active" title="查看了日志">
        <span class="entry-stat-icon">☰</span>
        <span class="entry-stat-num">日志 {{ index.blogCount }}</span>
      </span>
      <span v-if="index.photoCount > 0" class="entry-stat active" title="查看了相册">
        <span class="entry-stat-icon">▣</span>
        <span class="entry-stat-num">相册 {{ index.photoCount }}</span>
      </span>
      <span v-if="index.shareCount > 0" class="entry-stat active" title="查看了分享">
        <span class="entry-stat-icon">↗</span>
        <span class="entry-stat-num">分享 {{ index.shareCount }}</span>
      </span>
      <span v-if="index.uinsCount > 0" class="entry-stat" title="同期其他访客">
        <span class="entry-stat-icon">◉</span>
        <span class="entry-stat-num">同期 {{ index.uinsCount }}</span>
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
import type { VisitorIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: VisitorIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: VisitorIndex] }>()

const displayName = computed(() => stripFormatting(props.index.name || ''))

// 访客来源映射（src 与 platform_src 数值含义来自 QQ 空间接口约定）
const SOURCE_MAP: Record<number, string> = {
  1: 'PC',
  2: 'QQ',
  3: '手机',
  4: '微信',
  5: 'PAD',
  6: '陌生人',
  7: '邮箱',
  8: '微信朋友圈',
  9: '朋友网',
  10: 'Android',
  11: 'iPhone'
}

const sourceText = computed(() => {
  const src = props.index.src || 0
  const plat = props.index.platformSrc || 0
  const parts: string[] = []
  if (SOURCE_MAP[src]) parts.push(SOURCE_MAP[src])
  if (plat && SOURCE_MAP[plat] && plat !== src) parts.push(SOURCE_MAP[plat])
  return parts.join(' / ')
})

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>
