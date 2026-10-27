<script setup lang="ts">
/** 应用顶栏（v4.6）：引擎连接状态 + 主题切换 + 登录态（头像下拉） */
import { computed } from 'vue';
import { NTag, NButton, NDropdown, useDialog, useMessage } from 'naive-ui';
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
const message = useMessage();

/** §D：三选主题下拉，当前项打勾 */
const themeOptions = computed(() => [
  { label: `${appearance.theme === 'auto' ? '✓ ' : ''}跟随系统`, key: 'auto' },
  { label: `${appearance.theme === 'light' ? '✓ ' : ''}浅色`, key: 'light' },
  { label: `${appearance.theme === 'dark' ? '✓ ' : ''}深色`, key: 'dark' },
]);
const themeTitle = computed(() =>
  appearance.theme === 'auto'
    ? `当前：跟随系统（${appearance.resolvedTheme === 'dark' ? '深色' : '浅色'}）`
    : `当前：${appearance.resolvedTheme === 'dark' ? '深色' : '浅色'}`
);

function confirmLogout() {
  dialog.warning({
    title: '退出登录？',
    content: '退出后需重新扫码才能备份；本地已备份的数据不受影响。',
    positiveText: '退出登录',
    negativeText: '再想想',
    onPositiveClick: async () => {
      // §B⑤：备份进行中主进程拒绝退出并给出原因
      const r = await auth.logout();
      if (r?.error) message.warning(r.error);
    },
  });
}

const userOptions = [
  { label: '打开 QQ 空间页面', key: 'engine' },
  { label: '退出登录', key: 'logout' },
];

function onUserAction(key: string) {
  // v5.5 M0：「打开 QQ 空间页面」直接置前引擎窗（不弹扫码前提示——那是「扫码登录」的语义）
  if (key === 'engine') auth.openEngine();
  if (key === 'logout') confirmLogout();
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <!-- v5.5 M0 六态：stalled（黄点·无响应）/ ready（已连接）/ loading（连接中）/ idle·closed（未连接·点击重试）/ crashed（连接失败·点击重试） -->
      <NTag
        v-if="bk.stalled"
        size="small"
        type="warning"
        round
        :bordered="false"
        style="cursor: pointer"
        title="备份长时间无引擎心跳，疑似停滞。可尝试重连；若日志无输出请取消后重新发起备份"
        @click="bk.retryEngine()"
      >
        <template #icon>
          <span class="dot off" />
        </template>
        无响应 · 点击重连
      </NTag>
      <NTag
        v-else-if="bk.engineState === 'ready'"
        size="small"
        type="success"
        round
        :bordered="false"
      >
        <template #icon>
          <span class="dot on" />
        </template>
        已连接
      </NTag>
      <NTag
        v-else-if="bk.engineState === 'loading'"
        size="small"
        round
        :bordered="false"
        type="default"
      >
        <template #icon>
          <span class="dot off" />
        </template>
        连接中…
      </NTag>
      <NTag
        v-else
        size="small"
        type="error"
        round
        :bordered="false"
        style="cursor: pointer"
        :title="bk.engineStateReason || (bk.engineState === 'crashed' ? '引擎连接失败' : 'QQ 空间窗口未打开')"
        @click="bk.retryEngine()"
      >
        {{ bk.engineState === 'crashed' ? '连接失败 · 点击重试' : '未连接 · 点击重试' }}
      </NTag>
    </div>

    <div class="header-right">
      <span class="ver">v{{ version }}</span>
      <!-- §D：三选下拉（浅色/深色/跟随系统），当前项打勾；图标按实际生效主题显示 -->
      <NDropdown
        :options="themeOptions"
        trigger="click"
        size="small"
        @select="appearance.setTheme($event as any)"
      >
        <NButton
          quaternary
          circle
          size="small"
          :title="themeTitle"
        >
          <template #icon>
            <svg
              v-if="appearance.resolvedTheme === 'light'"
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
              <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 7.5 7.5 0 1 0 20 13.5Z" />
            </svg>
          </template>
        </NButton>
      </NDropdown>

      <template v-if="auth.auth.loggedIn">
        <NDropdown
          :options="userOptions"
          trigger="click"
          @select="onUserAction"
        >
          <button
            class="user-chip"
            :title="auth.auth.qqNumber ? `QQ ${auth.auth.qqNumber}` : ''"
          >
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
