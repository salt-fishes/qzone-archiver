<template>
  <section class="visitors-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 10</span>
      <h2 class="section-title">访客 · 档案</h2>
      <span class="section-meta">{{ headMeta }}</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="visitorsStore.loading" class="app-loading">正在加载访客索引…</div>

    <!-- 错误状态 -->
    <div v-else-if="visitorsStore.error" class="error-tip">
      <p>{{ visitorsStore.error }}</p>
      <p class="hint">提示：访客数据尚未导出。请先在扩展中选择「访客 → SPA」备份类型并完成导出。</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="visitorsStore.total === 0" class="empty-tip">
      <p>暂无访客数据</p>
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
        <p>未找到匹配「{{ query }}」的访客</p>
        <p class="hint">试试其他关键字，或清除搜索查看全部。</p>
      </div>

      <!-- 虚拟滚动列表 -->
      <VirtualList
        v-else
        ref="listRef"
        :items="results"
        :key-of="(it: VisitorIndex) => `${it.uin}-${it.time}`"
        list-class="visitor-list"
      >
        <template #default="{ item }">
          <VisitorCard
            :index="item"
            :clickable="true"
            @open="handleOpen"
          />
        </template>
      </VirtualList>

      <!-- 年份快速跳转 -->
      <div v-if="!query && visitorsStore.yearGroups.length > 1" class="year-jump">
        <span class="meta">归档：</span>
        <button
          v-for="[year, items] in visitorsStore.yearGroups"
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
    <VisitorDetailModal
      v-model="detailVisible"
      :visitor="detailVisitor"
      :index="detailIndex"
      :loading="detailLoading"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVisitorsStore } from '@/stores/visitors'
import VirtualList from '@/components/common/VirtualList.vue'
import VisitorCard from '@/components/visitor/VisitorCard.vue'
import VisitorDetailModal from '@/components/visitor/VisitorDetailModal.vue'
import { stripFormatting } from '@/utils/formatContent'
import type { Visitor, VisitorIndex } from '@/types'

const route = useRoute()
const router = useRouter()
const visitorsStore = useVisitorsStore()

// 客户端搜索：访客数据量通常较小（几百到几千条），用普通 includes 过滤即可
const query = ref('')

const listRef = ref<InstanceType<typeof VirtualList> | null>(null)

// 详情模态状态
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailVisitor = ref<Visitor | null>(null)
const detailIndex = ref<VisitorIndex | null>(null)

const headMeta = computed(() => {
  if (visitorsStore.loading) return 'Loading…'
  if (visitorsStore.error) return 'Error'
  return `${visitorsStore.total} entries`
})

const results = computed<VisitorIndex[]>(() => {
  const kw = query.value.trim()
  if (!kw) return visitorsStore.index
  const lower = kw.toLowerCase()
  return visitorsStore.index.filter(item => {
    const name = stripFormatting(item.name || '').toLowerCase()
    return (
      name.includes(lower) ||
      String(item.uin).includes(lower) ||
      (item.time || '').toLowerCase().includes(lower)
    )
  })
})

const searchMeta = computed(() => {
  if (query.value) {
    return `查询「${query.value}」 · 命中 ${results.value.length} 条`
  }
  return `共 ${visitorsStore.total} 条 · 按时间倒序`
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

async function handleOpen(idx: VisitorIndex) {
  detailLoading.value = true
  detailVisible.value = true
  detailVisitor.value = null
  detailIndex.value = idx
  try {
    const found = await visitorsStore.getVisitorByIndex(idx)
    detailVisitor.value = found || null
    if (!found) {
      console.warn('[VisitorsView] 未在年份分片中找到访客', idx)
    }
  } catch (e) {
    console.error('[VisitorsView] 加载访客详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

function jumpToYear(year: string) {
  const pos = visitorsStore.index.findIndex(item => (item.time || '').startsWith(year))
  if (pos >= 0) {
    listRef.value?.scrollToItem(pos)
  }
}

// 侧边栏年份快速跳转：监听 route.query.year
watch(() => route.query.year, async (year) => {
  const y = year ? String(year) : ''
  if (!y) return
  if (visitorsStore.index.length === 0) {
    if (!visitorsStore.loading) visitorsStore.init()
    while (visitorsStore.loading) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (visitorsStore.index.length === 0) return
  }
  await nextTick()
  jumpToYear(y)
}, { immediate: true })

onMounted(() => {
  if (visitorsStore.index.length === 0 && !visitorsStore.loading) {
    visitorsStore.init()
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
