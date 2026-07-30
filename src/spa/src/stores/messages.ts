import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MessageIndex, Message, DeletedMessage } from '@/types'
import { loadMessagesIndex, loadMessagesByYear, loadMessagesDeleted } from '@/api/data-loader'

export const useMessagesStore = defineStore('messages', () => {
  /** 轻量索引（启动时加载） */
  const index = ref<MessageIndex[]>([])
  /** 按年份缓存全量数据 */
  const yearCache = ref<Map<string, Message[]>>(new Map())
  /** 已加载完成的年份集合 */
  const loadedYears = ref<Set<string>>(new Set())
  /** 当前加载中的年份集合 */
  const loadingYears = ref<Set<string>>(new Set())

  const loading = ref(false)
  const error = ref<string>('')

  /** 已删除说说列表（实验性，按需加载） */
  const deletedList = ref<DeletedMessage[]>([])
  const deletedLoading = ref(false)
  const deletedLoaded = ref(false)
  const deletedError = ref<string>('')

  const total = computed(() => index.value.length)
  const deletedTotal = computed(() => deletedList.value.length)

  /** 按年份分组的索引（用于侧边栏目录树） */
  const yearGroups = computed(() => {
    const map = new Map<string, MessageIndex[]>()
    for (const item of index.value) {
      const year = (item.time || '').substring(0, 4)
      if (!year) continue
      if (!map.has(year)) map.set(year, [])
      map.get(year)!.push(item)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  })

  /** 启动时加载索引 */
  async function init() {
    if (index.value.length > 0 || loading.value) return
    loading.value = true
    error.value = ''
    try {
      index.value = await loadMessagesIndex()
    } catch (e: any) {
      error.value = e?.message || '说说索引加载失败'
      console.warn('[messagesStore] 说说索引加载失败，可能尚未导出', e)
    } finally {
      loading.value = false
    }
  }

  /** 按需加载某年全量数据 */
  async function loadYear(year: string | number): Promise<Message[]> {
    const y = String(year)
    if (yearCache.value.has(y)) return yearCache.value.get(y)!
    if (loadingYears.value.has(y)) {
      // 等待已在进行的加载
      while (loadingYears.value.has(y)) {
        await new Promise(r => setTimeout(r, 50))
      }
      return yearCache.value.get(y) || []
    }
    loadingYears.value.add(y)
    try {
      const items = await loadMessagesByYear(y)
      yearCache.value.set(y, items)
      loadedYears.value.add(y)
      return items
    } catch (e: any) {
      console.warn(`[messagesStore] 加载年份 ${y} 失败`, e)
      return []
    } finally {
      loadingYears.value.delete(y)
    }
  }

  /** 根据 tid 获取单条说说（需已知年份） */
  async function getMessageByTid(tid: string, year: string | number): Promise<Message | undefined> {
    const items = await loadYear(year)
    return items.find(m => m.tid === tid)
  }

  /** 加载已删除说说（实验性，按需，带缓存） */
  async function loadDeleted(): Promise<DeletedMessage[]> {
    if (deletedLoaded.value) return deletedList.value
    if (deletedLoading.value) {
      while (deletedLoading.value) {
        await new Promise(r => setTimeout(r, 50))
      }
      return deletedList.value
    }
    deletedLoading.value = true
    deletedError.value = ''
    try {
      deletedList.value = await loadMessagesDeleted()
      deletedLoaded.value = true
      return deletedList.value
    } catch (e: any) {
      // 文件可能不存在（未开启恢复功能）
      deletedError.value = e?.message || '已删除说说加载失败'
      console.info('[messagesStore] 已删除说说数据未找到（可能未开启恢复功能）', e)
      deletedList.value = []
      deletedLoaded.value = true
      return []
    } finally {
      deletedLoading.value = false
    }
  }

  return {
    index,
    yearCache,
    loadedYears,
    loadingYears,
    loading,
    error,
    total,
    yearGroups,
    deletedList,
    deletedLoading,
    deletedLoaded,
    deletedError,
    deletedTotal,
    init,
    loadYear,
    getMessageByTid,
    loadDeleted
  }
})
