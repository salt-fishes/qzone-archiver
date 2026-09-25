<template>
  <section class="boards-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 06</span>
      <h2 class="section-title">留言 · 档案</h2>
      <span class="section-meta">{{ headMeta }}</span>
    </div>

    <!-- 主人寄语 -->
    <blockquote v-if="authorMessage" class="author-message">
      <span class="quote-author">主人寄语</span>
      <div class="quote-text" v-html="resolvedAuthorMessage"></div>
    </blockquote>

    <!-- 加载状态 -->
    <div v-if="boardsStore.loading" class="app-loading">正在加载留言索引…</div>

    <!-- 错误状态 -->
    <div v-else-if="boardsStore.error" class="error-tip">
      <p>{{ boardsStore.error }}</p>
      <p class="hint">提示：留言数据尚未导出。请先在扩展中选择「留言 → SPA」备份类型并完成导出。</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="boardsStore.total === 0" class="empty-tip">
      <p>暂无留言数据</p>
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
        <p>未找到匹配「{{ query }}」的留言</p>
        <p class="hint">试试其他关键字，或清除搜索查看全部。</p>
      </div>

      <!-- 虚拟滚动列表 -->
      <VirtualList
        v-else
        ref="listRef"
        :items="results"
        :key-of="(it: BoardIndex) => `${it.uin}_${it.pubtime}`"
        list-class="board-list"
      >
        <template #default="{ item }">
          <BoardCard
            :index="item"
            :clickable="true"
            @open="handleOpen"
          />
        </template>
      </VirtualList>

      <!-- 年份快速跳转 -->
      <div v-if="!query && boardsStore.yearGroups.length > 1" class="year-jump">
        <span class="meta">归档：</span>
        <button
          v-for="[year, items] in boardsStore.yearGroups"
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
    <BoardDetailModal
      v-model="detailVisible"
      :board="detailBoard"
      :index="detailIndex"
      :loading="detailLoading"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBoardsStore } from '@/stores/boards'
import VirtualList from '@/components/common/VirtualList.vue'
import BoardCard from '@/components/board/BoardCard.vue'
import BoardDetailModal from '@/components/board/BoardDetailModal.vue'
import { stripFormatting, resolveModulePath } from '@/utils/formatContent'
import type { Board, BoardIndex } from '@/types'

const route = useRoute()
const router = useRouter()
const boardsStore = useBoardsStore()

// 客户端搜索：留言数据量通常较小，用普通 includes 过滤即可
const query = ref('')

const listRef = ref<InstanceType<typeof VirtualList> | null>(null)

// 详情模态状态
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailBoard = ref<Board | null>(null)
const detailIndex = ref<BoardIndex | null>(null)

const headMeta = computed(() => {
  if (boardsStore.loading) return 'Loading…'
  if (boardsStore.error) return 'Error'
  return `${boardsStore.total} entries`
})

// 主人寄语：扩展端可能含 HTML（如换行符），渲染时保留
const authorMessage = computed(() => boardsStore.author?.message || '')
const resolvedAuthorMessage = computed(() => {
  const msg = authorMessage.value
  if (!msg) return ''
  // 主人寄语中可能含表情图片相对路径 'images/xxx'，需重写为 SPA 可访问路径
  return msg.replace(
    /(<img\b[^>]*\bsrc=["'])(images\/[^"']+)(["'])/gi,
    (_m, prefix: string, src: string, quote: string) =>
      prefix + resolveModulePath(src, 'Boards') + quote
  )
})

const results = computed<BoardIndex[]>(() => {
  const kw = query.value.trim()
  if (!kw) return boardsStore.index
  const lower = kw.toLowerCase()
  return boardsStore.index.filter(item => {
    const name = stripFormatting(item.nickname || '').toLowerCase()
    const abstract = stripFormatting(item.abstract || '').toLowerCase()
    return (
      name.includes(lower) ||
      abstract.includes(lower) ||
      String(item.uin).includes(lower) ||
      (item.time || '').toLowerCase().includes(lower)
    )
  })
})

const searchMeta = computed(() => {
  if (query.value) {
    return `查询「${query.value}」 · 命中 ${results.value.length} 条`
  }
  return `共 ${boardsStore.total} 条 · 按时间倒序`
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

async function handleOpen(idx: BoardIndex) {
  detailLoading.value = true
  detailVisible.value = true
  detailBoard.value = null
  detailIndex.value = idx
  try {
    const found = await boardsStore.getBoardByIndex(idx)
    detailBoard.value = found || null
    if (!found) {
      console.warn('[BoardsView] 未在年份分片中找到留言', idx)
    }
  } catch (e) {
    console.error('[BoardsView] 加载留言详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

function jumpToYear(year: string) {
  const pos = boardsStore.index.findIndex(item => (item.time || '').startsWith(year))
  if (pos >= 0) {
    listRef.value?.scrollToItem(pos)
  }
}

// 侧边栏年份快速跳转：监听 route.query.year
watch(() => route.query.year, async (year) => {
  const y = year ? String(year) : ''
  if (!y) return
  if (boardsStore.index.length === 0) {
    if (!boardsStore.loading) boardsStore.init()
    while (boardsStore.loading) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (boardsStore.index.length === 0) return
  }
  await nextTick()
  jumpToYear(y)
}, { immediate: true })

onMounted(() => {
  if (boardsStore.index.length === 0 && !boardsStore.loading) {
    boardsStore.init()
  }
})
</script>

<style scoped>
.author-message {
  border-left: 3px solid var(--vermilion);
  padding: var(--sp-3) var(--sp-4);
  background: rgba(200, 68, 42, 0.05);
  margin: var(--sp-4) 0;
}

.quote-author {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--vermilion);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--sp-2);
}

.quote-text {
  font-family: var(--font-serif-cn);
  font-size: 0.95rem;
  color: var(--ink-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.quote-text :deep(img) {
  max-width: 100%;
  height: auto;
}

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
