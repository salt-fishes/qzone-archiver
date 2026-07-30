<template>
  <section class="friends-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 08</span>
      <h2 class="section-title">好友 · 档案</h2>
      <span class="section-meta">{{ headMeta }}</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="friendsStore.loading" class="app-loading">正在加载好友索引…</div>

    <!-- 错误状态 -->
    <div v-else-if="friendsStore.error" class="error-tip">
      <p>{{ friendsStore.error }}</p>
      <p class="hint">提示：好友数据尚未导出。请先在扩展中选择「好友 → SPA」备份类型并完成导出。</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="friendsStore.total === 0" class="empty-tip">
      <p>暂无好友数据</p>
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
        <p>未找到匹配「{{ query }}」的好友</p>
        <p class="hint">试试其他关键字，或清除搜索查看全部。</p>
      </div>

      <!-- 虚拟滚动列表 -->
      <VirtualList
        v-else
        ref="listRef"
        :items="results"
        :key-of="(it: FriendIndex) => String(it.uin)"
        list-class="friend-list"
      >
        <template #default="{ item }">
          <FriendCard
            :index="item"
            :clickable="true"
            @open="handleOpen"
          />
        </template>
      </VirtualList>

      <!-- 分组快速跳转 -->
      <div v-if="!query && friendsStore.groupLists.length > 1" class="group-jump">
        <span class="meta">归档：</span>
        <button
          v-for="[groupName, items] in friendsStore.groupLists"
          :key="groupName"
          class="group-jump-btn"
          type="button"
          @click="jumpToGroup(groupName)"
        >
          {{ groupName }} <span class="group-jump-count">{{ items.length }}</span>
        </button>
      </div>
    </template>

    <!-- 详情模态 -->
    <FriendDetailModal
      v-model="detailVisible"
      :friend="detailFriend"
      :index="detailIndex"
      :loading="detailLoading"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFriendsStore } from '@/stores/friends'
import VirtualList from '@/components/common/VirtualList.vue'
import FriendCard from '@/components/friend/FriendCard.vue'
import FriendDetailModal from '@/components/friend/FriendDetailModal.vue'
import type { Friend, FriendIndex } from '@/types'

const route = useRoute()
const router = useRouter()
const friendsStore = useFriendsStore()

// 客户端搜索：好友数据量通常适中，用普通 includes 过滤即可
const query = ref('')

const listRef = ref<InstanceType<typeof VirtualList> | null>(null)

// 详情模态状态
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailFriend = ref<Friend | null>(null)
const detailIndex = ref<FriendIndex | null>(null)

const headMeta = computed(() => {
  if (friendsStore.loading) return 'Loading…'
  if (friendsStore.error) return 'Error'
  return `${friendsStore.total} entries`
})

const results = computed<FriendIndex[]>(() => {
  const kw = query.value.trim()
  if (!kw) return friendsStore.index
  const lower = kw.toLowerCase()
  return friendsStore.index.filter(item => {
    const name = (item.name || '').toLowerCase()
    const remark = (item.remark || '').toLowerCase()
    const groupName = (item.groupName || '').toLowerCase()
    const uin = String(item.uin || '').toLowerCase()
    return (
      name.includes(lower) ||
      remark.includes(lower) ||
      groupName.includes(lower) ||
      uin.includes(lower)
    )
  })
})

const searchMeta = computed(() => {
  if (query.value) {
    return `查询「${query.value}」 · 命中 ${results.value.length} 条`
  }
  return `共 ${friendsStore.total} 条 · 按分组聚合`
})

// 路由 query → 搜索框
watch(() => route.query.q, (q) => {
  const next = String(q || '')
  if (next !== query.value) query.value = next
}, { immediate: true })

// 搜索框 → 路由 query
watch(query, (v) => {
  const next = { ...route.query }
  const q = (v || '').trim()
  if (q) next.q = q
  else delete next.q
  if (route.query.q !== q) {
    router.replace({ query: next })
  }
})

async function handleOpen(idx: FriendIndex) {
  detailLoading.value = true
  detailVisible.value = true
  detailFriend.value = null
  detailIndex.value = idx
  try {
    const found = await friendsStore.getFriendByUin(idx.uin)
    detailFriend.value = found || null
    if (!found) {
      console.warn('[FriendsView] 未在全量分组中找到好友', idx)
    }
  } catch (e) {
    console.error('[FriendsView] 加载好友详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

function jumpToGroup(groupName: string) {
  const pos = friendsStore.index.findIndex(item => (item.groupName || '') === groupName)
  if (pos >= 0) {
    listRef.value?.scrollToItem(pos)
  }
}

// 侧边栏分组快速跳转：监听 route.query.group
watch(() => route.query.group, async (groupName) => {
  const g = groupName ? String(groupName) : ''
  if (!g) return
  if (friendsStore.index.length === 0) {
    if (!friendsStore.loading) friendsStore.init()
    while (friendsStore.loading) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (friendsStore.index.length === 0) return
  }
  await nextTick()
  jumpToGroup(g)
}, { immediate: true })

onMounted(() => {
  if (friendsStore.index.length === 0 && !friendsStore.loading) {
    friendsStore.init()
  }
})
</script>

<style scoped>
.error-tip,
.empty-tip {
  padding: var(--sp-5);
  border: var(--line);
  background: rgba(200, 68, 42, 0.04);
  font-family: var(--font-serif-cn);
}

.error-tip .hint,
.empty-tip .hint {
  margin-top: var(--sp-2);
  font-size: 0.85rem;
  color: var(--ink-3);
}

.search-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin: var(--sp-4) 0 var(--sp-3);
}

.clear-btn {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  background: transparent;
  border: var(--line-dot);
  color: var(--ink-3);
  padding: 2px var(--sp-2);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  color: var(--vermilion);
  border-color: var(--vermilion);
}

.group-jump {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-5);
  padding-top: var(--sp-4);
  border-top: var(--line-double);
}

.group-jump-btn {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  background: transparent;
  color: var(--ink);
  border: var(--line);
  padding: var(--sp-1) var(--sp-3);
  cursor: pointer;
  transition: all 0.15s;
}

.group-jump-btn:hover {
  background: var(--ink);
  color: var(--paper);
}

.group-jump-count {
  color: var(--vermilion);
  margin-left: var(--sp-1);
}

.group-jump-btn:hover .group-jump-count {
  color: var(--paper);
}
</style>
