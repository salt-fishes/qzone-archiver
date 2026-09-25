<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Visitor"
    size="md"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-tip">正在加载访客详情…</div>
    <div v-else-if="!visitor" class="empty-tip">访客数据未找到</div>
    <article v-else class="detail">
      <!-- 元数据栏 -->
      <div class="detail-meta">
        <span class="meta">{{ index?.time || formatUnixTime(visitor.time) }}</span>
        <span class="meta">№ {{ visitor.uin }}</span>
        <span v-if="visitor.is_hide_visit === 1" class="meta meta-tag">隐身</span>
        <span v-if="visitor.supervip > 0" class="meta meta-tag meta-svip">SVIP</span>
        <span v-else-if="visitor.yellow > 0" class="meta meta-tag meta-yellow">黄钻</span>
      </div>

      <!-- 访客信息块 -->
      <div class="visitor-head">
        <div class="visitor-name">{{ index?.name || visitor.name || '匿名访客' }}</div>
        <a
          v-if="visitor.uin"
          class="visitor-link"
          :href="`https://user.qzone.qq.com/${visitor.uin}`"
          target="_blank"
          rel="noopener"
        >
          访问主页 →
        </a>
      </div>

      <!-- 查看的内容 -->
      <section v-if="shuoshuoes.length" class="visit-section">
        <h4 class="section-title">查看了说说 · {{ shuoshuoes.length }}</h4>
        <ul class="visit-list">
          <li v-for="item in shuoshuoes" :key="item.id" class="visit-item">
            <span class="visit-name" v-html="formatContent(item.name || '（无标题）')"></span>
            <a
              v-if="item.url"
              :href="item.url"
              class="visit-link"
              target="_blank"
              rel="noopener"
            >查看原文</a>
          </li>
        </ul>
      </section>

      <section v-if="blogs.length" class="visit-section">
        <h4 class="section-title">查看了日志 · {{ blogs.length }}</h4>
        <ul class="visit-list">
          <li v-for="(item, i) in blogs" :key="`b-${i}`" class="visit-item">
            <span class="visit-name" v-html="formatContent(item.name || '（无标题）')"></span>
          </li>
        </ul>
      </section>

      <section v-if="photoes.length" class="visit-section">
        <h4 class="section-title">查看了相册 · {{ photoes.length }}</h4>
        <ul class="visit-list">
          <li v-for="(item, i) in photoes" :key="`p-${i}`" class="visit-item">
            <span class="visit-name" v-html="formatContent(item.name || '（无标题）')"></span>
            <img
              v-if="item.custom_filepath || item.custom_url"
              class="visit-thumb"
              :src="resolveModulePath(item.custom_filepath || item.custom_url || '', 'Visitors')"
              :alt="item.name"
              loading="lazy"
            />
          </li>
        </ul>
      </section>

      <section v-if="shares.length" class="visit-section">
        <h4 class="section-title">查看了分享 · {{ shares.length }}</h4>
        <ul class="visit-list">
          <li v-for="(item, i) in shares" :key="`s-${i}`" class="visit-item">
            <span class="visit-name" v-html="formatContent(item.name || '（无标题）')"></span>
          </li>
        </ul>
      </section>

      <!-- 同期其他访客 -->
      <section v-if="uins.length" class="visit-section">
        <h4 class="section-title">同期访问的访客 · {{ uins.length }}</h4>
        <ul class="visit-list visit-list-inline">
          <li v-for="(item, i) in uins" :key="`u-${i}`" class="visit-inline">
            <span class="visit-name">{{ item.name || '匿名' }}</span>
            <span class="visit-time">{{ formatUnixTime(item.time) }}</span>
          </li>
        </ul>
      </section>

      <!-- 空内容提示 -->
      <div
        v-if="!shuoshuoes.length && !blogs.length && !photoes.length && !shares.length && !uins.length"
        class="empty-tip"
      >
        该访客记录未关联查看的具体内容（可能是主页访问）。
      </div>
    </article>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import { formatContent, resolveModulePath, formatUnixTime } from '@/utils/formatContent'
import type { Visitor, VisitorIndex } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  visitor: Visitor | null
  index: VisitorIndex | null
  loading?: boolean
}>(), {
  loading: false
})

const emit = defineEmits<{ 'update:modelValue': [boolean]; close: [] }>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const titleText = computed(() => {
  const name = props.index?.name || props.visitor?.name || '访客'
  const time = props.index?.time || (props.visitor ? formatUnixTime(props.visitor.time) : '')
  return time ? `${name} · ${time.substring(0, 10)}` : name
})

const shuoshuoes = computed(() => props.visitor?.shuoshuoes || [])
const blogs = computed(() => props.visitor?.blogs || [])
const photoes = computed(() => props.visitor?.photoes || [])
const shares = computed(() => props.visitor?.shares || [])
const uins = computed(() => props.visitor?.uins || [])

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

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-3);
  padding-bottom: var(--sp-3);
  border-bottom: var(--line-dot);
  align-items: center;
}

.meta-tag {
  border: 1px solid;
  padding: 1px 6px;
  letter-spacing: 0.1em;
}

.meta-svip {
  color: var(--paper);
  background: var(--vermilion);
  border-color: var(--vermilion);
}

.meta-yellow {
  color: var(--ink);
  background: rgba(255, 215, 0, 0.25);
  border-color: var(--ink-3);
}

.visitor-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--sp-3);
  padding-bottom: var(--sp-3);
  border-bottom: var(--line);
}

.visitor-name {
  font-family: var(--font-serif-cn);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--ink);
}

.visitor-link {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--vermilion);
  border-bottom: none;
  letter-spacing: 0.05em;
}

.visit-section {
  padding: var(--sp-3) 0;
  border-bottom: var(--line-dot);
}

.visit-section:last-child {
  border-bottom: none;
}

.section-title {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-bottom: var(--sp-3);
  padding-bottom: var(--sp-2);
  border-bottom: var(--line);
}

.visit-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.visit-list-inline {
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--sp-3);
}

.visit-item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  background: rgba(255, 255, 255, 0.3);
  border: var(--line-dot);
}

.visit-name {
  font-family: var(--font-serif-cn);
  font-size: 0.95rem;
  color: var(--ink);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visit-name :deep(.mention) {
  color: var(--vermilion);
  border-bottom: 1px dotted var(--vermilion);
}

.visit-name :deep(.emoticon) {
  height: 1em;
  vertical-align: middle;
}

.visit-link {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--ink-3);
  border-bottom: none;
}

.visit-link:hover {
  color: var(--vermilion);
}

.visit-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border: var(--line);
}

.visit-inline {
  display: flex;
  flex-direction: column;
  padding: var(--sp-1) var(--sp-3);
  background: rgba(255, 255, 255, 0.3);
  border: var(--line-dot);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  min-width: 140px;
}

.visit-time {
  color: var(--ink-3);
  font-size: 0.7rem;
}

.loading-tip,
.empty-tip {
  padding: var(--sp-4);
  font-family: var(--font-serif-cn);
  color: var(--ink-2);
  text-align: center;
}

@media (max-width: 720px) {
  .visit-item {
    padding: var(--sp-3);
  }
  .visit-name {
    white-space: normal;
    word-break: break-word;
  }
}
</style>
