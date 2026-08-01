<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Album"
    size="lg"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-tip">正在加载相册详情…</div>
    <div v-else-if="!album" class="empty-tip">相册数据未找到</div>
    <article v-else class="detail">
      <!-- 元数据栏 -->
      <div class="detail-meta">
        <span class="meta">{{ index?.createTime || formatUnixTime(album.createtime || 0) }}</span>
        <span v-if="displayClassName" class="meta meta-tag">{{ displayClassName }}</span>
        <span v-if="modifyTimeText" class="meta">修改于 {{ modifyTimeText }}</span>
        <span class="meta">照片 {{ photoList.length }}</span>
      </div>

      <!-- 标题 -->
      <h3 class="detail-title">{{ displayTitle }}</h3>

      <!-- 描述 -->
      <div
        v-if="album.desc"
        class="detail-text"
        v-html="formatContent(album.desc)"
      ></div>

      <!-- 照片网格 -->
      <section v-if="photoList.length" class="detail-section">
        <h4 class="section-title">照片 · {{ photoList.length }}</h4>
        <div class="photo-grid">
          <button
            v-for="(photo, i) in photoList"
            :key="`p-${i}`"
            type="button"
            class="photo-cell"
            :title="photo.name || `照片 ${i + 1}`"
            @click="previewPhoto(photo, i)"
          >
            <img
              v-if="photoSrc(photo) && !photoErrors[i]"
              :src="photoSrc(photo)"
              :alt="photo.name || `照片 ${i + 1}`"
              loading="lazy"
              @error="photoErrors[i] = true"
            />
            <span v-else class="photo-placeholder">无图</span>
          </button>
        </div>
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
              <span v-else class="comment-name">{{ c.poster?.name || c.poster?.nick || '匿名' }}</span>
              <span v-if="c.postTime" class="comment-time">{{ formatUnixTime(c.postTime) }}</span>
            </div>
            <div class="comment-content" v-html="formatContent(c.content || '', { plainMentions: true })"></div>
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
                    <span v-else class="reply-name">{{ r.poster?.name || r.poster?.nick || '匿名' }}</span>
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

    <!-- 内嵌图片预览：点击切换大图显示，再次点击关闭 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="previewSrc" class="photo-preview-overlay" @click="closePreview">
          <img :src="previewSrc" class="photo-preview-img" :alt="previewAlt" />
          <span class="photo-preview-tip">{{ previewIndex + 1 }} / {{ photoList.length }} · 点击关闭</span>
        </div>
      </Transition>
    </Teleport>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import LikesModal from '@/components/common/LikesModal.vue'
import { formatContent, formatUnixTime, resolveModulePath } from '@/utils/formatContent'
import type { Album, AlbumIndex, Photo, LikeItem } from '@/types'

/** 相册评论（结构沿用扩展端，与 ShareComment/VideoComment 兼容） */
interface AlbumComment {
  poster?: { id?: number | string; name?: string; nick?: string; [k: string]: any }
  content?: string
  /** unix 秒 */
  postTime?: number
  replies?: AlbumComment[]
  [key: string]: any
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  album: Album | null
  index: AlbumIndex | null
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

const MODULE = 'Albums'

/** 照片加载失败状态：按索引跟踪，文件缺失时显示「无图」占位符 */
const photoErrors = ref<Record<number, boolean>>({})

const titleText = computed(() => {
  const name = props.album?.name || props.index?.name || '相册'
  const time = props.index?.createTime || (props.album?.createtime ? formatUnixTime(props.album.createtime) : '')
  return time ? `${name} · ${time.substring(0, 10)}` : name
})

const displayTitle = computed(() => props.album?.name || props.index?.name || '未命名相册')
const displayClassName = computed(() => props.album?.className || props.index?.className || '')
const modifyTimeText = computed(() => {
  if (props.index?.modifyTime) return props.index.modifyTime
  if (props.album?.modifytime) return formatUnixTime(props.album.modifytime)
  return ''
})

const photoList = computed<Photo[]>(() => props.album?.photoList || [])

const comments = computed<AlbumComment[]>(() => (props.album?.comments as AlbumComment[]) || [])
const commentCount = computed(() => props.album?.comments?.length || props.index?.commentCount || comments.value.length)

const likeList = computed<LikeItem[]>(() => props.album?.likes || props.album?.like?.list || [])
const likeCount = computed(() => props.album?.like?.total || props.index?.likeCount || likeList.value.length)

/**
 * 单张照片可访问 URL：优先本地 custom_filepath，回退 s_url / t_url
 * 本地路径相对 Albums/ 模块根，经 resolveModulePath 转换（生产模式即 ../../Albums/ 前缀）
 */
function photoSrc(photo: Photo): string {
  const raw = photo.custom_filepath || photo.s_url || photo.t_url || ''
  return raw ? resolveModulePath(raw, MODULE) : ''
}

// 内嵌图片预览状态
const previewSrc = ref('')
const previewAlt = ref('')
const previewIndex = ref(-1)

function previewPhoto(photo: Photo, i: number) {
  const src = photoSrc(photo)
  if (!src) return
  previewSrc.value = src
  previewAlt.value = photo.name || `照片 ${i + 1}`
  previewIndex.value = i
}

function closePreview() {
  previewSrc.value = ''
  previewAlt.value = ''
  previewIndex.value = -1
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
  closePreview()
  emit('close')
}

watch(visible, v => {
  if (!v) {
    likesVisible.value = false
    closePreview()
    photoErrors.value = {}
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

/* 照片网格：CSS Grid 自适应 */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--sp-2);
}

.photo-cell {
  padding: 0;
  border: var(--line);
  background: var(--paper-2);
  cursor: pointer;
  overflow: hidden;
  aspect-ratio: 1;
  transition: transform 0.15s, border-color 0.15s;
  display: block;
}

.photo-cell:hover {
  border-color: var(--vermilion);
  transform: translateY(-2px);
}

.photo-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--ink-3);
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

/* 内嵌图片预览：层级高于主模态（1000） */
.photo-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 22, 18, 0.92);
  z-index: 1100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  cursor: zoom-out;
  padding: var(--sp-5);
}

.photo-preview-img {
  max-width: 92vw;
  max-height: 82vh;
  object-fit: contain;
  border: var(--line);
  background: var(--paper);
}

.photo-preview-tip {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--paper);
  letter-spacing: 0.1em;
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
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  }
  .comment-item {
    padding: var(--sp-3);
  }
}
</style>
