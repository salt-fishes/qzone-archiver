<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Video"
    size="lg"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-tip">正在加载视频详情…</div>
    <div v-else-if="!video" class="empty-tip">视频数据未找到</div>
    <article v-else class="detail">
      <!-- 元数据栏 -->
      <div class="detail-meta">
        <span class="meta">{{ index?.time || formatUnixTime(video.uploadTime || video.uploadtime || 0) }}</span>
        <span class="meta meta-tag">{{ (index?.hasLocalVideo || video.custom_filepath) ? '本地视频' : '外部视频' }}</span>
        <span class="meta">vid {{ video.vid }}</span>
      </div>

      <!-- 标题 -->
      <h3 class="detail-title">{{ video.title || video.desc || '未命名视频' }}</h3>

      <!-- 视频播放区 -->
      <div class="video-player">
        <video
          v-if="video.custom_filepath"
          controls
          :src="videoSrc"
          :poster="coverSrc"
          preload="metadata"
        ></video>
        <a
          v-else-if="video.play_url"
          :href="video.play_url"
          target="_blank"
          rel="noopener"
          class="external-link"
        >
          <img v-if="coverSrc" :src="coverSrc" class="video-cover" :alt="video.title || '视频封面'" />
          <span class="external-link-text">▶ 在原平台播放</span>
        </a>
        <div v-else class="video-unavailable">视频源不可用</div>
      </div>

      <!-- 封面图（无本地视频且非外链时单独展示，避免与外链卡片重复） -->
      <img
        v-if="!video.custom_filepath && !video.play_url && coverSrc"
        :src="coverSrc"
        class="video-cover"
        :alt="video.title || '视频封面'"
      />

      <!-- 描述 -->
      <div
        v-if="video.desc"
        class="detail-text"
        v-html="formatContent(video.desc)"
      ></div>

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
              <span v-if="c.postTime" class="comment-time">{{ formatUnixTime(c.postTime) }}</span>
            </div>
            <div class="comment-content" v-html="formatContent(c.content || '', { plainMentions: true })"></div>
            <MediaGrid
              v-if="commentImages(c).length"
              :media-items="commentImages(c)"
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
import type { Video, VideoIndex, VideoComment, LikeItem, MediaImage } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  video: Video | null
  index: VideoIndex | null
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

const MODULE = 'Videos'

const titleText = computed(() => {
  const name = props.video?.title || props.video?.desc || '视频'
  const time = props.index?.time || (props.video ? formatUnixTime(props.video.uploadTime || props.video.uploadtime || 0) : '')
  return time ? `${name} · ${time.substring(0, 10)}` : name
})

/** 视频源地址：本地文件优先（经 resolveModulePath 转换），回退多个远程字段 */
const videoSrc = computed(() => {
  const v = props.video
  if (!v) return ''
  if (v.custom_filepath) return resolveModulePath(v.custom_filepath, MODULE)
  return v.custom_url || v.url || v.url3 || v.video_url || ''
})

/** 封面图地址：本地封面优先，回退远程封面，统一经 resolveModulePath 处理（远程 URL 会原样返回） */
const coverSrc = computed(() => {
  const v = props.video
  if (!v) return ''
  const raw = v.custom_pre_filepath || v.custom_pre_url || v.pre || v.preview_img || ''
  return raw ? resolveModulePath(raw, MODULE) : ''
})

const comments = computed<VideoComment[]>(() => props.video?.comments || [])
const commentCount = computed(() => props.video?.cmtTotal || comments.value.length)

const likeList = computed<LikeItem[]>(() => props.video?.likes || props.video?.like?.list || [])
const likeCount = computed(() => props.video?.like?.total || likeList.value.length)

/** 评论配图（优先本地 custom_filepath，回退 custom_url） */
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

.video-player {
  margin: var(--sp-3) 0;
  text-align: center;
}

.video-player video {
  max-width: 100%;
  max-height: 70vh;
  border: var(--line);
  background: #000;
}

.video-cover {
  max-width: 100%;
  border: var(--line);
}

.external-link {
  display: block;
  padding: var(--sp-4);
  border: var(--line);
  background: rgba(43, 74, 111, 0.05);
  text-align: center;
  text-decoration: none;
  color: var(--indigo);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  transition: all 0.15s;
}

.external-link:hover {
  background: rgba(43, 74, 111, 0.1);
  border-color: var(--indigo);
}

.external-link .video-cover {
  margin: 0 auto var(--sp-3);
  display: block;
}

.external-link-text {
  display: inline-block;
  letter-spacing: 0.1em;
  border-bottom: 1px solid currentColor;
  padding-bottom: 1px;
}

.video-unavailable {
  padding: var(--sp-5);
  border: var(--line-dot);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-3);
  text-align: center;
}

.detail-text {
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  line-height: 1.85;
  color: var(--ink);
  word-break: break-word;
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
