<script setup lang="ts">
/** 首次启动欢迎引导（v4.6 重写：Naive UI 模态 + 三步说明） */
import { NModal, NButton } from 'naive-ui';

const show = defineModel<boolean>('show', { default: false });
const emit = defineEmits<{ done: []; tour: [] }>();

function finish() {
  window.api.config.set({ onboardingDone: true }).catch((e) => console.warn('保存引导状态失败', e));
  emit('done');
}

/** 指引式教程：关闭欢迎页并启动聚光引导 */
function startTour() {
  show.value = false;
  emit('tour');
}

const STEPS = [
  {
    title: '登录',
    desc: '使用你的 QQ 扫码登录，应用只在你自己的电脑上运行，凭证不会上传。',
    icon: 'M8 10V7a4 4 0 0 1 8 0v3 M5 10h14v10H5V10Z',
  },
  {
    title: '选择要备份的内容',
    desc: '说说、日志、相册、视频、留言等 10 类内容，按需勾选；也支持备份好友的公开内容。',
    icon: 'M4 6h16v12H4V6Z M4 10h16 M8 14h5',
  },
  {
    title: '一键备份，离线浏览',
    desc: '备份完成后生成可直接打开的网页档案，双击 index.html 即可离线浏览。',
    icon: 'M5 12l4 4 10-10 M5 20h14',
  },
];
</script>

<template>
  <NModal
    v-model:show="show"
    :auto-focus="false"
    :mask-closable="false"
  >
    <div class="welcome">
      <div class="welcome-hero">
        <span class="seal">檔</span>
        <h2>欢迎使用空间档案备份</h2>
        <p>把你的 QQ 空间记忆，完整地留在自己的电脑里</p>
      </div>

      <div class="steps">
        <div
          v-for="(s, i) in STEPS"
          :key="s.title"
          class="step"
        >
          <div class="step-no">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path :d="s.icon" />
            </svg>
          </div>
          <div>
            <div class="step-title">
              {{ i + 1 }}. {{ s.title }}
            </div>
            <div class="step-desc">
              {{ s.desc }}
            </div>
          </div>
        </div>
      </div>

      <p class="privacy">
        隐私说明：所有数据均保存到本地，应用不接入任何服务器；
        备份好友空间时仅采集对方公开内容，并会留下普通访客记录。
      </p>

      <div class="actions">
        <NButton
          tertiary
          @click="startTour()"
        >
          快速教程
        </NButton>
        <span class="flex1" />
        <NButton
          tertiary
          @click="finish()"
        >
          先逛逛
        </NButton>
        <NButton
          type="primary"
          @click="finish()"
        >
          开始使用
        </NButton>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.welcome {
  width: 460px;
  max-width: calc(100vw - 60px);
  border-radius: 16px;
  padding: 30px 32px 24px;
  background: var(--surface);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
.welcome-hero {
  text-align: center;
  margin-bottom: 20px;
}
.seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(145deg, #b5432a, #96381f);
  color: #fff;
  font-size: 24px;
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(153, 79, 49, 0.4);
  margin-bottom: 12px;
}
.welcome-hero h2 {
  margin: 0 0 6px;
  font-size: 19px;
}
.welcome-hero p {
  margin: 0;
  font-size: 13px;
  opacity: 0.6;
}
.steps {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}
.step {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.step-no {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(180, 95, 61, 0.12);
  color: #b5432a;
  flex-shrink: 0;
}
.step-no svg {
  width: 18px;
  height: 18px;
}
.step-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
}
.step-desc {
  font-size: 12.5px;
  line-height: 1.65;
  opacity: 0.65;
}
.privacy {
  margin: 0 0 18px;
  font-size: 11.5px;
  line-height: 1.7;
  opacity: 0.5;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.flex1 {
  flex: 1;
}
</style>
