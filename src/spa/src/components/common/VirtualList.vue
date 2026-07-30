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
import { ref, computed } from 'vue'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

/**
 * 通用虚拟滚动列表
 *
 * 合并 MessageList/VisitorList/FavoriteList/BoardList/ShareList 的公共逻辑：
 *   - 基于 DynamicScroller 实现动态高度列表
 *   - 通过 keyOf 函数生成唯一 _key（注入到 item 上，不改原数据）
 *   - 调用方通过默认插槽自定义 Card 渲染
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
