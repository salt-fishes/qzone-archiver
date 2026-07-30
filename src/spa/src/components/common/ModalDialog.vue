<template>
  <Teleport to="body">
    <Transition name="modal">
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-window,
.modal-leave-active .modal-window {
  transition: transform 0.25s var(--ease-out), opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-window,
.modal-leave-to .modal-window {
  transform: translateY(16px) scale(0.98);
  opacity: 0;
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
