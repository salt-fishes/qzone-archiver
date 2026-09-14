<script setup lang="ts">
/**
 * QQ 空间昵称/文本的表情渲染（v4.7 反馈 ②）
 *
 * 背景：QZone 昵称与内容里的表情是 `[em]e327806[/em]` 这类代码，
 * 应用界面此前直接 `{{ nickname }}` 输出，于是"你好，[em]e327806[/em]"这种原文就露出来了。
 * 引擎侧导出档案时已有 formatEmoticon 转换，界面侧一直缺这一步。
 *
 * 策略（离线可用，不依赖 CDN 存活）：
 *   1. 内置表情（assets/emoticons/qq，随包分发）→ 引用本地文件；
 *   2. 内置库没有的 id → 回落腾讯 CDN；
 *   3. 图片加载失败 → 隐藏图片并显示原始代码（不出现破图）。
 * 安全性：文本一律先转义，只有我们自己生成的 <img> 参与渲染，避免昵称注入 HTML。
 */
import { computed } from 'vue';
// 内置表情清单（由 scripts/sync-emoticons.mjs 生成）：roster 给出「id → 真实文件名」，
// 必须按真实扩展名取文件 —— 经典表情是 .gif，魔法表情（e327xxx）多为 .png。
import emoticonManifest from '../../assets/emoticons-manifest.json';

const props = withDefaults(
  defineProps<{
    /** 原始文本（可能含 [em]e123[/em]） */
    text?: string | null;
    /** 表情渲染尺寸（px） */
    size?: number;
  }>(),
  { text: '', size: 16 }
);

/** id → 本地文件名（离线可用，随包分发到 renderer/dist/emoticons） */
const ROSTER = (emoticonManifest as { roster?: Record<string, string> }).roster || {};

function localFileName(id: number): string | undefined {
  return ROSTER[String(id)];
}

/**
 * 本地表情 URL：相对 index.html 解析（vite base 为 './'），
 * 对应 dist/emoticons/qq/<真实文件名> —— 打包进 asar 后同样可用。
 */
function localEmoticonUrl(id: number) {
  const name = localFileName(id);
  return name ? `./emoticons/qq/${name}` : '';
}

function cdnEmoticonUrl(id: number) {
  return `https://qzonestyle.gtimg.cn/qzone/em/e${id}.gif`;
}

type Part = { type: 'text'; value: string } | { type: 'em'; id: number; alt: string };

/** 解析 `[em]e123[/em]`：其余内容原样作为文本段（渲染时转义） */
const parts = computed<Part[]>(() => {
  const raw = String(props.text ?? '');
  const out: Part[] = [];
  const re = /\[em\]e(\d+)\[\/em\]/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: raw.slice(last, m.index) });
    out.push({ type: 'em', id: Number(m[1]), alt: m[0] });
    last = m.index + m[0].length;
  }
  if (last < raw.length) out.push({ type: 'text', value: raw.slice(last) });
  return out;
});

/**
 * 图片加载失败的兜底：
 *   本地文件（真实扩展名）→ 腾讯 CDN → 隐藏图片、显示原始代码（不出现破图）
 */
function onImgError(e: Event) {
  const img = e.target as HTMLImageElement;
  const step = img.dataset.step || '0';
  const id = Number(img.dataset.id || '0');
  if (step === '0') {
    img.dataset.step = '1';
    img.src = cdnEmoticonUrl(id);
    return;
  }
  const alt = img.dataset.alt || '';
  const span = document.createElement('span');
  span.className = 'em-fallback';
  span.textContent = alt;
  img.replaceWith(span);
}
</script>

<template>
  <span class="em-text">
    <template
      v-for="(p, i) in parts"
      :key="i"
    >
      <span v-if="p.type === 'text'">{{ p.value }}</span>
      <img
        v-else
        class="em-img"
        :src="localEmoticonUrl(p.id) || cdnEmoticonUrl(p.id)"
        :data-alt="p.alt"
        :data-id="p.id"
        data-step="0"
        :alt="p.alt"
        :style="{ width: size + 'px', height: size + 'px' }"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="onImgError"
      >
    </template>
  </span>
</template>

<style scoped>
.em-text {
  display: inline;
}
.em-img {
  display: inline-block;
  vertical-align: -0.18em;
  margin: 0 1px;
}
.em-fallback {
  opacity: 0.7;
}
</style>
