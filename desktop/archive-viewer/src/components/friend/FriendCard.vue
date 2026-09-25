<template>
  <!--
    好友名录卡（双形态，随阅读密度切换）：
    - 流式 v-stream：一行一人的印刷名录行——头像｜姓名｜分组·亲密度·№｜结识日期
    - 网格 v-grid：紧凑名片卡——头像+姓名+关心｜分组/亲密度/№｜结识日期
    不再套用 ArchiveEntry：好友的「结识时间」是元数据而非叙事主角，
    巨型日期列既浪费版面又压错信息层级。
  -->
  <article
    class="friend-card"
    :class="[`v-${density}`, { clickable }]"
    @click="handleClick"
  >
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

    <div class="friend-main">
      <div class="friend-name-row">
        <span class="friend-name">{{ displayTitle || `№ ${uin || '——'}` }}</span>
        <span v-if="index.care" class="friend-care" title="特别关心">★ 特别关心</span>
        <span
          v-if="index.deleted"
          class="friend-deleted"
          title="已删除（曾经是好友但本次未拉到）"
        >已删除</span>
      </div>
      <div class="friend-meta">
        <span class="friend-group">{{ groupLabel }}</span>
        <span v-if="index.intimacyScore > 0" class="friend-intimacy" title="亲密度">
          ♡ 亲密度 {{ index.intimacyScore }}
        </span>
        <span v-if="uin" class="friend-uin">№ {{ uin }}</span>
      </div>
    </div>

    <div class="friend-side">
      <span class="friend-date" :title="index.time ? `结识于 ${index.time}` : ''">{{ dateLabel }}</span>
      <span v-if="clickable" class="friend-cta">详情 →</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDensity } from '@/composables/useDensity'
import { buildQzoneAvatarUrl, resolveCommonImagePath } from '@/utils/formatContent'
import type { FriendIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: FriendIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: FriendIndex] }>()

const { density } = useDensity()

// 主标题：备注名 → 昵称 → QQ 号
const displayTitle = computed(() => {
  const idx = props.index
  return idx.remark || idx.name || ''
})

// 副标题：分组名（无分组时显示占位）
const groupLabel = computed(() => {
  const g = props.index.groupName || ''
  return g ? `分组 · ${g}` : '(未分组)'
})

// 结识日期：YYYY-MM-DD（缺失显示 ——）
const dateLabel = computed(() => {
  const t = props.index.time || ''
  const m = t.match(/(\d{4})[-/.年]?(\d{1,2})?[-/.月]?(\d{1,2})?/)
  if (!m) return '——'
  const [, y, mo, d] = m
  if (!mo) return y
  return `${y}-${mo.padStart(2, '0')}${d ? '-' + d.padStart(2, '0') : ''}`
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
.friend-card {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  position: relative;
  background: transparent;
  transition: background var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out),
    box-shadow var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out);
}

.friend-card.clickable { cursor: pointer; }

/* ===== 流式：名录行 ===== */
.v-stream.friend-card {
  padding: var(--sp-2) var(--sp-2);
  border-bottom: var(--rule-dot);
}

/* 名录行悬停：纸亮底 + 左缘朱砂竖线（行语义，不浮起） */
.v-stream.friend-card.clickable::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--vermilion);
  transform: scaleY(0);
  transition: transform var(--dur-1) var(--ease-out);
}

.v-stream.friend-card.clickable:hover {
  background: var(--paper-raised);
}

.v-stream.friend-card.clickable:hover::before {
  transform: scaleY(1);
}

.v-stream.friend-card.clickable:active {
  background: rgba(181, 67, 42, 0.05);
}

/* ===== 网格：名片卡 ===== */
.v-grid.friend-card {
  flex-direction: column;
  align-items: stretch;
  gap: var(--sp-2);
  height: 100%;
  padding: var(--sp-2);
  border: var(--line-1);
  background: var(--paper-raised);
}

.v-grid.friend-card.clickable::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--ink);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform var(--dur-1) var(--ease-out);
}

.v-grid.friend-card.clickable:hover {
  transform: translateY(-2px);
  border-color: rgba(33, 29, 23, 0.3);
  box-shadow: var(--shadow-raise);
}

.v-grid.friend-card.clickable:hover::before {
  transform: scaleX(1);
}

.v-grid.friend-card.clickable:active {
  transform: translateY(1px);
  box-shadow: none;
}

/* ===== 头像 ===== */
.friend-avatar-wrap {
  display: inline-flex;
  align-items: center;
  flex: none;
}

.v-grid .friend-avatar-wrap { align-self: flex-start; }

.friend-avatar {
  width: 40px;
  height: 40px;
  border: var(--line-1);
  object-fit: cover;
  background: var(--paper);
}

.v-grid .friend-avatar { width: 44px; height: 44px; }

.friend-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  color: var(--ink-muted);
}

/* ===== 主体 ===== */
.friend-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.friend-name-row {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  min-width: 0;
}

.friend-name {
  font-family: var(--font-serif-cn);
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-care {
  flex: none;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  color: var(--gold);
  white-space: nowrap;
}

.friend-deleted {
  flex: none;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  color: var(--vermilion);
  border: 1px solid var(--vermilion);
  padding: 0 4px;
  white-space: nowrap;
}

.friend-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.03em;
  color: var(--ink-muted);
  white-space: nowrap;
}

.friend-group {
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-serif-cn);
  font-size: 0.72rem;
}

.friend-intimacy { flex: none; }
.friend-uin { flex: none; }

/* ===== 侧栏（流式）：日期 + CTA ===== */
.friend-side {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.friend-date {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  color: var(--ink-muted);
  white-space: nowrap;
}

.friend-cta {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  color: var(--vermilion);
  white-space: nowrap;
  opacity: 0;
  transition: opacity var(--dur-1) var(--ease-out);
}

.friend-card.clickable:hover .friend-cta { opacity: 1; }

/* 网格：侧栏转为底部行 */
.v-grid .friend-side {
  margin-top: auto;
  padding-top: var(--sp-1);
  border-top: var(--rule-dot);
  justify-content: space-between;
  width: 100%;
}

@media (max-width: 720px) {
  .v-stream .friend-cta { display: none; }
  .v-stream .friend-uin { display: none; }
}
</style>
