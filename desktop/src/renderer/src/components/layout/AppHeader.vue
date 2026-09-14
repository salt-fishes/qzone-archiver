<script setup lang="ts">
/** 应用顶栏（v4.6）：引擎连接状态 + 主题切换 + 登录态（头像下拉） */
import { NTag, NButton, NDropdown, useDialog } from 'naive-ui';
import { useAuthStore } from '../../stores/auth';
import { useAppearanceStore } from '../../stores/appearance';
import { useBackupStore } from '../../stores/backup';
import EmoticonText from '../common/EmoticonText.vue';
import TargetAvatar from '../common/TargetAvatar.vue';

defineProps<{ version: string }>();

const auth = useAuthStore();
const appearance = useAppearanceStore();
const bk = useBackupStore();
const dialog = useDialog();

function confirmLogout() {
  dialog.warning({
    title: '退出登录？',
    content: '退出后需重新扫码才能备份；本地已备份的数据不受影响。',
    positiveText: '退出登录',
    negativeText: '再想想',
    onPositiveClick: () => auth.logout(),
  });
}

const userOptions = [
  { label: '打开 QQ 空间页面', key: 'engine' },
  { label: '退出登录', key: 'logout' },
];

function onUserAction(key: string) {
  // 走 store 的 login()：会先给出「打开 QQ 空间前的注意事项」提示（v4.7 反馈 ⑤）
  if (key === 'engine') auth.login();
  if (key === 'logout') confirmLogout();
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <NTag
        v-if="bk.engineFailed"
        size="small"
        type="error"
        round
        :bordered="false"
        style="cursor: pointer"
        @click="bk.retryEngine()"
      >
        连接失败 · 点击重试
      </NTag>
      <NTag
        v-else
        size="small"
        round
        :bordered="false"
        :type="bk.engineReady ? 'success' : 'default'"
      >
        <template #icon>
          <span
            class="dot"
            :class="bk.engineReady ? 'on' : 'off'"
          />
        </template>
        {{ bk.engineReady ? '已连接' : '连接中…' }}
      </NTag>
    </div>

    <div class="header-right">
      <span class="ver">v{{ version }}</span>
      <NButton
        quaternary
        circle
        size="small"
        :title="appearance.theme === 'light' ? '切换深色' : '切换浅色'"
        @click="appearance.toggleTheme()"
      >
        <template #icon>
          <svg
            v-if="appearance.theme === 'light'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            width="17"
            height="17"
          >
            <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 7.5 7.5 0 1 0 20 13.5Z" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            width="17"
            height="17"
          >
            <circle
              cx="12"
              cy="12"
              r="4"
            />
            <path d="M12 2.5v2.5 M12 19v2.5 M2.5 12H5 M19 12h2.5 M5 5l1.8 1.8 M17.2 17.2 19 19 M19 5l-1.8 1.8 M6.8 17.2 5 19" />
          </svg>
        </template>
      </NButton>

      <template v-if="auth.auth.loggedIn">
        <NDropdown
          :options="userOptions"
          trigger="click"
          @select="onUserAction"
        >
          <button class="user-chip">
            <!-- v4.7.5：头像统一走 TargetAvatar（主进程本地缓存 → data URL）。
                 直连 qlogo 外链会被 CSP 拦掉且离线不可用；文字占位也不能放 NAvatar
                 默认插槽（会覆盖 src，导致永远只显示文字头像）。 -->
            <TargetAvatar
              :uin="auth.auth.qqNumber"
              :label="auth.auth.nickname || auth.auth.qqNumber"
              :size="26"
            />
            <span class="user-name">
              <EmoticonText
                :text="auth.auth.nickname"
                :size="15"
              />
              <template v-if="!auth.auth.nickname">{{ auth.auth.qqNumber }}</template>
            </span>
          </button>
        </NDropdown>
      </template>
      <template v-else>
        <NButton
          size="small"
          type="primary"
          round
          @click="auth.login()"
        >
          扫码登录
        </NButton>
      </template>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-h);
  padding: 0 22px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--surface-border);
}
.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.dot.on {
  background: #18a058;
}
.dot.off {
  background: #f0a020;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
.ver {
  font-size: 12px;
  opacity: 0.45;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: none;
  padding: 4px 6px;
  border-radius: 999px;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.user-chip:hover {
  background: var(--surface-soft);
}
.user-name {
  font-size: 13px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
