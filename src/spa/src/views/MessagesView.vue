<template>
  <section class="messages-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 01</span>
      <h2 class="section-title">说说 · 档案</h2>
      <span class="section-meta">{{ headMeta }}</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="messagesStore.loading" class="app-loading">正在加载说说索引…</div>

    <!-- 错误状态 -->
    <div v-else-if="messagesStore.error" class="error-tip">
      <p>{{ messagesStore.error }}</p>
      <p class="hint">提示：说说数据尚未导出。请先在扩展中选择「说说 → SPA」备份类型并完成导出。</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="messagesStore.total === 0" class="empty-tip">
      <p>暂无说说数据</p>
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
        <p>未找到匹配「{{ query }}」的说说</p>
        <p class="hint">试试其他关键字，或清除搜索查看全部。</p>
      </div>

      <!-- 虚拟滚动列表 -->
      <VirtualList
        v-else
        ref="listRef"
        :items="results"
        :key-of="(it: MessageIndex) => it.tid"
        list-class="message-list"
      >
        <template #default="{ item }">
          <MessageCard
            :index="item"
            :clickable="true"
            @open="handleOpen"
          />
        </template>
      </VirtualList>

      <!-- 年份快速跳转 -->
      <div v-if="!query && messagesStore.yearGroups.length > 1" class="year-jump">
        <span class="meta">归档：</span>
        <button
          v-for="[year, items] in messagesStore.yearGroups"
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
    <MessageDetailModal
      v-model="detailVisible"
      :message="detailMessage"
      :loading="detailLoading"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMessagesStore } from '@/stores/messages'
import { useFlexSearch } from '@/composables/useFlexSearch'
import VirtualList from '@/components/common/VirtualList.vue'
import MessageCard from '@/components/message/MessageCard.vue'
import MessageDetailModal from '@/components/message/MessageDetailModal.vue'
import type { Message, MessageIndex } from '@/types'

const route = useRoute()
const router = useRouter()
const messagesStore = useMessagesStore()

// 用 storeToRefs 拿到响应式 ref（避免 setup 中自动解包导致 watch 失效）
const { index: indexRef } = storeToRefs(messagesStore)

// 全文搜索 hook —— 自动 watch source 重建索引
const { query, results } = useFlexSearch(indexRef)

const listRef = ref<InstanceType<typeof VirtualList> | null>(null)

// 详情模态状态
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailMessage = ref<Message | null>(null)

const headMeta = computed(() => {
  if (messagesStore.loading) return 'Loading…'
  if (messagesStore.error) return 'Error'
  return `${messagesStore.total} entries`
})

const searchMeta = computed(() => {
  if (query.value) {
    return `查询「${query.value}」 · 命中 ${results.value.length} 条`
  }
  return `共 ${messagesStore.total} 条 · 按时间倒序`
})

// 路由 query → 搜索框（外部链接、回退时同步）
watch(() => route.query.q, (q) => {
  const next = String(q || '')
  if (next !== query.value) query.value = next
}, { immediate: true })

// 搜索框 → 路由 query（ NavBar 已处理输入框 → route，这里仅作兜底）
watch(query, (v) => {
  const next = { ...route.query }
  const q = (v || '').trim()
  if (q) next.q = q
  else delete next.q
  // 避免重复 replace
  if (route.query.q !== q) {
    router.replace({ query: next })
  }
})

async function handleOpen(idx: MessageIndex) {
  const year = (idx.time || '').substring(0, 4)
  if (!year) {
    console.warn('[MessagesView] 无法解析年份，tid=', idx.tid, 'time=', idx.time)
    return
  }
  detailLoading.value = true
  detailVisible.value = true
  detailMessage.value = null
  try {
    const items = await messagesStore.loadYear(year)
    const found = items.find(m => m.tid === idx.tid) || null
    detailMessage.value = found
    if (!found) {
      console.warn('[MessagesView] 未在年份分片中找到 tid=', idx.tid, 'year=', year)
    }
  } catch (e) {
    console.error('[MessagesView] 加载说说详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

async function jumpToYear(year: string) {
  // 在索引中找到该年第一条的位置，调用虚拟滚动 API 跳转
  const pos = messagesStore.index.findIndex(item => (item.time || '').startsWith(year))
  if (pos < 0) return
  // 等待 listRef 就绪（首次渲染时 VirtualList 可能还没挂载）
  for (let i = 0; i < 20; i++) {
    if (listRef.value) break
    await new Promise(r => setTimeout(r, 50))
  }
  if (!listRef.value) return
  // 等待两帧让 DynamicScroller 完成内部高度测量，并避开 router scrollBehavior 的执行时机
  await new Promise(r => requestAnimationFrame(() => r(null as any)))
  await new Promise(r => requestAnimationFrame(() => r(null as any)))
  listRef.value.scrollToItem(pos)
}

// 侧边栏年份快速跳转：监听 route.query.year，等索引就绪后定位
watch(() => route.query.year, async (year) => {
  const y = year ? String(year) : ''
  if (!y) return
  // 1. 索引未就绪时，确保 init 已触发并等待完成（init 内部有 guard）
  if (messagesStore.index.length === 0) {
    if (!messagesStore.loading) messagesStore.init()
    while (messagesStore.loading) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (messagesStore.index.length === 0) return // 加载失败
  }
  // 2. 等待 useFlexSearch 异步重建索引并填充 results（最多 1s）
  for (let i = 0; i < 20; i++) {
    if (results.value.length > 0) break
    await new Promise(r => setTimeout(r, 50))
  }
  // 3. 列表渲染后定位
  await nextTick()
  await jumpToYear(y)
}, { immediate: true })

onMounted(() => {
  if (messagesStore.index.length === 0 && !messagesStore.loading) {
    messagesStore.init()
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
