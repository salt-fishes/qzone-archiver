import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo } from '@/types'
import { loadUserInfo } from '@/api/data-loader'

export const useUserStore = defineStore('user', () => {
  const info = ref<UserInfo | null>(null)
  const loading = ref(false)
  const error = ref<string>('')

  const isReady = computed(() => info.value !== null)
  const uin = computed(() => info.value?.uin)
  const nickname = computed(() => info.value?.nickname || '')
  const avatar = computed(() => info.value?.avatar || '')
  const isOwner = computed(() => info.value?.isOwner === true)

  /** 模块统计：用于首页数据卡与侧边栏计数 */
  const stats = computed(() => ({
    messages: info.value?.messages || 0,
    blogs: info.value?.blogs || 0,
    diaries: info.value?.diaries || 0,
    photos: info.value?.photos || 0,
    videos: info.value?.videos || 0,
    boards: info.value?.boards || 0,
    favorites: info.value?.favorites || 0,
    shares: info.value?.shares || 0,
    friends: info.value?.friends || 0,
    visitors: info.value?.visitors || 0
  }))

  const totalRecords = computed(() => {
    const s = stats.value
    return s.messages + s.blogs + s.diaries + s.photos + s.videos + s.boards +
           s.favorites + s.shares + s.friends
  })

  async function init() {
    if (info.value) return
    loading.value = true
    error.value = ''
    try {
      info.value = await loadUserInfo()
    } catch (e: any) {
      error.value = e?.message || '用户信息加载失败'
      console.warn('[userStore] 用户信息加载失败，可能尚未导出', e)
    } finally {
      loading.value = false
    }
  }

  return { info, loading, error, isReady, uin, nickname, avatar, isOwner, stats, totalRecords, init }
})
