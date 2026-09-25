import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DiaryIndex, Diary } from '@/types'
import { loadDiariesIndex, loadDiariesByYear } from '@/api/data-loader'

export const useDiariesStore = defineStore('diaries', () => {
  /** 轻量索引（启动时加载） */
  const index = ref<DiaryIndex[]>([])
  /** 按年份缓存全量数据 */
  const yearCache = ref<Map<string, Diary[]>>(new Map())
  /** 已加载完成的年份集合 */
  const loadedYears = ref<Set<string>>(new Set())
  /** 当前加载中的年份集合 */
  const loadingYears = ref<Set<string>>(new Set())

  const loading = ref(false)
  const error = ref<string>('')

  const total = computed(() => index.value.length)

  /** 按年份分组的索引（用于侧边栏目录树与年份跳转） */
  const yearGroups = computed(() => {
    const map = new Map<string, DiaryIndex[]>()
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
      index.value = await loadDiariesIndex()
    } catch (e: any) {
      error.value = e?.message || '日记索引加载失败'
      console.warn('[diariesStore] 日记索引加载失败，可能尚未导出', e)
    } finally {
      loading.value = false
    }
  }

  /** 按需加载某年全量数据 */
  async function loadYear(year: string | number): Promise<Diary[]> {
    const y = String(year)
    if (yearCache.value.has(y)) return yearCache.value.get(y)!
    if (loadingYears.value.has(y)) {
      while (loadingYears.value.has(y)) {
        await new Promise(r => setTimeout(r, 50))
      }
      return yearCache.value.get(y) || []
    }
    loadingYears.value.add(y)
    try {
      const items = await loadDiariesByYear(y)
      yearCache.value.set(y, items)
      loadedYears.value.add(y)
      return items
    } catch (e: any) {
      console.warn(`[diariesStore] 加载年份 ${y} 失败`, e)
      return []
    } finally {
      loadingYears.value.delete(y)
    }
  }

  /**
   * 根据索引项获取单条日记全量数据。
   * blogId 为唯一标识，优先用 blogId/blogid 精确匹配。
   * 注意：不使用时间作为匹配条件——扩展端索引 time 用 12 小时制格式化，
   * SPA 端 formatUnixTime 用 24 小时制，两者不一致会导致匹配失败。
   */
  async function getDiaryByIndex(idx: DiaryIndex): Promise<Diary | undefined> {
    const year = (idx.time || '').substring(0, 4)
    if (!year) return undefined
    const items = await loadYear(year)
    return items.find(d => d.blogId === idx.blogId || d.blogid === idx.blogId)
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
    init,
    loadYear,
    getDiaryByIndex
  }
})
