<script setup lang="ts">
/**
 * 指引式教程（v4.6）：聚光高亮 + 分步气泡引导
 * 按选择器依次高亮页面元素，目标缺失自动跳过；完成后标记 onboardingDone
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { NButton } from 'naive-ui';

const show = defineModel<boolean>('show', { default: false });
const emit = defineEmits<{ done: [] }>();

const STEPS = [
  {
    sel: '.nav',
    title: '功能导航',
    desc: '新建任务、我的档案、设置都在左侧，备份相关的所有操作从这里开始。',
  },
  {
    sel: '.header-right',
    title: '登录与外观',
    desc: '右上角可以扫码登录、切换深浅色主题。备份前需要先登录 QQ 空间。',
  },
  {
    sel: '.hero-actions',
    title: '开始备份',
    desc: '点「开始备份」，选择备份谁的空间和要备份的内容，三步完成。',
  },
  {
    sel: '.nav-item[href="#/archives"]',
    title: '我的档案',
    desc: '备份完成后生成离线档案，在这里可以随时打开浏览或压缩分享。',
  },
];

const stepIndex = ref(0);
const rect = ref<{ top: number; left: number; width: number; height: number } | null>(null);

const step = computed(() => STEPS[stepIndex.value] || null);

/** 气泡位置：目标下方优先，放不下放上方 */
const bubblePos = computed(() => {
  if (!rect.value) return { top: 0, left: 0, place: 'bottom' as const };
  const { top, left, width, height } = rect.value;
  const place = top + height + 150 > window.innerHeight ? 'top' : 'bottom';
  return {
    top: place === 'bottom' ? top + height + 14 : Math.max(14, top - 14),
    left: Math.max(16, Math.min(left + width / 2, window.innerWidth - 16)),
    place,
  };
});

function locate() {
  if (!step.value) return;
  const el = document.querySelector(step.value.sel) as HTMLElement | null;
  if (!el) {
    // 目标缺失（如在非首页步骤页）：跳过该步
    nextStep();
    return;
  }
  const r = el.getBoundingClientRect();
  const pad = 8;
  rect.value = {
    top: Math.max(0, r.top - pad),
    left: Math.max(0, r.left - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

function nextStep() {
  if (stepIndex.value < STEPS.length - 1) {
    stepIndex.value++;
    nextTick(locate);
  } else {
    finish();
  }
}

function prevStep() {
  if (stepIndex.value > 0) {
    stepIndex.value--;
    nextTick(locate);
  }
}

function finish() {
  show.value = false;
  window.api.config.set({ onboardingDone: true }).catch(() => {});
  emit('done');
}

function onKey(e: KeyboardEvent) {
  if (!show.value) return;
  if (e.key === 'Escape') finish();
  if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep();
  if (e.key === 'ArrowLeft') prevStep();
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', locate);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', locate);
});

// 打开时定位第一步
watch(show, (v) => {
  if (v) {
    stepIndex.value = 0;
    nextTick(locate);
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show && rect"
        class="tour-mask"
        @click.self="finish()"
      >
        <!-- 聚光框 -->
        <div
          class="spotlight"
          :style="{
            top: rect.top + 'px',
            left: rect.left + 'px',
            width: rect.width + 'px',
            height: rect.height + 'px',
          }"
        />
        <!-- 气泡 -->
        <div
          class="bubble"
          :class="bubblePos.place"
          :style="{ top: bubblePos.top + 'px', left: bubblePos.left + 'px' }"
        >
          <div class="b-step">{{ stepIndex + 1 }} / {{ STEPS.length }}</div>
          <div class="b-title">{{ step?.title }}</div>
          <div class="b-desc">{{ step?.desc }}</div>
          <div class="b-actions">
            <NButton
              size="tiny"
              quaternary
              @click="finish()"
            >
              跳过
            </NButton>
            <span class="flex1" />
            <NButton
              v-if="stepIndex > 0"
              size="small"
              quaternary
              @click="prevStep"
            >
              上一步
            </NButton>
            <NButton
              size="small"
              type="primary"
              round
              @click="nextStep"
            >
              {{ stepIndex === STEPS.length - 1 ? '完成' : '下一步' }}
            </NButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tour-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
}
.spotlight {
  position: fixed;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  border: 2px solid rgba(180, 95, 61, 0.9);
  pointer-events: none;
  transition: all 0.25s var(--ease-out);
}
.bubble {
  position: fixed;
  transform: translateX(-50%);
  width: 320px;
  max-width: calc(100vw - 32px);
  border-radius: 12px;
  padding: 14px 16px 12px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  z-index: 3001;
}
.bubble.bottom {
  margin-top: 0;
}
.bubble.top {
  transform: translate(-50%, -100%);
}
.b-step {
  font-size: 11px;
  opacity: 0.45;
  margin-bottom: 4px;
}
.b-title {
  font-size: 14.5px;
  font-weight: 700;
  margin-bottom: 4px;
}
.b-desc {
  font-size: 12.5px;
  line-height: 1.7;
  opacity: 0.7;
}
.b-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.flex1 {
  flex: 1;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--dur-mid) ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
