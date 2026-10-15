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

  <!-- 就地预览：缩放 / 左右切换 / 视频播放，全部由公共媒体查看器承载 -->
  <MediaViewer :items="mediaItems" v-model:index="previewIndex" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MediaViewer from '@/components/common/MediaViewer.vue'
import VideoCover from '@/components/common/VideoCover.vue'
import type { MediaItem } from '@/components/common/MediaViewer.vue'

const props = defineProps<{
  mediaItems: MediaItem[]
}>()

// ============ 就地预览（缩放 / 左右切换由 MediaViewer 承载） ============
const previewIndex = ref(-1)

function openPreview(index: number) {
  const item = props.mediaItems[index]
  if (!item || !item.src) return
  previewIndex.value = index
}
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
  border: var(--rule);
  overflow: hidden;
  background: var(--paper-2);
  cursor: zoom-in;
  display: block;
  max-width: 100%;
  min-width: 0;
  padding: 0;
  transition: border-color 0.2s ease;
}

.media-cell:hover {
  border-color: var(--vermilion);
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
  transition: filter 0.25s var(--ease-out);
}

.media-cell:hover img {
  filter: brightness(1.08);
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
  transform: translateX(-50%);
  padding: 2px 8px;
  background: rgba(244, 236, 216, 0.95);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s var(--ease-out);
  pointer-events: none;
  border: 1px solid var(--ink);
}

.media-cell:hover .media-cell-tip {
  opacity: 1;
}

.media-cell-video .media-cell-tip {
  bottom: auto;
  top: 6px;
}

.media-empty {
  padding: var(--sp-3);
  text-align: center;
  border: var(--rule-dot);
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
