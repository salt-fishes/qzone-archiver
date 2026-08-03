<template>
  <img
    v-if="src && !failed"
    :src="shown"
    :alt="alt"
    class="video-cover"
    :class="sizeClass"
    loading="lazy"
    decoding="async"
    @load="handleLoad"
    @error="failed = true"
  />
  <span
    v-else-if="placeholder"
    class="video-cover-fallback"
    :class="sizeClass"
  >
    <span class="video-cover-icon">{{ placeholderIcon }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { repairBlackCover } from '@/utils/coverRepair'

/**
 * 视频封面统一组件
 *
 * 封装三件事：
 *   1. 封面图展示（本地/远程路径已由调用方 resolve）
 *   2. 黑帧封面自动修复：加载完成后像素采样，若为纯黑帧且提供了
 *      本地视频源（videoSrc），自动 seek 视频首帧生成 dataURL 替换
 *   3. 加载失败占位符
 *
 * 根元素为 <img>（有效时），父组件的 scoped 选择器（如 .photo-cell img）
 * 仍能命中，因此外部可继续用 CSS 控制尺寸/圆角/hover 动画。
 *
 * 用法：
 *   <VideoCover :src="coverSrc" :video-src="videoSrc" size="wide" placeholder-icon="▶" />
 */
const props = withDefaults(defineProps<{
  /** 封面图地址（已 resolve 为 SPA 可访问 URL） */
  src: string
  /** 视频源地址（黑帧时提取首帧替换；缺省或外部视频则为空） */
  videoSrc?: string
  /** 图片 alt 文本 */
  alt?: string
  /** 是否显示加载失败占位符 */
  placeholder?: boolean
  /** 占位符内容（符号或短文本） */
  placeholderIcon?: string
  /** 布局：wide=整宽固定高度（列表大图），fill=填满父容器（网格单元） */
  size?: 'wide' | 'fill'
}>(), {
  videoSrc: '',
  alt: '',
  placeholder: true,
  placeholderIcon: '▣',
  size: 'fill'
})

/** 加载失败标志：src 变更时重置 */
const failed = ref(false)
/** 黑帧修复结果（dataURL）：封面为黑帧时用本地视频首帧替换 */
const override = ref('')

const shown = computed(() => override.value || props.src)
const sizeClass = computed(() => `video-cover-${props.size}`)

watch(() => props.src, () => {
  failed.value = false
  override.value = ''
})

/** 封面加载完成：若为黑帧且存在本地视频源，提取首帧替换 */
async function handleLoad(e: Event) {
  if (override.value) return
  const img = e.target as HTMLImageElement
  const frame = await repairBlackCover(img, props.videoSrc)
  if (frame) override.value = frame
}
</script>

<style scoped>
.video-cover {
  display: block;
  border: var(--line);
  background: var(--paper-2);
}

/* fill：填满父容器（照片网格单元 / 媒体网格单元） */
.video-cover-fill {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* wide：整宽固定高度（视频/相册列表大图），为异步加载预留高度避免虚拟滚动抖动 */
.video-cover-wide {
  width: 100%;
  height: 120px;
  object-fit: cover;
  margin-bottom: var(--sp-2);
}

/* 占位符：与图片保持相同尺寸，避免虚拟滚动高度抖动 */
.video-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper-2);
  border: var(--line-dot);
}

.video-cover-fallback.video-cover-fill {
  width: 100%;
  height: 100%;
}

.video-cover-fallback.video-cover-wide {
  width: 100%;
  height: 120px;
  margin-bottom: var(--sp-2);
}

.video-cover-icon {
  color: var(--ink-3);
  opacity: 0.5;
  font-size: 0.9rem;
}
</style>
