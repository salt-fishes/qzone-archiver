// 动效统一入口（v5.2 设计 §3.3 降级规则）
// 全系统动效一律经本 composable 取时长/缓动/错峰值——
// 组件与 animejs/motion-v 调用处禁止写死毫秒数或缓动曲线（守卫测试）。
import { onMounted, onUnmounted, readonly, ref } from 'vue'
import type { Ref } from 'vue'

/** 系统「减少动态效果」偏好（响应式，全模块共享一个 matchMedia） */
const reduced = ref(false)
let media: MediaQueryList | null = null
let listener: ((e: MediaQueryListEvent) => void) | null = null

function ensureMedia(): void {
  if (media || typeof window === 'undefined' || !window.matchMedia) return
  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced.value = media.matches
  listener = (e) => { reduced.value = e.matches }
  media.addEventListener('change', listener)
}

/** 页面可见性（rAF 类动画在 document.hidden 时暂停） */
const pageVisible = ref(true)
let visListener: (() => void) | null = null

function ensureVisibility(): void {
  if (visListener || typeof document === 'undefined') return
  pageVisible.value = !document.hidden
  visListener = () => { pageVisible.value = !document.hidden }
  document.addEventListener('visibilitychange', visListener)
}

type DurToken = 'dur-1' | 'dur-2' | 'dur-3' | 'dur-4'

function readVarMs(varName: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const ms = Number.parseFloat(raw)
  return Number.isFinite(ms) ? ms : fallback
}

function readVar(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return raw || fallback
}

export interface Motion {
  /** 是否处于「减少动态效果」——为 true 时所有动效直切（时长 0） */
  readonly reduced: Readonly<Ref<boolean>>
  /** 页面是否可见 */
  readonly visible: Readonly<Ref<boolean>>
  /** 动效时长（ms）：reduced 时一律返回 0（直切） */
  dur: (token: DurToken) => number
  /** 列表逐卡错峰间隔（ms）：reduced 时返回 0 */
  stagger: () => number
  /** 缓动曲线：out=入场 / sweep=扫版 */
  ease: (kind: 'out' | 'sweep') => string
}

export function useMotion(): Motion {
  onMounted(() => { ensureMedia(); ensureVisibility() })
  onUnmounted(() => {
    if (media && listener) { media.removeEventListener('change', listener); listener = null }
    if (visListener) { document.removeEventListener('visibilitychange', visListener); visListener = null }
  })

  const r = reduced
  return {
    reduced: readonly(r),
    visible: readonly(pageVisible),
    dur: (token) => (r.value ? 0 : readVarMs(`--${token}`, { 'dur-1': 120, 'dur-2': 240, 'dur-3': 320, 'dur-4': 560 }[token])),
    stagger: () => (r.value ? 0 : readVarMs('--stagger-step', 60)),
    ease: (kind) => readVar(kind === 'out' ? '--ease-out' : '--ease-sweep',
      kind === 'out' ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.65, 0, 0.35, 1)'),
  }
}

/** 非 composable 场景（纯函数/工具内）读取降级状态；模块加载时同步一次 */
export function prefersReducedMotion(): boolean {
  ensureMedia()
  return reduced.value
}
