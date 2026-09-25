<script setup lang="ts">
/**
 * 备份目标头像（v4.7 反馈 ②）
 * 图片来源为主进程本地缓存（data URL）；没有时回落昵称首字/问号占位，
 * 不使用外链（file:// 下直连 qlogo 会被防盗链拦掉，且离线不可用）。
 *
 * ⚠️ v4.7.5 修复（头像一直是"文字头像"的根因）：
 *   占位文字**不能**放进 NAvatar 的默认插槽 —— naive-ui 的 NAvatar 只要默认插槽
 *   非空，就只渲染文字、**直接忽略 src**（见 naive-ui Avatar.mjs：
 *   `resolveWrappedSlot($slots.default, children => children ? 文字 : (src ? img : null))`）。
 *   之前是"同时给 src 和默认插槽首字"，于是永远出文字、永远不出图，
 *   跟取图链路（缓存/IPC/data URL）通不通完全无关。
 *   正确做法：文字占位走 render-fallback（加载失败时）或走"没有 src 时的文字分支"。
 *   tests/unit/avatars.render.test.mjs 里有静态守卫盯着这条，别再写回去。
 */
import { computed } from 'vue';
import { NAvatar } from 'naive-ui';
import { avatarOf } from '../../stores/avatars';

const props = withDefaults(
  defineProps<{
    uin?: string | number | null;
    /** 占位文字（一般是昵称） */
    label?: string;
    size?: number;
  }>(),
  { uin: null, label: '', size: 30 }
);

/** 触发按需加载；缓存命中后由响应式 cache 重新求值 */
const src = computed(() => avatarOf(props.uin));

/**
 * 占位首字：昵称里可能带 `[em]e327806[/em]` 这类表情代码，
 * 直接 slice(0,1) 会显示出 `[`，先剥掉表情代码再取首字。
 */
const fallbackChar = computed(
  () =>
    (props.label || '?')
      .replace(/\[em\][^[]*\[\/em\]/gi, '')
      .trim()
      .slice(0, 1) || '?'
);

/** 图片加载失败时 naive-ui 调用的占位渲染（必须是函数，不能用默认插槽） */
function renderFallback() {
  return fallbackChar.value;
}
</script>

<template>
  <!-- 已拿到图：交给 NAvatar 渲染 <img>，加载失败由 render-fallback 兜底首字 -->
  <NAvatar
    v-if="src"
    round
    :size="size"
    :src="src"
    :render-fallback="renderFallback"
    style="background: #b5432a"
  />
  <!-- 还没拿到图（首次请求中 / 无缓存且抓取失败）：渲染首字占位 -->
  <NAvatar
    v-else
    round
    :size="size"
    style="background: #b5432a"
  >
    {{ fallbackChar }}
  </NAvatar>
</template>
