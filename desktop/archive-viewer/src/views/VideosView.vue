<template>
  <section class="videos-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 05</span>
      <h2 class="section-title">视频 · 档案</h2>
      <span class="section-meta">{{ headMeta }}</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="videosStore.loading" class="app-loading">正在加载视频索引…</div>

    <!-- 错误状态 -->
    <div v-else-if="videosStore.error" class="error-tip">
      <p>{{ videosStore.error }}</p>
      <p class="hint">提示：视频数据尚未导出。请先在扩展中选择「视频 → SPA」备份类型并完成导出。</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="videosStore.total === 0" class="empty-tip">
      <p>暂无视频数据</p>
    </div>

    <!-- 主视图：搜索结果 + 虚拟滚动列表 -->
    <template v-else>
      <!-- 搜索结果元信息 -->
      <div class="search-meta">
        <span class="meta">{{ searchMeta }}</span>
        <button v-if="query" class="clear-btn" type="button" @click="query = ''">清除搜索</button>
      </div>

      <!-- 无结果 -->
      <div v-if="results.length === 0" class="empty-tip">
        <p>未找到匹配「{{ query }}」的视频</p>
        <p class="hint">试试其他关键字，或清除搜索查看全部。</p>
      </div>

      <!-- 网格铺开（仿相册内部分批渲染：先渲染前 PAGE 条，滚动到末尾加载下一批） -->
      <div v-else class="video-grid">
        <VideoCard
          v-for="(item, i) in visibleVideos"
          :key="`${item.vid}_${item.uploadTime}`"
          :index="item"
          :clickable="true"
          variant="grid"
          :data-video-pos="globalPos(item)"
          @open="handleOpen"
        />
      </div>
      <div v-if="hasMore" ref="sentinelEl" class="video-grid-sentinel" aria-hidden="true"></div>

      <!-- 年份快速跳转 -->
      <div v-if="!query && videosStore.yearGroups.length > 1" class="year-jump">
        <span class="meta">归档：</span>
        <button
          v-for="[year, items] in videosStore.yearGroups"
          :key="year"
          class="year-jump-btn"
          type="button"
          @click="jumpToYear(year)"
        >
          {{ year }} <span class="year-jump-count">{{ items.length }}</span>
        </button>
      </div>
    </template>

    <!-- 详情模态 -->
    <VideoDetailModal
      v-model="detailVisible"
      :video="detailVideo"
      :index="detailIndex"
      :loading="detailLoading"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVideosStore } from '@/stores/videos'
import VideoCard from '@/components/video/VideoCard.vue'
import VideoDetailModal from '@/components/video/VideoDetailModal.vue'
import { stripFormatting } from '@/utils/formatContent'
import type { Video, VideoIndex } from '@/types'

const route = useRoute()
const router = useRouter()
const videosStore = useVideosStore()

// 客户端搜索：视频数据量通常适中，用普通 includes 过滤即可
const query = ref('')

// 网格分页（仿相册内部分批渲染）：每批条数 + 滚动哨兵
const PAGE = 48
const visibleCount = ref(PAGE)
const visibleVideos = computed(() => results.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < results.value.length)
const sentinelEl = ref<HTMLElement | null>(null)
let sentinelIO: IntersectionObserver | null = null

// 详情模态状态
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailVideo = ref<Video | null>(null)
const detailIndex = ref<VideoIndex | null>(null)

const headMeta = computed(() => {
  if (videosStore.loading) return 'Loading…'
  if (videosStore.error) return 'Error'
  return `${videosStore.total} entries`
})

const results = computed<VideoIndex[]>(() => {
  const kw = query.value.trim()
  if (!kw) return videosStore.index
  const lower = kw.toLowerCase()
  return videosStore.index.filter(item => {
    const title = stripFormatting(item.title || '').toLowerCase()
    const desc = stripFormatting(item.desc || '').toLowerCase()
    const vid = (item.vid || '').toLowerCase()
    const time = (item.time || '').toLowerCase()
    return (
      title.includes(lower) ||
      desc.includes(lower) ||
      vid.includes(lower) ||
      time.includes(lower)
    )
  })
})

const searchMeta = computed(() => {
  if (query.value) {
    return `查询「${query.value}」 · 命中 ${results.value.length} 条`
  }
  return `共 ${videosStore.total} 条 · 按时间倒序`
})

/** 视频在完整索引中的位置（用于年份跳转定位） */
function globalPos(item: VideoIndex): number {
  return videosStore.index.indexOf(item)
}

// 路由 query → 搜索框
watch(() => route.query.q, (q) => {
  const next = String(q || '')
  if (next !== query.value) query.value = next
}, { immediate: true })

// 搜索框 → 路由 query；搜索变化时重置分页回第一屏
watch(query, (v) => {
  visibleCount.value = PAGE
  const next = { ...route.query }
  const q = (v || '').trim()
  if (q) next.q = q
  else delete next.q
  if (route.query.q !== q) {
    router.replace({ query: next })
  }
})

async function handleOpen(idx: VideoIndex) {
  detailLoading.value = true
  detailVisible.value = true
  detailVideo.value = null
  detailIndex.value = idx
  try {
    const found = await videosStore.getVideoByIndex(idx)
    detailVideo.value = found || null
    if (!found) {
      console.warn('[VideosView] 未在年份分片中找到视频', idx)
    }
  } catch (e) {
    console.error('[VideosView] 加载视频详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

function jumpToYear(year: string) {
  const pos = videosStore.index.findIndex(item => (item.time || '').startsWith(year))
  if (pos < 0) return
  // 目标尚未渲染（分批）时，先把分页扩到包含该位置
  if (pos >= visibleCount.value) {
    visibleCount.value = Math.ceil((pos + 1) / PAGE) * PAGE
  }
  nextTick(() => {
    const el = document.querySelector<HTMLElement>(`[data-video-pos="${pos}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// 侧边栏年份快速跳转：监听 route.query.year
watch(() => route.query.year, async (year) => {
  const y = year ? String(year) : ''
  if (!y) return
  if (videosStore.index.length === 0) {
    if (!videosStore.loading) videosStore.init()
    while (videosStore.loading) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (videosStore.index.length === 0) return
  }
  await nextTick()
  jumpToYear(y)
}, { immediate: true })

onMounted(() => {
  if (videosStore.index.length === 0 && !videosStore.loading) {
    videosStore.init()
  }
  // 滚动哨兵：进入视口时加载下一批（仿相册内部）
  sentinelIO = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      visibleCount.value += PAGE
    }
  }, { rootMargin: '200px' })
  if (sentinelEl.value) sentinelIO.observe(sentinelEl.value)
})

// 数据异步加载完成后哨兵才存在，需补观察
watch([() => hasMore.value, () => !!sentinelEl.value], ([more, hasEl]) => {
  if (more && hasEl && sentinelEl.value && sentinelIO) {
    sentinelIO.observe(sentinelEl.value)
  }
}, { flush: 'post' })

onBeforeUnmount(() => {
  sentinelIO?.disconnect()
  sentinelIO = null
})
</script>

<style scoped>
.error-tip,
.empty-tip {
  padding: var(--sp-5);
  border: var(--line);
  background: rgba(200, 68, 42, 0.04);
  font-family: var(--font-serif-cn);
}

/* 网格铺开（仿相册内部） */
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--sp-4);
  padding: var(--sp-4);
  border: var(--line);
  background: rgba(255, 255, 255, 0.2);
}

.video-grid-sentinel {
  height: 1px;
}

@media (max-width: 900px) {
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: var(--sp-3);
    padding: var(--sp-3);
  }
}

.error-tip .hint,
.empty-tip .hint {
  margin-top: var(--sp-2);
  font-size: 0.85rem;
  color: var(--ink-3);
}

.search-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin: var(--sp-4) 0 var(--sp-3);
}

.clear-btn {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  background: transparent;
  border: var(--line-dot);
  color: var(--ink-3);
  padding: 2px var(--sp-2);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  color: var(--vermilion);
  border-color: var(--vermilion);
}

.year-jump {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-5);
  padding-top: var(--sp-4);
  border-top: var(--line-double);
}

.year-jump-btn {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  background: transparent;
  color: var(--ink);
  border: var(--line);
  padding: var(--sp-1) var(--sp-3);
  cursor: pointer;
  transition: all 0.15s;
}

.year-jump-btn:hover {
  background: var(--ink);
  color: var(--paper);
}

.year-jump-count {
  color: var(--vermilion);
  margin-left: var(--sp-1);
}

.year-jump-btn:hover .year-jump-count {
  color: var(--paper);
}
</style>
