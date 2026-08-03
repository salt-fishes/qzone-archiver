<template>
  <nav class="navbar">
    <div class="nav-inner">
      <div class="nav-links">
        <RouterLink to="/" class="nav-link" active-class="active">首页</RouterLink>
        <RouterLink to="/messages" class="nav-link" active-class="active">说说</RouterLink>
        <RouterLink to="/blogs" class="nav-link" active-class="active">日志</RouterLink>
      </div>
      <div class="search-box" v-if="showSearch">
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
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const searchQuery = ref(String(route.query.q || ''))

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
// MessagesView 监听 route.query.q 即可获取搜索词，无需 emit 链路
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
    const input = document.querySelector<HTMLInputElement>('.search-input')
    input?.focus()
  }
}

onMounted(() => document.addEventListener('keydown', handleShortcut))
onUnmounted(() => document.removeEventListener('keydown', handleShortcut))
</script>

<style scoped>
.navbar {
  border-top: var(--line-dot);
  margin-top: var(--sp-4);
  padding-top: var(--sp-3);
}

.nav-inner {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-5);
  flex-wrap: wrap;
}

.nav-links {
  display: flex;
  gap: var(--sp-5);
}

.nav-link {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-2);
  border-bottom: none;
  padding: var(--sp-1) 0;
  position: relative;
}

/* 下划线指示器：hover 墨色 / 激活朱砂，从左向右展开 */
.nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 2px;
  background: var(--vermilion);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.28s var(--ease-out), background 0.2s;
}

.nav-link:hover {
  color: var(--vermilion);
}

.nav-link:hover::after {
  transform: scaleX(1);
}

.nav-link.active {
  color: var(--ink);
}

.nav-link.active::after {
  background: var(--ink);
  transform: scaleX(1);
}

.search-box {
  display: flex;
  align-items: center;
  border: var(--line);
  background: rgba(255, 255, 255, 0.4);
  padding: var(--sp-2) var(--sp-4);
  flex: 1;
  max-width: 360px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-box:focus-within {
  border-color: var(--vermilion);
  box-shadow: 0 0 0 2px rgba(200, 68, 42, 0.12);
}

/* 清除按钮 pop 过渡 */
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s var(--ease-out);
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
  margin-left: var(--sp-2);
  background: transparent;
  border: 1px solid var(--ink-3);
  color: var(--ink-3);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.15s;
}

.search-clear:hover {
  border-color: var(--vermilion);
  color: var(--vermilion);
}

.search-box :deep(.search-input)::-webkit-search-cancel-button {
  display: none;
}

@media (max-width: 720px) {
  /* 移动端：导航与搜索框堆叠居中 */
  .nav-inner {
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
  }
  .nav-links {
    justify-content: center;
    gap: var(--sp-4);
  }
  .search-box {
    width: 100%;
    max-width: 420px;
    margin: 0 auto;
  }
  /* 扩大清除按钮触控区域 */
  .search-clear {
    width: 28px;
    height: 28px;
    font-size: 1rem;
  }
  /* 隐藏 ⌘K 快捷键提示（移动端无意义） */
  .search-shortcut {
    display: none;
  }
}
</style>
