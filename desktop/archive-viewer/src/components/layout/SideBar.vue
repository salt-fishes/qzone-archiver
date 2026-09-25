<template>
  <!-- 移动端窄图标栏（≤900px 常驻左侧，点击图标直达 / 汉堡展开抽屉） -->
  <div class="side-rail">
    <button
      type="button"
      class="rail-toggle"
      :class="{ open: drawerOpen }"
      aria-label="打开导航"
      @click="drawerOpen = !drawerOpen"
    >☰</button>
    <RouterLink
      v-for="item in navItems"
      :key="`rail-${item.path}`"
      :to="item.path"
      class="rail-item"
      active-class="active"
    >
      <span class="rail-glyph">{{ item.glyph }}</span>
      <span class="rail-count">{{ formatCount(item.count) }}</span>
    </RouterLink>
  </div>

  <!-- 抽屉遮罩（仅移动端） -->
  <div v-if="drawerOpen" class="side-backdrop" @click="drawerOpen = false"></div>

  <aside class="sidebar" :class="{ 'drawer-open': drawerOpen }">
    <div class="sidebar-head">
      <h4>模块导航</h4>
      <button type="button" class="sidebar-close" aria-label="关闭导航" @click="drawerOpen = false">×</button>
    </div>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
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

const route = useRoute()
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
  { path: '/messages', label: '说说', glyph: '说', count: stats.value.messages },
  { path: '/blogs', label: '日志', glyph: '志', count: stats.value.blogs },
  { path: '/diaries', label: '日记', glyph: '记', count: stats.value.diaries },
  { path: '/photos', label: '相册', glyph: '相', count: stats.value.photos },
  { path: '/videos', label: '视频', glyph: '视', count: stats.value.videos },
  { path: '/boards', label: '留言', glyph: '言', count: stats.value.boards },
  { path: '/favorites', label: '收藏', glyph: '藏', count: stats.value.favorites },
  { path: '/friends', label: '好友', glyph: '友', count: stats.value.friends },
  { path: '/visitors', label: '访客', glyph: '访', count: stats.value.visitors }
])

/* ============ 移动端抽屉 ============ */
const drawerOpen = ref(false)

function onDrawerKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') drawerOpen.value = false
}

watch(drawerOpen, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (v) document.addEventListener('keydown', onDrawerKeydown)
  else document.removeEventListener('keydown', onDrawerKeydown)
})

// 路由变化（含 year/album 参数）后收起抽屉
watch(() => route.fullPath, () => {
  drawerOpen.value = false
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDrawerKeydown)
  document.body.style.overflow = ''
})

function formatCount(n: number) {
  if (!n) return '0'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
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
})
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

.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}

.sidebar-close {
  display: none;
  font-family: var(--font-mono);
  font-size: 1.05rem;
  line-height: 1;
  color: var(--ink-3);
  background: transparent;
  border: var(--line);
  padding: var(--sp-1) var(--sp-2);
  cursor: pointer;
  transition: all 0.15s;
}

.sidebar-close:hover {
  color: var(--vermilion);
  border-color: var(--vermilion);
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

/* 移动端（≤900px）：侧栏收纳为左侧抽屉 + 窄图标栏 */
@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 268px;
    max-width: 82vw;
    margin: 0;
    padding: var(--sp-5);
    background: var(--paper);
    border-right: var(--line-double);
    border-bottom: none;
    box-shadow: 4px 0 24px rgba(26, 22, 18, 0.25);
    transform: translateX(-100%);
    transition: transform 0.25s var(--ease-out);
    z-index: 100;
    max-height: none;
    overflow-y: auto;
  }

  .sidebar.drawer-open {
    transform: translateX(0);
  }

  .sidebar-close {
    display: block;
  }

  /* 窄图标栏：常驻左侧 */
  .side-rail {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    position: sticky;
    top: 0;
    align-self: start;
    max-height: 100vh;
    overflow-y: auto;
  }

  .rail-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-3) 0;
    font-size: 1rem;
    line-height: 1;
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: var(--line-dot);
    cursor: pointer;
  }

  .rail-toggle.open {
    color: var(--vermilion);
  }

  .rail-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--sp-2) 0;
    font-family: var(--font-serif-cn);
    font-size: 0.95rem;
    color: var(--ink-2);
    text-decoration: none;
    border-left: 2px solid transparent;
    transition: all 0.15s;
  }

  .rail-item:hover {
    color: var(--vermilion);
  }

  .rail-item.active {
    color: var(--vermilion);
    border-left-color: var(--vermilion);
  }

  .rail-count {
    font-family: var(--font-mono);
    font-size: 0.55rem;
    color: var(--ink-3);
  }

  .side-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(26, 22, 18, 0.45);
    z-index: 99;
  }
}

/* 桌面端（≥901px）：隐藏窄图标栏与遮罩 */
@media (min-width: 901px) {
  .side-rail {
    display: none;
  }

  .side-backdrop {
    display: none;
  }
}
</style>
