<template>
  <article class="archive-entry" :class="{ clickable }" @click="handleClick">
    <!-- 时间戳列（年份/月日/时分，由 time 自动派生） -->
    <div class="entry-date">
      <div class="entry-year">{{ yearText }}</div>
      <div class="entry-md">{{ mdText }}</div>
      <div class="entry-time">{{ timeText }}</div>
    </div>

    <!-- 主体 -->
    <div class="entry-body">
      <!-- 头部：编号、标签等（具名插槽） -->
      <div v-if="$slots.head" class="entry-head">
        <slot name="head" />
      </div>

      <!-- 默认插槽：正文、摘要等 -->
      <slot />

      <!-- 互动数据（具名插槽） -->
      <div v-if="$slots.stats" class="entry-stats">
        <slot name="stats" />
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 通用归档卡片布局
 *
 * 提供所有模块卡片共享的「时间戳列 + entry-body 容器 + 头部/正文/统计」结构，
 * 以及配套的 archive-entry/entry-date/entry-body/entry-stats 等样式。
 * 各模块 Card 只需关注字段渲染，样式自动复用。
 *
 * 调用示例：
 *   <ArchiveEntry :time="item.time" :clickable="true" @click="onOpen">
 *     <template #head>
 *       <span class="entry-num">№ {{ item.tid }}</span>
 *     </template>
 *     <p class="entry-text">{{ title }}</p>
 *     <template #stats>
 *       <span class="entry-stat active">
 *         <span class="entry-stat-icon">♡</span>
 *         <span class="entry-stat-num">{{ likeCount }}</span>
 *       </span>
 *     </template>
 *   </ArchiveEntry>
 */
const props = withDefaults(defineProps<{
  /** 已格式化时间字符串 'YYYY-MM-DD HH:mm:ss'，自动派生为年/月日/时分三段 */
  time?: string
  /** 是否可点击（true 时显示 hover 效果与 cursor: pointer） */
  clickable?: boolean
}>(), {
  time: '',
  clickable: true
})

const emit = defineEmits<{ click: [] }>()

const yearText = computed(() => (props.time || '').substring(0, 4) || '——')
const mdText = computed(() => {
  const t = props.time || ''
  return t.length >= 10 ? t.substring(5, 10) : ''
})
const timeText = computed(() => {
  const t = props.time || ''
  return t.length >= 16 ? t.substring(11, 16) : ''
})

function handleClick() {
  if (props.clickable) emit('click')
}
</script>

<style scoped>
.archive-entry {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: var(--sp-5);
  padding: var(--sp-4) var(--sp-3);
  border-bottom: var(--line-dot);
  position: relative;
  transition: background 0.2s, transform 0.25s var(--ease-out), box-shadow 0.25s var(--ease-out);
}

.archive-entry.clickable {
  cursor: pointer;
}

.archive-entry.clickable:hover {
  background: rgba(255, 255, 255, 0.3);
}

.archive-entry.clickable:hover .entry-date::after {
  background: var(--vermilion);
}

.entry-date {
  font-family: var(--font-mono);
  text-align: right;
  border-right: var(--line);
  padding-right: var(--sp-3);
  position: relative;
}

.entry-date::after {
  content: '';
  position: absolute;
  right: -5px;
  top: var(--sp-2);
  width: 9px;
  height: 9px;
  background: var(--ink-3);
  border-radius: 50%;
  border: 2px solid var(--paper);
  box-shadow: 0 0 0 1px var(--ink);
  transition: background 0.2s;
}

.entry-year {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--ink);
  line-height: 1;
}

.entry-md {
  font-size: 0.7rem;
  color: var(--ink-3);
  margin-top: var(--sp-1);
  letter-spacing: 0.05em;
}

.entry-time {
  font-size: 0.65rem;
  color: var(--ink-3);
  margin-top: var(--sp-1);
}

.entry-body {
  padding-left: var(--sp-2);
  min-width: 0;
}

/* 具名插槽容器样式（子元素继承公共风格） */
.entry-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-2);
  flex-wrap: wrap;
}

/* 通用头部标签（编号/印章/类型）—— 各 Card 直接复用 */
.entry-head :deep(.entry-num) {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--ink-3);
  letter-spacing: 0.1em;
}

.entry-head :deep(.entry-stamp-tag),
.entry-head :deep(.entry-type-tag) {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--vermilion);
  border: 1px solid var(--vermilion);
  padding: 1px 6px;
}

.entry-head :deep(.entry-badge) {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  padding: 1px 6px;
  border: 1px solid;
}

.entry-head :deep(.entry-badge-svip) {
  color: var(--paper);
  background: var(--vermilion);
  border-color: var(--vermilion);
}

.entry-head :deep(.entry-badge-yellow) {
  color: var(--ink);
  background: rgba(255, 215, 0, 0.25);
  border-color: var(--ink-3);
}

/* 默认插槽内通用样式：标题/摘要文本 */
.archive-entry :deep(.entry-text) {
  font-family: var(--font-serif-cn);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--ink);
  margin-bottom: var(--sp-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.archive-entry :deep(.entry-abstract) {
  font-family: var(--font-serif-cn);
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--ink-2);
  margin-bottom: var(--sp-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.archive-entry :deep(.entry-abstract-empty),
.archive-entry :deep(.entry-text-empty) {
  color: var(--ink-3);
  font-style: italic;
}

.archive-entry :deep(.entry-source) {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.archive-entry :deep(.entry-source-label) {
  color: var(--ink-3);
  letter-spacing: 0.1em;
}

.archive-entry :deep(.entry-source-from),
.archive-entry :deep(.entry-source-text) {
  color: var(--ink-2);
}

.archive-entry :deep(.entry-owner) {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.archive-entry :deep(.entry-owner-label) {
  color: var(--vermilion);
  margin-right: 2px;
}

.archive-entry :deep(.entry-thumbs) {
  display: flex;
  gap: 4px;
  margin-bottom: var(--sp-2);
  align-items: center;
}

.archive-entry :deep(.thumb-placeholder) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--paper-2);
  border: 1px solid var(--ink-3);
  color: var(--ink-3);
  font-size: 0.7rem;
}

.archive-entry :deep(.thumb-more) {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--ink-3);
  margin-left: 4px;
}

/* 统计栏容器与单项 */
.entry-stats {
  display: flex;
  gap: var(--sp-5);
  margin-top: var(--sp-2);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--ink-3);
  align-items: center;
  flex-wrap: wrap;
}

.archive-entry :deep(.entry-stat) {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}

.archive-entry :deep(.entry-stat.active) {
  color: var(--ink-2);
}

.archive-entry :deep(.entry-stat-icon) {
  font-size: 0.85rem;
  display: inline-block;
  transition: color 0.2s var(--ease-out);
}

.archive-entry :deep(.entry-stat:hover .entry-stat-icon) {
  color: var(--vermilion);
}

.archive-entry :deep(.entry-stat-num) {
  font-weight: 500;
}

.archive-entry :deep(.entry-stat-cta) {
  margin-left: auto;
  color: var(--vermilion);
  font-style: italic;
  letter-spacing: 0.05em;
  transition: transform 0.2s var(--ease-out);
}

.archive-entry.clickable:hover :deep(.entry-stat-cta) {
  transform: translateX(4px);
}

@media (max-width: 600px) {
  .archive-entry {
    grid-template-columns: 1fr;
    gap: var(--sp-2);
    padding: var(--sp-4) var(--sp-3);
  }
  .entry-date {
    text-align: left;
    border-right: none;
    border-bottom: var(--line-dot);
    padding-right: 0;
    padding-bottom: var(--sp-2);
    display: flex;
    gap: var(--sp-3);
    align-items: baseline;
  }
  .entry-date::after {
    display: none;
  }
  /* 移动端扩大互动数据点击区域 */
  .entry-stats {
    gap: var(--sp-4);
    margin-top: var(--sp-3);
    padding-top: var(--sp-2);
  }
  .archive-entry :deep(.entry-stat) {
    padding: var(--sp-2) var(--sp-1);
    min-height: 36px;
    align-items: center;
  }
  .archive-entry :deep(.entry-stat-icon) {
    font-size: 1rem;
  }
  .archive-entry :deep(.entry-stat-cta) {
    padding: var(--sp-2) var(--sp-3);
    border: var(--line-dot);
  }
}
</style>
