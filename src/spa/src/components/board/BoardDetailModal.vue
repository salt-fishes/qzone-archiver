<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Board"
    size="lg"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-tip">正在加载留言详情…</div>
    <div v-else-if="!board" class="empty-tip">留言数据未找到</div>
    <article v-else class="detail">
      <!-- 元数据栏 -->
      <div class="detail-meta">
        <span class="meta">{{ index?.time || formatUnixTime(board.pubtime) }}</span>
        <span class="meta">№ {{ board.uin }}</span>
        <span v-if="board.secret == 1" class="meta meta-tag">私密</span>
      </div>

      <!-- 留言人信息 -->
      <div class="board-head">
        <div class="board-name">{{ board.nickname || '匿名' }}</div>
        <a
          v-if="board.uin"
          class="board-link"
          :href="`https://user.qzone.qq.com/${board.uin}`"
          target="_blank"
          rel="noopener"
        >
          访问主页 →
        </a>
      </div>

      <!-- 留言正文（HTML 已含本地图片路径，需重写为 SPA 可访问路径） -->
      <div
        v-if="board.htmlContent"
        class="detail-text board-content"
        v-html="resolvedHtml"
      ></div>
      <div v-else class="empty-tip">（无留言内容）</div>

      <!-- 二级回复列表 -->
      <section v-if="replies.length" class="detail-section">
        <h4 class="section-title">回复 · {{ replies.length }}</h4>
        <ul class="reply-list">
          <li v-for="(reply, i) in replies" :key="`r-${i}`" class="reply-item">
            <div class="reply-head">
              <a
                v-if="reply.uin"
                class="reply-name"
                :href="`https://user.qzone.qq.com/${reply.uin}`"
                target="_blank"
                rel="noopener"
              >
                {{ reply.name || reply.uin }}
              </a>
              <span v-else class="reply-name">{{ reply.name || '匿名' }}</span>
              <span v-if="reply.time" class="reply-time">{{ formatUnixTime(reply.time) }}</span>
            </div>
            <div class="reply-content" v-html="formatContent(reply.content || '')"></div>
          </li>
        </ul>
      </section>
    </article>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import { formatContent, formatUnixTime, resolveModulePath } from '@/utils/formatContent'
import type { Board, BoardIndex, BoardReply } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  board: Board | null
  index: BoardIndex | null
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
  const name = props.index?.nickname || props.board?.nickname || '留言'
  const time = props.index?.time || (props.board ? formatUnixTime(props.board.pubtime) : '')
  return time ? `${name} · ${time.substring(0, 10)}` : name
})

const replies = computed<BoardReply[]>(() => props.board?.replyList || [])

/**
 * 重写 htmlContent 中的图片相对路径，使其在 SPA 中可访问
 *
 * 扩展端 handerData 将 <img src> 改写为 'images/xxx'（相对模块根目录），
 * SPA 部署在 备份根/Common/spa/ 下，需要回退两级到 备份根/Boards/images/xxx
 */
const resolvedHtml = computed(() => {
  const html = props.board?.htmlContent || ''
  if (!html) return ''
  // 匹配 <img src="images/xxx"> 或 <img src='images/xxx'>，重写 src 为完整相对路径
  return html.replace(
    /(<img\b[^>]*\bsrc=["'])(images\/[^"']+)(["'])/gi,
    (_m, prefix: string, src: string, quote: string) =>
      prefix + resolveModulePath(src, 'Boards') + quote
  )
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

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-4);
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

.board-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-3);
}

.board-name {
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--ink);
}

.board-link {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--indigo);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
  padding-bottom: 1px;
}

.board-link:hover {
  color: var(--vermilion);
}

.board-content {
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  line-height: 1.85;
  color: var(--ink);
  word-break: break-word;
}

.board-content :deep(img) {
  max-width: 100%;
  height: auto;
  border: var(--line);
  margin: var(--sp-2) 0;
  display: block;
}

.board-content :deep(.mention) {
  color: var(--indigo);
  border-bottom: 1px solid currentColor;
  text-decoration: none;
}

.board-content :deep(.emoticon) {
  display: inline-block;
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: 0 1px;
  border: none;
}

.detail-section {
  padding-top: var(--sp-3);
  border-top: var(--line-double);
}

.section-title {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-2);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: var(--sp-3);
  font-weight: 500;
}

.reply-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.reply-item {
  padding: var(--sp-2) var(--sp-3);
  background: rgba(234, 224, 197, 0.4);
  border-left: 3px solid var(--vermilion);
}

.reply-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  margin-bottom: var(--sp-1);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.reply-name {
  color: var(--indigo);
  text-decoration: none;
  font-weight: 500;
}

.reply-name:hover {
  color: var(--vermilion);
}

.reply-time {
  color: var(--ink-3);
}

.reply-content {
  font-family: var(--font-serif-cn);
  font-size: 0.9rem;
  color: var(--ink-2);
  line-height: 1.6;
}

.reply-content :deep(.mention) {
  color: var(--indigo);
  border-bottom: 1px solid currentColor;
  text-decoration: none;
}

.reply-content :deep(.emoticon) {
  display: inline-block;
  width: 20px;
  height: 20px;
  vertical-align: middle;
  margin: 0 1px;
  border: none;
}

.loading-tip,
.empty-tip {
  padding: var(--sp-5);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-3);
}

@media (max-width: 720px) {
  .board-content {
    font-size: 1rem;
    line-height: 1.75;
  }
  .reply-item {
    padding: var(--sp-3);
  }
}
</style>
