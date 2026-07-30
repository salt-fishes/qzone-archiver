<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Friend"
    size="md"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-tip">正在加载好友详情…</div>
    <div v-else-if="!friend" class="empty-tip">好友数据未找到</div>
    <article v-else class="detail">
      <!-- 头部：头像 + 主信息 -->
      <div class="detail-head">
        <div class="avatar-wrap">
          <img
            v-if="avatarSrc"
            :src="avatarSrc"
            :alt="displayName"
            class="avatar"
          />
          <span v-else class="avatar avatar-placeholder">{{ avatarFallback }}</span>
        </div>
        <div class="head-info">
          <h3 class="detail-title">{{ displayName }}</h3>
          <p v-if="friend.remark && friend.name && friend.remark !== friend.name" class="head-sub">
            昵称 · {{ friend.name }}
          </p>
          <p class="head-sub head-uin">QQ · {{ friend.uin ?? index?.uin }}</p>
        </div>
      </div>

      <!-- 元数据栏 -->
      <div class="detail-meta">
        <span class="meta">{{ groupLabel }}</span>
        <span v-if="addTimeText" class="meta">{{ addTimeText }}</span>
        <span v-if="friend.intimacyScore !== undefined && friend.intimacyScore > 0" class="meta meta-tag">
          亲密度 {{ friend.intimacyScore }}
        </span>
        <span v-if="friend.care" class="meta meta-tag meta-tag-care">特别关心</span>
        <span v-if="isDeleted" class="meta meta-tag meta-tag-deleted">已删除</span>
        <span v-else-if="friend.isFriend === false" class="meta meta-tag meta-tag-deleted">非好友</span>
      </div>

      <!-- QQ 主页链接 -->
      <a
        v-if="friend.uin"
        class="detail-link"
        :href="`https://user.qzone.qq.com/${friend.uin}`"
        target="_blank"
        rel="noopener"
      >
        <span class="link-icon">→</span>
        <span class="link-text">访问 QQ 空间主页</span>
      </a>
    </article>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import { formatUnixTime, resolveModulePath } from '@/utils/formatContent'
import type { Friend, FriendIndex } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  friend: Friend | null
  index: FriendIndex | null
  loading?: boolean
}>(), {
  loading: false
})

const emit = defineEmits<{ 'update:modelValue': [boolean]; close: [] }>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const MODULE = 'Friends'

// 主标题：备注名 → 昵称 → QQ 号
const displayName = computed(() => {
  const f = props.friend
  if (!f) return ''
  return f.remark || f.name || (f.uin ? String(f.uin) : '(未知好友)')
})

const titleText = computed(() => {
  const uin = props.friend?.uin ?? props.index?.uin
  return uin ? `${displayName.value} · ${uin}` : displayName.value
})

// 头像地址：优先全量数据的 custom_avatar_filepath（经 resolveModulePath 转换）
const avatarSrc = computed(() => {
  const f = props.friend
  if (!f) return ''
  if (f.custom_avatar_filepath) return resolveModulePath(f.custom_avatar_filepath, MODULE)
  if (f.avatar && /^https?:\/\//i.test(f.avatar)) return f.avatar
  return ''
})

// 无头像时的占位字符（取 displayName 首字）
const avatarFallback = computed(() => {
  const n = displayName.value
  return n ? n.charAt(0) : '?'
})

const groupLabel = computed(() => {
  const g = props.friend?.groupName ?? props.index?.groupName ?? ''
  return g ? `分组 · ${g}` : '分组 · (未分组)'
})

// 添加时间：优先索引已格式化字符串，回退全量数据的 addFriendTime（unix 秒）
const addTimeText = computed(() => {
  if (props.index?.time) return `添加于 ${props.index.time.substring(0, 10)}`
  const t = props.friend?.addFriendTime
  if (t && Number.isFinite(t) && t > 0) {
    const s = formatUnixTime(t)
    return s ? `添加于 ${s.substring(0, 10)}` : ''
  }
  return ''
})

const isDeleted = computed(() => {
  if (props.index?.deleted) return true
  if (props.friend?.isFriend === false) return false
  return false
})

function handleClose() {
  emit('close')
}
</script>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.detail-head {
  display: flex;
  gap: var(--sp-4);
  align-items: center;
  padding-bottom: var(--sp-3);
  border-bottom: var(--line-dot);
}

.avatar-wrap {
  flex-shrink: 0;
}

.avatar {
  display: block;
  width: 72px;
  height: 72px;
  border: var(--line);
  background: var(--paper-2);
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif-cn);
  font-size: 1.6rem;
  color: var(--ink-3);
}

.head-info {
  flex: 1;
  min-width: 0;
}

.detail-title {
  font-family: var(--font-serif-cn);
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--ink);
  margin: 0 0 var(--sp-2);
  word-break: break-word;
}

.head-sub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-3);
  margin: var(--sp-1) 0 0;
}

.head-uin {
  color: var(--ink-2);
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  padding-bottom: var(--sp-3);
  border-bottom: var(--line-dot);
}

.meta {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-3);
}

.meta-tag {
  color: var(--vermilion);
  border: 1px solid var(--vermilion);
  padding: 1px 6px;
  letter-spacing: 0.1em;
}

.meta-tag-care {
  color: var(--ink);
  border-color: var(--ink);
  background: rgba(255, 215, 0, 0.25);
}

.meta-tag-deleted {
  color: var(--paper);
  background: var(--vermilion);
  border-color: var(--vermilion);
}

.detail-link {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  border: var(--line);
  background: rgba(43, 74, 111, 0.05);
  text-decoration: none;
  color: var(--indigo);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  transition: all 0.15s;
  align-self: flex-start;
}

.detail-link:hover {
  background: rgba(43, 74, 111, 0.1);
  border-color: var(--indigo);
}

.link-icon {
  font-size: 0.95rem;
}

.loading-tip,
.empty-tip {
  padding: var(--sp-5);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-3);
}

@media (max-width: 600px) {
  .detail-head {
    gap: var(--sp-3);
  }
  .avatar {
    width: 56px;
    height: 56px;
  }
  .detail-title {
    font-size: 1.1rem;
  }
}
</style>
