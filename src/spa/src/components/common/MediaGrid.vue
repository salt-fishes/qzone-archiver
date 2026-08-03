<template>
  <div v-if="mediaItems.length" class="media-grid">
    <button
      v-for="(item, i) in mediaItems"
      :key="i"
      type="button"
      class="media-cell"
      :class="{ 'media-cell-video': item.type === 'video' }"
      :title="item.caption || (item.type === 'video' ? '点击播放' : '点击放大')"
      @click="openPreview(i)"
    >
      <!-- 视频项：统一封面组件（含黑帧修复）；图片项：普通 img -->
      <VideoCover
        v-if="item.type === 'video'"
        :src="item.thumb"
        :video-src="item.src"
        size="fill"
        :placeholder="false"
        :alt="item.caption || ''"
      />
      <img
        v-else
        :src="item.thumb"
        :alt="item.caption || ''"
        loading="lazy"
        decoding="async"
      />
      <!-- 视频播放标识 -->
      <span v-if="item.type === 'video'" class="media-video-overlay" aria-label="视频">
        <span class="media-video-icon">▶</span>
        <span class="media-video-label">视频</span>
      </span>
      <span v-if="item.duration" class="media-duration">{{ item.duration }}</span>
      <!-- hover 提示 -->
      <span class="media-cell-tip">{{ item.type === 'video' ? '点击播放' : '点击放大' }}</span>
    </button>
  </div>
  <div v-else class="media-empty">
    <span class="meta">无媒体附件</span>
  </div>

  <!-- 就地预览：图片放大 / 视频播放，点击遮罩关闭，左右箭头切换，Esc 退出 -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="previewIndex >= 0" class="media-preview-overlay" @click.self="closePreview">
        <video
          v-if="currentPreview?.type === 'video'"
          :key="`v-${previewIndex}`"
          :src="currentPreview.src"
          controls
          autoplay
          playsinline
          class="media-preview-video"
        ></video>
        <img
          v-else
          :src="currentPreview?.src"
          class="media-preview-img"
          :alt="currentPreview?.caption || ''"
        />
        <button
          v-if="mediaItems.length > 1"
          type="button"
          class="preview-nav preview-prev"
          aria-label="上一张"
          @click="stepPreview(-1)"
        >‹</button>
        <button
          v-if="mediaItems.length > 1"
          type="button"
          class="preview-nav preview-next"
          aria-label="下一张"
          @click="stepPreview(1)"
        >›</button>
        <span class="media-preview-tip">
          {{ previewIndex + 1 }} / {{ mediaItems.length }}
          <template v-if="currentPreview?.caption"> · {{ currentPreview.caption }}</template>
          <template v-else> · 点击遮罩关闭</template>
        </span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import VideoCover from '@/components/common/VideoCover.vue'

export interface MediaItem {
  src: string
  thumb: string
  caption?: string
  type?: 'image' | 'video'
  poster?: string
  duration?: string
}

const props = defineProps<{
  mediaItems: MediaItem[]
}>()

// ============ 就地预览 ============
const previewIndex = ref(-1)

const currentPreview = computed(() => {
  if (previewIndex.value < 0) return null
  return props.mediaItems[previewIndex.value] || null
})

function openPreview(index: number) {
  const item = props.mediaItems[index]
  if (!item || !item.src) return
  previewIndex.value = index
}

function closePreview() {
  previewIndex.value = -1
}

function stepPreview(dir: number) {
  const n = props.mediaItems.length
  if (n < 2) return
  previewIndex.value = (previewIndex.value + dir + n) % n
}

/** 键盘：← → 切换，Esc 关闭 */
function onKeydown(e: KeyboardEvent) {
  if (previewIndex.value < 0) return
  if (e.key === 'ArrowLeft') stepPreview(-1)
  else if (e.key === 'ArrowRight') stepPreview(1)
  else if (e.key === 'Escape') closePreview()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// mediaItems 变化：若预览项已超出范围则关闭
watch(() => props.mediaItems, () => {
  if (previewIndex.value >= props.mediaItems.length) previewIndex.value = -1
})
</script>

<style scoped>
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--sp-2);
  margin: var(--sp-3) 0;
}

.media-cell {
  position: relative;
  aspect-ratio: 1;
  border: var(--line);
  overflow: hidden;
  background: var(--paper-2);
  cursor: zoom-in;
  display: block;
  max-width: 100%;
  min-width: 0;
  padding: 0;
  transition: border-color 0.15s, transform 0.15s;
}

.media-cell:hover {
  border-color: var(--vermilion);
  transform: translateY(-2px);
}

.media-cell-video {
  cursor: pointer;
}

.media-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  max-width: 100%;
  max-height: 100%;
  display: block;
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

/* ============ 就地预览遮罩 ============ */
.media-preview-overlay {
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

.media-preview-img {
  max-width: 92vw;
  max-height: 82vh;
  object-fit: contain;
  border: var(--line);
  background: var(--paper);
}

.media-preview-video {
  max-width: 92vw;
  max-height: 82vh;
  background: #000;
  border: var(--line);
}

.media-preview-tip {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--paper);
  letter-spacing: 0.1em;
  max-width: 90vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 左右切换按钮 */
.preview-nav {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(244, 236, 216, 0.12);
  color: var(--paper);
  border: 1px solid rgba(244, 236, 216, 0.35);
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
}

.preview-prev {
  left: var(--sp-5);
}

.preview-next {
  right: var(--sp-5);
}

.preview-nav:hover {
  background: var(--vermilion);
  border-color: var(--vermilion);
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

@media (max-width: 720px) {
  .media-preview-overlay {
    padding: var(--sp-3);
  }
  .preview-prev {
    left: var(--sp-2);
  }
  .preview-next {
    right: var(--sp-2);
  }
}
</style>
