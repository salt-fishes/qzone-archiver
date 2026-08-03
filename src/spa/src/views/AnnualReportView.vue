<template>
  <section class="report-view">
    <!-- ============ 封面（§01） ============ -->
    <header v-if="cover" class="report-cover">
      <div class="cover-kicker">年度档案 · Annual Archive</div>
      <h1 class="cover-title" v-html="cover.title"></h1>
      <p class="cover-text" v-html="cover.text"></p>
      <div class="cover-accent">{{ cover.accent }}</div>

      <!-- 年度切换器 -->
      <div class="year-switch">
        <button
          class="year-btn"
          :class="{ active: year === 'all' }"
          @click="year = 'all'"
        >全部</button>
        <button
          v-for="y in years"
          :key="y"
          class="year-btn"
          :class="{ active: year === y }"
          @click="year = y"
        >{{ y }}</button>
      </div>
    </header>

    <!-- ============ 章节卡片 ============ -->
    <main class="report-chapters">
      <article
        v-for="ch in body"
        :key="ch.id"
        :id="`ch-${ch.id}`"
        class="report-chapter"
      >
        <!-- 章节头 -->
        <header class="chapter-head">
          <span class="chapter-num">{{ ch.num }}</span>
          <h2 class="chapter-title" v-html="ch.title"></h2>
          <span v-if="ch.accent" class="chapter-accent">{{ ch.accent }}</span>
        </header>

        <!-- 正文 -->
        <p class="chapter-text" v-html="ch.text"></p>

        <!-- 图形区 -->
        <!-- 柱状图（年度 / 月度 / 时段 / 词频）：每列 = 柱体 + 底部标签，避免值/标签重叠 -->
        <div
          v-if="isBarChart(ch.id)"
          class="chart-box"
        >
          <div
            v-for="b in chartItems(ch)"
            :key="b.label"
            class="chart-col"
            :title="`${b.label} · ${b.value}`"
          >
            <div class="chart-track">
              <div class="chart-bar" :style="{ height: barH(ch, b.value) }"></div>
            </div>
            <span class="bar-label">{{ b.label }}</span>
          </div>
        </div>

        <!-- 起点与终点（§03）：第一条 / 最近一条 -->
        <blockquote v-else-if="ch.id === 'first'" class="chapter-quote first-quote">
          <template v-if="ch.data?.first">
            <p class="quote-main">{{ cleanText(ch.data.first.title) || '（这条说说没有文字）' }}</p>
            <footer class="quote-foot">
              {{ ch.data.first.time || '' }}
              <span class="quote-tag">第一条</span>
              <RouterLink v-if="msgLink(ch.data.first)" :to="msgLink(ch.data.first)" class="quote-link">原文 →</RouterLink>
            </footer>
          </template>
          <hr
            v-if="ch.data?.first && ch.data?.last && ch.data.last !== ch.data.first"
            class="quote-divider"
          />
          <template v-if="ch.data?.last && ch.data.last !== ch.data.first">
            <p class="quote-main">{{ cleanText(ch.data.last.title) || '（这条说说没有文字）' }}</p>
            <footer class="quote-foot">
              {{ ch.data.last.time || '' }}
              <span class="quote-tag">最近一条</span>
              <RouterLink v-if="msgLink(ch.data.last)" :to="msgLink(ch.data.last)" class="quote-link">原文 →</RouterLink>
            </footer>
          </template>
        </blockquote>

        <!-- 金句（§07）：大引号 -->
        <blockquote v-else-if="ch.id === 'quote'" class="chapter-quote">
          <span class="quote-mark">“</span>
          <p class="quote-main">{{ quoteText(ch) }}</p>
          <footer class="quote-foot">
            <RouterLink v-if="msgLink(ch.data?.longestContent)" :to="msgLink(ch.data.longestContent)" class="quote-link">查看原文 →</RouterLink>
          </footer>
        </blockquote>

        <!-- 互动高光（§08）：数据条 -->
        <div v-else-if="ch.id === 'highlight'" class="highlight-grid">
          <div class="highlight-cell">
            <span class="highlight-num">{{ ch.data?.topLike?.likeCount || 0 }}</span>
            <span class="highlight-label">最多赞</span>
            <RouterLink
              v-if="ch.data?.topLike?.title"
              :to="msgLink(ch.data.topLike)"
              class="highlight-title"
            >{{ cleanText(ch.data.topLike.title).slice(0, 24) }}</RouterLink>
          </div>
          <div class="highlight-cell">
            <span class="highlight-num">{{ ch.data?.topComment?.commentCount || 0 }}</span>
            <span class="highlight-label">最多评</span>
            <RouterLink
              v-if="ch.data?.topComment?.title"
              :to="msgLink(ch.data.topComment)"
              class="highlight-title"
            >{{ cleanText(ch.data.topComment.title).slice(0, 24) }}</RouterLink>
          </div>
        </div>

        <!-- 人物志（§10）：好友档案列表 -->
        <div v-else-if="ch.id === 'people' && ch.data?.lines?.length" class="people-list">
          <div v-for="line in ch.data.lines" :key="line.key" class="people-item">
            <span class="people-label">{{ line.label }}</span>
            <span class="people-name">{{ line.text }}</span>
            <span v-if="line.note" class="people-note">{{ line.note }}</span>
            <span v-if="line.status" class="people-status">{{ line.status }}</span>
          </div>
        </div>

        <!-- 特别的日子（§11）：多主题卡片 -->
        <div v-else-if="ch.id === 'special' && ch.data?.days?.length" class="special-grid">
          <div v-for="day in ch.data.days" :key="day.key" class="special-card" :class="`special-${day.key}`">
            <span class="special-mark">{{ day.mark }}</span>
            <div class="special-body">
              <span class="special-label">{{ day.label }}</span>
              <p class="special-text">{{ day.text }}</p>
              <span class="special-time">{{ day.time || '' }}</span>
              <RouterLink v-if="msgLink(day)" :to="msgLink(day)" class="quote-link">原文 →</RouterLink>
            </div>
          </div>
        </div>

        <!-- 年度词（§12）：词云大字 -->
        <div v-else-if="ch.id === 'word' && ch.data?.words?.length" class="word-cloud">
          <span
            v-for="(w, i) in ch.data.words"
            :key="w.word"
            class="word-tag"
            :style="{ fontSize: wordSize(i) }"
            :title="`${w.word} · ${w.count} 次`"
          >{{ w.word }}</span>
        </div>
      </article>
    </main>

    <!-- 页脚 -->
    <footer class="report-foot">
      年度档案 · 由 qzone-archiver 为你生成
      <span class="foot-hint">{{ detailLoaded ? '内容已全部载入' : '正在翻找更早的档案…' }}</span>
    </footer>

    <!-- 背景音乐播放器 -->
    <div class="music-player">
      <button
        type="button"
        class="music-btn"
        :class="{ playing: musicOn }"
        :title="musicOn ? '暂停音乐' : '播放音乐'"
        @click="toggleMusic"
      >
        <span class="music-icon">{{ musicOn ? '♫' : '♪' }}</span>
      </button>
      <span v-if="musicBlocked" class="music-tip">点击开启背景音乐 · 请打开声音</span>
      <span v-else-if="musicOn" class="music-tip">背景音乐播放中…</span>
    </div>
    <audio ref="audioRef" :src="MUSIC_SRC" loop preload="auto"></audio>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAnnualReport, type ReportChapter } from '@/composables/useAnnualReport'

/** 年度：'all' 或具体年份，响应式切换 */
const year = ref<'all' | number>('all')

const { stats, chapters, loadDetail, detailLoaded } = useAnnualReport(year)

/** 可切换的年份列表 */
const years = computed<number[]>(() => stats.value.yearCounts.map(x => x.year))

const cover = computed(() => chapters.value.find(c => c.id === 'cover'))
const body = computed(() => chapters.value.filter(c => c.id !== 'cover'))

/** 年报 → 说说详情跳转链接（/messages?year=YYYY&tid=XXX） */
function msgLink(m: { tid?: string | number; time?: string } | null | undefined): string {
  if (!m || m.tid === undefined || m.tid === null || m.tid === '') return ''
  const y = (m.time || '').substring(0, 4)
  return y ? `/messages?year=${y}&tid=${encodeURIComponent(String(m.tid))}` : ''
}

/** 挂载后延迟加载全量文本（金句 / 年度词） */
onMounted(() => {
  setTimeout(loadDetail, 600)
  // 尝试自动播放背景音乐；被浏览器拦截时提示用户手动开启
  const audio = audioRef.value
  if (audio) {
    audio.play().then(() => {
      musicOn.value = true
      musicBlocked.value = false
    }).catch(() => {
      musicBlocked.value = true
    })
  }
})

/* ============ 背景音乐 ============ */
/** 音乐文件位于 Common/spa/assets/（file:// 相对路径） */
const MUSIC_SRC = './assets/annual-music.mp3'
const audioRef = ref<HTMLAudioElement | null>(null)
const musicOn = ref(false)
const musicBlocked = ref(false)

function toggleMusic() {
  const audio = audioRef.value
  if (!audio) return
  if (musicOn.value) {
    audio.pause()
    musicOn.value = false
    return
  }
  audio.play().then(() => {
    musicOn.value = true
    musicBlocked.value = false
  }).catch(() => {
    musicBlocked.value = true
  })
}

/* ============ 图形辅助 ============ */

function isBarChart(id: string): boolean {
  return ['years', 'months', 'night', 'word'].includes(id)
}

interface ChartItem { label: string; value: number }

function chartItems(ch: ReportChapter): ChartItem[] {
  switch (ch.id) {
    case 'years':
      return (ch.data?.yearCounts || []).map((x: any) => ({ label: String(x.year), value: x.count }))
    case 'months':
      return (ch.data?.monthCounts || []).map((v: number, i: number) => ({ label: `${i + 1}月`, value: v }))
    case 'night':
      return (ch.data?.hourCounts || []).map((v: number, i: number) => ({ label: `${i}时`, value: v }))
    case 'word':
      return (ch.data?.words || []).map((w: any) => ({ label: w.word, value: w.count }))
    default:
      return []
  }
}

/** 柱高百分比（相对该章最大值） */
function barH(ch: ReportChapter, value: number): string {
  const items = chartItems(ch)
  const max = Math.max(1, ...items.map(i => i.value))
  const pct = Math.max(2, Math.round((value / max) * 100))
  return `${pct}%`
}

/** 词频字号：越大越突出 */
function wordSize(index: number): string {
  const sizes = ['2.1rem', '1.6rem', '1.4rem', '1.2rem', '1.1rem', '1rem', '0.95rem', '0.9rem']
  return sizes[Math.min(index, sizes.length - 1)]
}

/** 金句正文（去首尾空白，截断超长） */
function quoteText(ch: ReportChapter): string {
  const t = ch.data?.longest?.text || ''
  const clean = t.replace(/\[em\]e\d+\[\/em\]/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return clean.length > 200 ? clean.slice(0, 200) + '…' : clean
}

/** 说说文本清洗：去除 QQ 表情标记 [em]xxx[/em] */
function cleanText(text: string): string {
  return (text || '').replace(/\[em\]e\d+\[\/em\]/g, '').replace(/\[em\]\[\/em\]/g, '').trim()
}
</script>

<style scoped>
/* ============ 整体 ============ */
.report-view {
  max-width: 860px;
  margin: 0 auto;
  padding: var(--sp-6) var(--sp-5) var(--sp-9);
}

/* ============ 封面 ============ */
.report-cover {
  text-align: center;
  padding: var(--sp-8) var(--sp-5);
  margin-bottom: var(--sp-7);
  border: var(--line-double);
  background: linear-gradient(180deg, rgba(234, 224, 197, 0.25), rgba(200, 68, 42, 0.05));
  position: relative;
}

.cover-kicker {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--vermilion);
  margin-bottom: var(--sp-4);
}

.cover-title {
  font-family: var(--font-serif-cn);
  font-size: 2rem;
  font-weight: 500;
  color: var(--ink);
  margin: 0 0 var(--sp-4);
}

.cover-title :deep(em) {
  color: var(--vermilion);
  font-style: italic;
}

.cover-text {
  font-family: var(--font-serif-cn);
  font-size: 1.05rem;
  line-height: 1.9;
  color: var(--ink-2);
  max-width: 620px;
  margin: 0 auto var(--sp-5);
}

.cover-text :deep(em) {
  color: var(--ink);
  font-style: normal;
}

.cover-accent {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: var(--ink-3);
  margin-bottom: var(--sp-5);
}

/* 年度切换器 */
.year-switch {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.year-btn {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: var(--sp-1) var(--sp-3);
  background: transparent;
  border: var(--line);
  color: var(--ink-3);
  cursor: pointer;
  transition: all 0.15s;
}

.year-btn:hover {
  color: var(--vermilion);
  border-color: var(--vermilion);
}

.year-btn.active {
  background: var(--vermilion);
  border-color: var(--vermilion);
  color: var(--paper);
}

/* ============ 章节卡片 ============ */
.report-chapters {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
}

.report-chapter {
  padding: var(--sp-6);
  border: 1px solid var(--ink-3);
  background: var(--paper);
  box-shadow: 0 1px 0 rgba(26, 22, 18, 0.06);
}

.chapter-head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  padding-bottom: var(--sp-3);
  margin-bottom: var(--sp-4);
  border-bottom: var(--line-dot);
}

.chapter-num {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--vermilion);
  letter-spacing: 0.1em;
}

.chapter-title {
  font-family: var(--font-serif-cn);
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--ink);
  margin: 0;
}

.chapter-title :deep(em) {
  color: var(--vermilion);
  font-style: normal;
}

.chapter-accent {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--ink-3);
  white-space: nowrap;
}

.chapter-text {
  font-family: var(--font-serif-cn);
  font-size: 1rem;
  line-height: 1.9;
  color: var(--ink-2);
  margin: 0 0 var(--sp-4);
}

.chapter-text :deep(em) {
  color: var(--ink);
  font-style: normal;
}

/* ============ 柱状图 ============ */
.chart-box {
  display: flex;
  align-items: stretch;
  gap: 4px;
  height: 150px;
  padding: var(--sp-3) var(--sp-2) 0;
  border-top: 1px solid rgba(26, 22, 18, 0.08);
}

/* 每列：柱体轨道 + 底部标签 */
.chart-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.chart-track {
  flex: 1;
  display: flex;
  align-items: flex-end;
}

.chart-bar {
  width: 100%;
  background: rgba(200, 68, 42, 0.28);
  border-top: 2px solid var(--vermilion);
  transition: background 0.15s;
  min-height: 2px;
}

.chart-col:hover .chart-bar {
  background: rgba(200, 68, 42, 0.45);
}

.bar-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--ink-3);
  text-align: center;
  padding: var(--sp-1) 0 0;
  overflow: hidden;
  white-space: nowrap;
  letter-spacing: 0.04em;
}

/* ============ 引用块（起点 / 金句） ============ */
.chapter-quote {
  margin: 0;
  padding: var(--sp-4) var(--sp-5);
  background: rgba(234, 224, 197, 0.35);
  border-left: 3px solid var(--vermilion);
}

.first-quote .quote-main {
  font-family: var(--font-serif-cn);
  font-size: 1rem;
  line-height: 1.8;
  color: var(--ink);
  margin: 0 0 var(--sp-2);
}

.quote-empty {
  color: var(--ink-3);
}

.quote-foot {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--ink-3);
  letter-spacing: 0.06em;
}

.quote-stat {
  margin-left: var(--sp-2);
}

/* 金句大引号 */
.chapter-quote .quote-mark {
  font-family: var(--font-display);
  font-size: 3rem;
  line-height: 1;
  color: var(--vermilion);
  display: block;
  margin-bottom: var(--sp-2);
}

.chapter-quote .quote-main {
  font-family: var(--font-serif-cn);
  font-size: 1.15rem;
  line-height: 1.9;
  color: var(--ink);
  margin: 0;
}

/* ============ 互动高光 ============ */
.highlight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1px;
  background: var(--ink);
  border: 1px solid var(--ink);
}

.highlight-cell {
  padding: var(--sp-4);
  background: var(--paper);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.highlight-num {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  color: var(--vermilion);
}

.highlight-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.highlight-title {
  font-family: var(--font-serif-cn);
  font-size: 0.8rem;
  color: var(--ink-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ============ 年度词 ============ */
.word-cloud {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: var(--sp-3) var(--sp-4);
  padding: var(--sp-4) 0 var(--sp-2);
}

.word-tag {
  font-family: var(--font-serif-cn);
  color: var(--ink);
  line-height: 1.2;
  cursor: default;
  transition: color 0.15s;
}

.word-tag:hover {
  color: var(--vermilion);
}

/* ============ 页脚 ============ */
.report-foot {
  margin-top: var(--sp-8);
  padding-top: var(--sp-5);
  border-top: var(--line-double);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.foot-hint {
  display: block;
  margin-top: var(--sp-2);
  letter-spacing: 0.1em;
  color: var(--ink-muted, var(--ink-3));
}

/* ============ 背景音乐播放器 ============ */
.music-player {
  position: fixed;
  right: var(--sp-5);
  bottom: var(--sp-5);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.music-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--ink-3);
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  box-shadow: 0 2px 8px rgba(26, 22, 18, 0.12);
}

.music-btn:hover {
  border-color: var(--vermilion);
  color: var(--vermilion);
}

.music-btn.playing {
  background: var(--vermilion);
  border-color: var(--vermilion);
  color: var(--paper);
  animation: music-pulse 2s ease-in-out infinite;
}

@keyframes music-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(200, 68, 42, 0.35); }
  50% { box-shadow: 0 0 0 8px rgba(200, 68, 42, 0); }
}

.music-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.music-tip {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  color: var(--ink-3);
  background: var(--paper);
  border: 1px solid var(--border);
  padding: var(--sp-2) var(--sp-3);
  border-radius: 2px;
  box-shadow: 0 2px 8px rgba(26, 22, 18, 0.08);
}

/* ============ 人物志 ============ */
.people-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.people-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border-left: 3px solid var(--ink-3);
  background: rgba(234, 224, 197, 0.25);
}

.people-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.15em;
  color: var(--vermilion);
  text-transform: uppercase;
}

.people-name {
  font-family: var(--font-serif-cn);
  font-size: 1rem;
  font-weight: 500;
  color: var(--ink);
}

.people-note {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--ink-3);
}

.people-status {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  color: var(--ink-3);
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 2px;
}

/* ============ 引用块细节 ============ */
.quote-divider {
  border: 0;
  border-top: var(--line-dot);
  margin: var(--sp-3) 0;
}

.quote-tag {
  margin-left: var(--sp-2);
  color: var(--vermilion);
  border: 1px solid var(--vermilion);
  padding: 0 5px;
  font-size: 0.6rem;
  border-radius: 2px;
}

.quote-link {
  margin-left: var(--sp-2);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  color: var(--ink-3);
  text-decoration: none;
  border-bottom: 1px dotted var(--ink-3);
  white-space: nowrap;
}

.quote-link:hover {
  color: var(--vermilion);
  border-bottom-color: var(--vermilion);
}

/* ============ 特别的日子（多主题卡片） ============ */
.special-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: var(--sp-3);
}

.special-card {
  display: flex;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border: 1px solid var(--ink-3);
  border-left: 4px solid var(--ink-3);
  background: var(--paper);
}

.special-mark {
  font-size: 1.4rem;
  line-height: 1.2;
  flex-shrink: 0;
  color: var(--ink-3);
}

.special-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.special-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.special-text {
  font-family: var(--font-serif-cn);
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--ink);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.special-time {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--ink-3);
  letter-spacing: 0.05em;
}

/* 各主题配色 */
.special-birthday { border-left-color: var(--vermilion); }
.special-birthday .special-mark { color: var(--vermilion); }

.special-newyear { border-left-color: var(--gold); }
.special-newyear .special-mark { color: var(--gold); }

.special-festival { border-left-color: var(--moss); }
.special-festival .special-mark { color: var(--moss); }

.special-milestone { border-left-color: var(--indigo); }
.special-milestone .special-mark { color: var(--indigo); }

/* 窄屏 */
@media (max-width: 720px) {
  .music-player {
    right: var(--sp-3);
    bottom: var(--sp-3);
  }
  .music-tip {
    max-width: 180px;
  }
  .people-status {
    margin-left: 0;
    width: 100%;
  }
  .report-view {
    padding: var(--sp-4) var(--sp-3) var(--sp-8);
  }
  .report-cover {
    padding: var(--sp-6) var(--sp-3);
  }
  .report-chapter {
    padding: var(--sp-4) var(--sp-3);
  }
  .chapter-head {
    flex-wrap: wrap;
  }
  .chapter-accent {
    width: 100%;
    margin-left: 0;
  }
}
</style>
