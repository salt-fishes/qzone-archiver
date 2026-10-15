<template>
  <ArchiveEntry
    :time="index.createTime"
    :clickable="clickable"
    :class="{ 'album-noaccess': isNoAccess }"
    @click="handleClick"
  >
    <template #head>
      <span class="entry-type-tag">相册</span>
      <span v-if="isNoAccess" class="album-badge album-badge-seal">未备份</span>
      <span v-else-if="isEmpty" class="album-badge album-badge-empty">空相册</span>
      <span v-if="index.className" class="album-class">{{ index.className }}</span>
    </template>

    <!-- 封面：拼图 / 单图 / 密封（未备份）/ 空白（无照片）四种形态 -->
    <div class="album-cover" :class="coverClass">
      <!-- 未备份：斜纹密封 + 朱砂印 -->
      <div v-if="isNoAccess" class="album-sealed">
        <span class="seal-mark">未备份</span>
        <span class="seal-sub">无权限访问</span>
      </div>

      <!-- 多图拼图：1 大 + N 小 -->
      <div v-else-if="previews.length > 1" class="album-mosaic" :class="`album-mosaic-${Math.min(previews.length, 4)}`">
        <span
          v-for="(p, i) in previews"
          :key="i"
          class="mosaic-cell"
          :class="`mosaic-cell-${i}`"
        >
          <img
            v-if="!photoErrors[i]"
            :src="p"
            class="mosaic-img"
            :alt="index.name || '相册照片'"
            loading="lazy"
            decoding="async"
            @error="photoErrors[i] = true"
          />
          <span v-else class="mosaic-fallback">▣</span>
        </span>
      </div>

      <!-- 单图封面 -->
      <img
        v-else-if="previews.length === 1"
        :src="previews[0]"
        class="album-single"
        :alt="index.name || '相册照片'"
        loading="lazy"
        decoding="async"
      />

      <!-- 无照片（空相册 / 旧档案无封面） -->
      <div v-else class="album-blank">
        <span class="blank-mark">▣</span>
        <span class="blank-text">{{ isEmpty ? '相册内没有照片' : '暂无封面' }}</span>
      </div>

      <!-- 照片数角标 -->
      <span v-if="!isNoAccess && index.photoCount > 0" class="cover-count">{{ index.photoCount }} 张</span>
    </div>

    <!-- 相册名 -->
    <p class="entry-text" :class="{ 'entry-text-empty': !index.name }">{{ displayName }}</p>

    <!-- 摘要（支持 2 行截断） -->
    <p v-if="displayDesc" class="entry-abstract">{{ displayDesc }}</p>

    <template #stats>
      <!-- 未备份：原因行代替统计（歧义消解：不是"没有照片"，而是"没权限、未采集"） -->
      <template v-if="isNoAccess">
        <span class="entry-stat album-reason">
          <span class="entry-stat-icon">⊘</span>
          <span class="entry-stat-num">无权限访问（对方设为私密或仅好友可见），未采集</span>
        </span>
      </template>
      <template v-else>
        <span v-if="index.photoCount > 0" class="entry-stat active" title="照片数量">
          <span class="entry-stat-icon">▤</span>
          <span class="entry-stat-num">照片 {{ index.photoCount }}</span>
        </span>
        <span v-if="index.commentCount > 0" class="entry-stat active" title="评论数量">
          <span class="entry-stat-icon">✎</span>
          <span class="entry-stat-num">评论 {{ index.commentCount }}</span>
        </span>
        <span v-if="index.likeCount > 0" class="entry-stat active" title="点赞数量">
          <span class="entry-stat-icon">♡</span>
          <span class="entry-stat-num">赞 {{ index.likeCount }}</span>
        </span>
      </template>
      <span v-if="clickable" class="entry-stat entry-stat-cta">
        {{ isNoAccess ? '查看原因 →' : '查看详情 →' }}
      </span>
    </template>
  </ArchiveEntry>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ArchiveEntry from '@/components/common/ArchiveEntry.vue'
import { usePhotosStore } from '@/stores/photos'
import { stripFormatting, resolveModulePath } from '@/utils/formatContent'
import type { AlbumIndex } from '@/types'

const props = withDefaults(defineProps<{
  index: AlbumIndex
  clickable?: boolean
}>(), {
  clickable: true
})

const emit = defineEmits<{ open: [index: AlbumIndex] }>()

const MODULE = 'Albums'
const photosStore = usePhotosStore()

// 无名称时显示占位文案
const displayName = computed(() => props.index.name || '(未命名相册)')
// 摘要去格式化后展示
const displayDesc = computed(() => stripFormatting(props.index.desc || ''))

/** 无权限相册（接口 allowAccess=0）：不加载分片、不展示照片数，显示「未备份」 */
const isNoAccess = computed(() => props.index.noAccess === true)
/** 空相册：有权限但 0 张照片（游戏自动生成的空相册等） */
const isEmpty = computed(() => !isNoAccess.value && (props.index.photoCount || 0) === 0)

/** 封面图地址（仅作为相册详情加载失败时的回退） */
const coverSrc = computed(() => {
  if (!props.index.hasCover || !props.index.coverUrl) return ''
  return resolveModulePath(props.index.coverUrl, MODULE)
})

/** 多照片预览（前 4 张）；未备份相册不加载分片 */
const previews = ref<string[]>([])
const photoErrors = ref<boolean[]>([])

/** 封面形态 class（拼图按张数选布局） */
const coverClass = computed(() => ({
  'album-cover-sealed': isNoAccess.value,
  'album-cover-blank': !isNoAccess.value && previews.value.length === 0,
}))

// 相册切换时按需加载详情取前 4 张；详情缺失时回退单张封面
let reqId = 0
watch(() => props.index.albumId, async (id) => {
  const cur = ++reqId
  previews.value = []
  photoErrors.value = []
  if (!id || isNoAccess.value) return
  const album = await photosStore.getAlbumById(String(id))
  if (cur !== reqId) return // 快速滚动时丢弃过期结果
  const list = album?.photoList || []
  if (list.length) {
    previews.value = list.slice(0, 4).map(p => {
      const raw = p.custom_filepath || p.s_url || p.t_url || p.custom_url || ''
      return raw ? resolveModulePath(raw, MODULE) : ''
    }).filter(Boolean)
  } else if (props.index.hasCover && coverSrc.value) {
    previews.value = [coverSrc.value]
  }
}, { immediate: true })

function handleClick() {
  if (props.clickable) emit('open', props.index)
}
</script>

<style scoped>
/* 相册模块的类型标签用深色背景（与 Video 保持一致） */
.archive-entry :deep(.entry-type-tag) {
  color: var(--ink);
  background: var(--paper-raised);
  border-color: var(--ink-muted);
  padding: 1px 8px;
}

/* ===== 状态印章（v5.4 视觉重做） ===== */
.album-badge {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  padding: 1px 7px;
  border: 1px solid;
}

.album-badge-seal {
  color: var(--paper);
  background: var(--vermilion);
  border-color: var(--vermilion);
}

.album-badge-empty {
  color: var(--ink-3);
  background: transparent;
  border-color: var(--ink-muted);
  border-style: dashed;
}

.album-class {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: var(--ink-muted);
}

/* ===== 封面（v5.4 视觉重做）：16:9 稳定高度，拼图 / 单图 / 密封 / 空白 ===== */
.album-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin-bottom: var(--sp-2);
  overflow: hidden;
  border: var(--rule);
  background: var(--paper-2);
}

/* 单图 */
.album-single {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--dur-2) var(--ease-out);
}

/* 拼图：1 大 + N 小 */
.album-mosaic {
  display: grid;
  gap: 2px;
  width: 100%;
  height: 100%;
}

/* 2 张：等宽两列；3/4 张：左大右小（大图跨行） */
.album-mosaic-2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
.album-mosaic-3 { grid-template-columns: 2fr 1fr; grid-template-rows: repeat(2, 1fr); }
.album-mosaic-4 { grid-template-columns: 2fr 1fr; grid-template-rows: repeat(3, 1fr); }

.mosaic-cell {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--paper-2);
}

.album-mosaic-3 .mosaic-cell-0,
.album-mosaic-4 .mosaic-cell-0 { grid-row: 1 / -1; }

.mosaic-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--dur-2) var(--ease-out);
}

.mosaic-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--ink-3);
  background: var(--paper-2);
  font-size: 1rem;
}

/* 悬停：整组封面轻微推近（仅悬停态，静止无动效） */
.archive-entry.clickable:hover .album-single,
.archive-entry.clickable:hover .mosaic-img {
  transform: scale(1.03);
}

/* 未备份：密封封面（斜纹 + 朱砂印），与"有照片"视觉彻底分开 */
.album-cover-sealed {
  border: 1px dashed var(--ink-muted);
  background:
    repeating-linear-gradient(
      -45deg,
      transparent 0 10px,
      rgba(138, 129, 114, 0.10) 10px 11px
    ),
    var(--paper-2);
}

.album-sealed {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 100%;
}

.seal-mark {
  font-family: var(--font-serif-cn);
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: var(--vermilion);
  border: 2px solid var(--vermilion);
  padding: 4px 12px 4px 16px;
  transform: rotate(-4deg);
}

.seal-sub {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  color: var(--ink-muted);
}

/* 空相册 / 无封面：空白封面 */
.album-cover-blank {
  border-style: dashed;
  border-color: var(--ink-muted);
}

.album-blank {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 100%;
  color: var(--ink-3);
}

.blank-mark {
  font-size: 1.4rem;
  opacity: 0.6;
}

.blank-text {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
}

/* 照片数角标（封面右下） */
.cover-count {
  position: absolute;
  right: 0;
  bottom: 0;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  color: var(--paper);
  background: rgba(33, 29, 23, 0.72);
  padding: 2px 8px;
}

/* 未备份原因行 */
.album-reason {
  color: var(--ink-2);
  font-size: 0.68rem;
}

.album-reason .entry-stat-icon {
  color: var(--vermilion);
}

/* 未备份整卡降饱和（与正常相册在流式列表里一眼区分） */
.archive-entry.album-noaccess :deep(.entry-date),
.archive-entry.album-noaccess :deep(.entry-body) {
  opacity: 0.82;
}
</style>
