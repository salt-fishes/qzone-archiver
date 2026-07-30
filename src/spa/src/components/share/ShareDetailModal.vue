<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Share"
    size="lg"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-tip">正在加载分享详情…</div>
    <div v-else-if="!share" class="empty-tip">分享数据未找到</div>
    <article v-else class="detail">
      <!-- 元数据栏 -->
      <div class="detail-meta">
        <span class="meta">{{ index?.time || formatUnixTime(share.shareTime) }}</span>
        <span class="meta meta-tag">{{ index?.typeLabel || typeLabel }}</span>
        <span class="meta">№ {{ share.uin }}</span>
      </div>

      <!-- 分享人信息 -->
      <div class="share-head">
        <div class="share-name">{{ share.nickname || '匿名' }}</div>
        <a
          v-if="share.uin"
          class="share-link"
          :href="`https://user.qzone.qq.com/${share.uin}`"
          target="_blank"
          rel="noopener"
        >
          访问主页 →
        </a>
      </div>

      <!-- 分享描述 -->
      <div
        v-if="share.desc"
        class="detail-text"
        v-html="formatContent(share.desc)"
      ></div>

      <!-- 分享源信息块 -->
      <section v-if="share.source" class="source-block">
        <header class="source-head">
          <span class="source-kicker">分享源</span>
          <a
            v-if="share.source.url"
            class="source-title"
            :href="share.source.url"
            target="_blank"
            rel="noopener"
          >
            {{ share.source.title || '原链接' }}
          </a>
          <span v-else-if="share.source.title" class="source-title source-title-text">
            {{ share.source.title }}
          </span>
        </header>

        <!-- 来源描述 -->
        <div
          v-if="share.source.desc"
          class="source-desc"
          v-html="formatContent(share.source.desc)"
        ></div>

        <!-- 来源信息 -->
        <div v-if="share.source.from?.name || share.source.count" class="source-meta">
          <span v-if="share.source.from?.name" class="meta">
            来自：
            <a
              v-if="share.source.from.url"
              :href="share.source.from.url"
              target="_blank"
              rel="noopener"
            >{{ share.source.from.name }}</a>
            <span v-else>{{ share.source.from.name }}</span>
          </span>
          <span v-if="share.source.count" class="meta">· 共分享 {{ share.source.count }} 次</span>
        </div>

        <!-- 来源配图 -->
        <MediaGrid
          v-if="sourceImages.length"
          :media-items="sourceImages"
          :autoplay-gallery="true"
          class="detail-media"
        />
      </section>

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
          共 {{ likeCount + commentCount + sourceImages.length }} 项互动
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
              <span v-if="c.postTime" class="comment-time">{{ formatUnixTime(c.postTime) }}</span>
            </div>
            <div class="comment-content" v-html="formatContent(c.content || '', { plainMentions: true })"></div>
            <MediaGrid
              v-if="commentImages(c).length"
              :media-items="commentImages(c)"
              :autoplay-gallery="false"
              class="comment-media"
            />
            <!-- 二级回复 -->
            <ul v-if="c.replies?.length" class="reply-list">
              <li v-for="(r, j) in c.replies" :key="`r-${i}-${j}`" class="reply-item">
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
                    <span v-if="r.postTime" class="reply-time">{{ formatUnixTime(r.postTime) }}</span>
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
import type { Share, ShareIndex, ShareComment, MediaImage } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  share: Share | null
  index: ShareIndex | null
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

const titleText = computed(() => {
  const name = props.index?.nickname || props.share?.nickname || '分享'
  const time = props.index?.time || (props.share ? formatUnixTime(props.share.shareTime) : '')
  return time ? `${name} · ${time.substring(0, 10)}` : name
})

const TYPE_LABELS: Record<number, string> = {
  1: '日志', 2: '相册', 3: '照片', 4: '网页',
  5: '视频', 10: '商品', 13: '新闻', 17: '微博', 18: '音乐'
}
const typeLabel = computed(() => {
  const t = props.share?.type
  return t ? TYPE_LABELS[t] || '其它' : '未知'
})

const MODULE = 'Shares'

/** 来源配图（优先本地 custom_filepath，回退 custom_url） */
const sourceImages = computed<MediaItem[]>(() => {
  const s = props.share?.source
  if (!s || !s.images) return []
  return s.images.map(p => buildMediaItem(p)).filter(Boolean) as MediaItem[]
})

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

/** 评论配图（同样优先本地） */
function commentImages(c: ShareComment): MediaItem[] {
  if (!c.pic || !c.pic.length) return []
  return c.pic.map(p => buildMediaItem(p)).filter(Boolean) as MediaItem[]
}

const comments = computed<ShareComment[]>(() => props.share?.comments || [])
const commentCount = computed(() => props.share?.commentTotal || comments.value.length)

const likeList = computed(() => props.share?.likes || [])
const likeCount = computed(() => props.share?.likeTotal || likeList.value.length)

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

.share-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-3);
}

.share-name {
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--ink);
}

.share-link {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--indigo);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
  padding-bottom: 1px;
}

.share-link:hover {
  color: var(--vermilion);
}

.detail-text {
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  line-height: 1.85;
  color: var(--ink);
  word-break: break-word;
}

.detail-text :deep(.mention),
.source-desc :deep(.mention),
.comment-content :deep(.mention),
.reply-content :deep(.mention-text) {
  color: var(--indigo);
  border-bottom: 1px solid currentColor;
  text-decoration: none;
}

.detail-text :deep(.emoticon),
.source-desc :deep(.emoticon),
.comment-content :deep(.emoticon),
.reply-content :deep(.emoticon) {
  display: inline-block;
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: 0 1px;
  border: none;
}

.source-block {
  border-left: 3px solid var(--vermilion);
  padding: var(--sp-3) var(--sp-4);
  background: rgba(200, 68, 42, 0.05);
}

.source-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  margin-bottom: var(--sp-2);
}

.source-kicker {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--vermilion);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.source-title {
  font-family: var(--font-serif-cn);
  font-size: 1rem;
  font-weight: 500;
  color: var(--indigo);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
  word-break: break-all;
}

.source-title:hover {
  color: var(--vermilion);
}

.source-title-text {
  color: var(--ink);
  border-bottom: none;
}

.source-desc {
  font-family: var(--font-serif-cn);
  font-size: 0.9rem;
  color: var(--ink-2);
  line-height: 1.6;
  margin: var(--sp-2) 0;
}

.source-meta {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--ink-3);
  margin-top: var(--sp-2);
}

.source-meta a {
  color: var(--indigo);
  text-decoration: none;
}

.detail-media {
  margin: var(--sp-3) 0;
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
