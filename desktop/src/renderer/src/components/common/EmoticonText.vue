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
// 内置表情清单（由 scripts/sync-emoticons.mjs 从 desktop/assets/emoticons/manifest.json 同步，
// 组件据此区分「可离线渲染的内置表情」与「回落 CDN 的表情」，避免两处清单漂移）
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

/** 内置 QQ 表情 id（离线可用，随包分发到 renderer/dist/emoticons） */
const BUILTIN_QQ_IDS = new Set<number>((emoticonManifest.qq as number[]).map((v) => Number(v)));
/**
 * 已下载到本地的「魔法表情」id（如 e327806）。
 * 由 scripts/fetch-magic-emoticons.mjs 探测下载后写入 manifest.qqMagic，
 * 未在清单内的 id 走腾讯 CDN 在线加载。
 */
const MAGIC_QQ_IDS = new Set<number>(((emoticonManifest as { qqMagic?: number[] }).qqMagic || []).map((v) => Number(v)));

/** 本地是否可离线渲染该 id */
function hasLocal(id: number) {
  return BUILTIN_QQ_IDS.has(id) || MAGIC_QQ_IDS.has(id);
}

/**
 * 本地内置表情 URL：相对 index.html 解析（vite base 为 './'），
 * 对应 dist/emoticons/qq/e{id}.gif —— 打包进 asar 后同样可用。
 */
function localEmoticonUrl(id: number) {
  return `./emoticons/qq/e${id}.gif`;
}

function cdnEmoticonUrl(id: number) {
  return `https://qzonestyle.gtimg.cn/qzone/em/e${id}.gif`;
}

function localEmoticonPngUrl(id: number) {
  return `./emoticons/qq/e${id}.png`;
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
 * 图片加载失败的三级兜底：
 *   本地 .gif → 本地 .png（魔法表情可能是 png）→ 隐藏图片显示原始代码
 */
function onImgError(e: Event) {
  const img = e.target as HTMLImageElement;
  const step = img.dataset.step || '0';
  const id = Number(img.dataset.id || '0');
  if (step === '0') {
    img.dataset.step = '1';
    img.src = localEmoticonPngUrl(id);
    return;
  }
  if (step === '1' && !hasLocal(id)) {
    img.dataset.step = '2';
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
        :src="hasLocal(p.id) ? localEmoticonUrl(p.id) : cdnEmoticonUrl(p.id)"
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
