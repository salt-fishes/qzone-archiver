<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Diary"
    size="lg"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-tip">正在加载日记详情…</div>
    <div v-else-if="!diary" class="empty-tip">日记数据未找到</div>
    <article v-else class="detail">
      <!-- 元数据栏 -->
      <div class="detail-meta">
        <span class="meta">{{ index?.time || formatUnixTime(diary.pubTime || diary.pubtime || 0) }}</span>
        <span v-if="diary.category" class="meta meta-tag">{{ diary.category }}</span>
        <span class="meta">blogId {{ diary.blogId || diary.blogid }}</span>
      </div>

      <!-- 标题 -->
      <h3 class="detail-title">{{ displayTitle }}</h3>

      <!-- 日记正文（base64 编码的 HTML，解码后渲染） -->
      <div
        v-if="decodedHtml"
        class="detail-text"
        v-html="decodedHtml"
      ></div>
      <div v-else class="empty-tip">（无正文内容）</div>

      <!-- 互动数据 -->
      <div class="detail-actions">
        <button
          type="button"
          class="detail-action"
          :class="{ active: likeCount > 0 }"
          @click="openLikes"
        >
          <span class="action-icon">♡</span>
          <span class="action-num">{{ likeCount }}</span>
          <span class="action-label">点赞</span>
        </button>
        <button
          type="button"
          class="detail-action"
          :class="{ active: commentCount > 0 }"
          @click="openComments"
        >
          <span class="action-icon">✎</span>
          <span class="action-num">{{ commentCount }}</span>
          <span class="action-label">评论</span>
        </button>
        <span class="detail-cta">
          共 {{ likeCount + commentCount }} 项互动
        </span>
      </div>

      <!-- 评论树 -->
      <section v-if="comments.length" class="detail-section">
        <h4 class="section-title">评论 · {{ comments.length }}</h4>
        <ul class="comment-list">
          <li v-for="(c, i) in comments" :key="`c-${i}`" class="comment-item">
            <div class="comment-head">
              <a
                v-if="c.poster?.id"
                class="comment-name"
                :href="`https://user.qzone.qq.com/${c.poster.id}`"
                target="_blank"
                rel="noopener"
              >
                {{ c.poster.name || c.poster.id }}
              </a>
              <span v-else class="comment-name">{{ c.poster?.name || '匿名' }}</span>
              <span v-if="commentTime(c)" class="comment-time">{{ commentTime(c) }}</span>
            </div>
            <div class="comment-content" v-html="formatContent(c.content || '', { plainMentions: true })"></div>
            <MediaGrid
              v-if="commentImages(c).length"
              :media-items="commentImages(c)"
              :autoplay-gallery="false"
              class="comment-media"
            />
            <!-- 二级回复 -->
            <ul v-if="getReplies(c).length" class="reply-list">
              <li v-for="(r, j) in getReplies(c)" :key="`r-${i}-${j}`" class="reply-item">
                <span class="reply-arrow">↳</span>
                <div class="reply-body">
                  <div class="reply-head">
                    <a
                      v-if="r.poster?.id"
                      class="reply-name"
                      :href="`https://user.qzone.qq.com/${r.poster.id}`"
                      target="_blank"
                      rel="noopener"
                    >
                      {{ r.poster.name || r.poster.id }}
                    </a>
                    <span v-else class="reply-name">{{ r.poster?.name || '匿名' }}</span>
                    <span v-if="commentTime(r)" class="reply-time">{{ commentTime(r) }}</span>
                  </div>
                  <div class="reply-content" v-html="formatContent(r.content || '', { plainMentions: true })"></div>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </section>
    </article>

    <!-- 子模态：点赞列表 -->
    <LikesModal
      v-model="likesVisible"
      :likes="likeList"
      :count="likeCount"
    />
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import MediaGrid, { type MediaItem } from '@/components/common/MediaGrid.vue'
import LikesModal from '@/components/common/LikesModal.vue'
import { formatContent, formatUnixTime, resolveModulePath } from '@/utils/formatContent'
import type { Diary, DiaryIndex, VideoComment, LikeItem, MediaImage } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  diary: Diary | null
  index: DiaryIndex | null
  loading?: boolean
}>(), {
  loading: false
})

const emit = defineEmits<{ 'update:modelValue': [boolean]; close: [] }>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const likesVisible = ref(false)

const MODULE = 'Diaries'

const titleText = computed(() => {
  const name = props.diary?.custom_title || props.diary?.title || '日记'
  const time = props.index?.time || (props.diary ? formatUnixTime(props.diary.pubTime || props.diary.pubtime || 0) : '')
  return time ? `${name} · ${time.substring(0, 10)}` : name
})

/** 标题：custom_title 优先，回退 title */
const displayTitle = computed(() => props.diary?.custom_title || props.diary?.title || '(无标题)')

/**
 * 日记正文为 base64 编码的 HTML，需 atob 解码后渲染。
 * 解码后其中的相对路径图片需补上 Diaries 模块前缀（../../Diaries/）。
 */
const decodedHtml = computed(() => {
  const d = props.diary
  if (!d) return ''
  const raw = d.custom_html || d.html || ''
  if (!raw) return ''
  try {
    let html = atob(raw)
    // 重写相对路径的 img src，补上模块前缀
    html = html.replace(
      /(<img[^>]*\ssrc=["'])(?!https?:|\/\/|data:)(\.?\/?)([^"']+)(["'])/gi,
      (_m, prefix: string, _slash: string, path: string, suffix: string) =>
        prefix + resolveModulePath(path, MODULE) + suffix
    )
    return html
  } catch (e) {
    console.warn('[DiaryDetailModal] base64 解码失败', e)
    return ''
  }
})

const comments = computed<VideoComment[]>(() => (props.diary?.comments as VideoComment[]) || [])
const commentCount = computed(() => props.diary?.replynum || comments.value.length)

const likeList = computed<LikeItem[]>(() => props.diary?.likes || props.diary?.like?.list || [])
const likeCount = computed(() => props.diary?.like?.total || likeList.value.length)

/** 评论配图（优先本地 custom_filepath，回退 custom_url 等远程字段） */
function commentImages(c: VideoComment): MediaItem[] {
  if (!c.pic || !c.pic.length) return []
  return c.pic.map(p => buildMediaItem(p)).filter(Boolean) as MediaItem[]
}

function buildMediaItem(p: MediaImage): MediaItem | null {
  const local = p.custom_filepath ? resolveModulePath(p.custom_filepath, MODULE) : ''
  const src = local || p.custom_url || p.url1 || p.b_url || p.url || ''
  const thumb = local || p.s_url || p.url3 || p.smallurl || p.b_url || p.url1 || p.url || ''
  if (!src || !thumb) return null
  return {
    src,
    thumb,
    type: 'image' as const
  }
}

/** 评论时间：兼容 postTime(unix) / create_time(unix) / custom_create_time(字符串) */
function commentTime(c: VideoComment): string {
  if (c.postTime) return formatUnixTime(c.postTime)
  if ((c as any).create_time) return formatUnixTime((c as any).create_time)
  if ((c as any).custom_create_time) return String((c as any).custom_create_time)
  return ''
}

/** 二级回复：兼容 replies / list_3 两种字段 */
function getReplies(c: VideoComment): VideoComment[] {
  return c.replies || (c as any).list_3 || []
}

function openLikes() {
  if (likeCount.value === 0) return
  likesVisible.value = true
}

function openComments() {
  // 评论直接展示在主模态下方，无需独立子模态
}

function handleClose() {
  likesVisible.value = false
  emit('close')
}

watch(visible, v => {
  if (!v) likesVisible.value = false
})
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

.detail-title {
  font-family: var(--font-serif-cn);
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--ink);
  margin: 0 0 var(--sp-3);
  word-break: break-word;
}

.detail-text {
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  line-height: 1.85;
  color: var(--ink);
  word-break: break-word;
}

.detail-text :deep(img) {
  max-width: 100%;
  height: auto;
  border: var(--line);
  margin: var(--sp-2) 0;
}

.detail-text :deep(.mention),
.comment-content :deep(.mention),
.reply-content :deep(.mention-text) {
  color: var(--indigo);
  border-bottom: 1px solid currentColor;
  text-decoration: none;
}

.detail-text :deep(.emoticon),
.comment-content :deep(.emoticon),
.reply-content :deep(.emoticon) {
  display: inline-block;
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: 0 1px;
  border: none;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  padding-top: var(--sp-4);
  border-top: var(--line-double);
}

.detail-action {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  background: transparent;
  border: var(--line);
  padding: var(--sp-2) var(--sp-4);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-2);
  cursor: pointer;
  transition: all 0.15s;
}

.detail-action:hover,
.detail-action.active {
  background: var(--vermilion);
  border-color: var(--vermilion);
  color: var(--paper);
}

.action-icon {
  font-size: 0.95rem;
}

.action-num {
  font-weight: 600;
}

.action-label {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.detail-cta {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--ink-3);
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

.comment-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.comment-item {
  padding: var(--sp-3);
  background: rgba(234, 224, 197, 0.3);
  border-left: 3px solid var(--ink-3);
}

.comment-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  margin-bottom: var(--sp-2);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.comment-name {
  color: var(--indigo);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.8rem;
}

.comment-name:hover {
  color: var(--vermilion);
}

.comment-time {
  color: var(--ink-3);
}

.comment-content {
  font-family: var(--font-serif-cn);
  font-size: 0.9rem;
  color: var(--ink-2);
  line-height: 1.7;
  word-break: break-word;
}

.comment-media {
  margin: var(--sp-2) 0;
}

.reply-list {
  list-style: none;
  padding: 0;
  margin: var(--sp-3) 0 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.reply-item {
  display: flex;
  gap: var(--sp-2);
  padding-left: 0;
}

.reply-arrow {
  color: var(--vermilion);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  flex-shrink: 0;
}

.reply-body {
  flex: 1;
  min-width: 0;
}

.reply-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
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
  font-size: 0.85rem;
  color: var(--ink-2);
  line-height: 1.6;
  word-break: break-word;
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
  .detail-actions {
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .detail-action {
    padding: var(--sp-3) var(--sp-5);
    min-height: 44px;
    font-size: 0.85rem;
  }
  .detail-cta {
    width: 100%;
    text-align: right;
  }
  .detail-text {
    font-size: 1rem;
    line-height: 1.75;
  }
  .comment-item {
    padding: var(--sp-3);
  }
}
</style>
