<template>
  <section class="favorites-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 11</span>
      <h2 class="section-title">收藏 · 档案</h2>
      <span class="section-meta">{{ headMeta }}</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="favoritesStore.loading" class="app-loading">正在加载收藏索引…</div>

    <!-- 错误状态 -->
    <div v-else-if="favoritesStore.error" class="error-tip">
      <p>{{ favoritesStore.error }}</p>
      <p class="hint">提示：收藏数据尚未导出。请先在扩展中选择「收藏 → SPA」备份类型并完成导出。</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="favoritesStore.total === 0" class="empty-tip">
      <p>暂无收藏数据</p>
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
        <p>未找到匹配「{{ query }}」的收藏</p>
        <p class="hint">试试其他关键字，或清除搜索查看全部。</p>
      </div>

      <!-- 虚拟滚动列表 -->
      <VirtualList
        v-else
        ref="listRef"
        :items="results"
        :key-of="(it: FavoriteIndex) => it.id || `${it.type}-${it.time}`"
        list-class="favorite-list"
      >
        <template #default="{ item }">
          <FavoriteCard
            :index="item"
            :clickable="true"
            @open="handleOpen"
          />
        </template>
      </VirtualList>

      <!-- 年份快速跳转 -->
      <div v-if="!query && favoritesStore.yearGroups.length > 1" class="year-jump">
        <span class="meta">归档：</span>
        <button
          v-for="[year, items] in favoritesStore.yearGroups"
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
    <FavoriteDetailModal
      v-model="detailVisible"
      :favorite="detailFavorite"
      :index="detailIndex"
      :loading="detailLoading"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFavoritesStore } from '@/stores/favorites'
import VirtualList from '@/components/common/VirtualList.vue'
import FavoriteCard from '@/components/favorite/FavoriteCard.vue'
import FavoriteDetailModal from '@/components/favorite/FavoriteDetailModal.vue'
import { stripFormatting } from '@/utils/formatContent'
import type { Favorite, FavoriteIndex } from '@/types'

const route = useRoute()
const router = useRouter()
const favoritesStore = useFavoritesStore()

// 客户端搜索：收藏数据量通常较小，用普通 includes 过滤即可
const query = ref('')

const listRef = ref<InstanceType<typeof VirtualList> | null>(null)

// 详情模态状态
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailFavorite = ref<Favorite | null>(null)
const detailIndex = ref<FavoriteIndex | null>(null)

const headMeta = computed(() => {
  if (favoritesStore.loading) return 'Loading…'
  if (favoritesStore.error) return 'Error'
  return `${favoritesStore.total} entries`
})

const results = computed<FavoriteIndex[]>(() => {
  const kw = query.value.trim()
  if (!kw) return favoritesStore.index
  const lower = kw.toLowerCase()
  return favoritesStore.index.filter(item => {
    const title = stripFormatting(item.title || '').toLowerCase()
    const abstract = stripFormatting(item.abstract || '').toLowerCase()
    const owner = stripFormatting(item.ownerName || '').toLowerCase()
    return (
      title.includes(lower) ||
      abstract.includes(lower) ||
      owner.includes(lower) ||
      String(item.ownerUin).includes(lower) ||
      item.typeLabel.toLowerCase().includes(lower) ||
      (item.time || '').toLowerCase().includes(lower)
    )
  })
})

const searchMeta = computed(() => {
  if (query.value) {
    return `查询「${query.value}」 · 命中 ${results.value.length} 条`
  }
  return `共 ${favoritesStore.total} 条 · 按时间倒序`
})

// 路由 query → 搜索框
watch(() => route.query.q, (q) => {
  const next = String(q || '')
  if (next !== query.value) query.value = next
}, { immediate: true })

// 搜索框 → 路由 query
watch(query, (v) => {
  const next = { ...route.query }
  const q = (v || '').trim()
  if (q) next.q = q
  else delete next.q
  if (route.query.q !== q) {
    router.replace({ query: next })
  }
})

async function handleOpen(idx: FavoriteIndex) {
  detailLoading.value = true
  detailVisible.value = true
  detailFavorite.value = null
  detailIndex.value = idx
  try {
    const found = await favoritesStore.getFavoriteByIndex(idx)
    detailFavorite.value = found || null
    if (!found) {
      console.warn('[FavoritesView] 未在年份分片中找到收藏', idx)
    }
  } catch (e) {
    console.error('[FavoritesView] 加载收藏详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

function jumpToYear(year: string) {
  const pos = favoritesStore.index.findIndex(item => (item.time || '').startsWith(year))
  if (pos >= 0) {
    listRef.value?.scrollToItem(pos)
  }
}

// 侧边栏年份快速跳转：监听 route.query.year
watch(() => route.query.year, async (year) => {
  const y = year ? String(year) : ''
  if (!y) return
  if (favoritesStore.index.length === 0) {
    if (!favoritesStore.loading) favoritesStore.init()
    while (favoritesStore.loading) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (favoritesStore.index.length === 0) return
  }
  await nextTick()
  jumpToYear(y)
}, { immediate: true })

onMounted(() => {
  if (favoritesStore.index.length === 0 && !favoritesStore.loading) {
    favoritesStore.init()
  }
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
