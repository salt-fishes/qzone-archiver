<template>
  <!-- 网格密度：非虚拟化的 CSS Grid（仅当条目数在阈值内），分段头通栏 -->
  <div v-if="useGrid" :class="['vl-grid', listClass]">
    <template v-for="(row, i) in rows" :key="row.__key">
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

  <!-- 流式密度：虚拟滚动，年代分段行注入为特殊行，sticky 悬停 -->
  <DynamicScroller
    v-else
    ref="scrollerRef"
    :class="listClass"
    :style="{ height: listHeight, minHeight: '360px' }"
    :items="rows"
    :min-item-size="minItemSize"
    key-field="__key"
    :buffer="buffer"
    v-slot="{ item, active }"
  >
    <SegmentHeader
      v-if="item.__seg"
      :seg="item.__seg"
      :grid-available="gridAvailable"
      :style="{ '--vss-min-item-size': `${SEG_MIN_SIZE}px` }"
    />
    <DynamicScrollerItem
      v-else
      class="archive-item-wrap"
      :item="item"
      :active="active"
      :data-index="item.__key"
    >
      <!--
        默认插槽接收当前项，由调用方决定渲染哪个 Card 组件
        item 已注入 __key 字段，原数据字段保持不变
      -->
      <slot :item="item" />
    </DynamicScrollerItem>
  </DynamicScroller>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import SegmentHeader from './SegmentHeader.vue'
import { useDensity } from '@/composables/useDensity'
import { yearLabel } from '@/utils/yearLabel'

/**
 * 通用虚拟滚动列表（V1 阅读型骨架升级）
 *
 * 新增能力：
 *  - segmentOf：按返回值把相邻同段条目分组，段首自动注入分段头行（sticky，§4.1）
 *  - 密度：流式（虚拟滚动）/ 网格（≤GRID_MAX 条时非虚拟 CSS Grid），
 *    状态由 useDensity() 全局记忆；超阈值网格自动回退流式
 *  - scrollToItem(index)：调用方仍传「原始条目下标」，内部自动映射到行下标
 */
const props = withDefaults(defineProps<{
  /** 列表数据 */
  items: any[]
  /** 生成唯一 key 的函数；不传则自动尝试 _key/tid/id/uin-time 等字段 */
  keyOf?: (item: any) => string
  /** 分段取值：返回段名（如 '2024'）则按相邻同值分组并注入分段头；返回空值不分段 */
  segmentOf?: (item: any) => string | null
  /** 网格模式可用性（分段头上的切换按钮禁用态） */
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
/** 分段头行的占位估算高度 */
const SEG_MIN_SIZE = 44

const scrollerRef = ref<any>(null)
const { density } = useDensity()

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

function keyFor(it: any, i: number): string {
  if (props.keyOf) return String(props.keyOf(it))
  return String(
    it.__key || it._key ||
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

defineExpose({ scrollToItem })
</script>

<style scoped>
.archive-list {
  height: calc(100vh - 320px);
  min-height: 360px;
  max-width: 780px; /* 流式 1 列 = 720px 阅读列（§4.2），居中 */
  margin: 0 auto;
  border: var(--line-1);
  background: rgba(255, 255, 255, 0.2);
}

/* vue-virtual-scroller 的滚动容器必须显式继承高度，
   否则 clientHeight 会等于 scrollHeight，虚拟滚动失效，
   scrollToItem 无法工作 */
.archive-list :deep(.vue-recycle-scroller) {
  height: 100%;
  min-height: 360px;
}

/* 分段头行在虚拟列表内最小高度提示（DynamicScroller 估算用） */
.archive-list :deep(.seg-head) {
  min-height: 44px;
}

/* 网格密度（§4.2）：分段头通栏，卡片 2~3 列随宽度自适应 */
.vl-grid {
  height: calc(100vh - 320px);
  min-height: 360px;
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
