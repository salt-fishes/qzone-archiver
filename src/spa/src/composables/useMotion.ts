/**
 * 统一动画工具 —— 基于 anime.js v3
 *
 * 设计原则（细节但不夸张）：
 *   - 入场：轻微上浮 + 淡入（8-16px），easeOutCubic 类缓动，短时长
 *   - 仅首次出现播放一次（marked 防重 + IntersectionObserver 一次性触发）
 *   - 尊重 prefers-reduced-motion：检测到「减少动态效果」时跳过动画直接落位
 *   - 组件卸载时统一 anime.remove 清理
 */
import anime from 'animejs'

// 页面隐藏时暂停动画，避免后台空转
anime.suspendWhenDocumentHidden = true

export type AnimeInstance = anime.AnimeInstance

/** 用户是否开启「减少动态效果」 */
export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** 同步设置初始态（在元素插入后立即调用，避免首帧闪烁） */
export function setFrom(el: any, props: Record<string, any>) {
  anime.set(el, props)
}

/** 单元素入场：opacity + 上浮 + 可选轻微缩放 */
export function enter(
  el: any,
  opts: { duration?: number; translateY?: number; scale?: number; delay?: number; ease?: string } = {}
): AnimeInstance | null {
  const { duration = 760, translateY = 22, scale = 1, delay = 0, ease = 'easeOutCubic' } = opts
  if (reducedMotion()) {
    anime.set(el, { opacity: 1, translateY: 0, scale: 1 })
    return null
  }
  setFrom(el, { opacity: 0, translateY, scale })
  return anime({ targets: el, opacity: 1, translateY: 0, scale: 1, duration, delay, easing: ease })
}

/** 容器内一组元素交错入场（selector 为 Element 数组或字符串） */
export function staggerEnter(
  container: any,
  selector: any,
  opts: { duration?: number; translateY?: number; scale?: number; delay?: number; gap?: number; ease?: string } = {}
): AnimeInstance | null {
  const els = typeof selector === 'string'
    ? Array.from(container.querySelectorAll(selector))
    : Array.from(selector || [])
  if (!els.length) return null
  const { duration = 700, translateY = 20, scale = 1, delay = 0, gap = 90, ease = 'easeOutCubic' } = opts
  if (reducedMotion()) {
    anime.set(els, { opacity: 1, translateY: 0, scale: 1 })
    return null
  }
  setFrom(els, { opacity: 0, translateY, scale })
  return anime({
    targets: els,
    opacity: 1,
    translateY: 0,
    scale: 1,
    duration,
    delay: anime.stagger(gap, { start: delay, from: 'first' }),
    easing: ease
  })
}

/** 已播放过入场动画的标记（防重播） */
export function markAnimated(el: any) {
  if (el) el.dataset.motionDone = '1'
}

export function isAnimated(el: any): boolean {
  return !!el?.dataset?.motionDone
}

/**
 * 数字滚动（innerHTML 插值）—— 用于统计数字 countUp
 * 需要元素初始可见（opacity 不归零），仅滚动数字本身
 * format 可返回 HTML（如千位分隔 + <em> 强调），内部数字来自本地数据，无注入风险
 */
export function countUp(
  el: any,
  to: number,
  opts: { duration?: number; delay?: number; format?: (n: number) => string } = {}
): AnimeInstance | null {
  const { duration = 1000, delay = 0, format = (n: number) => String(n) } = opts
  if (reducedMotion() || typeof to !== 'number') {
    el.innerHTML = format(to)
    return null
  }
  const obj = { v: 0 }
  return anime({
    targets: obj,
    v: to,
    duration,
    delay,
    easing: 'easeOutCubic',
    update: () => {
      el.innerHTML = format(Math.round(obj.v))
    }
  })
}

/**
 * 滚动进入视口时一次性触发 onEnter（用于年报章节等长页面元素）
 * 返回清理函数
 */
export function scrollReveal(
  el: any,
  onEnter: () => void,
  opts: { threshold?: number; rootMargin?: string } = {}
): () => void {
  if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
    onEnter()
    return () => {}
  }
  const { threshold = 0.1, rootMargin = '0px 0px -6% 0px' } = opts
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      io.disconnect()
      onEnter()
    }
  }, { threshold, rootMargin })
  io.observe(el)
  return () => io.disconnect()
}

/** 组件卸载时统一清理目标上的动画 */
export function removeAnimations(targets: any) {
  anime.remove(targets)
}

export { anime }
