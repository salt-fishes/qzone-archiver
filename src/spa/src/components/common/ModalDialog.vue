<template>
  <Teleport to="body">
    <Transition
      name="modal"
      @before-enter="beforeEnter"
      @enter="enter"
      @after-enter="afterEnter"
      @before-leave="beforeLeave"
      @leave="leave"
    >
      <div v-if="modelValue" class="modal-overlay" @click.self="handleOverlay">
        <div class="modal-window" :class="sizeClass">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <span v-if="kicker" class="modal-kicker">{{ kicker }}</span>
              <h3 class="modal-title">{{ title }}</h3>
            </div>
            <button class="modal-close" type="button" @click="close" aria-label="关闭">×</button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { anime, isAnimated, markAnimated, reducedMotion, staggerEnter } from '@/composables/useMotion'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  kicker?: string
  size?: 'sm' | 'md' | 'lg'
  closeOnOverlay?: boolean
}>(), {
  size: 'md',
  closeOnOverlay: true
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; close: [] }>()

const sizeClass = computed(() => `modal-${props.size}`)

// ============ anime 进出过渡 ============
function beforeEnter(el: Element) {
  if (reducedMotion()) return
  const root = el as HTMLElement
  const win = root.querySelector('.modal-window') as HTMLElement | null
  anime.set(el, { opacity: 0 })
  if (win) anime.set(win, { translateY: 24, scale: 0.97 })
  // 头部（kicker/标题/关闭钮）先隐藏，随窗口进入后滑入
  const headerKids = Array.from(root.querySelectorAll('.modal-header > *'))
  if (headerKids.length) anime.set(headerKids, { opacity: 0, translateY: 10 })
}

function enter(el: Element, done: () => void) {
  if (reducedMotion()) {
    done()
    return
  }
  const root = el as HTMLElement
  const win = root.querySelector('.modal-window') as HTMLElement | null
  anime({
    targets: el,
    opacity: 1,
    duration: 220,
    easing: 'easeOutQuad',
    complete: done
  })
  if (win) {
    anime({
      targets: win,
      translateY: 0,
      scale: 1,
      duration: 580,
      easing: 'easeOutBack',
      elasticity: 340
    })
  }
  const headerKids = Array.from(root.querySelectorAll('.modal-header > *'))
  if (headerKids.length) {
    anime({
      targets: headerKids,
      opacity: 1,
      translateY: 0,
      duration: 520,
      delay: 120,
      easing: 'easeOutCubic'
    })
  }
}

function beforeLeave(el: Element) {
  if (reducedMotion()) return
  const win = (el as HTMLElement).querySelector('.modal-window') as HTMLElement | null
  if (win) anime.set(win, { translateY: 0, scale: 1 })
}

function leave(el: Element, done: () => void) {
  if (reducedMotion()) {
    done()
    return
  }
  const win = (el as HTMLElement).querySelector('.modal-window') as HTMLElement | null
  const targets: any[] = win ? [el, win] : [el]
  anime({
    targets,
    opacity: 0,
    translateY: 12,
    scale: 0.98,
    duration: 200,
    easing: 'easeInQuad',
    complete: done
  })
}

// ============ 内容级联入场（异步内容也生效） ============
// 打开动画完成后，对 .modal-body 的直接子元素做交错浮现；
// 之后异步替换的内容（loading → 详情）由 MutationObserver 捕获，单段淡入
let bodyObserver: MutationObserver | null = null

function revealBodyChildren(body: HTMLElement) {
  const fresh = Array.from(body.children).filter(c => !isAnimated(c)) as HTMLElement[]
  if (!fresh.length) return
  staggerEnter(body, fresh, { gap: 80, translateY: 16, duration: 620 })
  fresh.forEach(markAnimated)
}

function setupBodyObserver(el: HTMLElement) {
  const body = el.querySelector('.modal-body') as HTMLElement | null
  if (!body) return
  // 初始内容（loading 提示等）
  revealBodyChildren(body)
  if (bodyObserver) bodyObserver.disconnect()
  bodyObserver = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.addedNodes.length) revealBodyChildren(body)
    })
  })
  bodyObserver.observe(body, { childList: true })
}

function teardownBodyObserver() {
  bodyObserver?.disconnect()
  bodyObserver = null
}

function afterEnter(el: Element) {
  setupBodyObserver(el as HTMLElement)
}

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function handleOverlay() {
  if (props.closeOnOverlay) close()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) close()
}

watch(() => props.modelValue, (v) => {
  if (v) {
    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
    teardownBodyObserver()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
  teardownBodyObserver()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 22, 18, 0.72);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-5);
  backdrop-filter: blur(2px);
}

.modal-window {
  background: var(--paper);
  border: var(--line-double);
  box-shadow: 8px 8px 0 var(--ink);
  max-width: 92vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-sm { width: 420px; }
.modal-md { width: 640px; }
.modal-lg { width: 960px; }

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: var(--line);
  background: rgba(255, 255, 255, 0.25);
}

.modal-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.modal-kicker {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--vermilion);
}

.modal-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--ink);
  word-break: break-word;
}

.modal-close {
  font-family: var(--font-display);
  font-size: 1.6rem;
  line-height: 1;
  background: transparent;
  border: none;
  color: var(--ink-2);
  cursor: pointer;
  padding: 0 var(--sp-2);
  transition: color 0.15s;
}

.modal-close:hover {
  color: var(--vermilion);
}

.modal-body {
  flex: 1;
  overflow: auto;
  padding: var(--sp-5);
}

.modal-footer {
  border-top: var(--line-dot);
  padding: var(--sp-3) var(--sp-5);
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-3);
}

@media (max-width: 720px) {
  .modal-window,
  .modal-sm,
  .modal-md,
  .modal-lg {
    width: 100%;
  }
  .modal-overlay {
    padding: var(--sp-2);
  }
  /* 移动端扩大关闭按钮触控区域 */
  .modal-close {
    padding: var(--sp-3) var(--sp-4);
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .modal-header {
    padding: var(--sp-3) var(--sp-4);
  }
  .modal-body {
    padding: var(--sp-4);
  }
}
</style>
