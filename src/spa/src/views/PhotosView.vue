<template>
  <section class="photos-view">
    <!-- 章节标题 -->
    <div class="section-head">
      <span class="section-num">§ 04</span>
      <h2 class="section-title">相册 · 档案</h2>
      <span class="section-meta">{{ headMeta }}</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="photosStore.loading" class="app-loading">正在加载相册索引…</div>

    <!-- 错误状态 -->
    <div v-else-if="photosStore.error" class="error-tip">
      <p>{{ photosStore.error }}</p>
      <p class="hint">提示：相册数据尚未导出。请先在扩展中选择「相册 → SPA」备份类型并完成导出。</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="photosStore.total === 0" class="empty-tip">
      <p>暂无相册数据</p>
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
        <p>未找到匹配「{{ query }}」的相册</p>
        <p class="hint">试试其他关键字，或清除搜索查看全部。</p>
      </div>

      <!-- 虚拟滚动列表 -->
      <VirtualList
        v-else
        ref="listRef"
        :items="results"
        :key-of="(it: AlbumIndex) => it.albumId"
        list-class="photo-list"
      >
        <template #default="{ item }">
          <AlbumCard
            :index="item"
            :clickable="true"
            @open="handleOpen"
          />
        </template>
      </VirtualList>
    </template>

    <!-- 详情模态 -->
    <AlbumDetailModal
      v-model="detailVisible"
      :album="detailAlbum"
      :index="detailIndex"
      :loading="detailLoading"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePhotosStore } from '@/stores/photos'
import VirtualList from '@/components/common/VirtualList.vue'
import AlbumCard from '@/components/photo/AlbumCard.vue'
import AlbumDetailModal from '@/components/photo/AlbumDetailModal.vue'
import { stripFormatting } from '@/utils/formatContent'
import type { Album, AlbumIndex } from '@/types'

const route = useRoute()
const router = useRouter()
const photosStore = usePhotosStore()

// 客户端搜索：相册数据量通常适中，用普通 includes 过滤即可
const query = ref('')

const listRef = ref<InstanceType<typeof VirtualList> | null>(null)

// 详情模态状态
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailAlbum = ref<Album | null>(null)
const detailIndex = ref<AlbumIndex | null>(null)

const headMeta = computed(() => {
  if (photosStore.loading) return 'Loading…'
  if (photosStore.error) return 'Error'
  return `${photosStore.total} 个相册 · ${photosStore.totalPhotos} 张照片`
})

const results = computed<AlbumIndex[]>(() => {
  const kw = query.value.trim()
  if (!kw) return photosStore.index
  const lower = kw.toLowerCase()
  return photosStore.index.filter(item => {
    const name = (item.name || '').toLowerCase()
    const desc = stripFormatting(item.desc || '').toLowerCase()
    const className = (item.className || '').toLowerCase()
    return (
      name.includes(lower) ||
      desc.includes(lower) ||
      className.includes(lower)
    )
  })
})

const searchMeta = computed(() => {
  if (query.value) {
    return `查询「${query.value}」 · 命中 ${results.value.length} 个相册`
  }
  return `共 ${photosStore.total} 个相册 · ${photosStore.totalPhotos} 张照片`
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

async function handleOpen(idx: AlbumIndex) {
  detailLoading.value = true
  detailVisible.value = true
  detailAlbum.value = null
  detailIndex.value = idx
  try {
    const found = await photosStore.getAlbumById(idx.albumId)
    detailAlbum.value = found || null
    if (!found) {
      console.warn('[PhotosView] 未找到相册', idx)
    }
  } catch (e) {
    console.error('[PhotosView] 加载相册详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

/** 直接按 albumId 加载相册详情（索引中可能不存在时也尝试） */
async function openAlbumById(albumId: string) {
  detailLoading.value = true
  detailVisible.value = true
  detailAlbum.value = null
  const idx = photosStore.index.find(it => it.albumId === albumId) || null
  detailIndex.value = idx
  try {
    const found = await photosStore.getAlbumById(albumId)
    detailAlbum.value = found || null
    if (!found) {
      console.warn('[PhotosView] 未找到相册', albumId)
    }
  } catch (e) {
    console.error('[PhotosView] 加载相册详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

// 侧边栏相册跳转：监听 route.query.album
watch(() => route.query.album, async (albumId) => {
  const id = albumId ? String(albumId) : ''
  if (!id) return
  // 等待索引加载
  if (photosStore.index.length === 0) {
    if (!photosStore.loading) photosStore.init()
    while (photosStore.loading) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (photosStore.index.length === 0) {
      // 索引为空也尝试直接加载该相册
      await openAlbumById(id)
    } else {
      await openAlbumById(id)
    }
  } else {
    await openAlbumById(id)
  }
  // 清除 query.album，避免刷新再次弹出
  const next = { ...route.query }
  delete next.album
  router.replace({ query: next })
}, { immediate: true })

onMounted(() => {
  if (photosStore.index.length === 0 && !photosStore.loading) {
    photosStore.init()
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
</style>
