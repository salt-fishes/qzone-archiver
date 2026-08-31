<script setup lang="ts">
/** 首次启动欢迎引导（P4.3 自 App.vue 拆出）
 *  完成时写入 onboardingDone 标记；帮助链接经 open-help 事件交由 App.vue 切换到帮助中心
 */
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-help', tab: 'guide' | 'faq' | 'privacy'): void;
}>();

async function finish() {
  emit('close');
  try {
    await window.api.config.set({ onboardingDone: true });
  } catch (e) {
    console.warn('保存首次启动标记失败', e);
  }
}
</script>

<template>
  <div class="overlay">
    <div class="welcome">
      <div class="welcome-brand">
        <span class="seal big">檔</span>
        <div>
          <h2 class="welcome-title">
            欢迎使用 QQ空间档案备份
          </h2>
          <p class="welcome-sub">
            将你的 QQ 空间数据完整保存在本地，随时浏览、永不丢失
          </p>
        </div>
      </div>
      <div class="welcome-steps">
        <div class="wstep">
          <span class="wstep-num">1</span>
          <div>
            <strong>扫码登录</strong>
            <p>点击右上角「扫码登录」，用手机 QQ 扫码授权，即可开始备份你的空间</p>
          </div>
        </div>
        <div class="wstep">
          <span class="wstep-num">2</span>
          <div>
            <strong>选择备份内容</strong>
            <p>勾选要备份的模块（说说 / 日志 / 相册 / 视频…），可在设置中调整备份类型与获取选项</p>
          </div>
        </div>
        <div class="wstep">
          <span class="wstep-num">3</span>
          <div>
            <strong>开始备份</strong>
            <p>选择保存位置并点击「开始备份」，助手自动采集数据并将多媒体下载到目标目录</p>
          </div>
        </div>
        <div class="wstep">
          <span class="wstep-num">4</span>
          <div>
            <strong>浏览备份</strong>
            <p>备份完成后打开目标目录，双击 index.html 即可离线浏览全部内容</p>
          </div>
        </div>
      </div>
      <div class="welcome-foot">
        <div class="welcome-links">
          <button
            class="link-btn"
            @click="emit('open-help', 'guide')"
          >
            新手教程
          </button>
          <button
            class="link-btn"
            @click="emit('open-help', 'faq')"
          >
            常见问题
          </button>
          <button
            class="link-btn"
            @click="emit('open-help', 'privacy')"
          >
            隐私政策
          </button>
        </div>
        <button
          class="btn primary"
          @click="finish"
        >
          开始使用
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(50, 40, 28, 0.5);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 36px 16px; z-index: 100;
}
.welcome {
  background: var(--card); border-radius: 14px; max-width: 600px; width: 100%;
  padding: 26px 28px; box-shadow: 0 14px 48px rgba(40, 30, 15, 0.32);
  animation: fadeUp 0.35s ease both;
}
.welcome-brand { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.seal.big { width: 52px; height: 52px; font-size: 26px; }
.welcome-title { margin: 0; font-family: Georgia, 'STZhongsong', 'SimSun', serif; color: var(--accent-deep); font-size: 20px; letter-spacing: 1px; }
.welcome-sub { margin: 6px 0 0; font-size: 13px; color: var(--ink-soft); }
.welcome-steps { display: flex; flex-direction: column; gap: 14px; margin-bottom: 22px; }
.wstep { display: flex; gap: 12px; }
.wstep-num {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  background: var(--accent); color: #fbe9d8; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  font-family: Consolas, monospace;
}
.wstep strong { font-size: 14px; color: var(--ink); }
.wstep p { margin: 3px 0 0; font-size: 12.5px; color: var(--ink-soft); line-height: 1.6; }
.welcome-foot {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 16px; border-top: 1px solid var(--line-soft);
}
.welcome-links { display: flex; gap: 14px; }
</style>
