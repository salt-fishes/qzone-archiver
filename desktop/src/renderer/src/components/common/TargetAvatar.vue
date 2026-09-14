<script setup lang="ts">
/**
 * 备份目标头像（v4.7 反馈 ②）
 * 图片来源为主进程本地缓存（data URL）；没有时回落昵称首字/问号占位，
 * 不使用外链（file:// 下直连 qlogo 会被防盗链拦掉，且离线不可用）。
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
const fallbackChar = computed(() => (props.label || '?').trim().slice(0, 1) || '?');
</script>

<template>
  <NAvatar
    round
    :size="size"
    :src="src || undefined"
    style="background: #b45f3d"
  >
    {{ fallbackChar }}
  </NAvatar>
</template>
