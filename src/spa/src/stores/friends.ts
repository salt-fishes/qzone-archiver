import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FriendIndex, FriendGroup, Friend } from '@/types'
import { loadFriendsIndex, loadFriendsGroup } from '@/api/data-loader'

export const useFriendsStore = defineStore('friends', () => {
  /** 轻量索引（启动时加载） */
  const index = ref<FriendIndex[]>([])
  /** 按分组聚合的全量数据（单文件加载） */
  const groups = ref<FriendGroup[]>([])
  /** 全量分组数据是否已加载（缓存标志） */
  const groupsLoaded = ref(false)
  /** 是否正在加载全量分组数据 */
  const loadingGroups = ref(false)

  const loading = ref(false)
  const error = ref<string>('')

  const total = computed(() => index.value.length)

  /** 按分组名聚合的索引（用于侧边栏目录树与分组跳转） */
  const groupLists = computed(() => {
    const map = new Map<string, FriendIndex[]>()
    for (const item of index.value) {
      const g = item.groupName || '(未分组)'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(item)
    }
    // 按分组名稳定排序（中文按拼音/localeCompare）
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'))
  })

  /** 启动时加载索引 */
  async function init() {
    if (index.value.length > 0 || loading.value) return
    loading.value = true
    error.value = ''
    try {
      index.value = await loadFriendsIndex()
    } catch (e: any) {
      error.value = e?.message || '好友索引加载失败'
      console.warn('[friendsStore] 好友索引加载失败，可能尚未导出', e)
    } finally {
      loading.value = false
    }
  }

  /** 按需加载全量分组数据（带缓存标志 groupsLoaded） */
  async function loadGroups(): Promise<FriendGroup[]> {
    if (groupsLoaded.value) return groups.value
    if (loadingGroups.value) {
      while (loadingGroups.value) {
        await new Promise(r => setTimeout(r, 50))
      }
      return groups.value
    }
    loadingGroups.value = true
    try {
      const items = await loadFriendsGroup()
      groups.value = items
      groupsLoaded.value = true
      return items
    } catch (e: any) {
      console.warn('[friendsStore] 加载好友分组全量数据失败', e)
      return []
    } finally {
      loadingGroups.value = false
    }
  }

  /**
   * 根据 uin 从全量数据中查找好友。
   * 若全量分组未加载会先触发 loadGroups()。
   */
  async function getFriendByUin(uin: number | string): Promise<Friend | undefined> {
    if (!groupsLoaded.value) await loadGroups()
    for (const g of groups.value) {
      const f = g.friends.find(f => String(f.uin) === String(uin))
      if (f) return f
    }
    return undefined
  }

  return {
    index,
    groups,
    groupsLoaded,
    loadingGroups,
    loading,
    error,
    total,
    groupLists,
    init,
    loadGroups,
    getFriendByUin
  }
})
