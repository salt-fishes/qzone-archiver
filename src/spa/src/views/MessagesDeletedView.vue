<template>
  <section class="messages-view messages-deleted-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 01′</span>
      <h2 class="section-title">说说 · 已删除</h2>
      <span class="section-meta">{{ headMeta }}</span>
    </div>

    <!-- 实验性提示 -->
    <div class="exp-tip">
      <strong>实验性功能</strong>
      <p>以下说说通过好友互动消息（评论/点赞通知）恢复，可能与原说说存在差异：</p>
      <ul>
        <li>仅能恢复有互动的说说；私密说说无通知故无法恢复</li>
        <li>摘要文本可能被截断；图片链接可能已失效</li>
        <li>评论/点赞为通知中提到的零散记录，可能不完整</li>
      </ul>
    </div>

    <!-- 加载状态 -->
    <div v-if="messagesStore.deletedLoading && !messagesStore.deletedLoaded" class="app-loading">
      正在加载已删除说说…
    </div>

    <!-- 空状态 -->
    <div v-else-if="messagesStore.deletedTotal === 0" class="empty-tip">
      <p>暂无已删除说说数据</p>
      <p class="hint">
        提示：可能未在扩展中开启「说说 → 恢复已删除说说」实验性选项，
        或备份时段内没有可恢复的已删除说说。
      </p>
    </div>

    <!-- 主视图：搜索结果 + 虚拟滚动列表 -->
    <template v-else>
      <!-- 搜索结果元信息 -->
      <div class="search-meta">
        <span class="meta">{{ searchMeta }}</span>
        <button v-if="query" class="clear-btn" type="button" @click="query = ''">清除搜索</button>
      </div>

      <!-- 无结果 -->
      <div v-if="results.length === 0" class="empty-tip">
        <p>未找到匹配「{{ query }}」的已删除说说</p>
        <p class="hint">试试其他关键字，或清除搜索查看全部。</p>
      </div>

      <!-- 虚拟滚动列表 -->
      <VirtualList
        v-else
        ref="listRef"
        :items="results"
        :key-of="(it: DeletedMessageIndex) => it.tid"
        list-class="message-list"
      >
        <template #default="{ item }">
          <MessageCard
            :index="item"
            :clickable="true"
            stamp-text="已删除"
            @open="(idx: MessageIndex) => handleOpen(idx as DeletedMessageIndex)"
          />
        </template>
      </VirtualList>
    </template>

    <!-- 详情模态（复用 MessageDetailModal，DeletedMessage 与 Message 结构兼容） -->
    <MessageDetailModal
      v-model="detailVisible"
      :message="detailMessage"
      :loading="detailLoading"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useMessagesStore } from '@/stores/messages'
import { useFlexSearch } from '@/composables/useFlexSearch'
import VirtualList from '@/components/common/VirtualList.vue'
import MessageCard from '@/components/message/MessageCard.vue'
import MessageDetailModal from '@/components/message/MessageDetailModal.vue'
import type { DeletedMessage, MessageIndex } from '@/types'

/**
 * 衍生索引类型：将 DeletedMessage 投影为 MessageIndex 形状
 * 用于复用 MessageCard 组件
 */
type DeletedMessageIndex = MessageIndex & { _raw: DeletedMessage }

const route = useRoute()
const router = useRouter()
const messagesStore = useMessagesStore()

// 将 DeletedMessage[] 投影为 MessageIndex[]（带 _raw 引用，用于打开详情）
const indexArray = computed<DeletedMessageIndex[]>(() => {
  return messagesStore.deletedList.map(m => ({
    tid: m.tid,
    time: m.custom_create_time || '',
    title: (m.content || '').substring(0, 50),
    imgCount: (m.custom_images && m.custom_images.length) || 0,
    commentCount: m.commenttotal || 0,
    likeCount: (m.like && m.like.total) || 0,
    _raw: m
  }))
})

const { index: _ignored } = storeToRefs(messagesStore)
// 用衍生索引作为搜索源
const indexRef = computed(() => indexArray.value)
const { query, results } = useFlexSearch(indexRef as any)

const listRef = ref<InstanceType<typeof VirtualList> | null>(null)

const headMeta = computed(() => {
  const total = messagesStore.deletedTotal
  if (messagesStore.deletedLoading && !messagesStore.deletedLoaded) return '加载中…'
  return `共 ${total} 条`
})

const searchMeta = computed(() => {
  const total = messagesStore.deletedTotal
  if (query.value) {
    return `匹配 ${results.value.length} / ${total} 条`
  }
  return `共 ${total} 条`
})

// 详情模态
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailMessage = ref<DeletedMessage | null>(null)

function handleOpen(idx: DeletedMessageIndex) {
  detailLoading.value = true
  detailVisible.value = true
  detailMessage.value = null
  // 已删除说说数据已全量加载，直接取 _raw
  detailMessage.value = idx._raw
  detailLoading.value = false
}

// 路由 query 同步
watch(() => route.query.q, (q) => {
  if (typeof q === 'string' && q !== query.value) {
    query.value = q
  }
}, { immediate: true })

watch(query, (q) => {
  const newQuery = { ...route.query }
  if (q) newQuery.q = q
  else delete newQuery.q
  router.replace({ query: newQuery })
})

onMounted(() => {
  // 确保已删除数据已加载（SideBar 已预加载，这里做幂等保障）
  messagesStore.loadDeleted()
})
</script>

<style scoped>
.exp-tip {
  margin: var(--sp-4) 0;
  padding: var(--sp-3) var(--sp-4);
  border-left: 3px solid var(--warning, #b8860b);
  background: var(--paper-2, rgba(0, 0, 0, 0.03));
  font-size: 0.85rem;
  color: var(--ink-2, #555);
}

.exp-tip strong {
  color: var(--warning, #b8860b);
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
}

.exp-tip p {
  margin: var(--sp-2) 0 var(--sp-1);
}

.exp-tip ul {
  margin: 0;
  padding-left: var(--sp-4);
}

.exp-tip li {
  margin: var(--sp-1) 0;
}
</style>
