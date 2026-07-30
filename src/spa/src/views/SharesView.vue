<template>
  <section class="shares-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 08</span>
      <h2 class="section-title">分享 · 档案</h2>
      <span class="section-meta">{{ headMeta }}</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="sharesStore.loading" class="app-loading">正在加载分享索引…</div>

    <!-- 错误状态 -->
    <div v-else-if="sharesStore.error" class="error-tip">
      <p>{{ sharesStore.error }}</p>
      <p class="hint">提示：分享数据尚未导出。请先在扩展中选择「分享 → SPA」备份类型并完成导出。</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="sharesStore.total === 0" class="empty-tip">
      <p>暂无分享数据</p>
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
        <p>未找到匹配「{{ query }}」的分享</p>
        <p class="hint">试试其他关键字，或清除搜索查看全部。</p>
      </div>

      <!-- 虚拟滚动列表 -->
      <VirtualList
        v-else
        ref="listRef"
        :items="results"
        :key-of="(it: ShareIndex) => it.id || `${it.uin}_${it.shareTime}`"
        list-class="share-list"
      >
        <template #default="{ item }">
          <ShareCard
            :index="item"
            :clickable="true"
            @open="handleOpen"
          />
        </template>
      </VirtualList>

      <!-- 年份快速跳转 -->
      <div v-if="!query && sharesStore.yearGroups.length > 1" class="year-jump">
        <span class="meta">归档：</span>
        <button
          v-for="[year, items] in sharesStore.yearGroups"
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
    <ShareDetailModal
      v-model="detailVisible"
      :share="detailShare"
      :index="detailIndex"
      :loading="detailLoading"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSharesStore } from '@/stores/shares'
import VirtualList from '@/components/common/VirtualList.vue'
import ShareCard from '@/components/share/ShareCard.vue'
import ShareDetailModal from '@/components/share/ShareDetailModal.vue'
import { stripFormatting } from '@/utils/formatContent'
import type { Share, ShareIndex } from '@/types'

const route = useRoute()
const router = useRouter()
const sharesStore = useSharesStore()

// 客户端搜索：分享数据量通常适中，用普通 includes 过滤即可
const query = ref('')

const listRef = ref<InstanceType<typeof VirtualList> | null>(null)

// 详情模态状态
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailShare = ref<Share | null>(null)
const detailIndex = ref<ShareIndex | null>(null)

const headMeta = computed(() => {
  if (sharesStore.loading) return 'Loading…'
  if (sharesStore.error) return 'Error'
  return `${sharesStore.total} entries`
})

const results = computed<ShareIndex[]>(() => {
  const kw = query.value.trim()
  if (!kw) return sharesStore.index
  const lower = kw.toLowerCase()
  return sharesStore.index.filter(item => {
    const nickname = stripFormatting(item.nickname || '').toLowerCase()
    const desc = stripFormatting(item.desc || '').toLowerCase()
    const sourceTitle = stripFormatting(item.sourceTitle || '').toLowerCase()
    const sourceFrom = stripFormatting(item.sourceFromName || '').toLowerCase()
    return (
      nickname.includes(lower) ||
      desc.includes(lower) ||
      sourceTitle.includes(lower) ||
      sourceFrom.includes(lower) ||
      String(item.uin).includes(lower) ||
      item.typeLabel.toLowerCase().includes(lower) ||
      (item.time || '').toLowerCase().includes(lower)
    )
  })
})

const searchMeta = computed(() => {
  if (query.value) {
    return `查询「${query.value}」 · 命中 ${results.value.length} 条`
  }
  return `共 ${sharesStore.total} 条 · 按时间倒序`
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

async function handleOpen(idx: ShareIndex) {
  detailLoading.value = true
  detailVisible.value = true
  detailShare.value = null
  detailIndex.value = idx
  try {
    const found = await sharesStore.getShareByIndex(idx)
    detailShare.value = found || null
    if (!found) {
      console.warn('[SharesView] 未在年份分片中找到分享', idx)
    }
  } catch (e) {
    console.error('[SharesView] 加载分享详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

function jumpToYear(year: string) {
  const pos = sharesStore.index.findIndex(item => (item.time || '').startsWith(year))
  if (pos >= 0) {
    listRef.value?.scrollToItem(pos)
  }
}

// 侧边栏年份快速跳转：监听 route.query.year
watch(() => route.query.year, async (year) => {
  const y = year ? String(year) : ''
  if (!y) return
  if (sharesStore.index.length === 0) {
    if (!sharesStore.loading) sharesStore.init()
    while (sharesStore.loading) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (sharesStore.index.length === 0) return
  }
  await nextTick()
  jumpToYear(y)
}, { immediate: true })

onMounted(() => {
  if (sharesStore.index.length === 0 && !sharesStore.loading) {
    sharesStore.init()
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
