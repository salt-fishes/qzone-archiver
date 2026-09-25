<template>
  <Teleport to="body">
    <Transition name="modal" @after-enter="trapFocus">
      <div v-if="modelValue" ref="overlayRef" class="modal-overlay" @click.self="handleOverlay">
        <div
          ref="windowRef"
          class="modal-window"
          :class="sizeClass"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <div class="modal-header">
            <div class="modal-title-wrap">
              <span v-if="kicker" class="modal-kicker">{{ kicker }}</span>
              <h3 class="modal-title">{{ title }}</h3>
            </div>
            <button ref="closeRef" class="modal-close" type="button" @click="close" aria-label="关闭">×</button>
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
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

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
const overlayRef = ref<HTMLElement | null>(null)
const windowRef = ref<HTMLElement | null>(null)
const closeRef = ref<HTMLElement | null>(null)

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function handleOverlay() {
  if (props.closeOnOverlay) close()
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return
  if (e.key === 'Escape') {
    close()
    return
  }
  // 焦点陷阱（§7）：Tab 循环限制在弹窗内
  if (e.key === 'Tab' && windowRef.value) {
    const focusables = windowRef.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

/** 打开后把焦点移入弹窗（关闭按钮）；关闭时还原焦点 */
let lastActive: HTMLElement | null = null

function trapFocus() {
  closeRef.value?.focus()
}

watch(() => props.modelValue, (v) => {
  if (v) {
    lastActive = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
    lastActive?.focus?.()
    lastActive = null
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(33, 29, 23, 0.55);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-4);
}

.modal-window {
  background: var(--paper-raised);
  border: 1px solid var(--ink);
  border-radius: var(--radius);
  /* 印刷品无阴影：层级靠遮罩压暗与墨线（§2.3） */
  max-width: 92vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-sm { width: 420px; }
.modal-md { width: 640px; }
.modal-lg { width: 960px; }

/* 弹窗动效（§3.1）：遮罩 fade + 面板 scale .98→1，--dur-2 */
.modal-enter-active {
  transition: opacity var(--dur-2) var(--ease-out);
}

.modal-leave-active {
  transition: opacity var(--dur-2) var(--ease-out);
}

.modal-enter-active .modal-window {
  transition: transform var(--dur-2) var(--ease-out);
}

.modal-leave-active .modal-window {
  transition: transform var(--dur-2) var(--ease-out);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-window,
.modal-leave-to .modal-window {
  transform: scale(0.98);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: var(--rule);
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
  color: var(--ink-muted);
  cursor: pointer;
  padding: 0 var(--sp-1);
  transition: color var(--dur-1);
}

.modal-close:hover {
  color: var(--vermilion);
}

.modal-body {
  flex: 1;
  overflow: auto;
  padding: var(--sp-4);
}

.modal-footer {
  border-top: var(--rule-dot);
  padding: var(--sp-2) var(--sp-4);
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
}

@media (max-width: 720px) {
  .modal-window,
  .modal-sm,
  .modal-md,
  .modal-lg {
    width: 100%;
  }
  .modal-overlay {
    padding: var(--sp-1);
  }
  /* 移动端扩大关闭按钮触控区域 */
  .modal-close {
    padding: var(--sp-3) var(--sp-3);
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .modal-header {
    padding: var(--sp-2) var(--sp-3);
  }
  .modal-body {
    padding: var(--sp-3);
  }
}
</style>
