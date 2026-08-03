<template>
  <DynamicScroller
    ref="scrollerRef"
    :class="listClass"
    :style="{ height: listHeight, minHeight: '360px' }"
    :items="keyedItems"
    :min-item-size="minItemSize"
    key-field="_key"
    :buffer="buffer"
    v-slot="{ item, active }"
  >
    <DynamicScrollerItem
      class="archive-item-wrap"
      :item="item"
      :active="active"
      :data-index="item._key"
    >
      <!--
        默认插槽接收当前项，由调用方决定渲染哪个 Card 组件
        item 已注入 _key 字段，原数据字段保持不变
      -->
      <slot :item="item" />
    </DynamicScrollerItem>
  </DynamicScroller>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { enter, isAnimated, markAnimated, staggerEnter } from '@/composables/useMotion'

/**
 * 通用虚拟滚动列表
 *
 * 合并 MessageList/VisitorList/FavoriteList/BoardList/ShareList 的公共逻辑：
 *   - 基于 DynamicScroller 实现动态高度列表
 *   - 通过 keyOf 函数生成唯一 _key（注入到 item 上，不改原数据）
 *   - 调用方通过默认插槽自定义 Card 渲染
 *   - 列表项首次出现做一次交错入场（首屏 stagger，滚动新增项单条淡入，
 *     复用的 DOM 节点带 motionDone 标记不重播）
 *
 * 调用示例：
 *   <VirtualList :items="messages" :key-of="it => it.tid">
 *     <template #default="{ item }">
 *       <MessageCard :index="item" @open="handleOpen" />
 *     </template>
 *   </VirtualList>
 */
const props = withDefaults(defineProps<{
  /** 列表数据 */
  items: any[]
  /** 生成唯一 key 的函数；不传则自动尝试 _key/tid/id/uin-time 等字段 */
  keyOf?: (item: any) => string
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
  minItemSize: 120,
  buffer: 400,
  listClass: 'archive-list',
  listHeight: 'calc(100vh - 320px)'
})

const scrollerRef = ref<any>(null)
let observer: MutationObserver | null = null
let revealTimer: number | undefined

/** 滚动新增项：单条淡入（复用节点带标记直接跳过） */
function revealItem(el: HTMLElement) {
  if (isAnimated(el)) return
  enter(el, { translateY: 18, duration: 600 })
  markAnimated(el)
}

/** 首屏现有项：交错入场 */
function revealInitial() {
  const root = scrollerRef.value?.$el
  if (!root) return
  const items = Array.from(root.querySelectorAll('.archive-item-wrap')) as HTMLElement[]
  const fresh = items.filter(el => !isAnimated(el))
  if (!fresh.length) return
  staggerEnter(root, fresh, { gap: 70, translateY: 20, scale: 0.99, duration: 700 })
  fresh.forEach(markAnimated)
}

function setupObserver() {
  const root = scrollerRef.value?.$el
  if (!root || observer) return
  observer = new MutationObserver(muts => {
    muts.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n instanceof HTMLElement && n.classList.contains('archive-item-wrap')) {
          revealItem(n)
        }
      })
    })
  })
  // subtree：捕获 item-wrapper 内新增的 item-view
  observer.observe(root, { childList: true, subtree: true })
}

onMounted(() => {
  // 同步处理首屏已渲染项（DOM 已插入但尚未绘制，无闪烁）
  revealInitial()
  // 异步兜底：DynamicScroller 内部布局可能跨帧渲染
  revealTimer = window.setTimeout(() => {
    revealInitial()
    setupObserver()
  }, 120)
})

onUnmounted(() => {
  if (revealTimer) clearTimeout(revealTimer)
  observer?.disconnect()
})

const keyedItems = computed<any[]>(() => {
  if (props.keyOf) {
    return props.items.map(it => ({ ...it, _key: props.keyOf!(it) }))
  }
  // 自动 fallback：按字段优先级取唯一 key
  return props.items.map((it: any) => {
    const key =
      it._key ||
      it.tid ||
      it.id ||
      (it.uin && it.time && `${it.uin}-${it.time}`) ||
      (it.uin && it.pubtime && `${it.uin}_${it.pubtime}`) ||
      (it.uin && it.shareTime && `${it.uin}_${it.shareTime}`) ||
      Math.random().toString(36).slice(2)
    return { ...it, _key: key }
  })
})

function scrollToItem(index: number) {
  const scroller = scrollerRef.value
  if (scroller && scroller.scrollToItem) {
    scroller.scrollToItem(index)
  }
}

defineExpose({ scrollToItem })
</script>

<style scoped>
.archive-list {
  height: calc(100vh - 320px);
  min-height: 360px;
  border: var(--line);
  background: rgba(255, 255, 255, 0.2);
}

/* vue-virtual-scroller 的滚动容器必须显式继承高度，
   否则 clientHeight 会等于 scrollHeight，虚拟滚动失效，
   scrollToItem 无法工作 */
.archive-list :deep(.vue-recycle-scroller) {
  height: 100%;
  min-height: 360px;
}
</style>
