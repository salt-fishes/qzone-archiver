<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Message"
    size="lg"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-tip">正在加载说说详情…</div>
    <div v-else-if="!message" class="empty-tip">说说数据未找到</div>
    <article v-else class="detail">
      <!-- 元数据栏 -->
      <div class="detail-meta">
        <span class="meta">{{ formatDate(message) }}</span>
        <span v-if="message.tid" class="meta">№ {{ message.tid }}</span>
        <span v-if="message.lbs?.idname" class="meta">◷ {{ message.lbs.idname }}</span>
      </div>

      <!-- 引用块（转发说说） -->
      <blockquote v-if="message.rt_con?.content" class="detail-quote">
        <span class="quote-author">@ 转发 · {{ message.rt_tid || '原说说' }}</span>
        <div class="quote-text" v-html="formatContent(message.rt_con.content)"></div>
      </blockquote>

      <!-- 说说正文 -->
      <div class="detail-text" v-html="formatContent(message.content || '（无内容）')"></div>

      <!-- 媒体网格（LightGallery） -->
      <MediaGrid
        v-if="mediaItems.length"
        :media-items="mediaItems"
        :autoplay-gallery="true"
        class="detail-media"
      />

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
          <span class="action-label">喜欢</span>
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
          共 {{ likeCount + commentCount + mediaItems.length }} 项互动
        </span>
      </div>
    </article>

    <!-- 子模态：点赞列表 -->
    <LikesModal
      v-model="likesVisible"
      :likes="likeList"
      :count="likeCount"
    />
    <!-- 子模态：评论树 -->
    <CommentsModal
      v-model="commentsVisible"
      :comments="commentList"
      :count="commentCount"
    />
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import MediaGrid, { type MediaItem } from '@/components/common/MediaGrid.vue'
import LikesModal from '@/components/common/LikesModal.vue'
import CommentsModal from '@/components/common/CommentsModal.vue'
import { formatContent, resolveModulePath } from '@/utils/formatContent'
import type { Message, MediaImage, MediaVideo } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  message: Message | null
  loading?: boolean
}>(), {
  loading: false
})

const emit = defineEmits<{ 'update:modelValue': [boolean]; close: [] }>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

// 子模态控制
const likesVisible = ref(false)
const commentsVisible = ref(false)

const titleText = computed(() => {
  if (!props.message) return '说说详情'
  const t = props.message.custom_create_time || ''
  return t ? `说说 · ${t.substring(0, 10)}` : '说说详情'
})

const mediaItems = computed<MediaItem[]>(() => {
  const m = props.message
  if (!m) return []
  // 优先使用扩展端转换后的 custom_images，回退到 pic，最后才用 pic_list（兼容旧数据）
  const pics: MediaImage[] = m.custom_images || m.pic || m.pic_list || []
  // 视频封面也作为媒体项展示
  const vids: MediaVideo[] = m.custom_videos || m.video || []
  const items: MediaItem[] = []
  for (const p of pics) {
    // 优先本地 custom_filepath（已下载到 Messages/images/），回退到远程 URL
    const local = p.custom_filepath ? resolveModulePath(p.custom_filepath, 'Messages') : ''
    const src = local || p.custom_url || p.hd_url || p.url1 || p.b_url || ''
    const thumb = local || p.s_url || p.url3 || p.smallurl || p.b_url || p.url1 || ''
    if (src && thumb) {
      items.push({
        src,
        thumb,
        type: 'image' as const,
        caption: p.pic_id ? `№ ${p.pic_id}` : ''
      })
    }
  }
  for (const v of vids) {
    // 修复视频项字段映射：
    //   - 视频源：优先用本地 .mp4 文件（custom_filepath），避免远程 URL 签名过期
    //   - 封面图：优先用 custom_pre_filepath（封面图专用字段），fallback 到 pic_url
    //     之前误用 custom_filepath（视频文件路径）作封面，导致封面缺失
    const videoLocal = v.custom_filepath ? resolveModulePath(v.custom_filepath, 'Messages') : ''
    const videoSrc = videoLocal || v.custom_url || v.url3 || ''
    const coverLocal = v.custom_pre_filepath ? resolveModulePath(v.custom_pre_filepath, 'Messages') : ''
    const cover = coverLocal || v.custom_pre_url || v.pic_url || v.url1 || ''
    if (cover && videoSrc) {
      items.push({
        src: videoSrc,
        thumb: cover,
        type: 'video' as const,
        poster: cover
      })
    }
  }
  return items
})

const likeCount = computed(() => props.message?.like?.total || 0)
const likeList = computed(() => props.message?.like?.list || [])

const commentList = computed(() => {
  const m = props.message
  return m?.custom_comments || m?.commentlist || []
})
const commentCount = computed(() => commentList.value.length)

function formatDate(m: Message): string {
  return m.custom_create_time || (m.created_time ? new Date(m.created_time * 1000).toISOString().replace('T', ' ').substring(0, 16) : '——')
}

function openLikes() {
  if (likeCount.value === 0) return
  likesVisible.value = true
}

function openComments() {
  if (commentCount.value === 0) return
  commentsVisible.value = true
}

function handleClose() {
  likesVisible.value = false
  commentsVisible.value = false
  emit('close')
}

// 外部关闭时同步子模态
watch(visible, v => {
  if (!v) {
    likesVisible.value = false
    commentsVisible.value = false
  }
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

.detail-quote {
  border-left: 3px solid var(--vermilion);
  padding: var(--sp-3) var(--sp-4);
  background: rgba(200, 68, 42, 0.05);
  margin: 0;
}

.quote-author {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--vermilion);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--sp-2);
}

.quote-text {
  font-family: var(--font-serif-cn);
  font-size: 0.95rem;
  color: var(--ink-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-text {
  font-family: var(--font-serif-cn);
  font-size: 1.1rem;
  line-height: 1.85;
  color: var(--ink);
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-text :deep(.mention),
.quote-text :deep(.mention) {
  color: var(--indigo);
  border-bottom: 1px solid currentColor;
  font-weight: 500;
  text-decoration: none;
}

.detail-text :deep(.mention:hover),
.quote-text :deep(.mention:hover) {
  color: var(--vermilion);
}

.detail-text :deep(.emoticon),
.quote-text :deep(.emoticon) {
  display: inline-block;
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: 0 1px;
  border: none;
}

.detail-media {
  margin: var(--sp-2) 0;
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

.detail-action.active:hover {
  background: var(--vermilion-2);
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

.loading-tip,
.empty-tip {
  padding: var(--sp-5);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-3);
}

@media (max-width: 720px) {
  /* 移动端扩大点赞/评论按钮触控区域 */
  .detail-actions {
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .detail-action {
    padding: var(--sp-3) var(--sp-5);
    min-height: 44px;
    font-size: 0.85rem;
  }
  .detail-action .action-label {
    font-size: 0.75rem;
  }
  .detail-cta {
    width: 100%;
    text-align: right;
  }
  .detail-text {
    font-size: 1rem;
    line-height: 1.75;
  }
}
</style>
