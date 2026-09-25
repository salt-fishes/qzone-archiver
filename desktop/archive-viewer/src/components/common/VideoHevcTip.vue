<template>
  <div class="hevc-tip" role="alert">
    <span class="hevc-tip-mark">ⓘ</span>
    <div class="hevc-tip-body">
      <p class="hevc-tip-title">{{ title }}</p>
      <p class="hevc-tip-text">{{ message }}</p>
      <p v-if="filePath" class="hevc-tip-path">
        文件位置：<code>{{ filePath }}</code>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { HEVC_UNSUPPORTED_MESSAGE, VIDEO_PLAY_ERROR_MESSAGE } from '@/utils/videoCompat'

/**
 * 视频播放失败提示卡
 *
 * 播放器 <video> 触发 error 时替换显示：若为 H.265 编码不支持，
 * 说明轻量化原因并引导用微信 / QQ / VLC 等播放；否则提示文件异常。
 */
const props = withDefaults(defineProps<{
  /** 是否判定为 H.265 编码不支持（否则按通用播放失败提示） */
  hevc?: boolean
  /** 视频文件相对路径（便于在文件管理器中定位） */
  filePath?: string
}>(), {
  hevc: true,
  filePath: ''
})

const title = computed(() =>
  props.hevc ? 'H.265 视频暂不支持在此浏览器播放' : '视频播放失败'
)
const message = computed(() =>
  props.hevc ? HEVC_UNSUPPORTED_MESSAGE : VIDEO_PLAY_ERROR_MESSAGE
)
</script>

<style scoped>
.hevc-tip {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border: var(--line);
  border-left: 3px solid #b8860b;
  background: rgba(184, 134, 11, 0.06);
  font-family: var(--font-serif-cn);
}

.hevc-tip-mark {
  flex-shrink: 0;
  color: #b8860b;
  font-size: 1.1rem;
  line-height: 1.4;
}

.hevc-tip-body {
  min-width: 0;
}

.hevc-tip-title {
  font-weight: 600;
  color: var(--ink);
  margin: 0 0 var(--sp-1);
}

.hevc-tip-text {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--ink-2);
  margin: 0;
}

.hevc-tip-path {
  margin: var(--sp-2) 0 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink-3);
  word-break: break-all;
}

.hevc-tip-path code {
  color: var(--ink-2);
}
</style>
