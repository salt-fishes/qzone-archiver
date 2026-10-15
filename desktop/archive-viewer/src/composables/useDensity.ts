// 阅读密度（§4.2）：流式 / 网格，默认流式，localStorage 记忆（file:// 下可用）
import { readonly, ref } from 'vue'

export type Density = 'grid' | 'stream'

const KEY = 'archive-density'

function initial(): Density {
  try {
    const v = localStorage.getItem(KEY)
    // 默认流式；仅当用户显式保存过 'grid' 时保持网格（未设置/未知值/'stream' → 流式）
    return v === 'grid' ? 'grid' : 'stream'
  } catch {
    return 'stream'
  }
}

const density = ref<Density>(initial())

export function useDensity() {
  function set(next: Density): void {
    density.value = next
    try { localStorage.setItem(KEY, next) } catch { /* file:// 某些环境禁写，忽略 */ }
  }
  function toggle(): void {
    set(density.value === 'grid' ? 'stream' : 'grid')
  }
  return { density: readonly(density), set, toggle }
}
