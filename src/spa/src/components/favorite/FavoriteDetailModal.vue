<template>
  <ModalDialog
    v-model="visible"
    :title="titleText"
    kicker="Favorite"
    size="lg"
    @close="handleClose"
  >
    <div v-if="loading" class="loading-tip">正在加载收藏详情…</div>
    <div v-else-if="!favorite" class="empty-tip">收藏数据未找到</div>
    <article v-else class="detail">
      <!-- 元数据栏 -->
      <div class="detail-meta">
        <span class="meta">{{ index?.time || favorite.custom_create_time || formatUnixTime(favorite.create_time) }}</span>
        <span class="meta meta-tag">{{ index?.typeLabel || typeLabel }}</span>
        <span v-if="favorite.user_agent" class="meta meta-ua" :title="favorite.user_agent">{{ favorite.user_agent }}</span>
      </div>

      <!-- 源作者信息块 -->
      <div class="favorite-head">
        <div class="favorite-name">{{ index?.ownerName || favorite.custom_name || '匿名' }}</div>
        <a
          v-if="ownerUin"
          class="favorite-link"
          :href="`https://user.qzone.qq.com/${ownerUin}`"
          target="_blank"
          rel="noopener"
        >
          访问主页 →
        </a>
      </div>

      <!-- 标题（若有） -->
      <h3 v-if="favorite.title" class="detail-title" v-html="formatContent(favorite.title)"></h3>

      <!-- 摘要 -->
      <div
        v-if="favorite.custom_abstract || favorite.abstract"
        class="detail-abstract"
        v-html="formatContent(favorite.custom_abstract || favorite.abstract)"
      ></div>

      <!-- 转发理由（说说/分享的转发场景） -->
      <blockquote
        v-if="forwardReason"
        class="detail-quote"
        v-html="formatContent(forwardReason)"
      ></blockquote>

      <!-- 说说正文（type=5 且 detail_shuoshuo_info.content 存在时） -->
      <div
        v-if="shuoshuoContent"
        class="detail-text"
        v-html="formatContent(shuoshuoContent)"
      ></div>

      <!-- 网页信息（type=1） -->
      <div v-if="webUrl" class="detail-web">
        <span class="meta-label">原网页：</span>
        <a :href="webUrl" class="detail-link" target="_blank" rel="noopener">{{ webUrl }}</a>
      </div>

      <!-- 分享链接（type=7） -->
      <div v-if="shareUrl" class="detail-share">
        <span class="meta-label">分享链接：</span>
        <a :href="shareUrl" class="detail-link" target="_blank" rel="noopener">{{ shareUrl }}</a>
      </div>

      <!-- 媒体网格（LightGallery） -->
      <MediaGrid
        v-if="mediaItems.length"
        :media-items="mediaItems"
        :autoplay-gallery="true"
        class="detail-media"
      />

      <!-- 音频列表 -->
      <section v-if="audios.length" class="detail-section">
        <h4 class="section-title">音频 · {{ audios.length }}</h4>
        <ul class="audio-list">
          <li v-for="(audio, i) in audios" :key="`a-${i}`" class="audio-item">
            <span class="audio-icon">♪</span>
            <a
              v-if="audio.play_url || audio.custom_url"
              :href="audio.play_url || audio.custom_url"
              class="audio-link"
              target="_blank"
              rel="noopener"
            >
              {{ audio.custom_filename || '播放音频' }}
            </a>
            <span v-else class="audio-name">{{ audio.custom_filename || '音频文件' }}</span>
          </li>
        </ul>
      </section>

      <!-- 原始链接（日志/相册等的关联链接） -->
      <div v-if="originalLink" class="detail-original">
        <span class="meta-label">查看原文：</span>
        <a :href="originalLink" class="detail-link" target="_blank" rel="noopener">{{ originalLink }}</a>
      </div>

      <!-- 空内容提示 -->
      <div
        v-if="!hasContent"
        class="empty-tip"
      >
        该收藏未关联具体内容（可能是文本/相片类收藏，仅保留元数据）。
      </div>
    </article>
  </ModalDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ModalDialog from '@/components/common/ModalDialog.vue'
import MediaGrid, { type MediaItem } from '@/components/common/MediaGrid.vue'
import { formatContent, resolveModulePath, formatUnixTime } from '@/utils/formatContent'
import type { Favorite, FavoriteIndex, MediaImage } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  favorite: Favorite | null
  index: FavoriteIndex | null
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
  const name = props.index?.ownerName || props.favorite?.custom_name || '收藏'
  const time = props.index?.time || (props.favorite ? formatUnixTime(props.favorite.create_time) : '')
  return time ? `${name} · ${time.substring(0, 10)}` : name
})

// 类型标签
const TYPE_LABELS: Record<number, string> = {
  1: '网页', 2: '相片', 3: '日志', 4: '照片',
  5: '说说', 6: '文字', 7: '分享', 8: '未知'
}
const typeLabel = computed(() => {
  const t = props.favorite?.type
  return t ? TYPE_LABELS[t] || '未知' : '未知'
})

// 源作者 uin（依据 type 从对应子结构取值，对齐扩展端 getFavoriteOwner 逻辑）
const ownerUin = computed(() => {
  const f = props.favorite
  if (!f) return 0
  switch (f.type) {
    case 3: return f.blog_info?.owner_uin || f.custom_uin || 0
    case 4:
      return f.album_info?.owner_uin ||
        (f.photo_list && f.photo_list[0]?.owner_uin) ||
        f.custom_uin || 0
    case 5: return f.shuoshuo_info?.owner_uin || f.custom_uin || 0
    case 7: return f.share_info?.owner_uin || f.custom_uin || 0
    default: return f.custom_uin || 0
  }
})

// 转发理由（说说转发场景 shuoshuo_info.reason，或分享的 share_info.reason）
const forwardReason = computed(() => {
  const f = props.favorite
  if (!f) return ''
  if (f.shuoshuo_info?.reason) return f.shuoshuo_info.reason
  if (f.share_info?.reason) return f.share_info.reason
  return ''
})

// 说说正文（type=5 时从 detail_shuoshuo_info.content 取）
const shuoshuoContent = computed(() => {
  const f = props.favorite
  if (!f || f.type !== 5) return ''
  return f.shuoshuo_info?.detail_shuoshuo_info?.content || ''
})

// 网页 URL（type=1）
const webUrl = computed(() => {
  const f = props.favorite
  if (!f || f.type !== 1) return ''
  return f.url_info?.url || ''
})

// 分享链接（type=7）
const shareUrl = computed(() => {
  const f = props.favorite
  if (!f || f.type !== 7) return ''
  return f.share_info?.share_url || ''
})

// 原文链接（日志/相册等）
const originalLink = computed(() => {
  const f = props.favorite
  if (!f) return ''
  switch (f.type) {
    case 3: {
      // 日志：user.qzone.qq.com/{uin}/blog/{id}
      const uin = f.blog_info?.owner_uin
      const id = f.blog_info?.id
      return uin && id ? `https://user.qzone.qq.com/${uin}/blog/${id}` : ''
    }
    case 4: {
      // 相册：user.qzone.qq.com/{uin}/photo/{id}
      const uin = f.album_info?.owner_uin
      const id = f.album_info?.id
      return uin && id ? `https://user.qzone.qq.com/${uin}/photo/${id}` : ''
    }
    default: return ''
  }
})

// 媒体项（配图 + 视频，合并给 MediaGrid）
const mediaItems = computed<MediaItem[]>(() => {
  const f = props.favorite
  if (!f) return []
  const MODULE = 'Favorites'
  const items: MediaItem[] = []
  // 合并 custom_images 和 custom_origin_images
  const pics: MediaImage[] = [
    ...(f.custom_images || []),
    ...(f.custom_origin_images || [])
  ]
  for (const p of pics) {
    // 优先本地 custom_filepath，回退到远程 url
    const local = p.custom_filepath ? resolveModulePath(p.custom_filepath, MODULE) : ''
    const src = local || p.custom_url || p.url1 || p.b_url || p.url || ''
    const thumb = local || p.s_url || p.url3 || p.smallurl || p.b_url || p.url1 || p.url || ''
    if (src && thumb) {
      items.push({
        src,
        thumb,
        type: 'image' as const,
        caption: p.pic_id ? `№ ${p.pic_id}` : ''
      })
    }
  }
  // 视频
  for (const v of f.custom_videos || []) {
    const videoLocal = v.custom_filepath ? resolveModulePath(v.custom_filepath, MODULE) : ''
    const videoSrc = videoLocal || v.custom_url || v.play_url || v.url || ''
    const coverLocal = v.custom_pre_filepath ? resolveModulePath(v.custom_pre_filepath, MODULE) : ''
    const cover = coverLocal || v.custom_pre_url || v.preview_img || v.pic_url || ''
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

// 音频列表
const audios = computed(() => props.favorite?.custom_audios || [])

// 是否有实质内容
const hasContent = computed(() => {
  const f = props.favorite
  if (!f) return false
  return !!(
    f.title ||
    f.custom_abstract ||
    f.abstract ||
    forwardReason.value ||
    shuoshuoContent.value ||
    webUrl.value ||
    shareUrl.value ||
    originalLink.value ||
    mediaItems.value.length ||
    audios.value.length
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
  gap: var(--sp-3);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-3);
  padding-bottom: var(--sp-3);
  border-bottom: var(--line-dot);
  align-items: center;
}

.meta-tag {
  border: 1px solid var(--ink-3);
  padding: 1px 6px;
  letter-spacing: 0.1em;
}

.meta-ua {
  font-size: 0.7rem;
  color: var(--ink-3);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--sp-3);
  padding-bottom: var(--sp-3);
  border-bottom: var(--line);
}

.favorite-name {
  font-family: var(--font-serif-cn);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--ink);
}

.favorite-link {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--vermilion);
  border-bottom: none;
  letter-spacing: 0.05em;
}

.detail-title {
  font-family: var(--font-serif-cn);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink);
  margin: 0;
  padding-bottom: var(--sp-2);
  border-bottom: var(--line-dot);
}

.detail-title :deep(.mention) {
  color: var(--vermilion);
  border-bottom: 1px dotted var(--vermilion);
}

.detail-abstract {
  font-family: var(--font-serif-cn);
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--ink-2);
  padding: var(--sp-3);
  background: rgba(255, 255, 255, 0.4);
  border-left: 3px solid var(--ink-3);
}

.detail-abstract :deep(.mention) {
  color: var(--vermilion);
  border-bottom: 1px dotted var(--vermilion);
}

.detail-abstract :deep(.emoticon) {
  height: 1em;
  vertical-align: middle;
}

.detail-quote {
  font-family: var(--font-serif-cn);
  font-size: 0.9rem;
  color: var(--ink-2);
  border-left: 3px solid var(--vermilion);
  padding: var(--sp-2) var(--sp-3);
  margin: 0;
  background: rgba(200, 68, 42, 0.04);
}

.detail-quote :deep(.mention) {
  color: var(--vermilion);
  border-bottom: 1px dotted var(--vermilion);
}

.detail-text {
  font-family: var(--font-serif-cn);
  font-size: 1rem;
  line-height: 1.7;
  color: var(--ink);
  word-break: break-word;
}

.detail-text :deep(.mention) {
  color: var(--vermilion);
  border-bottom: 1px dotted var(--vermilion);
}

.detail-text :deep(.emoticon) {
  height: 1em;
  vertical-align: middle;
}

.detail-web,
.detail-share,
.detail-original {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-3);
  padding: var(--sp-2) var(--sp-3);
  border: var(--line-dot);
  word-break: break-all;
}

.meta-label {
  color: var(--ink-3);
  letter-spacing: 0.1em;
  margin-right: var(--sp-2);
}

.detail-link {
  color: var(--vermilion);
  border-bottom: none;
}

.detail-link:hover {
  text-decoration: underline;
}

.detail-media {
  margin-top: var(--sp-2);
}

.detail-section {
  padding: var(--sp-3) 0;
  border-top: var(--line-dot);
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

.audio-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.audio-item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  background: rgba(255, 255, 255, 0.3);
  border: var(--line-dot);
}

.audio-icon {
  color: var(--vermilion);
  font-size: 1rem;
}

.audio-link,
.audio-name {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-2);
  border-bottom: none;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audio-link:hover {
  color: var(--vermilion);
}

.loading-tip,
.empty-tip {
  padding: var(--sp-4);
  font-family: var(--font-serif-cn);
  color: var(--ink-2);
  text-align: center;
}

@media (max-width: 720px) {
  .detail-meta {
    gap: var(--sp-2);
  }
  .meta-ua {
    max-width: 100%;
  }
  .favorite-head {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sp-1);
  }
}
</style>
