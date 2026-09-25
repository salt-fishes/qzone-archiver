import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AlbumIndex, Album } from '@/types'
import { loadPhotosIndex, loadAlbumById } from '@/api/data-loader'

export const usePhotosStore = defineStore('photos', () => {
  /** 轻量索引（启动时加载，不含 photoList） */
  const index = ref<AlbumIndex[]>([])
  /** 按相册 ID 缓存全量数据（含 photoList） */
  const albumCache = ref<Map<string, Album>>(new Map())
  /** 已加载完成的相册集合 */
  const loadedAlbums = ref<Set<string>>(new Set())
  /** 当前加载中的相册集合 */
  const loadingAlbums = ref<Set<string>>(new Set())

  const loading = ref(false)
  const error = ref<string>('')

  const total = computed(() => index.value.length)

  /** 所有相册的照片总数（索引项 photoCount 之和） */
  const totalPhotos = computed(() =>
    index.value.reduce((sum, a) => sum + (a.photoCount || 0), 0)
  )

  /** 启动时加载索引 */
  async function init() {
    if (index.value.length > 0 || loading.value) return
    loading.value = true
    error.value = ''
    try {
      index.value = await loadPhotosIndex()
    } catch (e: any) {
      error.value = e?.message || '相册索引加载失败'
      console.warn('[photosStore] 相册索引加载失败，可能尚未导出', e)
    } finally {
      loading.value = false
    }
  }

  /** 按需加载某个相册全量数据（含 photoList） */
  async function loadAlbum(albumId: string): Promise<Album | undefined> {
    if (!albumId) return undefined
    if (albumCache.value.has(albumId)) return albumCache.value.get(albumId)
    if (loadingAlbums.value.has(albumId)) {
      while (loadingAlbums.value.has(albumId)) {
        await new Promise(r => setTimeout(r, 50))
      }
      return albumCache.value.get(albumId)
    }
    loadingAlbums.value.add(albumId)
    try {
      const album = await loadAlbumById(albumId)
      albumCache.value.set(albumId, album)
      loadedAlbums.value.add(albumId)
      return album
    } catch (e: any) {
      console.warn(`[photosStore] 加载相册 ${albumId} 失败`, e)
      return undefined
    } finally {
      loadingAlbums.value.delete(albumId)
    }
  }

  /**
   * 根据相册 ID 获取单个相册全量数据（含 photoList）。
   * 与 loadAlbum 等价，保留以对齐其它 store 的 get*ByIndex 命名风格。
   */
  async function getAlbumById(albumId: string): Promise<Album | undefined> {
    return loadAlbum(albumId)
  }

  return {
    index,
    albumCache,
    loadedAlbums,
    loadingAlbums,
    loading,
    error,
    total,
    totalPhotos,
    init,
    loadAlbum,
    getAlbumById
  }
})
