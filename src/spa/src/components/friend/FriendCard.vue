<template>
  <ArchiveEntry :time="index.time" :clickable="clickable" @click="handleClick">
    <template #head>
      <span class="friend-avatar-wrap">
        <img
          v-if="avatarSrc"
          :src="avatarSrc"
          :alt="displayTitle"
          class="friend-avatar"
          loading="lazy"
          decoding="async"
          @error="onAvatarError"
        />
        <span v-else class="friend-avatar friend-avatar-fallback">{{ avatarFallback }}</span>
      </span>
      <span class="entry-type-tag">好友</span>
      <span
        v-if="index.deleted"
        class="entry-badge entry-badge-deleted"
        title="已删除（曾经是好友但本次未拉到）"
      >已删除</span>
    </template>

    <!-- 主标题：备注名 → 昵称 → QQ 号 -->
    <p class="entry-text" :class="{ 'entry-text-empty': !displayTitle }">{{ displayTitle }}</p>

    <!-- 副标题：分组名 -->
    <p class="entry-abstract">{{ groupLabel }}</p>

    <template #stats>
      <span v-if="index.intimacyScore > 0" class="entry-stat active" title="亲密度">
        <span class="entry-stat-icon">♡</span>
        <span class="entry-stat-num">亲密度 {{ index.intimacyScore }}</span>
      </span>
      <span v-if="index.care" class="entry-stat active" title="特别关心">
        <span class="entry-stat-icon">★</span>
        <span class="entry-stat-num">特别关心</span>
      </span>
      <span v-if="clickable" class="entry-stat entry-stat-cta">
        查看详情 →
      </span>
    </template>
  </ArchiveEntry>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ArchiveEntry from '@/components/common/ArchiveEntry.vue'
import { buildQzoneAvatarUrl, resolveCommonImagePath } from '@/utils/formatContent'
import type { FriendIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: FriendIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: FriendIndex] }>()

// 主标题：备注名 → 昵称 → QQ 号
const displayTitle = computed(() => {
  const idx = props.index
  return idx.remark || idx.name || (idx.uin ? String(idx.uin) : '')
})

// 副标题：分组名（无分组时显示占位）
const groupLabel = computed(() => {
  const g = props.index.groupName || ''
  return g ? `分组 · ${g}` : '(未分组)'
})

/* ============ 头像：本地文件 → 在线 qlogo → 占位字 ============ */
const uin = computed(() => (props.index.uin != null && props.index.uin !== '' ? String(props.index.uin) : ''))

// 头像加载状态：local（本地 Common/images/）→ remote（在线 qlogo）→ none（占位）
const avatarState = ref<'local' | 'remote' | 'none'>('local')

const avatarSrc = computed(() => {
  if (!uin.value || avatarState.value === 'none') return ''
  if (avatarState.value === 'remote') return buildQzoneAvatarUrl(uin.value)
  return resolveCommonImagePath(`Common/images/${uin.value}`)
})

function onAvatarError() {
  if (avatarState.value === 'local') {
    // 本地文件缺失，回退到在线头像
    avatarState.value = 'remote'
    return
  }
  avatarState.value = 'none'
}

// 无头像时的占位字符（取主标题首字）
const avatarFallback = computed(() => {
  const n = displayTitle.value
  return n ? n.charAt(0) : '?'
})

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>

<style scoped>
/* Friend 模块的类型标签用靛蓝色背景，区分于视频 */
.archive-entry :deep(.entry-type-tag) {
  color: var(--paper);
  background: var(--indigo);
  border-color: var(--indigo);
  padding: 1px 8px;
}

/* 已删除徽章：红色 */
.archive-entry :deep(.entry-badge-deleted) {
  color: var(--vermilion);
  border-color: var(--vermilion);
  background: rgba(200, 68, 42, 0.1);
}

/* 好友头像 */
.friend-avatar-wrap {
  display: inline-flex;
  align-items: center;
}

.friend-avatar {
  width: 38px;
  height: 38px;
  border: var(--line);
  object-fit: cover;
  background: var(--paper-2);
}

.friend-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif-cn);
  font-size: 1.1rem;
  color: var(--ink-3);
}
</style>
