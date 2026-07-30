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

    <!-- 数据档案 -->
    <div class="section-head" v-if="userStore.isReady">
      <span class="section-num">§ 02</span>
      <h2 class="section-title">数据档案</h2>
      <span class="section-meta">Statistics</span>
    </div>

    <div class="stat-grid" v-if="userStore.isReady">
      <div class="stat-cell" v-for="item in statItems" :key="item.label">
        <div class="stat-num" v-html="formatStatNum(item.count)"></div>
        <div class="stat-label">{{ item.label }}</div>
      </div>
    </div>

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
        <div class="entry-num">{{ formatStatNum(m.count || 0) }}</div>
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
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const statItems = computed(() => {
  const s = userStore.stats
  return [
    { label: '说说', count: s.messages },
    { label: '日志', count: s.blogs },
    { label: '日记', count: s.diaries },
    { label: '照片', count: s.photos },
    { label: '视频', count: s.videos },
    { label: '留言', count: s.boards },
    { label: '收藏', count: s.favorites },
    { label: '分享', count: s.shares },
    { label: '好友', count: s.friends },
    { label: '访客', count: s.visitors }
  ]
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

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0;
  border: var(--line);
  margin: var(--sp-5) 0;
}

.stat-cell {
  padding: var(--sp-5);
  border-right: var(--line);
  border-bottom: var(--line);
  background: rgba(255, 255, 255, 0.2);
}

/* 每行最后一个 cell 不显示右边框，避免与外框重叠 */
.stat-cell:last-child {
  border-right: none;
}

/* 响应式：≥4 列时一行内最后一个 cell 隐藏右边框 */
@media (min-width: 1024px) {
  .stat-cell:nth-child(4n) {
    border-right: none;
  }
}

/* 响应式：2 列布局（平板） */
@media (max-width: 1023px) and (min-width: 640px) {
  .stat-cell:nth-child(2n) {
    border-right: none;
  }
}

/* 响应式：1 列布局（手机） */
@media (max-width: 639px) {
  .stat-cell {
    border-right: none;
  }
}

.stat-num {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
  color: var(--ink);
}

.stat-num :deep(em) {
  color: var(--vermilion);
  font-style: normal;
}

.stat-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-top: var(--sp-2);
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

/* 模块入口网格 */
.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0;
  border: var(--line);
  margin: var(--sp-5) 0;
}

.entry-cell {
  display: block;
  padding: var(--sp-5);
  border-right: var(--line);
  border-bottom: var(--line);
  background: rgba(255, 255, 255, 0.2);
  color: var(--ink);
  border-top: none;
  border-left: none;
  transition: background 0.15s, transform 0.15s;
}

.entry-cell:hover {
  background: rgba(200, 68, 42, 0.06);
  transform: translateY(-2px);
}

.entry-cell:nth-child(4n) {
  border-right: none;
}

@media (max-width: 1023px) and (min-width: 640px) {
  .entry-cell:nth-child(2n) {
    border-right: none;
  }
  .entry-cell:nth-child(4n) {
    border-right: var(--line);
  }
}

@media (max-width: 639px) {
  .entry-cell {
    border-right: none;
  }
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
