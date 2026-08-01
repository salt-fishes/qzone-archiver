import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VisitorIndex, Visitor } from '@/types'
import { loadVisitorsIndex, loadVisitorsByYear } from '@/api/data-loader'

export const useVisitorsStore = defineStore('visitors', () => {
  /** 轻量索引（启动时加载） */
  const index = ref<VisitorIndex[]>([])
  /** 按年份缓存全量数据 */
  const yearCache = ref<Map<string, Visitor[]>>(new Map())
  /** 已加载完成的年份集合 */
  const loadedYears = ref<Set<string>>(new Set())
  /** 当前加载中的年份集合 */
  const loadingYears = ref<Set<string>>(new Set())

  const loading = ref(false)
  const error = ref<string>('')

  const total = computed(() => index.value.length)

  /** 按年份分组的索引（用于侧边栏目录树与年份跳转） */
  const yearGroups = computed(() => {
    const map = new Map<string, VisitorIndex[]>()
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
      index.value = await loadVisitorsIndex()
    } catch (e: any) {
      error.value = e?.message || '访客索引加载失败'
      console.warn('[visitorsStore] 访客索引加载失败，可能尚未导出', e)
    } finally {
      loading.value = false
    }
  }

  /** 按需加载某年全量数据 */
  async function loadYear(year: string | number): Promise<Visitor[]> {
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
      const items = await loadVisitorsByYear(y)
      yearCache.value.set(y, items)
      loadedYears.value.add(y)
      return items
    } catch (e: any) {
      console.warn(`[visitorsStore] 加载年份 ${y} 失败`, e)
      return []
    } finally {
      loadingYears.value.delete(y)
    }
  }

  /**
   * 根据索引项（uin + 已格式化 time 字符串）获取单条访客全量数据。
   * 索引项 ts 为 unix 秒，全量数据 time 也为 unix 秒，直接数值比较。
   * uin + ts 双重匹配以确保唯一性（同一访客可能多次访问）。
   */
  async function getVisitorByIndex(idx: VisitorIndex): Promise<Visitor | undefined> {
    const year = (idx.time || '').substring(0, 4)
    if (!year) return undefined
    const items = await loadYear(year)
    return items.find(v =>
      String(v.uin) === String(idx.uin) &&
      Number(v.time) === Number(idx.ts)
    )
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
    getVisitorByIndex
  }
})
