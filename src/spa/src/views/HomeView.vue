<template>
  <section class="home-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 01</span>
      <h2 class="section-title">个人中心</h2>
      <span class="section-meta">{{ userStore.isReady ? '已就绪' : '加载中…' }}</span>
    </div>

    <!-- 加载/错误状态 -->
    <div v-if="userStore.loading" class="app-loading">正在加载用户信息…</div>
    <div v-else-if="userStore.error" class="error-tip">
      <p>{{ userStore.error }}</p>
      <p class="hint">提示：请先通过扩展导出 SPA 备份，再双击 index.html 打开。</p>
    </div>

    <!-- 用户信息卡 -->
    <div v-else-if="userStore.isReady" class="user-card">
      <div class="user-avatar">
        <img v-if="userStore.avatar" :src="userStore.avatar" :alt="userStore.nickname" />
        <span v-else class="avatar-placeholder">{{ (userStore.nickname || '档')[0] }}</span>
      </div>
      <div class="user-info">
        <h3 class="user-name">{{ userStore.nickname || '匿名' }}</h3>
        <div class="user-meta">
          <span class="meta">№ {{ userStore.uin }}</span>
          <span v-if="userStore.isOwner" class="tag tag-vermilion" style="margin-left: 8px;">本人</span>
        </div>
      </div>
    </div>

    <!-- 档案起点：第一条说说 -->
    <div class="section-head" v-if="userStore.isReady">
      <span class="section-num">§ 02</span>
      <h2 class="section-title">档案起点</h2>
      <span class="section-meta">第一条说说</span>
    </div>

    <section v-if="firstMessage" class="first-card">
      <div class="first-date">
        <span class="first-date-day">{{ firstDay }}</span>
        <span class="first-date-rest">{{ firstYear }} 年 {{ firstMonth }} 月</span>
      </div>
      <div class="first-body">
        <p class="first-text">{{ firstText }}</p>
        <div class="first-stats">
          <span v-if="firstMessage.imgCount > 0" class="first-stat">图 {{ firstMessage.imgCount }}</span>
          <span v-if="firstMessage.commentCount > 0" class="first-stat">评 {{ firstMessage.commentCount }}</span>
          <span v-if="firstMessage.likeCount > 0" class="first-stat">赞 {{ firstMessage.likeCount }}</span>
          <span v-if="!firstMessage.imgCount && !firstMessage.commentCount && !firstMessage.likeCount" class="first-stat muted">无互动 · 安静的开始</span>
        </div>
      </div>
      <RouterLink to="/report" class="first-more" title="查看年度档案">
        <span class="first-more-label">查看更多</span>
        <span class="first-more-arrow">→</span>
      </RouterLink>
    </section>
    <section v-else-if="userStore.isReady" class="first-card first-card-empty">
      <p class="first-text">还没有找到第一条说说——<em>起点未至，故事待写。</em></p>
      <RouterLink to="/report" class="first-more" title="查看年度档案">
        <span class="first-more-label">查看更多</span>
        <span class="first-more-arrow">→</span>
      </RouterLink>
    </section>

    <!-- 入口提示 -->
    <div class="section-head" v-if="userStore.isReady">
      <span class="section-num">§ 03</span>
      <h2 class="section-title">入口</h2>
      <span class="section-meta">Modules</span>
    </div>

    <div v-if="userStore.isReady" class="entry-grid">
      <RouterLink
        v-for="m in moduleEntries"
        :key="m.path"
        :to="m.path"
        class="entry-cell"
        :class="{ 'entry-cell-empty': !m.count }"
      >
        <div class="entry-num" v-html="formatStatNum(m.count || 0)"></div>
        <div class="entry-label">{{ m.label }}</div>
        <div class="entry-desc">{{ m.desc }}</div>
      </RouterLink>
    </div>

    <!-- 页脚 -->
    <div class="colophon">
      QQ空间<em>档案</em> · Editorial Archive Style<br>
      Fraunces · Noto Serif SC · JetBrains Mono
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useMessagesStore } from '@/stores/messages'

const userStore = useUserStore()
const messagesStore = useMessagesStore()

/** 首页挂载时加载说说索引（首条说说展示） */
onMounted(() => {
  messagesStore.init()
})

/** 第一条说说（时间升序最早的一条） */
const firstMessage = computed(() => {
  const list = messagesStore.index
  if (!list.length) return null
  return [...list].sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0]
})

/** 首条说说时间解析：'YYYY-MM-DD HH:mm:ss' */
const firstDate = computed(() => {
  const t = firstMessage.value?.time || ''
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? { y: m[1], mo: Number(m[2]), d: Number(m[3]) } : null
})
const firstYear = computed(() => firstDate.value?.y || '')
const firstMonth = computed(() => firstDate.value?.mo || '')
const firstDay = computed(() => firstDate.value?.d || '')
/** 首条说说内容（去除 QQ 表情标记） */
const firstText = computed(() => {
  const t = firstMessage.value?.title || ''
  return t.replace(/\[em\]e\d+\[\/em\]/g, '').replace(/\[em\]\[\/em\]/g, '').trim() || '（这条说说没有文字）'
})

const moduleEntries = computed(() => {
  const s = userStore.stats
  return [
    { path: '/messages', label: '说说', count: s.messages, desc: '时间线动态' },
    { path: '/blogs', label: '日志', count: s.blogs, desc: '长篇文章' },
    { path: '/diaries', label: '日记', count: s.diaries, desc: '私密记录' },
    { path: '/photos', label: '相册', count: s.photos, desc: '影像档案' },
    { path: '/videos', label: '视频', count: s.videos, desc: '动态影像' },
    { path: '/boards', label: '留言', count: s.boards, desc: '访客留言' },
    { path: '/favorites', label: '收藏', count: s.favorites, desc: '收藏内容' },
    { path: '/shares', label: '分享', count: s.shares, desc: '转发分享' },
    { path: '/friends', label: '好友', count: s.friends, desc: '好友档案' },
    { path: '/visitors', label: '访客', count: s.visitors, desc: '访问足迹' }
  ]
})

function formatStatNum(n: number): string {
  if (!n) return '0'
  if (n >= 1000) {
    const k = Math.floor(n / 1000)
    const r = n % 1000
    if (r === 0) return `${k},<em>000</em>`
    return `${k},<em>${String(r).padStart(3, '0')}</em>`
  }
  return String(n)
}
</script>

<style scoped>
.error-tip {
  padding: var(--sp-5);
  border: var(--line);
  background: rgba(200, 68, 42, 0.04);
  font-family: var(--font-serif-cn);
}
.error-tip .hint {
  margin-top: var(--sp-2);
  font-size: 0.85rem;
  color: var(--ink-3);
}

.user-card {
  display: flex;
  align-items: center;
  gap: var(--sp-5);
  padding: var(--sp-5);
  border: var(--line);
  background: rgba(255, 255, 255, 0.3);
  margin: var(--sp-5) 0;
}

.user-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: var(--line);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--paper-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-family: var(--font-display);
  font-size: 2rem;
  color: var(--ink-2);
}

.user-name {
  font-family: var(--font-display);
  font-size: 1.5rem;
  margin-bottom: var(--sp-2);
}

.user-meta {
  display: flex;
  align-items: center;
}

/* 档案起点：首条说说卡片 */
.first-card {
  display: flex;
  align-items: stretch;
  gap: var(--sp-5);
  padding: var(--sp-5);
  border: var(--line);
  background: linear-gradient(180deg, rgba(234, 224, 197, 0.2), rgba(200, 68, 42, 0.04));
  margin: var(--sp-5) 0;
}

.first-date {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  padding-right: var(--sp-5);
  border-right: var(--line-dot);
}

.first-date-day {
  font-family: var(--font-display);
  font-size: 2.6rem;
  font-weight: 800;
  line-height: 1;
  color: var(--vermilion);
}

.first-date-rest {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  color: var(--ink-3);
  margin-top: var(--sp-2);
  white-space: nowrap;
}

.first-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--sp-3);
}

.first-text {
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  line-height: 1.8;
  color: var(--ink);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.first-text em {
  color: var(--ink-3);
  font-style: normal;
}

.first-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
}

.first-stat {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  border: 1px solid var(--border);
  padding: 1px 7px;
  border-radius: 2px;
}

.first-stat.muted {
  border-style: dotted;
}

.first-more {
  flex-shrink: 0;
  align-self: center;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: var(--line);
  color: var(--ink-2);
  text-decoration: none;
  transition: all 0.15s;
}

.first-more:hover {
  background: var(--vermilion);
  border-color: var(--vermilion);
  color: var(--paper);
}

.first-more-label {
  font-family: var(--font-serif-cn);
  font-size: 0.9rem;
}

.first-more-arrow {
  font-family: var(--font-mono);
  transition: transform 0.15s;
}

.first-more:hover .first-more-arrow {
  transform: translateX(3px);
}

.first-card-empty .first-text {
  -webkit-line-clamp: unset;
}

@media (max-width: 720px) {
  .first-card {
    flex-direction: column;
    gap: var(--sp-4);
  }
  .first-date {
    flex-direction: row;
    align-items: baseline;
    gap: var(--sp-2);
    min-width: 0;
    padding-right: 0;
    padding-bottom: var(--sp-3);
    border-right: none;
    border-bottom: var(--line-dot);
  }
  .first-date-day {
    font-size: 1.8rem;
  }
  .first-date-rest {
    margin-top: 0;
  }
  .first-more {
    align-self: flex-end;
  }
}

.colophon {
  margin-top: var(--sp-9);
  padding-top: var(--sp-5);
  border-top: var(--line-double);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-3);
}

/* 模块入口网格 —— gap+背景色方案，任意列数下分界线均稳定 */
.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1px;
  background: var(--ink);
  border: 1px solid var(--ink);
  margin: var(--sp-5) 0;
}

.entry-cell {
  display: block;
  padding: var(--sp-5);
  background: var(--paper);
  color: var(--ink);
  transition: background 0.15s, transform 0.15s;
}

.entry-cell:hover {
  background: var(--paper-2);
  transform: translateY(-2px);
}

.entry-cell-empty {
  opacity: 0.45;
}

.entry-num {
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
  color: var(--ink);
}

.entry-num :deep(em) {
  color: var(--vermilion);
  font-style: normal;
}

.entry-label {
  font-family: var(--font-serif-cn);
  font-size: 1rem;
  margin-top: var(--sp-2);
  color: var(--ink);
}

.entry-desc {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-top: var(--sp-1);
}

.colophon :deep(em) {
  color: var(--vermilion);
  font-style: italic;
  letter-spacing: 0.05em;
}
</style>
