// LightGallery 初始化 hook
// 使用静态导入而非动态 import()，因为 IIFE bundle 格式下动态 import()
// 会因 "Failed to resolve module specifier" 而失败
// 静态导入在 Vite 构建时会被正确打包到 IIFE bundle 中
import { ref, onBeforeUnmount } from 'vue'
import lightgallery from 'lightgallery'
import lgZoom from 'lightgallery/plugins/zoom'
import lgVideo from 'lightgallery/plugins/video'
import lgThumbnail from 'lightgallery/plugins/thumbnail'
import lgRotate from 'lightgallery/plugins/rotate'
import lgFullscreen from 'lightgallery/plugins/fullscreen'
import lgAutoplay from 'lightgallery/plugins/autoplay'

/**
 * 在指定 DOM 容器上初始化 LightGallery
 * - 自动销毁：组件卸载时自动 destroy，避免内存泄漏
 */
export function useLightGallery() {
  let instance: any = null
  const ready = ref(false)

  function init(el: HTMLElement) {
    if (instance) return
    instance = lightgallery(el, {
      plugins: [lgZoom, lgVideo, lgThumbnail, lgRotate, lgFullscreen, lgAutoplay],
      speed: 300,
      videojs: false,
      thumbnail: true,
      download: false,
      addClass: 'lg-theme-archive'
    })
    ready.value = true
  }

  function destroy() {
    if (instance) {
      instance.destroy()
      instance = null
      ready.value = false
    }
  }

  onBeforeUnmount(destroy)

  return { init, destroy, ready }
}
