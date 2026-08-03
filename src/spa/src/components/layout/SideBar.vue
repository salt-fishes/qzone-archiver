<template>
  <aside ref="sidebarRef" class="sidebar">
    <h4>模块导航</h4>
    <ul>
      <li v-for="item in navItems" :key="item.path">
        <RouterLink :to="item.path" active-class="active">
          <span class="nav-label">{{ item.label }}</span>
          <span class="sidebar-count">{{ formatCount(item.count) }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="yearGroups.length" class="sidebar-section">说说归档</h4>
    <ul v-if="yearGroups.length">
      <li>
        <RouterLink to="/messages-deleted" active-class="active">
          <span class="nav-label">已删除</span>
          <span class="sidebar-count sidebar-count-deleted" :class="{ 'is-loading': deletedLoading }">{{ deletedCount }}</span>
        </RouterLink>
      </li>
      <li v-for="[year, items] in yearGroups" :key="year">
        <RouterLink :to="`/messages?year=${year}`">
          <span class="nav-label">{{ year }} 年</span>
          <span class="sidebar-count">{{ items.length }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="visitorYearGroups.length" class="sidebar-section">访客归档</h4>
    <ul v-if="visitorYearGroups.length">
      <li v-for="[year, items] in visitorYearGroups" :key="`v-${year}`">
        <RouterLink :to="`/visitors?year=${year}`">
          <span class="nav-label">{{ year }} 年</span>
          <span class="sidebar-count">{{ items.length }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="favoriteYearGroups.length" class="sidebar-section">收藏归档</h4>
    <ul v-if="favoriteYearGroups.length">
      <li v-for="[year, items] in favoriteYearGroups" :key="`f-${year}`">
        <RouterLink :to="`/favorites?year=${year}`">
          <span class="nav-label">{{ year }} 年</span>
          <span class="sidebar-count">{{ items.length }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="boardYearGroups.length" class="sidebar-section">留言归档</h4>
    <ul v-if="boardYearGroups.length">
      <li v-for="[year, items] in boardYearGroups" :key="`b-${year}`">
        <RouterLink :to="`/boards?year=${year}`">
          <span class="nav-label">{{ year }} 年</span>
          <span class="sidebar-count">{{ items.length }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="shareYearGroups.length" class="sidebar-section">分享归档</h4>
    <ul v-if="shareYearGroups.length">
      <li v-for="[year, items] in shareYearGroups" :key="`s-${year}`">
        <RouterLink :to="`/shares?year=${year}`">
          <span class="nav-label">{{ year }} 年</span>
          <span class="sidebar-count">{{ items.length }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="videoYearGroups.length" class="sidebar-section">视频归档</h4>
    <ul v-if="videoYearGroups.length">
      <li v-for="[year, items] in videoYearGroups" :key="`v-${year}`">
        <RouterLink :to="`/videos?year=${year}`">
          <span class="nav-label">{{ year }} 年</span>
          <span class="sidebar-count">{{ items.length }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="diaryYearGroups.length" class="sidebar-section">日记归档</h4>
    <ul v-if="diaryYearGroups.length">
      <li v-for="[year, items] in diaryYearGroups" :key="`d-${year}`">
        <RouterLink :to="`/diaries?year=${year}`">
          <span class="nav-label">{{ year }} 年</span>
          <span class="sidebar-count">{{ items.length }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="blogYearGroups.length" class="sidebar-section">日志归档</h4>
    <ul v-if="blogYearGroups.length">
      <li v-for="[year, items] in blogYearGroups" :key="`bl-${year}`">
        <RouterLink :to="`/blogs?year=${year}`">
          <span class="nav-label">{{ year }} 年</span>
          <span class="sidebar-count">{{ items.length }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="albumList.length" class="sidebar-section">相册归档</h4>
    <ul v-if="albumList.length">
      <li v-for="album in albumList" :key="`album-${album.albumId}`">
        <RouterLink :to="`/photos?album=${album.albumId}`">
          <span class="nav-label">{{ album.name || '(未命名相册)' }}</span>
          <span class="sidebar-count">{{ album.photoCount }}</span>
        </RouterLink>
      </li>
    </ul>

    <h4 v-if="friendGroups.length" class="sidebar-section">好友归档</h4>
    <ul v-if="friendGroups.length">
      <li v-for="[groupName, items] in friendGroups" :key="`fr-${groupName}`">
        <RouterLink :to="`/friends?group=${encodeURIComponent(groupName)}`">
          <span class="nav-label">{{ groupName }}</span>
          <span class="sidebar-count">{{ items.length }}</span>
        </RouterLink>
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { useMessagesStore } from '@/stores/messages'
import { useVisitorsStore } from '@/stores/visitors'
import { useFavoritesStore } from '@/stores/favorites'
import { useBoardsStore } from '@/stores/boards'
import { useSharesStore } from '@/stores/shares'
import { useVideosStore } from '@/stores/videos'
import { useDiariesStore } from '@/stores/diaries'
import { useBlogsStore } from '@/stores/blogs'
import { useFriendsStore } from '@/stores/friends'
import { usePhotosStore } from '@/stores/photos'
import { countUp, enter, isAnimated, markAnimated, staggerEnter } from '@/composables/useMotion'

const userStore = useUserStore()
const messagesStore = useMessagesStore()
const visitorsStore = useVisitorsStore()
const favoritesStore = useFavoritesStore()
const boardsStore = useBoardsStore()
const sharesStore = useSharesStore()
const videosStore = useVideosStore()
const diariesStore = useDiariesStore()
const blogsStore = useBlogsStore()
const friendsStore = useFriendsStore()
const photosStore = usePhotosStore()

const sidebarRef = ref<HTMLElement | null>(null)
let observer: MutationObserver | null = null

const stats = computed(() => userStore.stats)
const yearGroups = computed(() => messagesStore.yearGroups)
const visitorYearGroups = computed(() => visitorsStore.yearGroups)
const favoriteYearGroups = computed(() => favoritesStore.yearGroups)
const boardYearGroups = computed(() => boardsStore.yearGroups)
const shareYearGroups = computed(() => sharesStore.yearGroups)
const videoYearGroups = computed(() => videosStore.yearGroups)
const diaryYearGroups = computed(() => diariesStore.yearGroups)
const blogYearGroups = computed(() => blogsStore.yearGroups)
const friendGroups = computed(() => friendsStore.groupLists)
const albumList = computed(() => photosStore.index)
const deletedCount = computed(() => messagesStore.deletedTotal)
const deletedLoading = computed(() => messagesStore.deletedLoading)

const navItems = computed(() => [
  { path: '/messages', label: '说说', count: stats.value.messages },
  { path: '/blogs', label: '日志', count: stats.value.blogs },
  { path: '/diaries', label: '日记', count: stats.value.diaries },
  { path: '/photos', label: '相册', count: stats.value.photos },
  { path: '/videos', label: '视频', count: stats.value.videos },
  { path: '/boards', label: '留言', count: stats.value.boards },
  { path: '/favorites', label: '收藏', count: stats.value.favorites },
  { path: '/friends', label: '好友', count: stats.value.friends },
  { path: '/visitors', label: '访客', count: stats.value.visitors }
])

function formatCount(n: number) {
  if (!n) return '0'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

/** 对新增的归档分组块（h4 / ul）做入场动画 */
function animateNewBlock(block: HTMLElement) {
  if (block.matches('h4')) {
    enter(block, { translateY: 10, duration: 560 })
  } else if (block.matches('ul')) {
    const lis = Array.from(block.querySelectorAll('li')).filter(li => !isAnimated(li))
    if (lis.length) {
      staggerEnter(block, lis, { gap: 50, translateY: 12, duration: 600 })
      lis.forEach(markAnimated)
      // 归档条目的数量数字滚动
      lis.forEach((li, i) => {
        const countEl = li.querySelector('.sidebar-count')
        const n = Number(countEl?.textContent?.replace(/[^\d]/g, '') || 0)
        if (countEl && n > 0) {
          countUp(countEl, n, { delay: 250 + i * 50, duration: 800 })
        }
      })
    }
  }
}

onMounted(() => {
  messagesStore.init()
  visitorsStore.init()
  favoritesStore.init()
  boardsStore.init()
  sharesStore.init()
  videosStore.init()
  diariesStore.init()
  blogsStore.init()
  friendsStore.init()
  photosStore.init()
  // 预加载已删除说说计数（失败静默处理，文件可能不存在）
  messagesStore.loadDeleted()

  // 模块导航首屏交错入场
  const root = sidebarRef.value
  if (root) {
    staggerEnter(root, 'ul:first-of-type li', { gap: 70, translateY: 12, duration: 660 })
    // 监听后续归档分组（store 异步填充）的新增 h4/ul
    observer = new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes.forEach(n => {
          if (n instanceof HTMLElement && (n.matches('h4') || n.matches('ul'))) {
            animateNewBlock(n)
          }
        })
      })
    })
    observer.observe(root, { childList: true })
  }
})

// 模块导航计数数字滚动（stats 异步就绪后触发一次）
let moduleCountsDone = false
watch(() => userStore.stats, (s) => {
  if (!s || moduleCountsDone || !sidebarRef.value) return
  const total = s.messages + s.blogs + s.diaries + s.photos + s.videos +
    s.boards + s.favorites + s.friends + s.visitors
  if (total === 0) return
  moduleCountsDone = true
  nextTick(() => {
    const root = sidebarRef.value
    if (!root) return
    const counts = Array.from(root.querySelectorAll('ul:first-of-type .sidebar-count'))
    counts.forEach((el, i) => {
      const n = navItems.value[i]?.count || 0
      if (n > 0) countUp(el, n, { delay: 350 + i * 70, duration: 900, format: formatCount })
    })
  })
}, { immediate: true })

onUnmounted(() => observer?.disconnect())
</script>

<style scoped>
.sidebar {
  position: sticky;
  top: var(--sp-5);
  align-self: start;
  max-height: calc(100vh - var(--sp-9));
  overflow-y: auto;
  padding-right: var(--sp-4);
  border-right: var(--line-dot);
}

.sidebar h4 {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-bottom: var(--sp-4);
  padding-bottom: var(--sp-2);
  border-bottom: var(--line);
}

.sidebar-section {
  margin-top: var(--sp-6);
}

.sidebar ul {
  list-style: none;
}

.sidebar li {
  margin-bottom: var(--sp-1);
}

.sidebar a {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--sp-1) 0;
  font-family: var(--font-serif-cn);
  font-size: 0.95rem;
  color: var(--ink-2);
  border-bottom: none;
  border-left: 2px solid transparent;
  padding-left: var(--sp-3);
  transition: all 0.15s;
}

.sidebar a:hover {
  color: var(--vermilion);
  border-left-color: var(--vermilion);
  padding-left: var(--sp-4);
}

.sidebar a.active {
  color: var(--ink);
  border-left-color: var(--ink);
  font-weight: 600;
}

.sidebar-count {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--ink-3);
  margin-left: var(--sp-2);
}

.sidebar-count-deleted {
  color: var(--warning, #b8860b);
}

.sidebar-count-deleted.is-loading::after {
  content: '...';
  margin-left: 2px;
}

@media (max-width: 900px) {
  .sidebar {
    position: relative;
    border-right: none;
    border-bottom: var(--line-dot);
    padding-bottom: var(--sp-5);
    max-height: none;
  }
}
</style>
