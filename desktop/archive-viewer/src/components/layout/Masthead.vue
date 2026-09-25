<template>
  <header class="masthead">
    <div class="masthead-row">
      <!-- 左：档案名 + 主人 + 年代跨度（信息优先级：档案名 > 搜索 > 年代） -->
      <RouterLink to="/" class="masthead-brand">
        <span class="brand-main">QQ空间<em>档案</em></span>
        <template v-if="userStore.isReady">
          <span class="brand-meta">№ {{ uin || '——' }} · {{ nickname || 'Archive' }}</span>
          <span class="brand-meta">共 {{ totalRecords.toLocaleString() }} 条记录</span>
        </template>
        <span v-else class="skeleton skeleton-line brand-skeleton"></span>
      </RouterLink>

      <!-- 右：全局搜索（原 NavBar 逻辑并入） -->
      <div v-if="showSearch" class="search-box">
        <span class="search-icon">⌕</span>
        <input
          class="search-input"
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          type="search"
        />
        <Transition name="pop">
          <button v-if="searchQuery" class="search-clear" type="button" @click="clearQuery" aria-label="清除">×</button>
        </Transition>
        <span class="search-shortcut">⌘K</span>
      </div>
    </div>

    <!-- 朱砂阅读进度线：3px 贴报头下缘，随滚动推进（§4.1） -->
    <div class="progress-track" aria-hidden="true">
      <div class="progress-line" :style="{ width: progressPct }"></div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const uin = computed(() => userStore.uin)
const nickname = computed(() => userStore.nickname)
const totalRecords = computed(() => userStore.totalRecords)

const showSearch = computed(() =>
  route.name === 'messages' ||
  route.name === 'visitors' ||
  route.name === 'favorites' ||
  route.name === 'boards' ||
  route.name === 'shares' ||
  route.name === 'videos' ||
  route.name === 'blogs' ||
  route.name === 'diaries' ||
  route.name === 'photos' ||
  route.name === 'friends'
)
const searchPlaceholder = computed(() => '搜索档案内容、时间、人物…')

// 输入时 debounce 250ms 同步到 URL（保持即时筛选，避免每键一次路由跳转）
// 各列表视图监听 route.query.q 即可获取搜索词，无需 emit 链路
const searchQuery = ref(String(route.query.q || ''))
let timer: ReturnType<typeof setTimeout> | undefined
watch(searchQuery, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const q = (v || '').trim()
    const next: Record<string, any> = { ...route.query }
    if (q) next.q = q
    else delete next.q
    router.replace({ query: next })
  }, 250)
})

// 路由变化时反向同步到输入框（如前进/后退、外部链接带 q 参数）
watch(() => route.query.q, (q) => {
  const next = String(q || '')
  if (next !== searchQuery.value) searchQuery.value = next
})

function clearQuery() {
  searchQuery.value = ''
}

function handleShortcut(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    const input = document.querySelector<HTMLInputElement>('.masthead .search-input')
    input?.focus()
  }
}

/* ===== 阅读进度线：捕捉阶段监听所有滚动容器 =====
   列表页是内部滚动（.vue-recycle-scroller / .vl-grid），首页是窗口滚动——
   谁在滚就按谁算进度；reduced-motion 下仍为 linear 匀速（进度线规格）。 */
const progressPct = ref('0%')

function updateProgress(target: HTMLElement | null) {
  let pct = 0
  if (target && target.scrollHeight > target.clientHeight + 4) {
    pct = target.scrollTop / (target.scrollHeight - target.clientHeight)
  } else {
    const doc = document.documentElement
    const max = doc.scrollHeight - window.innerHeight
    pct = max > 0 ? window.scrollY / max : 0
  }
  progressPct.value = `${Math.min(100, Math.max(0, pct * 100)).toFixed(2)}%`
}

function onScroll(e: Event) {
  const t = e.target as HTMLElement | null
  if (t && t.nodeType === 1) {
    // 内部滚动容器（虚拟列表 / 网格）
    if (t.classList.contains('vue-recycle-scroller') || t.classList.contains('vl-grid')) {
      updateProgress(t)
      return
    }
  }
  updateProgress(null)
}

onMounted(() => {
  if (!userStore.isReady) userStore.init()
  document.addEventListener('keydown', handleShortcut)
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleShortcut)
  document.removeEventListener('scroll', onScroll, { capture: true })
})
</script>

<style scoped>
.masthead {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--paper);
  border-bottom: var(--rule-double);
  padding: var(--sp-2) var(--sp-4);
}

.masthead-row {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.masthead-brand {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  text-decoration: none;
  border: none;
  min-width: 0;
}

.brand-main {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--ink);
  white-space: nowrap;
}

.brand-main em {
  font-style: italic;
  color: var(--vermilion);
  font-weight: 600;
}

.brand-meta {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: var(--ink-muted);
  white-space: nowrap;
}

.brand-skeleton {
  width: 140px;
  height: 10px;
  display: inline-block;
}

/* 搜索框（原 NavBar 规格） */
.search-box {
  display: flex;
  align-items: center;
  border: var(--line-1);
  background: var(--paper-raised);
  padding: var(--sp-1) var(--sp-2);
  flex: 0 1 360px;
  min-width: 160px;
  transition: border-color var(--dur-1) var(--ease-out), box-shadow var(--dur-1) var(--ease-out);
}

.search-box:focus-within {
  border-color: var(--vermilion);
  box-shadow: 0 0 0 2px rgba(181, 67, 42, 0.12);
}

.search-icon {
  color: var(--ink-muted);
  margin-right: var(--sp-1);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--font-serif-cn);
  font-size: 0.85rem;
  color: var(--ink);
  outline: none;
}

.search-input::placeholder {
  color: var(--ink-muted);
  font-style: italic;
}

.search-input::-webkit-search-cancel-button { display: none; }

.pop-enter-active,
.pop-leave-active {
  transition: opacity var(--dur-1) ease, transform var(--dur-1) var(--ease-out);
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.4);
}

.search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  margin-left: var(--sp-1);
  background: transparent;
  border: 1px solid var(--ink-muted);
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 50%;
  transition: all var(--dur-1);
}

.search-clear:hover {
  border-color: var(--vermilion);
  color: var(--vermilion);
}

.search-shortcut {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--ink-muted);
  border: var(--line-1);
  padding: 1px 6px;
  margin-left: var(--sp-1);
}

/* 朱砂阅读进度线 */
.progress-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  height: 3px;
  pointer-events: none;
}

.progress-line {
  height: 100%;
  background: var(--vermilion);
  transition: none; /* 进度线规格：linear 匀速，不加缓动 */
}

/* 窄屏：品牌与搜索折行 */
@media (max-width: 1100px) {
  .masthead-row {
    flex-wrap: wrap;
  }
  .search-box {
    flex: 1 1 100%;
    order: 2;
  }
}

@media (max-width: 900px) {
  .masthead {
    padding: var(--sp-1) var(--sp-2);
  }
  .brand-main {
    font-size: 1.2rem;
  }
  .brand-meta {
    display: none;
  }
  .search-shortcut {
    display: none;
  }
}
</style>
