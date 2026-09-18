<script setup lang="ts">
/**
 * §H：未登录首页打字机文案（反馈 #11）
 * 打字 → 停留 → 删字 → 下一条，循环；末尾细光标闪烁。
 * 降级与可访问性：
 *  - prefers-reduced-motion: reduce → 静态显示第一条（不逐字）
 *  - document.hidden 暂停（visibilitychange 恢复）；卸载清定时器
 *  - aria-label 固定第一条完整文案、aria-live="off"（避免读屏逐字念）
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { createTypewriter } from '../../utils/typewriter';

const props = withDefaults(
  defineProps<{
    phrases: string[];
    typeMs?: number;
    holdMs?: number;
    deleteMs?: number;
    startDelay?: number;
  }>(),
  { typeMs: 70, holdMs: 1400, deleteMs: 35, startDelay: 300 }
);

const text = ref('');
const reducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let timer: ReturnType<typeof setTimeout> | undefined;
let waitingVisible = false;
let machine: ReturnType<typeof createTypewriter> | null = null;

function run() {
  if (!machine) return;
  if (typeof document !== 'undefined' && document.hidden) {
    // 页面不可见暂停，回到可见后继续（once 自动清理）
    if (!waitingVisible) {
      waitingVisible = true;
      document.addEventListener('visibilitychange', onVisibility, { once: true });
    }
    return;
  }
  waitingVisible = false;
  const delay = machine.step();
  text.value = machine.text;
  timer = setTimeout(run, delay);
}

function onVisibility() {
  if (!document.hidden) run();
}

onMounted(() => {
  if (reducedMotion || !props.phrases.length) {
    text.value = props.phrases[0] || '';
    return;
  }
  machine = createTypewriter(props.phrases, {
    typeMs: props.typeMs,
    holdMs: props.holdMs,
    deleteMs: props.deleteMs,
    startDelay: props.startDelay,
  });
  timer = setTimeout(run, props.startDelay);
});

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
  if (waitingVisible && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility);
  }
});
</script>

<template>
  <span
    class="typewriter"
    :aria-label="phrases[0] || ''"
    aria-live="off"
  >
    <span aria-hidden="true">{{ text }}</span><span
      class="tw-caret"
      aria-hidden="true"
    />
  </span>
</template>

<style scoped>
.typewriter {
  display: inline-flex;
  align-items: baseline;
}
.tw-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 3px;
  background: currentColor;
  opacity: 0.75;
  animation: tw-blink 1s steps(1) infinite;
}
@keyframes tw-blink {
  50% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tw-caret {
    animation: none;
  }
}
</style>
