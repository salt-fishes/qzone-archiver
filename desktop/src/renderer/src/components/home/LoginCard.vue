<script setup lang="ts">
/** 登录卡片（S2 概览）：未登录时的唯一焦点，引导扫码登录 */
import { useAuthStore } from '../../stores/auth';

const { login } = useAuthStore();
</script>

<template>
  <section class="panel login-card">
    <span class="seal big">檔</span>
    <div class="lc-body">
      <h3 class="lc-title">
        欢迎使用 QQ空间档案备份
      </h3>
      <p class="lc-sub">
        把十几年的 QQ 空间记忆——说说、日志、相册、视频——完整搬回你的电脑，随时回看，永不丢失。
      </p>
      <button
        class="btn primary lc-btn"
        @click="login"
      >
        扫码登录
      </button>
      <p class="lc-hint">
        登录后用手机 QQ 扫码授权，即可开始备份你的空间
      </p>
    </div>
  </section>
</template>

<style scoped>
.login-card {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  background:
    linear-gradient(160deg, rgba(154, 83, 54, 0.06), rgba(154, 83, 54, 0)) 0 0 / cover,
    var(--card);
  padding: 24px 26px;
}
.lc-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.lc-title {
  margin: 0;
  font-family: Georgia, 'STZhongsong', 'SimSun', serif;
  font-size: 19px;
  letter-spacing: 1px;
  color: var(--accent-deep);
}
.lc-sub {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  color: var(--ink-soft);
}
.lc-btn {
  margin-top: 4px;
  padding: 10px 30px;
  font-size: 14px;
}
.lc-hint {
  margin: 0;
  font-size: 12px;
  color: var(--ink-soft);
}
</style>
