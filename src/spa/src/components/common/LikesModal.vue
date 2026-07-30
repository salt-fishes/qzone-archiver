<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Likes"
    size="sm"
    @close="$emit('close')"
  >
    <div v-if="loading" class="loading-tip">加载中…</div>
    <div v-else-if="!likes.length" class="empty-tip">暂无点赞</div>
    <ul v-else class="likes-list">
      <li v-for="(item, i) in likes" :key="itemKey(item, i)" class="like-item">
        <div class="like-avatar">
          <img v-if="avatarUrl(item)" :src="avatarUrl(item)" :alt="displayName(item)" />
          <span v-else class="like-avatar-placeholder">{{ (displayName(item) || '?')[0] }}</span>
        </div>
        <div class="like-info">
          <span class="like-name">{{ displayName(item) }}</span>
          <span v-if="item.uin" class="like-uin">№ {{ item.uin }}</span>
        </div>
      </li>
    </ul>
    <template #footer>
      <span class="meta">共 {{ likes.length }} 人</span>
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ModalDialog from './ModalDialog.vue'
import type { LikeItem } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  likes: LikeItem[]
  loading?: boolean
  count?: number
}>(), {
  loading: false
})

const emit = defineEmits<{ 'update:modelValue': [boolean]; close: [] }>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const titleText = computed(() => {
  const c = props.count ?? props.likes.length
  return `点赞列表 · ${c}`
})

function displayName(item: LikeItem): string {
  return item.nick || item.name || '匿名'
}

function avatarUrl(item: LikeItem): string {
  if (!item.portrait) return ''
  // QQ 头像 portrait 字段：可能是相对路径或完整 URL
  if (item.portrait.startsWith('http')) return item.portrait
  if (item.portrait.startsWith('//')) return 'https:' + item.portrait
  return item.portrait
}

function itemKey(item: LikeItem, i: number): string {
  return item.uin ? String(item.uin) : `k${i}`
}
</script>

<style scoped>
.likes-list {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--sp-2);
}

.like-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border: var(--line-dot);
  background: rgba(255, 255, 255, 0.2);
  transition: background 0.15s;
}

.like-item:hover {
  background: rgba(255, 255, 255, 0.4);
}

.like-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: var(--line);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--paper-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.like-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.like-avatar-placeholder {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--ink-2);
}

.like-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.like-name {
  font-family: var(--font-serif-cn);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.like-uin {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--ink-3);
}

.loading-tip,
.empty-tip {
  padding: var(--sp-5);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-3);
}
</style>
