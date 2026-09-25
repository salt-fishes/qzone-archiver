// 阅读密度（§4.2）：流式 / 网格，默认网格，localStorage 记忆（file:// 下可用）
import { readonly, ref } from 'vue'

export type Density = 'grid' | 'stream'

const KEY = 'archive-density'

function initial(): Density {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'stream' ? 'stream' : 'grid'
  } catch {
    return 'grid'
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
