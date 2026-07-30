import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VideoIndex, Video } from '@/types'
import { loadVideosIndex, loadVideosByYear } from '@/api/data-loader'
import { formatUnixTime } from '@/utils/formatContent'

export const useVideosStore = defineStore('videos', () => {
  /** 轻量索引（启动时加载） */
  const index = ref<VideoIndex[]>([])
  /** 按年份缓存全量数据 */
  const yearCache = ref<Map<string, Video[]>>(new Map())
  /** 已加载完成的年份集合 */
  const loadedYears = ref<Set<string>>(new Set())
  /** 当前加载中的年份集合 */
  const loadingYears = ref<Set<string>>(new Set())

  const loading = ref(false)
  const error = ref<string>('')

  const total = computed(() => index.value.length)

  /** 按年份分组的索引（用于侧边栏目录树与年份跳转） */
  const yearGroups = computed(() => {
    const map = new Map<string, VideoIndex[]>()
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
      index.value = await loadVideosIndex()
    } catch (e: any) {
      error.value = e?.message || '视频索引加载失败'
      console.warn('[videosStore] 视频索引加载失败，可能尚未导出', e)
    } finally {
      loading.value = false
    }
  }

  /** 按需加载某年全量数据 */
  async function loadYear(year: string | number): Promise<Video[]> {
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
      const items = await loadVideosByYear(y)
      yearCache.value.set(y, items)
      loadedYears.value.add(y)
      return items
    } catch (e: any) {
      console.warn(`[videosStore] 加载年份 ${y} 失败`, e)
      return []
    } finally {
      loadingYears.value.delete(y)
    }
  }

  /**
   * 根据索引项获取单条视频全量数据。
   * 索引项的 time 为 'YYYY-MM-DD HH:mm:ss'，全量数据 uploadTime 为 unix 秒，
   * 通过 formatUnixTime(v.uploadTime) 转换后与索引项的 time 比较以定位。
   * vid 为唯一标识，优先用 vid 精确匹配。
   */
  async function getVideoByIndex(idx: VideoIndex): Promise<Video | undefined> {
    const year = (idx.time || '').substring(0, 4)
    if (!year) return undefined
    const items = await loadYear(year)
    return items.find(v =>
      (v.vid === idx.vid || v.video_id === idx.vid) &&
      formatUnixTime(v.uploadTime || v.uploadtime || 0) === idx.time
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
    getVideoByIndex
  }
})
