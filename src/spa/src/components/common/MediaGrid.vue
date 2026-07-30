<template>
  <div v-if="mediaItems.length" ref="containerRef" class="media-grid">
    <a
      v-for="(item, i) in mediaItems"
      :key="i"
      class="media-cell"
      :class="{ 'media-cell-video': item.type === 'video' }"
      :href="item.type === 'video' ? '' : item.src"
      :data-sub-html="item.caption"
      :data-poster="item.poster"
      :data-video="item.type === 'video' ? videoSourceJSON(item.src) : null"
    >
      <img :src="item.thumb" :alt="item.caption || ''" loading="lazy" />
      <!-- 视频播放标识 -->
      <span v-if="item.type === 'video'" class="media-video-overlay" aria-label="视频">
        <span class="media-video-icon">▶</span>
        <span class="media-video-label">视频</span>
      </span>
      <span v-if="item.duration" class="media-duration">{{ item.duration }}</span>
      <!-- hover 提示 -->
      <span class="media-cell-tip">{{ item.type === 'video' ? '点击播放' : '点击放大' }}</span>
    </a>
  </div>
  <div v-else class="media-empty">
    <span class="meta">无媒体附件</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useLightGallery } from '@/composables/useLightGallery'

export interface MediaItem {
  src: string
  thumb: string
  caption?: string
  type?: 'image' | 'video'
  poster?: string
  duration?: string
}

const props = withDefaults(defineProps<{
  mediaItems: MediaItem[]
  /** 启用自动初始化 LightGallery（默认 true；列表卡片可置为 false 仅展示缩略图） */
  autoplayGallery?: boolean
}>(), {
  autoplayGallery: true
})

const containerRef = ref<HTMLElement>()
const { init, destroy } = useLightGallery()

/**
 * 生成 LightGallery video 插件所需的 data-video JSON 配置
 *
 * LightGallery video 插件需要明确的 source 数组才能创建 <video> 元素播放
 * 仅靠 href 指向 .mp4 文件不足以触发视频播放（会卡在 lg-video-loading 状态）
 *
 * 格式：{"source":[{"src":"video.mp4","type":"video/mp4"}]}
 */
function videoSourceJSON(src: string): string {
  // 根据扩展名推断 MIME 类型
  const ext = src.split('?')[0].split('.').pop()?.toLowerCase() || ''
  const typeMap: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    ogv: 'video/ogg',
    mov: 'video/quicktime',
  }
  const mimeType = typeMap[ext] || 'video/mp4'
  return JSON.stringify({ source: [{ src, type: mimeType }] })
}

async function setupGallery() {
  if (!props.autoplayGallery || !containerRef.value) return
  await nextTick()
  if (containerRef.value) init(containerRef.value)
}

// 组件挂载后初始化（containerRef 此时已绑定）
onMounted(() => {
  setupGallery()
})

// mediaItems 变化时重新初始化
watch(() => props.mediaItems, () => {
  destroy()
  setupGallery()
}, { flush: 'post' })

onUnmounted(destroy)
</script>

<style scoped>
/* LightGallery 初始化后会注入全局 CSS 覆盖我们的 scoped 样式：
 *   .lg-container { display: block }  覆盖 display: grid
 *   .lg-item      { display: inline } 覆盖 display: block
 *   以及 aspect-ratio: auto / overflow: visible / object-fit: fill 等
 * 这里用 !important 强制保持网格布局和图片约束，避免溢出屏幕。 */
.media-grid {
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)) !important;
  gap: var(--sp-2) !important;
  margin: var(--sp-3) 0 !important;
}

.media-cell {
  position: relative !important;
  aspect-ratio: 1 !important;
  border: var(--line) !important;
  overflow: hidden !important;
  background: var(--paper-2) !important;
  cursor: zoom-in !important;
  display: block !important;
  /* 兜底：即使 grid 失效，单格也不会撑破屏幕 */
  max-width: 100% !important;
  min-width: 0 !important;
}

.media-cell-video {
  cursor: pointer !important;
}

.media-cell img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  /* 关键：限制图片最大尺寸，防止原图撑破容器 */
  max-width: 100% !important;
  max-height: 100% !important;
  display: block !important;
  transition: transform 0.3s var(--ease-out);
}

.media-cell:hover img {
  transform: scale(1.06);
}

.media-cell::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(244, 236, 216, 0.45);
  pointer-events: none;
}

/* 视频覆盖层：渐变蒙版 + 播放图标 */
.media-video-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: linear-gradient(180deg, rgba(26, 22, 18, 0.15) 0%, rgba(26, 22, 18, 0.55) 100%);
  pointer-events: none;
}

.media-video-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(200, 68, 42, 0.85);
  color: var(--paper);
  border-radius: 50%;
  font-size: 1rem;
  border: 2px solid var(--paper);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  transition: transform 0.2s var(--ease-out), background 0.2s;
}

.media-cell:hover .media-video-icon {
  transform: scale(1.1);
  background: var(--vermilion);
}

.media-video-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--paper);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.media-duration {
  position: absolute;
  right: 4px;
  bottom: 4px;
  padding: 1px 6px;
  background: rgba(26, 22, 18, 0.85);
  color: var(--paper);
  font-family: var(--font-mono);
  font-size: 0.65rem;
}

/* hover 提示文字 */
.media-cell-tip {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%) translateY(8px);
  padding: 2px 8px;
  background: rgba(244, 236, 216, 0.95);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  white-space: nowrap;
  opacity: 0;
  transition: all 0.2s var(--ease-out);
  pointer-events: none;
  border: 1px solid var(--ink);
}

.media-cell:hover .media-cell-tip {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.media-cell-video .media-cell-tip {
  bottom: auto;
  top: 6px;
}

.media-empty {
  padding: var(--sp-3);
  text-align: center;
  border: var(--line-dot);
}

/* 移动端：去掉 hover 提示，简化交互 */
@media (hover: none) {
  .media-cell-tip {
    display: none;
  }
  .media-video-icon {
    width: 40px;
    height: 40px;
  }
}
</style>
