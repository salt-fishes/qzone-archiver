<script setup lang="ts">
/**
 * QQ 空间昵称/文本的表情渲染（v4.7 反馈 ②）
 *
 * QZone 昵称与内容里的表情是 `[em]e327806[/em]` 这类代码，界面上必须转成图片，
 * 否则用户看到的就是原始代码。取图有三级兜底：
 *   1. 本地相对路径（`./emoticons/qq/<真实文件名>`，由 sync-emoticons 同步进产物）
 *   2. 主进程内联 data URL（IPC emoticons:get）—— 实机上路径加载失败时兜底，
 *      不依赖 URL 解析/协议/网络（v4.7.4 新增）
 *   3. 腾讯 CDN（仅内置库未收录、且前两级都失败的 id）
 * 全部失败才显示原始代码文本（不出破图）。
 *
 * 安全性：文本一律转义，只有我们自己生成的 <img> 参与渲染，避免昵称注入 HTML。
 * 缓存：id → 可用 src 记在模块级 Map 里，切换页面/重渲染不重复请求。
 */
import { computed, ref, watch } from 'vue';
// 内置表情清单（由 scripts/sync-emoticons.mjs 生成）：roster 给出「id → 真实文件名」。
// 经典表情是 .gif，魔法表情（e327xxx）多为 .png —— 必须按真实文件名取，不能猜扩展名。
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

const ROSTER = (emoticonManifest as { roster?: Record<string, string> }).roster || {};

/** id → 已验证可用的 src（'ok:…' 本地路径 / 'data:…' 内联 / 'cdn' 已回落） */
const resolved = ref<Record<string, string>>({});
/** 正在请求的 id（避免并发重复 IPC） */
const loading = new Set<string>();
/** 已判定「本地路径不可用」的 id：下次直接走 IPC，不再产生一次失败请求 */
const pathFailed = new Set<string>();

function localUrl(id: number): string {
  const name = ROSTER[String(id)];
  return name ? `./emoticons/qq/${name}` : '';
}

function cdnUrl(id: number): string {
  return `https://qzonestyle.gtimg.cn/qzone/em/e${id}.gif`;
}

/** 需要渲染的表情 id 列表 */
const emIds = computed<number[]>(() => {
  const raw = String(props.text ?? '');
  const ids: number[] = [];
  const re = /\[em\]e(\d+)\[\/em\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) ids.push(Number(m[1]));
  return ids;
});

/** 该 id 当前应显示的图（未就绪返回空串 → 由模板决定是否隐藏） */
function srcOf(id: number): string {
  const hit = resolved.value[id];
  if (hit === 'cdn') return cdnUrl(id);
  if (hit) return hit;
  // 未解析完成：先给个候选（本地优先），失败后由 onImgError 换 IPC 兜底
  if (pathFailed.has(String(id)) || !localUrl(id)) return '';
  return localUrl(id);
}

/** 通过主进程内联取图（最可靠的一级） */
async function loadViaIpc(id: number) {
  const key = String(id);
  if (loading.has(key)) return;
  loading.add(key);
  try {
    const r = await window.api.emoticons.get(id);
    if (r?.dataUrl) {
      resolved.value = { ...resolved.value, [id]: r.dataUrl };
    } else {
      // 主进程也没有 → 只能回落 CDN
      resolved.value = { ...resolved.value, [id]: 'cdn' };
    }
  } catch (e) {
    console.warn('[EmoticonText] 内联取表情失败', id, e);
    resolved.value = { ...resolved.value, [id]: 'cdn' };
  } finally {
    loading.delete(key);
  }
}

/** 有表情就预取（组件挂载/文本变化时），避免首次渲染闪烁 */
watch(
  emIds,
  (ids) => {
    for (const id of ids) {
      if (resolved.value[id] || loading.has(String(id))) continue;
      if (!localUrl(id)) void loadViaIpc(id);
    }
  },
  { immediate: true }
);

type Part = { type: 'text'; value: string } | { type: 'em'; id: number; alt: string; src: string };

/** 解析 `[em]e123[/em]`：其余内容作为文本段（渲染时由 Vue 转义） */
const parts = computed<Part[]>(() => {
  const raw = String(props.text ?? '');
  const out: Part[] = [];
  const re = /\[em\]e(\d+)\[\/em\]/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: raw.slice(last, m.index) });
    const id = Number(m[1]);
    out.push({ type: 'em', id, alt: m[0], src: srcOf(id) });
    last = m.index + m[0].length;
  }
  if (last < raw.length) out.push({ type: 'text', value: raw.slice(last) });
  return out;
});

/**
 * 图片加载失败的处理链：
 *   本地路径失败 → 标记并走 IPC 内联 → 再失败 → CDN → 最终显示原始代码
 */
function onImgError(e: Event) {
  const img = e.target as HTMLImageElement;
  const id = Number(img.dataset.id || '0');
  const alt = img.dataset.alt || '';
  const src = img.getAttribute('src') || '';

  if (src.startsWith('./') || src.startsWith('file:')) {
    // 本地路径不通：记下来，改走主进程内联（不依赖 URL 解析）
    pathFailed.add(String(id));
    delete resolved.value[id];
    void loadViaIpc(id);
    // 立刻隐藏这张图，等 resolved 更新后重建
    img.style.display = 'none';
    return;
  }
  if (src.startsWith('data:')) {
    // 内联也失败（极少见）：回落 CDN
    resolved.value = { ...resolved.value, [id]: 'cdn' };
    return;
  }
  // 已是 CDN 仍失败 → 显示原始代码，避免破图
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
        v-else-if="p.src"
        class="em-img"
        :src="p.src"
        :data-alt="p.alt"
        :data-id="p.id"
        :alt="p.alt"
        :style="{ width: size + 'px', height: size + 'px' }"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="onImgError"
      >
      <!-- 尚未取到图：先不显示任何东西（避免闪出原始代码） -->
      <span
        v-else
        class="em-pending"
        :style="{ width: size + 'px', height: size + 'px' }"
      />
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
.em-pending {
  display: inline-block;
  vertical-align: -0.18em;
}
.em-fallback {
  opacity: 0.7;
}
</style>
