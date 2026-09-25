<template>
  <div ref="rootWrap" class="vl-wrap">
    <span v-if="sweepOn" class="vl-sweep-line" aria-hidden="true"></span>
    <span v-if="sweepOn" class="vl-sweep-bar" aria-hidden="true"></span>

    <!-- 网格密度：非虚拟化的 CSS Grid（仅当条目数在阈值内），分段头通栏 sticky -->
    <div v-if="useGrid" :class="['vl-grid', listClass]">
      <template v-for="row in rows" :key="row.__key">
        <SegmentHeader
          v-if="row.__seg"
          class="vl-grid-seg"
          :seg="row.__seg"
          :grid-available="gridAvailable"
        />
        <div v-else class="vl-grid-cell" :data-vl-orig="row.__orig">
          <slot :item="row" />
        </div>
      </template>
    </div>

    <!-- 流式密度：虚拟滚动 + 常驻「当前卷指示条」 -->
    <template v-else>
      <!-- 当前卷指示条：虚拟滚动行会被回收，分段头无法 sticky——
           由本条常驻顶部，随滚动显示当前段（含密度切换） -->
      <div v-if="rowsHaveSegs" class="vl-current" :class="{ show: currentSeg }">
        <template v-if="currentSeg">
          <span class="vl-current-mark">▸</span>
          <span class="vl-current-label">{{ currentSeg.label }}</span>
          <span class="vl-current-count">{{ currentSeg.count }} 条</span>
        </template>
        <span class="vl-current-flex"></span>
        <DensityToggle :grid-available="gridAvailable" />
      </div>

      <DynamicScroller
        ref="scrollerRef"
        :class="listClass"
        :style="{ height: '100%' }"
        :items="rows"
        :min-item-size="minItemSize"
        key-field="__key"
        :buffer="buffer"
        @scroll="updateCurrentSeg"
        v-slot="{ item, active }"
      >
        <!-- 分段行同样用 DynamicScrollerItem 包裹：
             尺寸观测把行高从 min-item-size 修正为实际高度，否则留下大片占位空白 -->
        <DynamicScrollerItem
          class="archive-item-wrap"
          :class="{ 'seg-row': !!item.__seg }"
          :item="item"
          :active="active"
          :data-index="item.__key"
        >
          <SegmentHeader
            v-if="item.__seg"
            :seg="item.__seg"
            :grid-available="gridAvailable"
          />
          <!--
            默认插槽接收当前项，由调用方决定渲染哪个 Card 组件
            item 已注入 __key 字段，原数据字段保持不变
          -->
          <slot v-else :item="item" />
        </DynamicScrollerItem>
      </DynamicScroller>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { animate, stagger as animeStagger, utils } from 'animejs'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import SegmentHeader from './SegmentHeader.vue'
import DensityToggle from './DensityToggle.vue'
import { useDensity } from '@/composables/useDensity'
import { useMotion } from '@/composables/useMotion'
import { yearLabel } from '@/utils/yearLabel'

/**
 * 通用虚拟滚动列表（V1 阅读型骨架升级）
 *
 * 能力：
 *  - segmentOf：按返回值把相邻同段条目分组，段首注入分段头行（§4.1）
 *  - 密度：流式（虚拟滚动）/ 网格（≤GRID_MAX 条时非虚拟 CSS Grid），
 *    状态由 useDensity() 全局记忆；超阈值网格自动回退流式
 *  - 流式模式常驻「当前卷指示条」：虚拟行回收导致分段头无法 sticky，
 *    由指示条随滚动显示当前段（含密度切换）
 *  - scrollToItem(index)：调用方仍传「原始条目下标」，内部自动映射到行下标
 */
const props = withDefaults(defineProps<{
  /** 列表数据 */
  items: any[]
  /** 生成唯一 key 的函数；不传则自动尝试 __key/_key/tid/id/uin-time 等字段 */
  keyOf?: (item: any) => string
  /** 分段取值：返回段名（如 '2024'）则按相邻同值分组并注入分段头；返回空值不分段 */
  segmentOf?: (item: any) => string | null
  /** 网格模式可用性（密度切换按钮禁用态） */
  gridAvailable?: boolean
  /** 最小项高度（仅占位估算） */
  minItemSize?: number
  /** 预渲染缓冲区像素 */
  buffer?: number
  /** 自定义列表容器 class */
  listClass?: string
  /** 列表高度（CSS 值），用于强制约束 DynamicScroller 的滚动容器高度。
   *  必须是固定值或 calc()，不能用 auto/100%，否则 vue-virtual-scroller
   *  会展开全部内容导致虚拟滚动失效 */
  listHeight?: string
}>(), {
  gridAvailable: true,
  minItemSize: 120,
  buffer: 400,
  listClass: 'archive-list',
  listHeight: 'calc(100vh - 320px)'
})

/** 网格密度上限：超过则回退流式（非虚拟渲染的内存/节点代价保护） */
const GRID_MAX = 800

const scrollerRef = ref<any>(null)
const rootWrap = ref<HTMLElement | null>(null)
const { density } = useDensity()
const { reduced, dur, stagger, ease } = useMotion()

interface SegRow { __key: string; __seg: { id: string; label: string; count: number } }
type Row = (any & { __key: string; __orig: number }) | SegRow

const useGrid = computed(() => props.gridAvailable && density.value === 'grid' && props.items.length <= GRID_MAX)

const rows = computed<Row[]>(() => {
  const keyed = props.items.map((it, i) => ({ ...it, __key: keyFor(it, i), __orig: i }))
  if (!props.segmentOf) return keyed
  const out: Row[] = []
  let cur: string | null = null
  let curHead: SegRow | null = null
  for (const it of keyed) {
    const seg = props.segmentOf(it) || null
    if (seg && seg !== cur) {
      curHead = { __key: `seg-${seg}`, __seg: { id: seg, label: segLabel(seg), count: 0 } }
      out.push(curHead)
      cur = seg
    }
    if (seg && curHead) curHead.__seg.count++
    out.push(it)
  }
  return out
})

const rowsHaveSegs = computed(() => rows.value.some(r => !!(r as SegRow).__seg))

function keyFor(it: any, i: number): string {
  if (props.keyOf) return String(props.keyOf(it))
  return String(
    it.__key ||
    it._key ||
    it.tid ||
    it.id ||
    (it.uin && it.time && `${it.uin}-${it.time}`) ||
    (it.uin && it.pubtime && `${it.uin}_${it.pubtime}`) ||
    (it.uin && it.shareTime && `${it.uin}_${it.shareTime}`) ||
    i
  )
}

/** 段名展示：4 位年份转汉字卷记，其余原样 */
function segLabel(seg: string): string {
  return /^\d{4}$/.test(seg) ? yearLabel(seg) : seg
}

/* ===== 当前卷指示条：随滚动计算当前段 ===== */
const currentSeg = ref<{ id: string; label: string; count: number } | null>(null)

function updateCurrentSeg(): void {
  if (!rowsHaveSegs.value) return
  const scrollerEl = (scrollerRef.value?.$el || null) as HTMLElement | null
  if (!scrollerEl) return
  if (scrollerEl.scrollTop <= 8) {
    currentSeg.value = null
    return
  }
  // 顶部可视行：第一个「底边越过指示条」的已渲染行
  const views = scrollerEl.querySelectorAll<HTMLElement>('.vue-recycle-scroller__item-wrapper > *')
  const barH = 32
  const scrollerTop = scrollerEl.getBoundingClientRect().top
  let topKey: string | null = null
  for (const v of views) {
    const rect = v.getBoundingClientRect()
    if (rect.bottom > scrollerTop + barH) {
      const inner = v.querySelector<HTMLElement>('[data-index]')
      topKey = inner?.dataset.index || null
      break
    }
  }
  if (!topKey) { currentSeg.value = null; return }
  // 从该行向前找最近的分段行
  const idx = rows.value.findIndex(r => r.__key === topKey)
  for (let i = idx; i >= 0; i--) {
    const seg = (rows.value[i] as SegRow).__seg
    if (seg) { currentSeg.value = seg; return }
  }
  currentSeg.value = null
}

function scrollToItem(index: number) {
  if (useGrid.value) {
    // 非虚拟网格：按原始下标找到 DOM 单元格滚动
    document.querySelector(`[data-vl-orig="${index}"]`)?.scrollIntoView({ block: 'start' })
    return
  }
  // 流式：原始下标 → 行下标（分段头行占位偏移）
  let rowIdx = -1
  let orig = -1
  for (let i = 0; i < rows.value.length; i++) {
    const row = rows.value[i] as any
    if (!row.__seg) orig++
    if (orig === index) { rowIdx = i; break }
  }
  if (rowIdx < 0) return
  const scroller = scrollerRef.value
  if (scroller && scroller.scrollToItem) scroller.scrollToItem(rowIdx)
}

/* ===== 细条划卡入场（§3.1②，一次性） =====
   3px 墨线先 scaleX 划出，朱砂条沿线扫过，卡片在条尾依次落位。
   播完整体淡出并移除（残留的墨线/色块会一直挡在列表顶部）；
   仅首屏可见行参与（虚拟滚动行复用，不做滚动重播）。 */
const sweepOn = ref(!reduced.value)

function playEntrance(): void {
  if (reduced.value) return
  const wrap = rootWrap.value
  if (!wrap) return
  const line = wrap.querySelector<HTMLElement>('.vl-sweep-line')
  const bar = wrap.querySelector<HTMLElement>('.vl-sweep-bar')
  const cells = wrap.querySelectorAll<HTMLElement>(
    useGrid.value ? '.vl-grid-cell' : '.archive-item-wrap'
  )
  const cards = (Array.from(cells) as HTMLElement[]).slice(0, 24) // 首屏入场只编排前 24 卡
  if (!line || !bar || cards.length === 0) return
  if (!cards.some(c => !c.dataset.vlEntered)) return // 二次挂载（密度切换回头）不重播
  cards.forEach(c => { c.dataset.vlEntered = '1' })

  const lineDur = dur('dur-4')
  const cardDur = dur('dur-3')
  const step = stagger()

  utils.set(cards, { opacity: 0, translateY: 12 })
  utils.set([line, bar], { opacity: 1 })
  animate(line, { scaleX: [0, 1], duration: lineDur, ease: ease('sweep') })
  animate(bar, {
    translateX: ['-6%', '106%'],
    duration: lineDur,
    ease: ease('sweep'),
  })
  animate(cards, {
    opacity: [0, 1],
    translateY: [12, 0],
    duration: cardDur,
    delay: animeStagger(step, { start: lineDur * 0.6 }),
    ease: ease('out'),
  })
  // 全部落位后整条淡出并移除
  setTimeout(() => {
    animate([line, bar], {
      opacity: [1, 0],
      duration: dur('dur-2'),
      ease: 'linear',
      onComplete: () => { sweepOn.value = false },
    })
  }, lineDur + cardDur * 2 + step * 8)
}

onMounted(async () => {
  await nextTick()
  await new Promise(r => requestAnimationFrame(() => r(null)))
  playEntrance()
})

defineExpose({ scrollToItem })
</script>

<style scoped>
.vl-wrap {
  position: relative;
  height: calc(100vh - 320px);
  min-height: 360px;
}

.vl-sweep-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--ink);
  transform: scaleX(0);
  transform-origin: left center;
  z-index: 6;
  pointer-events: none;
}

.vl-sweep-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 12%;
  height: 3px;
  background: var(--vermilion);
  transform: translateX(-6%);
  z-index: 7;
  pointer-events: none;
}

/* 当前卷指示条 */
.vl-current {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  height: 32px;
  padding: 0 var(--sp-2);
  background: var(--paper-raised);
  border-bottom: var(--line-1);
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
  pointer-events: none;
}

.vl-current.show {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.vl-current-mark {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--vermilion);
}

.vl-current-label {
  font-family: var(--font-serif-cn);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.4;
}

.vl-current-count {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--ink-muted);
}

.vl-current-flex { flex: 1; }

/* wrapper 承担高度，内部容器占满 */
.archive-list {
  height: 100% !important;
  /* 流式去盒子化（v5.2 重设计）：开放式阅读流——无边框无底色，
     条目间靠点线分隔 + 分段头划界；网格模式仍由 .vl-grid 自带边界 */
  border: none;
  background: transparent;
}

@media (prefers-reduced-motion: reduce) {
  .vl-sweep-line,
  .vl-sweep-bar { display: none; }
  .vl-current { transition: none; }
}

/* 网格密度（§4.2）：分段头通栏，卡片 2~3 列随宽度自适应 */
.vl-grid {
  height: 100%;
  overflow-y: auto;
  border: var(--line-1);
  background: rgba(255, 255, 255, 0.2);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--sp-2);
  padding: var(--sp-2);
  align-content: start;
}

.vl-grid-seg {
  grid-column: 1 / -1;
  margin: calc(var(--sp-2) * -1) calc(var(--sp-2) * -1) 0;
}

.vl-grid-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.vl-grid-cell > :deep(*) {
  flex: 1;
}
</style>
