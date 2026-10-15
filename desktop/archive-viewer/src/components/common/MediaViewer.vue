<script lang="ts">
/**
 * 媒体查看器条目（普通 script 块导出类型，供 MediaGrid / 相册等复用）
 */
export interface MediaItem {
  /** 预览源：图片为原图、视频为视频文件地址 */
  src: string
  /** 缩略图 / 视频封面（视频 poster 回退） */
  thumb: string
  caption?: string
  type?: 'image' | 'video'
  poster?: string
  duration?: string
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import VideoHevcTip from '@/components/common/VideoHevcTip.vue'
import { detectHevcSupport, isCodecUnsupportedError } from '@/utils/videoCompat'

/**
 * 通用媒体查看器（全屏遮罩）
 *
 * 各详情弹窗（MediaGrid）与相册详情（AlbumDetailModal）共用：
 * - 左右切换：两侧按钮 / ← → 键（自动跳过 src 为空的条目）
 * - 放大缩小：图片支持滚轮（以指针为锚点）、单击切换、±按钮与 +/−/0 键；
 *   放大后可拖拽平移；视频走原生控件不缩放
 * - Esc 关闭：捕获阶段拦截，避免穿透把下层弹窗一并关掉
 * - 视频解码失败（H.265 等）展示引导提示
 */
const props = defineProps<{
  items: MediaItem[]
  /** 当前索引；-1 表示关闭 */
  index: number
}>()

const emit = defineEmits<{ 'update:index': [number] }>()

const overlayRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)

const current = computed(() => (props.index >= 0 ? props.items[props.index] || null : null))
const isVideo = computed(() => current.value?.type === 'video')

// ============ 缩放 / 平移 ============
const MIN_SCALE = 1
const MAX_SCALE = 8

const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
/** 按钮/双击缩放时启用过渡；滚轮与拖拽即时跟手 */
const smooth = ref(false)
const panning = ref(false)

const imgStyle = computed(() => ({
  transform: `translate3d(${tx.value}px, ${ty.value}px, 0) scale(${scale.value})`
}))

/** 平移边界：放大后的图片不飞出遮罩可视区 */
function clampPan() {
  const img = imgRef.value
  const ov = overlayRef.value
  if (!img || !ov) return
  const maxX = Math.max(0, (img.offsetWidth * scale.value - ov.clientWidth) / 2)
  const maxY = Math.max(0, (img.offsetHeight * scale.value - ov.clientHeight) / 2)
  tx.value = Math.max(-maxX, Math.min(maxX, tx.value))
  ty.value = Math.max(-maxY, Math.min(maxY, ty.value))
}

/**
 * 以遮罩中心为原点的坐标处为锚点缩放（cx/cy 为相对中心偏移）
 */
function applyZoom(factor: number, cx = 0, cy = 0, animate = false) {
  if (!current.value || isVideo.value) return
  const s1 = scale.value
  const s2 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s1 * factor))
  smooth.value = animate
  if (s2 <= MIN_SCALE + 0.0001) {
    scale.value = MIN_SCALE
    tx.value = 0
    ty.value = 0
    return
  }
  if (Math.abs(s2 - s1) < 0.0001) return
  const k = s2 / s1
  tx.value = cx - (cx - tx.value) * k
  ty.value = cy - (cy - ty.value) * k
  scale.value = s2
  clampPan()
}

function resetZoom(animate = true) {
  smooth.value = animate
  scale.value = MIN_SCALE
  tx.value = 0
  ty.value = 0
}

function zoomIn() { applyZoom(1.4, 0, 0, true) }
function zoomOut() { applyZoom(1 / 1.4, 0, 0, true) }

function onWheel(e: WheelEvent) {
  if (!current.value || isVideo.value) return
  const ov = overlayRef.value
  if (!ov) return
  const mult = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
  const rect = ov.getBoundingClientRect()
  const cx = e.clientX - (rect.left + rect.width / 2)
  const cy = e.clientY - (rect.top + rect.height / 2)
  applyZoom(Math.exp(-e.deltaY * mult * 0.002), cx, cy, false)
}

// 按住拖拽平移（放大后）；拖拽超过阈值则忽略随后触发的 click
let press = { active: false, moved: false, x: 0, y: 0, tx: 0, ty: 0 }

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  press = { active: true, moved: false, x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value }
  // 指针捕获可能失败（如指针已释放 / 合成事件），失败时退化为普通拖拽
  try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* 忽略 */ }
}

function onPointerMove(e: PointerEvent) {
  if (!press.active) return
  const dx = e.clientX - press.x
  const dy = e.clientY - press.y
  if (!press.moved && Math.abs(dx) + Math.abs(dy) > 4) press.moved = true
  if (!press.moved || scale.value <= MIN_SCALE) return
  panning.value = true
  smooth.value = false
  tx.value = press.tx + dx
  ty.value = press.ty + dy
  clampPan()
}

function onPointerUp(e: PointerEvent) {
  if (!press.active) return
  press.active = false
  panning.value = false
  try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId) } catch { /* 忽略 */ }
}

/** 单击图片：未放大 → 以点击处为锚点放大到 2x；已放大 → 复原
 *  （快速连击视为双击，只按一次处理，避免放大后立刻复原） */
let lastToggleTs = 0

function onMediaClick(e: MouseEvent) {
  if (press.moved) return
  const now = Date.now()
  if (now - lastToggleTs < 260) return
  lastToggleTs = now
  if (scale.value > MIN_SCALE) {
    resetZoom(true)
    return
  }
  const ov = overlayRef.value
  if (!ov) return
  const rect = ov.getBoundingClientRect()
  applyZoom(2, e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2), true)
}

// ============ 切换 / 关闭 ============
function close() {
  emit('update:index', -1)
}

/** 切换条目：循环并跳过 src 为空的条目 */
function step(dir: number) {
  const n = props.items.length
  if (n < 2) return
  let j = props.index
  for (let k = 0; k < n; k++) {
    j = (j + dir + n) % n
    const it = props.items[j]
    if (it && it.src) {
      emit('update:index', j)
      return
    }
  }
}

// 条目变化：越界时关闭；切换时复位缩放与视频错误态
watch(() => props.index, () => {
  videoError.value = false
  hevcUnsupported.value = false
  resetZoom(false)
})

watch(() => props.items.length, () => {
  if (props.index >= props.items.length) close()
})

// ============ 视频解码失败提示 ============
const hevcSupported = detectHevcSupport()
const videoError = ref(false)
const hevcUnsupported = ref(false)

function onVideoError(e: Event) {
  videoError.value = true
  hevcUnsupported.value = !hevcSupported && isCodecUnsupportedError(e.target as HTMLVideoElement)
}

const tipText = computed(() => {
  const c = current.value
  if (!c) return ''
  const base = `${props.index + 1} / ${props.items.length}`
  if (c.caption) return `${base} · ${c.caption}`
  return isVideo.value ? `${base} · ←→ 切换 · Esc 关闭` : `${base} · 单击/滚轮缩放 · ←→ 切换 · Esc 关闭`
})

// ============ 键盘（捕获阶段：优先于下层弹窗的 Esc 处理） ============
function onKeydown(e: KeyboardEvent) {
  if (props.index < 0) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
  } else if (e.key === 'ArrowLeft') {
    e.stopPropagation()
    e.preventDefault()
    step(-1)
  } else if (e.key === 'ArrowRight') {
    e.stopPropagation()
    e.preventDefault()
    step(1)
  } else if (!isVideo.value && (e.key === '+' || e.key === '=')) {
    zoomIn()
  } else if (!isVideo.value && (e.key === '-' || e.key === '_')) {
    zoomOut()
  } else if (!isVideo.value && e.key === '0') {
    resetZoom(true)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onUnmounted(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <Teleport to="body">
    <Transition name="mv-fade">
      <div
        v-if="current"
        ref="overlayRef"
        class="mv-overlay"
        :class="{ 'mv-grabbing': panning }"
        @click.self="close"
        @wheel.prevent="onWheel"
      >
        <!-- 视频：原生控件播放 -->
        <video
          v-if="isVideo && !videoError"
          :key="`v-${index}`"
          :src="current.src"
          :poster="current.poster || current.thumb || undefined"
          controls
          autoplay
          playsinline
          class="mv-video"
          @error="onVideoError"
        ></video>
        <div v-else-if="isVideo" class="mv-error">
          <VideoHevcTip :hevc="hevcUnsupported" />
        </div>

        <!-- 图片：支持缩放 / 平移 -->
        <img
          v-else
          ref="imgRef"
          :key="`i-${index}`"
          :src="current.src"
          class="mv-img"
          :class="{ 'mv-zoomed': scale > MIN_SCALE, 'mv-smooth': smooth }"
          :style="imgStyle"
          :alt="current.caption || ''"
          draggable="false"
          @click="onMediaClick"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
        />

        <!-- 上一张 / 下一张 -->
        <button
          v-if="items.length > 1"
          type="button"
          class="mv-nav mv-prev"
          aria-label="上一张"
          @click="step(-1)"
        >‹</button>
        <button
          v-if="items.length > 1"
          type="button"
          class="mv-nav mv-next"
          aria-label="下一张"
          @click="step(1)"
        >›</button>

        <!-- 关闭 -->
        <button type="button" class="mv-close" aria-label="关闭" @click="close">×</button>

        <!-- 底部栏：缩放控件（仅图片）+ 计数/说明 -->
        <div class="mv-bar">
          <span v-if="!isVideo" class="mv-zoom">
            <button type="button" class="mv-zbtn" aria-label="缩小" @click="zoomOut">−</button>
            <button type="button" class="mv-zpct" title="复原（100%）" @click="resetZoom(true)">
              {{ Math.round(scale * 100) }}%
            </button>
            <button type="button" class="mv-zbtn" aria-label="放大" @click="zoomIn">＋</button>
          </span>
          <span class="mv-tip">{{ tipText }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mv-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 22, 18, 0.92);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-5);
  touch-action: none;
}

/* ============ 媒体本体 ============ */
.mv-img {
  max-width: 92vw;
  max-height: 82vh;
  object-fit: contain;
  border: var(--rule);
  background: var(--paper);
  cursor: zoom-in;
  transform-origin: center center;
  user-select: none;
  -webkit-user-drag: none;
  will-change: transform;
}

.mv-img.mv-zoomed {
  cursor: grab;
}

.mv-overlay.mv-grabbing .mv-img {
  cursor: grabbing;
}

.mv-img.mv-smooth {
  transition: transform 0.18s var(--ease-out);
}

.mv-video {
  max-width: 92vw;
  max-height: 82vh;
  background: #000;
  border: var(--rule);
}

/* H.265 等无法解码时的引导提示容器 */
.mv-error {
  max-width: min(560px, 92vw);
  background: var(--paper);
  border: var(--rule);
  padding: var(--sp-1);
}

/* ============ 切换按钮 ============ */
.mv-nav {
  position: absolute;
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

.mv-nav:hover {
  background: var(--vermilion);
  border-color: var(--vermilion);
}

.mv-prev { left: var(--sp-5); }
.mv-next { right: var(--sp-5); }

.mv-close {
  position: absolute;
  top: var(--sp-3);
  right: var(--sp-5);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--paper);
  border: 1px solid rgba(244, 236, 216, 0.35);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s;
}

.mv-close:hover {
  background: var(--vermilion);
  border-color: var(--vermilion);
}

/* ============ 底部栏 ============ */
.mv-bar {
  position: absolute;
  left: 50%;
  bottom: var(--sp-5);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  max-width: 92vw;
}

.mv-zoom {
  display: flex;
  align-items: center;
  background: rgba(244, 236, 216, 0.1);
  border: 1px solid rgba(244, 236, 216, 0.35);
  flex: none;
}

.mv-zbtn,
.mv-zpct {
  background: transparent;
  color: var(--paper);
  border: none;
  font-family: var(--font-mono);
  cursor: pointer;
  padding: 5px 11px;
  font-size: 0.85rem;
  line-height: 1;
  transition: background 0.15s;
}

.mv-zpct {
  min-width: 58px;
  border-left: 1px solid rgba(244, 236, 216, 0.25);
  border-right: 1px solid rgba(244, 236, 216, 0.25);
  letter-spacing: 0.05em;
}

.mv-zbtn:hover,
.mv-zpct:hover {
  background: var(--vermilion);
}

.mv-tip {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--paper);
  letter-spacing: 0.1em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ============ 遮罩过渡 ============ */
.mv-fade-enter-active,
.mv-fade-leave-active {
  transition: opacity 0.2s ease;
}

.mv-fade-enter-from,
.mv-fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .mv-overlay {
    padding: var(--sp-3);
  }
  .mv-prev { left: var(--sp-2); }
  .mv-next { right: var(--sp-2); }
  .mv-close { right: var(--sp-2); }
  .mv-bar {
    bottom: var(--sp-3);
    gap: var(--sp-2);
  }
  .mv-nav {
    width: 40px;
    height: 40px;
    font-size: 1.5rem;
  }
}
</style>
