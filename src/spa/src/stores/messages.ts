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
  /** 是否已用全量数据增强索引（旧备份索引的点赞/评论数可能缺失或截断） */
  const enriched = ref(false)

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
      // 旧备份索引的点赞数（like.total）与扩展端实际导出的 likes 数组不一致、
      // 评论数可能被列表接口截断，加载后异步用全量数据回填真实值（本地文件，无网络开销）
      enrichIndex()
    } catch (e: any) {
      error.value = e?.message || '说说索引加载失败'
      console.warn('[messagesStore] 说说索引加载失败，可能尚未导出', e)
    } finally {
      loading.value = false
    }
  }

  /**
   * 用全量数据（messages-YYYY.js）回填索引中的真实点赞/评论数：
   * 扩展端索引 likeCount 取 like.total，但旧备份实际导出的是 likes 数组；
   * commentCount 曾取内嵌评论长度（截断为 10）。此处按 tid 覆盖为真实值。
   */
  async function enrichIndex() {
    if (enriched.value || index.value.length === 0) return
    enriched.value = true
    try {
      const fixMap = new Map<string, { likeCount?: number; commentCount?: number }>()
      for (const [year] of yearGroups.value) {
        const items = await loadYear(year)
        for (const m of items) {
          const tid = String((m as any).tid ?? '')
          if (!tid) continue
          const likeTotal = (m as any).like?.total
            || ((m as any).likes && (m as any).likes.length)
            || 0
          const commentTotal = (m as any).commenttotal
            || ((m as any).custom_comments && (m as any).custom_comments.length)
            || 0
          if (likeTotal > 0 || commentTotal > 0) {
            fixMap.set(tid, { likeCount: likeTotal, commentCount: commentTotal })
          }
        }
      }
      if (fixMap.size === 0) return
      index.value = index.value.map(it => {
        const fix = fixMap.get(String(it.tid))
        if (!fix) return it
        const next = { ...it }
        if (fix.likeCount && fix.likeCount > (next.likeCount || 0)) next.likeCount = fix.likeCount
        if (fix.commentCount && fix.commentCount > (next.commentCount || 0)) next.commentCount = fix.commentCount
        return next
      })
    } catch (e) {
      console.warn('[messagesStore] 索引互动数据增强失败', e)
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
    enriched,
    total,
    yearGroups,
    deletedList,
    deletedLoading,
    deletedLoaded,
    deletedError,
    deletedTotal,
    init,
    enrichIndex,
    loadYear,
    getMessageByTid,
    loadDeleted
  }
})
