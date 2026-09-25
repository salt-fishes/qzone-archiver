<template>
  <div class="rp-page" :class="{ 'rp-static': reduced }" :data-year="year">
    <!-- three.js 粒子背景（石墨/金，低透明度，保持极简） -->
    <div ref="bgRef" class="rp-bg" aria-hidden="true"></div>
    <!-- 装饰网点底纹（填补留白） -->
    <div class="rp-deco" aria-hidden="true"></div>

    <!-- 顶部固定：返回档案馆 + 导出长图 + 年度切换 -->
    <header class="rp-top">
      <div class="rp-top-left">
        <button type="button" class="rp-back" @click="router.push('/')">← 返回档案馆</button>
        <button
          type="button"
          class="rp-back rp-export"
          :disabled="exporting"
          @click="exportLongImage"
        >{{ exporting ? '生成中…' : '导出长图 ↓' }}</button>
      </div>
      <nav class="rp-years" aria-label="年度切换">
        <button
          type="button"
          class="rp-year"
          :class="{ active: year === 'all' }"
          @click="year = 'all'"
        >全部</button>
        <button
          v-for="y in years"
          :key="y"
          type="button"
          class="rp-year"
          :class="{ active: year === y }"
          @click="year = y"
        >{{ y }}</button>
      </nav>
    </header>

    <!-- 滚动进度 -->
    <div class="rp-progress" aria-hidden="true">
      <div ref="progressRef" class="rp-progress-bar"></div>
    </div>

    <!-- ============ 封面（巨型排版，逐字升起） ============ -->
    <section v-if="cover" class="rp-hero" :key="`hero-${year}`">
      <p class="rp-kicker">{{ cover.num }} · ANNUAL ARCHIVE</p>
      <h1 class="rp-title">{{ cover.title }}</h1>
      <p class="rp-text" v-html="cover.text"></p>
      <p v-if="cover.accent" class="rp-accent">{{ cover.accent }}</p>
      <span class="rp-hero-num" aria-hidden="true">{{ spanLabel }}</span>
      <div class="rp-scroll-hint"><span>SCROLL</span><i>↓</i></div>
    </section>

    <!-- 跑马灯 -->
    <div class="rp-marquee" aria-hidden="true">
      <div class="rp-marquee-track">
        <template v-for="n in 8" :key="n">
          <span>QQ空间 · 年度档案 · ANNUAL ARCHIVE · {{ cover?.accent || '' }} ·&nbsp;</span>
        </template>
      </div>
    </div>

    <!-- ============ 章节 ============ -->
    <section
      v-for="ch in body"
      :key="`ch-${ch.id}-${year}`"
      :id="`ch-${ch.id}`"
      class="rp-section"
    >
      <span class="rp-big" aria-hidden="true">{{ ch.num }}</span>

      <div class="rp-ch-head">
        <span class="rp-num">{{ ch.num }}</span>
        <h2 class="rp-ch-title">{{ ch.title }}</h2>
        <span v-if="ch.accent" class="rp-accent">{{ ch.accent }}</span>
      </div>

      <p class="rp-ch-text" v-html="ch.text"></p>

      <!-- 起点与终点（§04）：首条 / 最近一条卡片 -->
      <div v-if="ch.id === 'first' && (ch.data?.first || ch.data?.last)" class="rp-milestones">
        <div v-if="ch.data.first" class="rp-milestone">
          <span class="rp-milestone-tag">第一条</span>
          <p class="rp-milestone-text">{{ cleanText(ch.data.first.title) || '（这条说说没有文字）' }}</p>
          <span class="rp-milestone-time">{{ ch.data.first.time }}</span>
          <RouterLink v-if="msgLink(ch.data.first)" :to="msgLink(ch.data.first)" class="rp-link">原文 →</RouterLink>
        </div>
        <div v-if="ch.data.last && ch.data.last !== ch.data.first" class="rp-milestone">
          <span class="rp-milestone-tag">最近一条</span>
          <p class="rp-milestone-text">{{ cleanText(ch.data.last.title) || '（这条说说没有文字）' }}</p>
          <span class="rp-milestone-time">{{ ch.data.last.time }}</span>
          <RouterLink v-if="msgLink(ch.data.last)" :to="msgLink(ch.data.last)" class="rp-link">原文 →</RouterLink>
        </div>
      </div>

      <!-- 数字档案（通用 cells：互动总量 / 文字累积 / 访客 / 全档案） -->
      <div v-if="ch.data?.cells?.length" class="rp-cells">
        <div v-for="cell in ch.data.cells" :key="cell.label" class="rp-cell">
          <span class="rp-cell-num" :data-count="cell.value">0</span>
          <span class="rp-cell-label">{{ cell.label }}</span>
        </div>
        <!-- 访客：常来的人 -->
        <div v-if="ch.id === 'visitors' && ch.data?.topVisitor" class="rp-cell">
          <span class="rp-cell-num" :data-count="ch.data.topVisitor.count">0</span>
          <span class="rp-cell-label">常来 · {{ ch.data.topVisitor.name }}</span>
        </div>
      </div>

      <!-- 影像档案（§12）：TOP 相册 -->
      <div v-if="ch.id === 'album' && ch.data?.topAlbums?.length" class="rp-albums">
        <div v-for="(a, i) in ch.data.topAlbums" :key="a.albumId" class="rp-album">
          <span class="rp-album-num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="rp-album-name">{{ a.name || '(未命名相册)' }}</span>
          <span class="rp-album-count">{{ a.photoCount }} 张</span>
        </div>
      </div>

      <!-- 柱状图（年度 / 月度 / 时辰 / 词频 / 访客分布；少于 2 个数据点不渲染） -->
      <div v-if="isBarChart(ch.id) && chartItems(ch).length > 1" class="rp-chart" :data-kind="ch.id">
        <div
          v-for="b in chartItems(ch)"
          :key="b.label"
          class="rp-col"
        >
          <div class="rp-track">
            <div
              class="rp-bar"
              :data-h="barH(ch, b.value)"
              :style="{ height: barH(ch, b.value) }"
              :title="`${b.label} · ${b.value}`"
            ></div>
          </div>
          <span class="rp-col-label">{{ b.label }}</span>
        </div>
      </div>

      <!-- 好友分布（横向条） -->
      <div v-else-if="ch.id === 'friend-dist' && ch.data?.groups?.length" class="rp-hbars">
        <div v-for="g in ch.data.groups" :key="g.label" class="rp-hbar">
          <span class="rp-hbar-label">{{ g.label }}</span>
          <div class="rp-hbar-track">
            <div class="rp-hbar-fill" :data-w="g.pct" :style="{ width: g.pct + '%' }"></div>
          </div>
          <span class="rp-hbar-value">{{ g.value }}</span>
        </div>
      </div>

      <!-- 金句（§10）：大引号 -->
      <blockquote v-else-if="ch.id === 'quote'" class="rp-quote">
        <span class="rp-quote-mark">“</span>
        <p class="rp-quote-main">{{ quoteText(ch) }}</p>
        <footer class="rp-quote-foot">
          <RouterLink v-if="msgLink(ch.data?.longestContent)" :to="msgLink(ch.data.longestContent)" class="rp-link">查看原文 →</RouterLink>
        </footer>
      </blockquote>

      <!-- 互动高光（§09）：数据条（无数据的项自动隐藏） -->
      <div v-else-if="ch.id === 'highlight'" class="rp-highlight">
        <div v-if="(ch.data?.topLike?.likeCount || 0) > 0" class="rp-hcell">
          <span class="rp-hnum" :data-count="ch.data?.topLike?.likeCount || 0">0</span>
          <span class="rp-hlabel">最多赞</span>
          <RouterLink
            v-if="ch.data?.topLike?.title"
            :to="msgLink(ch.data.topLike)"
            class="rp-link"
          >{{ cleanText(ch.data.topLike.title).slice(0, 24) }}</RouterLink>
        </div>
        <div v-if="(ch.data?.topComment?.commentCount || 0) > 0" class="rp-hcell">
          <span class="rp-hnum" :data-count="ch.data?.topComment?.commentCount || 0">0</span>
          <span class="rp-hlabel">最多评</span>
          <RouterLink
            v-if="ch.data?.topComment?.title"
            :to="msgLink(ch.data.topComment)"
            class="rp-link"
          >{{ cleanText(ch.data.topComment.title).slice(0, 24) }}</RouterLink>
        </div>
      </div>

      <!-- 人物志（§10）：档案条目 -->
      <div v-else-if="ch.id === 'people' && ch.data?.lines?.length" class="rp-people">
        <div v-for="line in ch.data.lines" :key="line.key" class="rp-person">
          <span class="rp-plabel">{{ line.label }}</span>
          <span class="rp-pname">{{ line.text }}</span>
          <span v-if="line.note" class="rp-pnote">{{ line.note }}</span>
          <span v-if="line.status" class="rp-pstatus">{{ line.status }}</span>
        </div>
      </div>

      <!-- 特别的日子（§11）：主题卡片 -->
      <div v-else-if="ch.id === 'special' && ch.data?.days?.length" class="rp-special">
        <div v-for="day in ch.data.days" :key="day.key" class="rp-scard">
          <span class="rp-smark">{{ day.mark }}</span>
          <span class="rp-slabel">{{ day.label }}</span>
          <p class="rp-stext">{{ day.text }}</p>
          <span class="rp-stime">{{ day.time }}</span>
          <RouterLink v-if="msgLink(day)" :to="msgLink(day)" class="rp-link">原文 →</RouterLink>
        </div>
      </div>

      <!-- 年度词（§12）：词云 -->
      <div v-else-if="ch.id === 'word' && ch.data?.words?.length" class="rp-word">
        <span
          v-for="(w, i) in ch.data.words"
          :key="w.word"
          class="rp-wtag"
          :style="{ fontSize: wordSize(i) }"
          :title="`${w.word} · ${w.count} 次`"
        >{{ w.word }}</span>
      </div>
    </section>

    <!-- 结尾跑马灯 -->
    <div class="rp-marquee" aria-hidden="true">
      <div class="rp-marquee-track">
        <template v-for="n in 8" :key="`e${n}`">
          <span>谢谢你的记录 · THANKS FOR THE MEMORIES ·&nbsp;</span>
        </template>
      </div>
    </div>

    <!-- 内容状态提示 -->
    <footer class="rp-status">
      {{ detailLoaded ? 'CONTENT LOADED' : 'COMPILING ARCHIVE…' }}
    </footer>

    <!-- 背景音乐播放器（网易云外链） -->
    <div class="rp-music">
      <iframe
        class="rp-music-frame"
        title="背景音乐"
        frameborder="no"
        border="0"
        marginwidth="0"
        marginheight="0"
        width="330"
        height="86"
        src="https://music.163.com/outchain/player?type=2&id=480353&auto=1&height=66"
        loading="lazy"
        allow="autoplay"
      ></iframe>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { animate, stagger, createTimeline } from 'animejs'
import html2canvas from 'html2canvas'
import { useAnnualReport, type ReportChapter } from '@/composables/useAnnualReport'

const router = useRouter()

/** 用户开启「减少动态效果」时：跳过 three.js 与 anime 动画，直接静态展示 */
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 年度：'all' 或具体年份，响应式切换 */
const year = ref<'all' | number>('all')

const { stats, chapters, loadDetail, detailLoaded } = useAnnualReport(year)

/** 可切换的年份列表 */
const years = computed<number[]>(() => stats.value.yearCounts.map(x => x.year))

const cover = computed(() => chapters.value.find(c => c.id === 'cover'))
const body = computed(() => chapters.value.filter(c => c.id !== 'cover'))

/** 封面背景年份区间（如 2020 — 2026） */
const spanLabel = computed(() => {
  const f = stats.value.firstYear
  const l = stats.value.lastYear
  if (!f || !l) return ''
  return f === l ? String(f) : `${f} — ${l}`
})

/** 年报 → 说说详情跳转链接（/messages?year=YYYY&tid=XXX） */
function msgLink(m: { tid?: string | number; time?: string } | null | undefined): string {
  if (!m || m.tid === undefined || m.tid === null || m.tid === '') return ''
  const y = (m.time || '').substring(0, 4)
  return y ? `/messages?year=${y}&tid=${encodeURIComponent(String(m.tid))}` : ''
}

/* ============ 图形辅助（沿用原数据逻辑） ============ */

function isBarChart(id: string): boolean {
  return ['years', 'months', 'night', 'word', 'visitors'].includes(id)
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
    case 'visitors':
      return (ch.data?.yearCounts || []).map((x: any) => ({ label: String(x.year), value: x.count }))
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
  const sizes = ['3.2rem', '2.5rem', '2.1rem', '1.8rem', '1.6rem', '1.4rem', '1.25rem', '1.15rem']
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

/* ============ three.js 粒子背景（石墨/金，极简低透明度） ============ */
const bgRef = ref<HTMLElement | null>(null)
let disposeBg: (() => void) | null = null

function initBackground() {
  const el = bgRef.value
  if (!el || reduced) return

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 300)
  camera.position.z = 46

  const COUNT = 500
  const pos = new Float32Array(COUNT * 3)
  const col = new Float32Array(COUNT * 3)
  const palette = ['#17130d', '#b3451f', '#b98a2f', '#8a8375'].map(c => new THREE.Color(c))
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 110
    pos[i * 3 + 1] = (Math.random() - 0.5) * 70
    pos[i * 3 + 2] = (Math.random() - 0.5) * 50
    const c = palette[(Math.random() * palette.length) | 0]
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.PointsMaterial({
    size: 0.22,
    vertexColors: true,
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  })
  const points = new THREE.Points(geo, mat)
  scene.add(points)

  let raf = 0
  let mx = 0
  let my = 0
  let tmx = 0
  let tmy = 0
  const onPointer = (e: PointerEvent) => {
    tmx = (e.clientX / window.innerWidth - 0.5) * 2
    tmy = (e.clientY / window.innerHeight - 0.5) * 2
  }
  const onResize = () => {
    const w = el.clientWidth
    const h = el.clientHeight
    if (!w || !h) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  const tick = () => {
    raf = requestAnimationFrame(tick)
    points.rotation.y += 0.00035
    points.rotation.x += 0.00014
    mx += (tmx - mx) * 0.04
    my += (tmy - my) * 0.04
    camera.position.x = mx * 2.2
    camera.position.y = -my * 1.5
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
  }
  window.addEventListener('pointermove', onPointer)
  window.addEventListener('resize', onResize)
  tick()

  disposeBg = () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onPointer)
    window.removeEventListener('resize', onResize)
    geo.dispose()
    mat.dispose()
    renderer.dispose()
    if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
  }
}

/* ============ 滚动进度 ============ */
const progressRef = ref<HTMLElement | null>(null)

function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight
  const p = max > 0 ? window.scrollY / max : 0
  if (progressRef.value) progressRef.value.style.transform = `scaleY(${p})`
}

/* ============ anime.js 动画 ============ */
let observer: IntersectionObserver | null = null
let anims: { pause?: () => void; revert?: () => void }[] = []

/** 标题元素：附带拆分出的逐字字符（由 splitChars 写入） */
interface TitleElement extends HTMLElement {
  __chars?: HTMLElement[]
}

/** 数字滚动（v4：动画一个对象 + onUpdate 写回 DOM） */
function countUp(el: HTMLElement, to: number) {
  if (reduced || !to) {
    el.textContent = (to || 0).toLocaleString()
    el.style.opacity = '1'
    return
  }
  const obj = { v: 0 }
  el.style.opacity = '1'
  el.textContent = '0'
  anims.push(animate(obj, {
    v: to,
    duration: 1200,
    ease: 'easeOutCubic',
    onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString() }
  }))
}

/**
 * 将标题拆分为逐字字符（wodniack 式逐字揭示）
 * 每个字符包一层 mask（overflow hidden），内层 .rp-char 上移隐藏
 */
function splitChars(el: HTMLElement): HTMLElement[] {
  const text = el.textContent || ''
  if (!text.trim()) return []
  el.textContent = ''
  const chars: HTMLElement[] = []
  for (const ch of text) {
    const mask = document.createElement('span')
    mask.className = 'rp-mask'
    const c = document.createElement('span')
    c.className = 'rp-char'
    c.textContent = ch === ' ' ? '\u00A0' : ch
    mask.appendChild(c)
    el.appendChild(mask)
    chars.push(c)
  }
  return chars
}

/** 逐字升起动画 */
function revealChars(chars: HTMLElement[], baseDelay = 0, perChar = 26, dur = 900) {
  if (reduced) return
  anims.push(animate(chars, {
    opacity: [0, 1],
    translateY: ['120%', '0%'],
    rotate: [6, 0],
    duration: dur,
    delay: (_: any, i = 0) => baseDelay + i * perChar,
    ease: 'easeOutCubic'
  }))
}

function runSectionAnim(sec: HTMLElement) {
  if (reduced) return

  // 标题逐字揭示
  const title = sec.querySelector<HTMLElement>('.rp-ch-title')
  if (title) revealChars((title as TitleElement).__chars || [], 0)

  // 正文浮现
  const text = sec.querySelector('.rp-ch-text')
  if (text) anims.push(animate(text, { opacity: [0, 1], translateY: [18, 0], duration: 720, delay: 200, ease: 'easeOutCubic' }))

  // 柱状图：从底部生长
  const bars = sec.querySelectorAll<HTMLElement>('.rp-bar')
  if (bars.length) {
    bars.forEach((b, i) => {
      const target = b.dataset.h || '0%'
      b.style.height = '0%'
      anims.push(animate(b, { opacity: [0, 1], height: target, duration: 850, delay: 250 + i * 40, ease: 'easeOutCubic' }))
    })
  }

  // 数字档案 cells：上浮 + 计数
  const cells = sec.querySelectorAll<HTMLElement>('.rp-cell')
  if (cells.length) anims.push(animate(cells, {
    opacity: [0, 1], translateY: [26, 0], duration: 650, delay: stagger(70), ease: 'easeOutCubic'
  }))

  // 起点与终点：卡片左右滑入
  const milestones = sec.querySelectorAll<HTMLElement>('.rp-milestone')
  if (milestones.length) anims.push(animate(milestones, {
    opacity: [0, 1], translateY: [34, 0], duration: 720, delay: stagger(140), ease: 'easeOutCubic'
  }))

  // 影像 TOP 相册：错峰浮现
  const albums = sec.querySelectorAll<HTMLElement>('.rp-album')
  if (albums.length) anims.push(animate(albums, {
    opacity: [0, 1], translateY: [24, 0], duration: 620, delay: stagger(110), ease: 'easeOutCubic'
  }))

  // 好友分布：行滑入 + 条生长
  const hbars = sec.querySelectorAll<HTMLElement>('.rp-hbar')
  if (hbars.length) {
    anims.push(animate(hbars, {
      opacity: [0, 1], translateX: [30, 0], duration: 600, delay: stagger(80), ease: 'easeOutCubic'
    }))
    hbars.forEach((row, i) => {
      const fill = row.querySelector<HTMLElement>('.rp-hbar-fill')
      const w = fill?.dataset.w || '0'
      if (fill) anims.push(animate(fill, { width: ['0%', w + '%'], duration: 900, delay: 200 + i * 80, ease: 'easeOutCubic' }))
    })
  }

  // 词云：弹出
  const tags = sec.querySelectorAll<HTMLElement>('.rp-wtag')
  if (tags.length) anims.push(animate(tags, {
    opacity: [0, 1], scale: [0.6, 1], duration: 650, delay: stagger(55), ease: 'easeOutBack'
  }))

  // 人物志：左滑入
  const people = sec.querySelectorAll<HTMLElement>('.rp-person')
  if (people.length) anims.push(animate(people, {
    opacity: [0, 1], translateX: [36, 0], duration: 640, delay: stagger(90), ease: 'easeOutCubic'
  }))

  // 特别的日子：上浮
  const cards = sec.querySelectorAll<HTMLElement>('.rp-scard')
  if (cards.length) anims.push(animate(cards, {
    opacity: [0, 1], translateY: [36, 0], duration: 720, delay: stagger(110), ease: 'easeOutCubic'
  }))

  // 金句：引号弹出 + 正文浮现
  const quote = sec.querySelector('.rp-quote')
  if (quote) {
    const mark = quote.querySelector<HTMLElement>('.rp-quote-mark')
    const main = quote.querySelector<HTMLElement>('.rp-quote-main')
    if (mark) anims.push(animate(mark, { opacity: [0, 1], scale: [0.5, 1], duration: 800, ease: 'easeOutBack' }))
    if (main) anims.push(animate(main, { opacity: [0, 1], translateY: [16, 0], duration: 800, delay: 120, ease: 'easeOutCubic' }))
  }

  // 互动数字
  sec.querySelectorAll<HTMLElement>('[data-count]').forEach((n) => {
    countUp(n, Number(n.dataset.count || 0))
  })
}

function setupReveals() {
  observer?.disconnect()
  observer = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        const sec = en.target as HTMLElement
        sec.classList.add('rp-in')
        runSectionAnim(sec)
        observer?.unobserve(sec)
      }
    }
  }, { threshold: 0.12 })
  document.querySelectorAll('.rp-section').forEach(s => observer?.observe(s))
}

/** 封面开场：逐字升起 + 正文时间线 */
function playCover() {
  if (reduced) return
  const kicker = document.querySelector<HTMLElement>('.rp-kicker')
  const title = document.querySelector<HTMLElement>('.rp-title')
  const text = document.querySelector<HTMLElement>('.rp-hero .rp-text')
  const accent = document.querySelector<HTMLElement>('.rp-hero .rp-accent')
  const hint = document.querySelector<HTMLElement>('.rp-scroll-hint')
  const heroNum = document.querySelector<HTMLElement>('.rp-hero-num')
  const tl = createTimeline({ defaults: { ease: 'easeOutCubic' } })
  if (kicker) tl.add(kicker, { opacity: [0, 1], letterSpacing: ['0.6em', '0.3em'], duration: 800 })
  if (title) {
    const chars = (title as TitleElement).__chars || []
    if (chars.length) tl.add(chars, {
      opacity: [0, 1], translateY: ['120%', '0%'], rotate: [6, 0],
      duration: 950, delay: stagger(32), ease: 'easeOutCubic'
    }, 150)
  }
  if (text) tl.add(text, { opacity: [0, 1], translateY: [22, 0], duration: 850 }, 500)
  if (accent) tl.add(accent, { opacity: [0, 1], duration: 700 }, 850)
  if (heroNum) tl.add(heroNum, { opacity: [0, 1], scale: [1.08, 1], duration: 1200 }, 700)
  if (hint) tl.add(hint, { opacity: [0, 1], duration: 800 }, 1100)
  anims.push(tl)
}

/** 把页面所有大标题拆成字符（挂载时执行一次；年度切换后重拆） */
function splitAllTitles() {
  if (reduced) return
  const titles = document.querySelectorAll<HTMLElement>('.rp-title, .rp-ch-title')
  titles.forEach((el) => {
    ;(el as TitleElement).__chars = splitChars(el)
  })
}

/* ============ 导出长图 ============ */
const exporting = ref(false)

/** 轮询等待条件成立（超时兜底） */
function waitFor(cond: () => boolean, timeout = 8000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const timer = setInterval(() => {
      if (cond() || Date.now() - start > timeout) {
        clearInterval(timer)
        resolve()
      }
    }, 200)
  })
}

/** 给 Promise 加超时，防止 toPng 挂死 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('截图超时')), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

/** 在画布上铺网点底纹（与页面装饰一致） */
function fillDotPattern(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 44
  const t = tile.getContext('2d')
  if (!t) return
  t.fillStyle = '#17130d'
  t.beginPath()
  t.arc(22, 22, 1, 0, Math.PI * 2)
  t.fill()
  const pat = ctx.createPattern(tile, 'repeat')
  if (!pat) return
  ctx.globalAlpha = 0.06
  ctx.fillStyle = pat
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1
}

/**
 * 整页导出为长图（分段截图 + 画布拼接，避免超大 DOM 一次性截图挂死）：
 * 1. 等待详情（金句/年度词）加载完成
 * 2. 加 rp-static（所有元素直显、字符取消上移）
 * 3. 隐藏固定层（顶栏/进度/音乐/three.js 画布），暂停跑马灯
 * 4. 固定导出宽度 900px，逐段（封面/跑马灯/章节）截图
 * 5. 画布纵向拼接 + 网点底纹 → 下载 PNG
 * 6. 还原现场
 */
async function exportLongImage() {
  const page = document.querySelector<HTMLElement>('.rp-page')
  if (!page || exporting.value) return
  if (!detailLoaded.value) {
    loadDetail()
    await waitFor(() => detailLoaded.value)
  }
  exporting.value = true

  const restores: (() => void)[] = []
  const setStyle = (el: HTMLElement | null, prop: string, value: string) => {
    if (!el) return
    const old = (el.style as any)[prop]
    ;(el.style as any)[prop] = value
    restores.push(() => { (el.style as any)[prop] = old })
  }
  const hide = (el: HTMLElement | null) => setStyle(el, 'display', 'none')

  try {
    // 1. 自动滚动到底部：逐段滚动让每个章节进入视口，触发逐字/数字滚动/图表动画完成
    //    （否则未滚动到的章节数字仍为 0，截图会出错）
    const scroller = document.scrollingElement || document.documentElement
    const maxY = scroller.scrollHeight - window.innerHeight
    if (maxY > 0) {
      const html = document.documentElement
      const oldBehavior = html.style.scrollBehavior
      html.style.scrollBehavior = 'auto'
      try {
        const step = Math.max(200, Math.round(window.innerHeight * 0.8))
        for (let y = 0; y < maxY; y += step) {
          window.scrollTo(0, y)
          await new Promise(r => setTimeout(r, 60))
        }
        window.scrollTo(0, maxY)
        // 等待最后一段的动画完成（柱状图/数字最迟约 2s）
        await new Promise(r => setTimeout(r, 2200))
        window.scrollTo(0, 0)
      } finally {
        html.style.scrollBehavior = oldBehavior
      }
    }

    page.classList.add('rp-static')
    await nextTick()
    // 固定层隐藏
    hide(page.querySelector('.rp-top'))
    hide(page.querySelector('.rp-progress'))
    hide(page.querySelector('.rp-music'))
    hide(page.querySelector('.rp-status'))
    hide(page.querySelector('.rp-bg'))
    // 跑马灯暂停
    page.querySelectorAll<HTMLElement>('.rp-marquee-track').forEach((t) => {
      setStyle(t, 'animation', 'none')
    })
    // 数字兜底：所有 [data-count] 直接写入终值（防个别计数未完成）
    page.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
      el.textContent = Number(el.dataset.count || 0).toLocaleString()
    })
    // 字符全部落位（防未滚动到章节的字符仍隐藏）
    page.querySelectorAll<HTMLElement>('.rp-char').forEach((c) => {
      setStyle(c, 'opacity', '1')
      setStyle(c, 'transform', 'none')
    })
    // 固定导出宽度
    setStyle(page, 'width', '900px')
    setStyle(page, 'maxWidth', 'none')
    await nextTick()

    // 参与导出的页面内容段（封面 / 跑马灯 / 章节）
    const segments = Array.from(page.children).filter(el =>
      el.classList.contains('rp-hero') || el.classList.contains('rp-marquee') || el.classList.contains('rp-section')
    ) as HTMLElement[]

    // 分段截图（html2canvas 按元素真实布局绘制，无 SVG 渲染挂死问题）；某帧失败则全局降采样重试
    let frames: HTMLCanvasElement[] = []
    let scale = 2
    while (!frames.length) {
      try {
        frames = await Promise.all(segments.map(seg =>
          withTimeout(html2canvas(seg, {
            scale,
            backgroundColor: '#f2efe7',
            logging: false,
            useCORS: true
          }), 20000)
        ))
      } catch {
        if (scale <= 0.5) throw new Error('导出失败，页面可能过大')
        scale = scale / 2
      }
    }

    // 拼接为 900px 宽长图（最终画布小，编码快，不卡页面）
    const W = 900
    const H = Math.round(frames.reduce((a, c) => a + c.height / scale, 0))
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建画布')
    ctx.fillStyle = '#f2efe7'
    ctx.fillRect(0, 0, W, H)
    let y = 0
    for (const f of frames) {
      const dh = Math.round(f.height / scale)
      ctx.drawImage(f, 0, y, W, dh)
      y += dh
    }
    fillDotPattern(ctx, W, H)

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `QQ空间年度档案-${year.value === 'all' ? '全部' : year.value}.png`
    a.click()
  } catch (e) {
    console.error('导出长图失败', e)
    alert(`导出失败：${(e as Error).message || e}`)
  } finally {
    restores.forEach(fn => fn())
    page.classList.remove('rp-static')
    exporting.value = false
  }
}

/* ============ 生命周期 ============ */

onMounted(() => {
  initBackground()
  nextTick(() => {
    splitAllTitles()
    setupReveals()
  })
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  setTimeout(loadDetail, 400)
  playCover()
})

// 年度切换后：章节重新挂载，重建观察器并重播封面
watch(year, () => {
  nextTick(() => {
    splitAllTitles()
    setupReveals()
    playCover()
  })
})

onBeforeUnmount(() => {
  disposeBg?.()
  observer?.disconnect()
  window.removeEventListener('scroll', onScroll)
  anims.forEach(a => a?.pause?.())
  anims = []
})
</script>

<style scoped>
/* ============ wodniack 风格：浅色极简 + 巨型排版 ============ */
.rp-page {
  --rp-bg: #f2efe7;
  --rp-ink: #17130d;
  --rp-muted: #8a8375;
  --rp-accent: #b3451f;
  --rp-gold: #b98a2f;
  --rp-line: rgba(23, 19, 13, 0.14);
  --rp-paper: #fffdf8;
  min-height: 100vh;
  background: var(--rp-bg);
  color: var(--rp-ink);
  font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif;
  position: relative;
  overflow-x: hidden;
}

.rp-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.rp-bg canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* 装饰网点底纹：填补留白 */
.rp-deco {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: radial-gradient(rgba(23, 19, 13, 0.06) 1px, transparent 1px);
  background-size: 22px 22px;
  background-position: 0 0;
}

/* ============ 顶部固定栏 ============ */
.rp-top {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  pointer-events: none;
  mix-blend-mode: normal;
}

.rp-back,
.rp-years,
.rp-top-left {
  pointer-events: auto;
}

.rp-top-left {
  display: flex;
  gap: 8px;
  align-items: center;
}

.rp-back {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  color: var(--rp-ink);
  background: transparent;
  border: 1px solid var(--rp-line);
  padding: 8px 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.rp-back:hover {
  border-color: var(--rp-ink);
}

.rp-export {
  color: var(--rp-accent);
  border-color: rgba(179, 69, 31, 0.4);
}

.rp-export:hover {
  color: var(--rp-paper);
  background: var(--rp-accent);
  border-color: var(--rp-accent);
}

.rp-export:disabled {
  opacity: 0.5;
  cursor: wait;
  pointer-events: none;
}

.rp-years {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.rp-year {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.68rem;
  color: var(--rp-muted);
  background: transparent;
  border: 1px solid transparent;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.rp-year:hover {
  color: var(--rp-ink);
  border-color: var(--rp-line);
}

.rp-year.active {
  color: var(--rp-paper);
  background: var(--rp-ink);
  border-color: var(--rp-ink);
}

/* ============ 滚动进度 ============ */
.rp-progress {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  z-index: 30;
  background: var(--rp-line);
}

.rp-progress-bar {
  width: 100%;
  height: 100%;
  background: var(--rp-ink);
  transform-origin: top;
  transform: scaleY(0);
}

/* ============ 封面 ============ */
.rp-hero {
  position: relative;
  min-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 110px 24px 90px;
  z-index: 1;
}

.rp-kicker {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--rp-accent);
}

.rp-title {
  font-family: 'Fraunces', 'Noto Serif SC', serif;
  font-size: clamp(3rem, 10vw, 7rem);
  font-weight: 800;
  line-height: 1.04;
  margin: 30px 0;
  letter-spacing: 0.02em;
}

.rp-hero .rp-text {
  max-width: 620px;
  font-size: 1.08rem;
  line-height: 2.05;
  color: var(--rp-ink);
}

.rp-hero .rp-text :deep(em) {
  color: var(--rp-accent);
  font-style: normal;
}

.rp-hero .rp-accent {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  color: var(--rp-muted);
  margin-top: 26px;
}

/* 巨型背景年份 */
.rp-hero-num {
  position: absolute;
  bottom: 34px;
  right: 26px;
  font-family: 'Fraunces', serif;
  font-size: clamp(3rem, 8vw, 6.5rem);
  font-weight: 800;
  color: rgba(23, 19, 13, 0.07);
  line-height: 1;
  pointer-events: none;
}

.rp-scroll-hint {
  position: absolute;
  bottom: 40px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.62rem;
  letter-spacing: 0.3em;
  color: var(--rp-muted);
}

.rp-scroll-hint i {
  font-style: normal;
  animation: rp-bob 1.6s ease-in-out infinite;
}

@keyframes rp-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(6px); }
}

/* ============ 跑马灯 ============ */
.rp-marquee {
  position: relative;
  z-index: 1;
  overflow: hidden;
  border-top: 1px solid var(--rp-ink);
  border-bottom: 1px solid var(--rp-ink);
  background: var(--rp-paper);
  padding: 14px 0;
  white-space: nowrap;
}

.rp-marquee-track {
  display: inline-block;
  animation: rp-marquee 24s linear infinite;
  font-family: 'Fraunces', 'Noto Serif SC', serif;
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--rp-ink);
}

.rp-marquee-track span {
  display: inline-block;
  padding: 0 6px;
}

@keyframes rp-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* ============ 章节（紧凑排布，填充留白） ============ */
.rp-section {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 84px max(24px, 6vw);
  max-width: 1200px;
  margin: 0 auto;
  border-top: 1px solid var(--rp-line);
  z-index: 1;
}

/* 巨型淡色背景序号 */
.rp-big {
  position: absolute;
  top: 8vh;
  right: 4vw;
  font-family: 'Fraunces', serif;
  font-size: clamp(6rem, 18vw, 14rem);
  font-weight: 800;
  line-height: 1;
  color: rgba(23, 19, 13, 0.05);
  pointer-events: none;
  user-select: none;
}

.rp-ch-head {
  display: flex;
  align-items: baseline;
  gap: 20px;
  flex-wrap: wrap;
  position: relative;
}

.rp-num {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.8rem;
  color: var(--rp-accent);
  letter-spacing: 0.2em;
}

.rp-ch-title {
  font-family: 'Fraunces', 'Noto Serif SC', serif;
  font-size: clamp(2.4rem, 6vw, 4.4rem);
  font-weight: 800;
  line-height: 1.05;
  margin: 0;
  letter-spacing: 0.01em;
}

.rp-section .rp-accent {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: var(--rp-muted);
}

.rp-ch-text {
  max-width: 720px;
  font-size: 1.08rem;
  line-height: 2.05;
  margin: 32px 0 0;
}

.rp-ch-text :deep(em) {
  color: var(--rp-accent);
  font-style: normal;
}

/* ============ 柱状图 ============ */
.rp-chart {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 260px;
  margin-top: 48px;
}

.rp-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.rp-track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.rp-bar {
  width: 70%;
  min-height: 2px;
  background: var(--rp-ink);
  transition: background 0.2s;
}

.rp-bar:hover {
  background: var(--rp-accent);
}

.rp-col-label {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.6rem;
  color: var(--rp-muted);
  white-space: nowrap;
}

/* 时辰图：24 列太密，移动端隐藏标签 */
.rp-chart[data-kind="night"] .rp-col-label {
  display: none;
}

@media (min-width: 720px) {
  .rp-chart[data-kind="night"] .rp-col-label {
    display: block;
    font-size: 0.5rem;
  }
}

/* ============ 金句 ============ */
.rp-quote {
  position: relative;
  max-width: 780px;
  margin-top: 44px;
}

.rp-quote-mark {
  display: block;
  font-family: 'Fraunces', serif;
  font-size: 8rem;
  line-height: 0.4;
  color: var(--rp-accent);
  margin-bottom: 26px;
  opacity: 0.9;
}

.rp-quote-main {
  font-size: 1.6rem;
  line-height: 1.9;
  margin: 0;
}

.rp-quote-foot {
  margin-top: 24px;
}

/* ============ 互动高光 ============ */
.rp-highlight {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  width: 100%;
  max-width: 720px;
  margin-top: 48px;
  border-top: 2px solid var(--rp-ink);
}

.rp-hcell {
  padding: 28px 8px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.rp-hcell + .rp-hcell {
  border-left: 1px solid var(--rp-line);
}

.rp-hnum {
  font-family: 'Fraunces', serif;
  font-size: 4.2rem;
  font-weight: 800;
  line-height: 1;
  color: var(--rp-ink);
}

.rp-hlabel {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.24em;
  color: var(--rp-muted);
}

/* ============ 数字档案 cells ============ */
.rp-cells {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0;
  width: 100%;
  max-width: 900px;
  margin-top: 44px;
  border-top: 2px solid var(--rp-ink);
  border-left: 1px solid var(--rp-line);
}

.rp-cell {
  padding: 24px 12px 16px;
  border-right: 1px solid var(--rp-line);
  border-bottom: 1px solid var(--rp-line);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(255, 253, 248, 0.4);
}

.rp-cell-num {
  font-family: 'Fraunces', serif;
  font-size: 2.7rem;
  font-weight: 800;
  line-height: 1;
  color: var(--rp-ink);
}

.rp-cell-label {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.64rem;
  letter-spacing: 0.16em;
  color: var(--rp-muted);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ============ 好友分布横向条 ============ */
.rp-hbars {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 760px;
  margin-top: 44px;
}

.rp-hbar {
  display: grid;
  grid-template-columns: 130px 1fr 44px;
  align-items: center;
  gap: 14px;
}

.rp-hbar-label {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: var(--rp-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rp-hbar-track {
  height: 10px;
  background: var(--rp-line);
  overflow: hidden;
}

.rp-hbar-fill {
  height: 100%;
  width: 0;
  background: var(--rp-ink);
}

.rp-hbar-value {
  font-family: 'Fraunces', serif;
  font-size: 1.1rem;
  font-weight: 700;
  text-align: right;
  color: var(--rp-ink);
}

/* ============ 起点与终点 ============ */
.rp-milestones {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  width: 100%;
  max-width: 900px;
  margin-top: 44px;
  border-top: 2px solid var(--rp-ink);
  border-left: 1px solid var(--rp-line);
  text-align: left;
}

.rp-milestone {
  border-right: 1px solid var(--rp-line);
  border-bottom: 1px solid var(--rp-line);
  padding: 26px;
  background: rgba(255, 253, 248, 0.4);
}

.rp-milestone-tag {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.66rem;
  letter-spacing: 0.22em;
  color: var(--rp-accent);
}

.rp-milestone-text {
  font-size: 1.05rem;
  line-height: 1.8;
  margin: 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.rp-milestone-time {
  display: block;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.64rem;
  color: var(--rp-muted);
  margin-bottom: 6px;
}

/* ============ 影像 TOP 相册 ============ */
.rp-albums {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 720px;
  margin-top: 44px;
  text-align: left;
}

.rp-album {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: baseline;
  gap: 18px;
  padding: 18px 4px;
  border-top: 1px solid var(--rp-line);
}

.rp-album:last-child {
  border-bottom: 1px solid var(--rp-line);
}

.rp-album-num {
  font-family: 'Fraunces', serif;
  font-size: 1.6rem;
  font-weight: 800;
  color: rgba(23, 19, 13, 0.28);
}

.rp-album-name {
  font-size: 1.15rem;
  font-weight: 600;
}

.rp-album-count {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.68rem;
  color: var(--rp-muted);
  letter-spacing: 0.1em;
}

/* ============ 人物志 ============ */
.rp-people {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 760px;
  margin-top: 48px;
  text-align: left;
}

.rp-person {
  display: grid;
  grid-template-columns: 150px 1fr auto;
  gap: 4px 24px;
  padding: 22px 4px;
  border-top: 1px solid var(--rp-line);
  align-items: baseline;
}

.rp-person:last-child {
  border-bottom: 1px solid var(--rp-line);
}

.rp-plabel {
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  color: var(--rp-accent);
}

.rp-pname {
  font-size: 1.3rem;
  font-weight: 600;
}

.rp-pnote,
.rp-pstatus {
  font-size: 0.85rem;
  color: var(--rp-muted);
}

.rp-pnote {
  grid-column: 2;
}

.rp-pstatus {
  grid-column: 3;
  white-space: nowrap;
}

/* ============ 特别的日子 ============ */
.rp-special {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0;
  width: 100%;
  max-width: 900px;
  margin-top: 48px;
  text-align: left;
  border-top: 2px solid var(--rp-ink);
  border-left: 1px solid var(--rp-line);
}

.rp-scard {
  border-right: 1px solid var(--rp-line);
  border-bottom: 1px solid var(--rp-line);
  padding: 26px;
  background: rgba(255, 253, 248, 0.5);
}

.rp-smark {
  font-size: 1.4rem;
  color: var(--rp-accent);
}

.rp-slabel {
  display: block;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  color: var(--rp-muted);
  margin: 10px 0 12px;
}

.rp-stext {
  font-size: 0.98rem;
  line-height: 1.7;
  margin: 0;
}

.rp-stime {
  display: block;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.64rem;
  color: var(--rp-muted);
  margin-top: 14px;
}

/* ============ 年度词 ============ */
.rp-word {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: 14px 30px;
  max-width: 880px;
  margin-top: 48px;
}

.rp-wtag {
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  color: var(--rp-ink);
  cursor: default;
  transition: color 0.2s;
}

.rp-wtag:hover {
  color: var(--rp-accent);
}

/* ============ 通用链接 ============ */
.rp-link {
  display: inline-block;
  margin-top: 10px;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  color: var(--rp-ink);
  text-decoration: none;
  border-bottom: 1px solid var(--rp-ink);
  transition: all 0.2s;
}

.rp-link:hover {
  color: var(--rp-accent);
  border-bottom-color: var(--rp-accent);
}

/* ============ 状态提示 / 音乐 ============ */
.rp-status {
  position: fixed;
  left: 18px;
  bottom: 16px;
  z-index: 20;
  font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  font-size: 0.58rem;
  letter-spacing: 0.24em;
  color: var(--rp-muted);
  opacity: 0.85;
}

.rp-music {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 40;
  background: var(--rp-paper);
  border: 1px solid var(--rp-line);
  box-shadow: 0 6px 30px rgba(23, 19, 13, 0.12);
  line-height: 0;
}

.rp-music-frame {
  display: block;
  border: none;
}

/* ============ 逐字揭示（mask + char） ============ */
.rp-mask {
  display: inline-block;
  overflow: hidden;
  vertical-align: top;
  padding-bottom: 0.06em;
  margin-bottom: -0.06em;
}

.rp-char {
  display: inline-block;
  opacity: 0;
  transform: translateY(120%);
  will-change: transform;
}

/* ============ 动画初始态 ============ */
.rp-hero .rp-kicker,
.rp-hero .rp-text,
.rp-hero .rp-accent,
.rp-hero .rp-hero-num,
.rp-hero .rp-scroll-hint,
.rp-section .rp-ch-text,
.rp-quote-mark,
.rp-quote-main,
.rp-bar,
.rp-cell,
.rp-hbar,
.rp-milestone,
.rp-album,
.rp-wtag,
.rp-person,
.rp-scard,
.rp-hnum {
  opacity: 0;
}

/* 减少动态效果：静态直显 */
.rp-page.rp-static .rp-char {
  opacity: 1;
  transform: none;
}

.rp-page.rp-static .rp-mask {
  overflow: visible;
}

.rp-page.rp-static .rp-hero .rp-kicker,
.rp-page.rp-static .rp-hero .rp-text,
.rp-page.rp-static .rp-hero .rp-accent,
.rp-page.rp-static .rp-hero .rp-hero-num,
.rp-page.rp-static .rp-hero .rp-scroll-hint,
.rp-page.rp-static .rp-ch-text,
.rp-page.rp-static .rp-quote-mark,
.rp-page.rp-static .rp-quote-main,
.rp-page.rp-static .rp-bar,
.rp-page.rp-static .rp-cell,
.rp-page.rp-static .rp-hbar,
.rp-page.rp-static .rp-milestone,
.rp-page.rp-static .rp-album,
.rp-page.rp-static .rp-wtag,
.rp-page.rp-static .rp-person,
.rp-page.rp-static .rp-scard,
.rp-page.rp-static .rp-hnum {
  opacity: 1;
}

/* ============ 响应式 ============ */
@media (max-width: 640px) {
  .rp-top {
    padding: 12px 14px;
  }
  .rp-back {
    font-size: 0.6rem;
    padding: 6px 10px;
  }
  .rp-year {
    font-size: 0.64rem;
    padding: 4px 9px;
  }
  .rp-hero {
    padding: 110px 16px 80px;
  }
  .rp-section {
    padding: 64px 20px;
    min-height: auto;
  }
  .rp-milestones {
    grid-template-columns: 1fr;
  }
  .rp-big {
    font-size: 7rem;
    top: 4vh;
    right: 10px;
  }
  .rp-highlight {
    grid-template-columns: 1fr;
  }
  .rp-hcell + .rp-hcell {
    border-left: none;
    border-top: 1px solid var(--rp-line);
  }
  .rp-quote-mark {
    font-size: 5.5rem;
  }
  .rp-quote-main {
    font-size: 1.25rem;
  }
  .rp-person {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .rp-pstatus {
    grid-column: 1;
  }
  .rp-chart {
    height: 220px;
  }
  .rp-music {
    right: 10px;
    bottom: 10px;
    transform: scale(0.92);
    transform-origin: bottom right;
  }
  .rp-status {
    display: none;
  }
}
</style>
