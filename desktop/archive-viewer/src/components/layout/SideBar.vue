<template>
  <!-- 窄屏图标栏（≤1100px 常驻左侧，点击展开抽屉卷目） -->
  <div class="side-rail">
    <button
      type="button"
      class="rail-toggle"
      :class="{ open: drawerOpen }"
      aria-label="打开卷目"
      @click="drawerOpen = !drawerOpen"
    >☰</button>
    <RouterLink
      v-for="item in tocItems"
      :key="`rail-${item.path}`"
      :to="item.path"
      class="rail-item"
      active-class="active"
    >
      <span class="rail-glyph">{{ item.glyph }}</span>
      <span class="rail-count">{{ formatCount(item.count) }}</span>
    </RouterLink>
  </div>

  <!-- 抽屉遮罩（仅窄屏） -->
  <div v-if="drawerOpen" class="side-backdrop" @click="drawerOpen = false"></div>

  <!-- 卷目（§4.1）：类型 + mono 计数；当前卷 = 朱砂竖线 + 加重；年报以点线分隔 -->
  <aside class="toc" :class="{ 'drawer-open': drawerOpen }">
    <div class="toc-head">
      <h4>卷目</h4>
      <button type="button" class="toc-close" aria-label="关闭卷目" @click="drawerOpen = false">×</button>
    </div>
    <ul class="toc-list">
      <li v-for="item in tocItems" :key="item.path">
        <RouterLink :to="item.path" class="toc-item" active-class="active">
          <span class="toc-glyph">{{ item.glyph }}</span>
          <span class="toc-label">卷·{{ item.label }}</span>
          <span class="toc-count">{{ formatCount(item.count) }}</span>
        </RouterLink>
        <!-- 当前卷的子索引（年代 / 相册 / 分组），仅展开当前卷 -->
        <ul v-if="item.path === modulePath && subEntries.length" class="toc-sub">
          <li v-for="sub in subEntries" :key="sub.to">
            <RouterLink :to="sub.to" :class="{ 'is-loading': sub.loading }">
              <span class="toc-sub-label">{{ sub.label }}</span>
              <span class="toc-sub-count">{{ sub.count }}</span>
            </RouterLink>
          </li>
        </ul>
      </li>
    </ul>

    <div class="toc-sep"></div>
    <ul class="toc-list">
      <li>
        <RouterLink to="/report" class="toc-item toc-report" active-class="active">
          <span class="toc-glyph">报</span>
          <span class="toc-label">年度报告</span>
          <span class="toc-count">ANN</span>
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

const tocItems = computed(() => [
  { path: '/', label: '看板', glyph: '首', count: userStore.totalRecords },
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

/** 当前模块路径（含子索引的卷） */
const modulePath = computed(() => {
  const p = route.path
  return tocItems.value.some(it => it.path === p && it.path !== '/') ? p : ''
})

interface SubEntry { to: string; label: string; count: number | string; loading?: boolean }

/** 当前卷的子索引：年代 / 相册 / 分组 */
const subEntries = computed<SubEntry[]>(() => {
  switch (route.path) {
    case '/messages': {
      const list: SubEntry[] = [{
        to: '/messages-deleted',
        label: '已删除',
        count: messagesStore.deletedLoading ? '…' : messagesStore.deletedTotal,
        loading: messagesStore.deletedLoading,
      }]
      return list.concat(yearSubs(messagesStore.yearGroups, '/messages'))
    }
    case '/visitors': return yearSubs(visitorsStore.yearGroups, '/visitors')
    case '/favorites': return yearSubs(favoritesStore.yearGroups, '/favorites')
    case '/boards': return yearSubs(boardsStore.yearGroups, '/boards')
    case '/shares': return yearSubs(sharesStore.yearGroups, '/shares')
    case '/videos': return yearSubs(videosStore.yearGroups, '/videos')
    case '/diaries': return yearSubs(diariesStore.yearGroups, '/diaries')
    case '/blogs': return yearSubs(blogsStore.yearGroups, '/blogs')
    case '/photos':
      return photosStore.index.map(album => ({
        to: `/photos?album=${album.albumId}`,
        label: album.name || '(未命名相册)',
        count: album.photoCount,
      }))
    case '/friends':
      return Object.entries(friendsStore.groupLists).map(([groupName, items]) => ({
        to: `/friends?group=${encodeURIComponent(groupName)}`,
        label: groupName,
        count: (items as any[]).length,
      }))
    default: return []
  }
})

function yearSubs(groups: [string, any[]][], base: string): SubEntry[] {
  return groups.map(([year, items]) => ({
    to: `${base}?year=${year}`,
    label: `${year} 年`,
    count: items.length,
  }))
}

/* ============ 窄屏抽屉 ============ */
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
.toc {
  position: sticky;
  top: 72px;
  align-self: start;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  border-right: var(--line-1);
  padding: var(--sp-2) 0 var(--sp-2) var(--sp-1);
}

.toc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: 0 var(--sp-2);
}

.toc h4 {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-muted);
  margin-bottom: var(--sp-1);
}

.toc-close {
  display: none;
  font-family: var(--font-mono);
  font-size: 1.05rem;
  line-height: 1;
  color: var(--ink-muted);
  background: transparent;
  border: var(--line-1);
  padding: var(--sp-1) var(--sp-2);
  cursor: pointer;
  transition: all var(--dur-1);
}

.toc-close:hover {
  color: var(--vermilion);
  border-color: var(--vermilion);
}

.toc-list {
  list-style: none;
}

.toc-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--sp-1) var(--sp-1) var(--sp-1) var(--sp-2);
  border-left: 2px solid transparent;
  text-decoration: none;
  border-bottom: none;
  transition: border-color var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out);
}

.toc-glyph {
  flex: none;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif-cn);
  font-size: 0.85rem;
  color: var(--ink);
  border: var(--line-1);
  background: var(--paper-raised);
}

.toc-label {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--font-serif-cn);
  font-size: 0.82rem;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toc-count {
  flex: none;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--ink-muted);
  letter-spacing: 0.03em;
}

.toc-item:hover {
  border-left-color: var(--vermilion);
  background: rgba(181, 67, 42, 0.05);
}

.toc-item.active {
  border-left-color: var(--vermilion);
  font-weight: 600;
}

.toc-item.active .toc-glyph {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

/* 当前卷子索引（年代/相册/分组） */
.toc-sub {
  list-style: none;
  margin: 0 0 var(--sp-1) calc(24px + var(--sp-2));
  border-left: var(--rule-dot);
  padding-left: var(--sp-2);
}

.toc-sub a {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-2);
  padding: 3px 0;
  font-family: var(--font-serif-cn);
  font-size: 0.78rem;
  color: var(--ink-muted);
  text-decoration: none;
  border-bottom: none;
  transition: color var(--dur-1) var(--ease-out);
}

.toc-sub a:hover { color: var(--vermilion); }
.toc-sub a.router-link-active { color: var(--ink); }

.toc-sub-count {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--ink-muted);
}

/* 年报：点线与其余卷目分隔 */
.toc-sep {
  border-top: var(--rule-dot);
  margin: var(--sp-2) var(--sp-2);
}

.toc-report .toc-glyph {
  color: var(--vermilion);
  border-color: var(--vermilion);
}

.toc-report.active .toc-glyph {
  background: var(--vermilion);
  color: var(--paper);
}

/* ============ ≥1440px：卷目 160px 宽整形态 ============ */
@media (max-width: 1439px) {
  /* 88px 窄卷目：隐藏文字标签与计数，仅字形 */
  .toc-label,
  .toc-count,
  .toc-sub,
  .toc-head h4 {
    display: none;
  }
  .toc-item {
    justify-content: center;
    padding: var(--sp-1) 0;
  }
  .toc {
    padding-left: 0;
  }
  .toc-sep { margin: var(--sp-1) var(--sp-2); }
}

/* ============ 窄屏（≤1100px）：卷目收纳为抽屉 + 窄图标栏 ============ */
@media (max-width: 1100px) {
  .toc {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 240px;
    max-width: 82vw;
    margin: 0;
    padding: var(--sp-3);
    background: var(--paper);
    border-right: var(--rule-double);
    box-shadow: 4px 0 24px rgba(33, 29, 23, 0.25);
    transform: translateX(-100%);
    transition: transform var(--dur-2) var(--ease-out);
    z-index: 100;
    max-height: none;
    overflow-y: auto;
  }

  .toc.drawer-open { transform: translateX(0); }

  /* 抽屉内恢复完整形态 */
  .toc-label,
  .toc-count,
  .toc-sub,
  .toc-head h4 { display: block; }
  .toc-item { justify-content: flex-start; }

  .toc-close { display: block; }

  .side-rail {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    position: sticky;
    top: 72px;
    align-self: start;
    max-height: calc(100vh - 96px);
    overflow-y: auto;
  }

  .rail-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--sp-2) 0;
    font-size: 1rem;
    line-height: 1;
    color: var(--ink);
    background: transparent;
    border: none;
    border-bottom: var(--rule-dot);
    cursor: pointer;
  }

  .rail-toggle.open { color: var(--vermilion); }

  .rail-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: var(--sp-1) 0;
    font-family: var(--font-serif-cn);
    font-size: 0.9rem;
    color: var(--ink);
    text-decoration: none;
    border-left: 2px solid transparent;
    transition: all var(--dur-1);
  }

  .rail-item:hover { color: var(--vermilion); }

  .rail-item.active {
    color: var(--vermilion);
    border-left-color: var(--vermilion);
  }

  .rail-count {
    font-family: var(--font-mono);
    font-size: 0.5rem;
    color: var(--ink-muted);
    transform: scale(0.9);
  }

  .side-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(33, 29, 23, 0.45);
    z-index: 99;
  }
}

@media (min-width: 1101px) {
  .side-rail { display: none; }
  .side-backdrop { display: none; }
}
</style>
