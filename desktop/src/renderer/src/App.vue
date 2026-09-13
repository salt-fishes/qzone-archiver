<script setup lang="ts">
/**
 * 应用壳（v4.6 C 端化全量改版）
 * 左侧导航 + 顶栏（连接状态/主题/登录态）+ 视图路由；Naive UI 主题系统 + zhCN 本地化
 */
import { ref, computed, watch, watchEffect, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { NConfigProvider, NDialogProvider, NMessageProvider, NGlobalStyle, darkTheme, dateZhCN, zhCN } from 'naive-ui';
import type { GlobalTheme } from 'naive-ui';
import AppSidebar from './components/layout/AppSidebar.vue';
import AppHeader from './components/layout/AppHeader.vue';
import WelcomeModal from './components/onboarding/WelcomeModal.vue';
import HelpModal from './components/onboarding/HelpModal.vue';
import TourOverlay from './components/onboarding/TourOverlay.vue';
import { lightThemeOverrides, darkThemeOverrides } from './theme';
import { useAuthStore } from './stores/auth';
import { useBackupStore } from './stores/backup';
import { useConfigStore } from './stores/config';
import { useAppearanceStore } from './stores/appearance';

const { refresh: refreshAuth, initAuth } = useAuthStore();
const appearance = useAppearanceStore();

/** 备份 store（引擎就绪标记 + 事件订阅（应用级）） */
const bk = useBackupStore();
const { engineReady, engineFailed } = storeToRefs(bk);
const { pushLog, initBackup } = bk;

const cfgStore = useConfigStore();

const appInfo = ref<{ version: string; platform: string }>({ version: '', platform: '' });
const showWelcome = ref(false);
const showHelp = ref(false);
const showTour = ref(false);

const naiveTheme = computed<GlobalTheme | null>(() => (appearance.theme === 'dark' ? darkTheme : null));
const themeOverrides = computed(() => (appearance.theme === 'dark' ? darkThemeOverrides : lightThemeOverrides));

// 自定义面板（非 Naive 组件）通过 tokens.scss 的 --surface 变量跟随主题，html.dark 为其切换开关
watchEffect(() => {
  document.documentElement.classList.toggle('dark', appearance.theme === 'dark');
});

/** 引擎加载超时兜底：20s 仍未就绪 → 提示连接失败并允许重试 */
let engineTimer: number | undefined;
watch(engineReady, (ready) => {
  window.clearTimeout(engineTimer);
  if (!ready) {
    engineTimer = window.setTimeout(() => {
      if (!engineReady.value) engineFailed.value = true;
    }, 20000);
  }
});

onMounted(async () => {
  window.api.app.getInfo().then((i) => (appInfo.value = i));

  // 主题（浅/深，持久化于应用配置）
  await appearance.initAppearance();

  // 恢复配置（targetDir/模块勾选/引擎设置/相册选择，收口在 stores/config.ts）
  await cfgStore.initConfig();
  // 首次启动：展示欢迎引导
  try {
    const c = await window.api.config.get();
    if (!c?.onboardingDone) showWelcome.value = true;
  } catch (e) {
    console.warn('读取配置失败', e);
  }

  // 登录态：订阅变更 + 主动刷新（订阅收口在 stores/auth.ts）
  initAuth();
  await refreshAuth();

  // 备份/下载事件订阅（应用级：engine-ready 等启动期广播不依赖当前视图；收口在 stores/backup.ts）
  initBackup();

  // 启动日志（填充初始内容）
  pushLog('info', '═══════════════════════════════════');
  pushLog('info', '  QQ空间档案备份 v' + appInfo.value.version);
  pushLog('info', '  启动完成，正在加载引擎窗口...');
  pushLog('info', '═══════════════════════════════════');
});

onBeforeUnmount(() => {
  bk.disposeBackup();
});
</script>

<template>
  <NConfigProvider
    class="app-provider"
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <NGlobalStyle />
    <NMessageProvider
      placement="top"
      :duration="3200"
    >
      <NDialogProvider>
        <div class="app-shell">
          <AppSidebar @help="showHelp = true" />
          <div class="app-main">
            <AppHeader :version="appInfo.version" />
            <main class="app-content app-scroll">
              <router-view v-slot="{ Component }">
                <Transition
                  name="route"
                  mode="out-in"
                >
                  <component :is="Component" />
                </Transition>
              </router-view>
            </main>
          </div>
        </div>

        <WelcomeModal
          v-model:show="showWelcome"
          @tour="showTour = true"
        />
        <HelpModal
          v-model:show="showHelp"
          @tour="showTour = true"
        />
        <TourOverlay v-model:show="showTour" />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
}
.app-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 26px 30px 40px;
}
.app-content > * {
  max-width: 980px;
  margin-left: auto;
  margin-right: auto;
}
</style>
