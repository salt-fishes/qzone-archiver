<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import TopBar from './components/layout/TopBar.vue';
import SideNav from './components/layout/SideNav.vue';
import ConfirmDialog from './components/ui/ConfirmDialog.vue';
import WelcomeModal from './components/onboarding/WelcomeModal.vue';
import HelpModal from './components/onboarding/HelpModal.vue';
import { useAuthStore } from './stores/auth';
import { useBackupStore } from './stores/backup';
import { useConfigStore } from './stores/config';

/** 应用壳：顶栏（品牌/连接/登录态）+ 侧边导航 + 四视图路由；欢迎页与帮助中心为全局模态 */
const { auth, refresh: refreshAuth, login, logout, initAuth } = useAuthStore();

/** 备份 store（引擎就绪标记 + 启动日志 + 事件订阅（应用级）） */
const bk = useBackupStore();
const { engineReady, engineFailed } = storeToRefs(bk);
const { retryEngine, pushLog, initBackup } = bk;

const cfgStore = useConfigStore();

const appInfo = ref<{ version: string; platform: string }>({ version: '', platform: '' });
const showWelcome = ref(false);
const showHelp = ref(false);
const helpTab = ref<'guide' | 'faq' | 'privacy'>('guide');

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

/** 退出登录（带确认） */
const showLogoutConfirm = ref(false);
async function confirmLogout() {
  showLogoutConfirm.value = false;
  await logout();
}

function openHelp(tab: 'guide' | 'faq' | 'privacy' = 'guide') {
  helpTab.value = tab;
  showHelp.value = true;
}

/** 顶栏「打开登录窗口」：模板作用域无法直接访问 window，收口为函数 */
function openEngine() {
  window.api.auth.showLogin();
}

onMounted(async () => {
  window.api.app.getInfo().then((i) => (appInfo.value = i));

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
  <div class="app">
    <TopBar
      :app-info="appInfo"
      :engine-ready="engineReady"
      :engine-failed="engineFailed"
      :auth="auth"
      @login="login"
      @logout="showLogoutConfirm = true"
      @retry="retryEngine"
      @open-engine="openEngine"
    />

    <div class="shell">
      <SideNav @help="openHelp('guide')" />
      <main class="shell-main">
        <!-- 内容区：四视图（概览/备份向导/历史/设置） -->
        <router-view />
      </main>
    </div>

    <ConfirmDialog
      :show="showLogoutConfirm"
      title="退出登录？"
      message="退出后需重新扫码才能备份；本地已备份的数据不受影响。"
      confirm-text="退出登录"
      danger
      @confirm="confirmLogout"
      @cancel="showLogoutConfirm = false"
    />

    <!-- 首次启动欢迎页（P4.3 拆出） -->
    <WelcomeModal
      v-if="showWelcome"
      @close="showWelcome = false"
      @open-help="(t) => { showWelcome = false; openHelp(t); }"
    />

    <!-- 帮助：新手教程 / 常见问题 / 隐私政策（P4.3 拆出） -->
    <HelpModal
      v-model:tab="helpTab"
      :show="showHelp"
      @close="showHelp = false"
    />
  </div>
</template>

<style>
:root {
  --paper: #ece5d5;
  --card: #f7f0e0;
  --card-2: #efe7d2;
  --ink: #2f2a22;
  --ink-soft: #8a7c66;
  --accent: #9a5336;
  --accent-deep: #7e3f29;
  --line: #d9ccb0;
  --line-soft: #e7dcc4;
  --ok: #5e8356;
  --err: #b04a38;
  --log-bg: #2b2722;
  --log-fg: #d9d2c4;
  --radius: 8px;
  --radius-sm: 6px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
  background-color: var(--paper);
  background-image: radial-gradient(rgba(90, 70, 40, 0.03) 1px, transparent 1px);
  background-size: 6px 6px;
  color: var(--ink);
}
.app { min-height: 100vh; display: flex; flex-direction: column; }

/* 侧边导航 + 内容区 */
.shell { flex: 1; display: flex; min-height: 0; }
.shell-main { flex: 1; min-width: 0; padding: 22px 24px 36px; max-width: 1240px; margin: 0 auto; overflow-y: auto; }

/* 顶栏 */
.topbar {
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  padding: 10px 24px;
  background: linear-gradient(180deg, #3a332b, #2c2620);
  color: #efe6d3;
  border-bottom: 2px solid var(--accent);
}
.brand { display: flex; align-items: center; gap: 12px; }
.seal {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border: 1.5px solid rgba(220, 150, 100, 0.6);
  color: #e0a27a; font-size: 19px;
  font-family: Georgia, 'STZhongsong', 'SimSun', serif;
  transform: rotate(-5deg); border-radius: 4px;
  background: rgba(156, 74, 47, 0.14);
}
.brand-text { display: flex; align-items: baseline; gap: 10px; }
.brand-title {
  font-family: Georgia, 'STZhongsong', 'SimSun', serif;
  font-size: 18px; letter-spacing: 2px; color: #f3ead7;
}
.ver { font-size: 12px; color: #b5a68b; font-variant-numeric: tabular-nums; }
.topmeta { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.engine {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px; border: 1px solid #4a4136; border-radius: 999px;
  background: rgba(0, 0, 0, 0.25); color: #b8aa96;
}
.engine .dot { width: 7px; height: 7px; border-radius: 50%; background: #b0493a; }
.engine.on { color: #d8e8d0; }
.engine.on .dot { background: #7ab57a; }
.engine.err {
  color: #f0b9a8; border-color: #8a4a3a; background: rgba(176, 74, 56, 0.18);
  cursor: pointer; font-family: inherit; font-size: 13px;
}
.engine.err:hover { background: rgba(176, 74, 56, 0.3); color: #fff; }
.engine.err .dot { background: #e08b7b; }
.vline { width: 1px; height: 16px; background: #4a4136; }
.who { color: #e8dfc9; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.who.off { color: #b5a68b; }

/* 按钮 */
.btn {
  padding: 7px 16px; border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--card); color: var(--ink); font-size: 13px; cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.05s ease;
  font-family: inherit;
}
.btn:hover:not(:disabled) { background: #fdf7e9; border-color: #c4b08a; }
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn.ghost { background: transparent; border-color: #4a4136; color: #d8cdb8; }
.btn.ghost:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); border-color: #6a5e4c; color: #fff; }
.btn.primary { background: var(--accent); border-color: var(--accent-deep); color: #fbe9d8; font-weight: 600; }
.btn.primary:hover:not(:disabled) { background: var(--accent-deep); }
.btn.danger { border-color: #d8a08a; color: var(--err); }
.btn.danger:hover:not(:disabled) { background: #fbeee7; }
.btn.sm { padding: 4px 10px; font-size: 12px; }
.link-btn {
  border: none; background: none; color: var(--accent); cursor: pointer;
  font-size: 12px; padding: 0; font-family: inherit;
}
.link-btn:hover { text-decoration: underline; }

/* 面板 */
.panel {
  background: var(--card); border-radius: var(--radius); padding: 18px 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
.panel-title {
  margin: 0 0 16px;
  font-family: Georgia, 'STZhongsong', 'SimSun', serif;
  font-size: 15px; font-weight: 700; color: var(--accent-deep); letter-spacing: 1px;
}
.panel-title-row { display: flex; justify-content: space-between; align-items: baseline; }
.panel-title-row .panel-title { margin-bottom: 12px; }
.dl-count { font-size: 12px; color: var(--ink-soft); font-variant-numeric: tabular-nums; }

/* 下载筛选 */
.dl-filter {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  margin-bottom: 10px;
}
.dl-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.chip {
  border: 1px solid var(--line); background: #faf3e3; color: var(--ink-soft);
  font-size: 11px; padding: 2px 9px; border-radius: 999px; cursor: pointer;
  font-family: inherit; transition: all 0.15s ease;
}
.chip:hover { border-color: #c8b28a; color: var(--ink); }
.chip.on {
  background: var(--accent); border-color: var(--accent); color: #fbe9d8; font-weight: 600;
}
.dl-mod {
  flex-shrink: 0; font-size: 10px; color: var(--accent-deep);
  background: #f3e6c8; border: 1px solid #e0d0a8; border-radius: 4px; padding: 1px 6px;
}

.fadein { animation: fadeUp 0.45s ease both; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .fadein { animation: none; }
  .bar-fill { transition: none; }
}

/* 备份设置 */
.field { margin-bottom: 18px; }
.field-label {
  display: block; font-size: 12px; color: var(--ink-soft);
  letter-spacing: 0.06em; margin-bottom: 7px;
}
.field-label-row { display: flex; justify-content: space-between; align-items: baseline; }
.sel-count { font-size: 12px; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.dir-row { display: flex; gap: 8px; }
.dir-input {
  flex: 1; min-width: 0; padding: 7px 10px;
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: #faf3e3; color: var(--ink); font-size: 13px;
  font-family: Consolas, 'PingFang SC', monospace;
}
.dir-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.mod-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px;
}
.mod {
  display: flex; align-items: center; gap: 7px; padding: 9px 10px;
  border: 1px solid var(--line-soft); border-radius: var(--radius-sm);
  background: var(--card-2); cursor: pointer; font-size: 13px;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}
.mod:hover { border-color: #c8b28a; background: #f3ebd8; transform: translateY(-1px); box-shadow: 0 2px 6px rgba(80, 60, 30, 0.08); }
.mod.picked { border-color: var(--accent); background: #f6ead8; }
.mod-check {
  appearance: none; width: 14px; height: 14px; border: 1px solid #c3ad8a;
  border-radius: 4px; background: #fff; position: relative; cursor: pointer; flex-shrink: 0;
}
.mod-check:checked { background: var(--accent); border-color: var(--accent); }
.mod-check:checked::after {
  content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px;
  border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.mod-check:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mod-icon { width: 15px; height: 15px; color: var(--accent); flex-shrink: 0; }
.mod-name { font-weight: 600; }
.mod-type {
  margin-left: auto; font-size: 10px; color: var(--ink-soft);
  background: #efe3c6; border: 1px solid #e0d0a8; border-radius: 4px;
  padding: 1px 5px; font-family: Consolas, monospace; font-variant-numeric: tabular-nums;
}

/* 配置摘要（联动） */
.summary-list { display: flex; flex-direction: column; gap: 6px; }
.summary-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 7px 10px; border: 1px solid var(--line-soft); border-radius: var(--radius-sm);
  background: #faf3e3; cursor: pointer; font-size: 13px; color: var(--ink);
  transition: border-color 0.15s ease, background 0.15s ease; font-family: inherit; text-align: left;
}
.summary-row:hover { border-color: var(--accent); background: #f6ead8; }
.sum-icon { width: 14px; height: 14px; color: var(--accent); flex-shrink: 0; }
.sum-name { font-weight: 600; flex-shrink: 0; }
.sum-detail { color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }

.actions { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 2px; }

/* 进度 */
.prog-empty { margin: 0; font-size: 13px; color: var(--ink-soft); }
.prog-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.prog-module {
  font-size: 15px; font-weight: 700; color: var(--ink);
  padding: 1px 8px; border-radius: 6px; background: var(--line-soft);
}
.prog-phase { font-size: 13px; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prog-percent {
  margin-left: auto; font-size: 18px; font-weight: 700; color: var(--accent);
  font-family: Consolas, monospace; font-variant-numeric: tabular-nums;
}
.prog-meta {
  display: flex; gap: 12px; margin-top: 7px; font-size: 11.5px; color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.prog-meta .fail { color: var(--err); }
.prog-meta .elapsed { margin-left: auto; }
.bar { height: 8px; border-radius: 4px; background: var(--line-soft); overflow: hidden; }
.bar-fill {
  height: 100%; border-radius: 4px; min-width: 0;
  background: linear-gradient(90deg, var(--accent), var(--accent-deep));
  transition: width 0.4s ease;
}

/* 下载列表 */
.dl-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow: auto; }
.dl-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.dl-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.dl-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: Consolas, monospace; }
.dl-bar { height: 4px; background: var(--line-soft); border-radius: 2px; overflow: hidden; }
.dl-bar-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s ease; }
.dl-size { flex-shrink: 0; font-family: Consolas, monospace; font-size: 11px; color: var(--ink-soft); }
.dl-pct { flex-shrink: 0; font-size: 11px; color: var(--accent-deep); width: 34px; text-align: right; }
.dl-state {
  flex-shrink: 0; font-size: 11px; padding: 1px 7px; border-radius: 4px;
  background: var(--line-soft); color: var(--ink-soft);
}
.dl-state.running { background: #f3e6c8; color: var(--accent-deep); }
.dl-state.done { background: #e0ebdc; color: var(--ok); }
.dl-state.failed { background: #f6e2dd; color: var(--err); }
.dl-error {
  flex-shrink: 0; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--err); font-size: 11px;
}
.dl-empty { margin: 0; font-size: 13px; color: var(--ink-soft); }

/* 日志 */
.log {
  max-height: 320px; overflow: auto; background: var(--log-bg); color: var(--log-fg);
  border-radius: var(--radius-sm); padding: 10px 12px; font-size: 12px;
  font-family: Consolas, 'PingFang SC', monospace; line-height: 1.75;
}
.log .line { display: flex; gap: 8px; }
.log .t { color: #8a8070; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.log .msg { word-break: break-all; }
.log .error { color: #e08b7b; }
.log .warn { color: #e0b56a; }
.log .success { color: #8ec48e; }
.log .empty { color: #6a645c; }

/* 模态遮罩（ConfirmDialog 等共用） */
.overlay {
  position: fixed; inset: 0; background: rgba(50, 40, 28, 0.5);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 36px 16px; z-index: 100;
}
.setrow {
  display: flex; align-items: center; gap: 12px; margin-bottom: 11px; font-size: 13px;
}
.setrow label { width: 148px; flex-shrink: 0; color: var(--ink); }
.setrow input[type='text'],
.setrow input[type='number'],
.setrow input[type='datetime-local'] {
  flex: 1; min-width: 0; padding: 6px 9px; border: 1px solid var(--line);
  border-radius: var(--radius-sm); background: #faf3e3; color: var(--ink); font-size: 13px;
}
/* 自定义下拉框（替代原生 select，避免系统蓝底） */
.cs { position: relative; flex: 1; min-width: 0; }
.cs .cs-val {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 6px 9px; border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: #faf3e3; color: var(--ink); font-size: 13px; cursor: pointer; user-select: none;
  transition: border-color 0.15s ease;
}
.cs .cs-val:hover { border-color: #c4b08a; }
.cs .cs-val::after {
  content: ''; width: 7px; height: 7px; flex-shrink: 0; margin-right: 2px;
  border-right: 1.5px solid #8a7c66; border-bottom: 1.5px solid #8a7c66;
  transform: rotate(45deg) translateY(-2px); transition: transform 0.18s ease;
}
.cs.open .cs-val::after { transform: rotate(225deg) translateY(-1px); }
/* 列表 Teleport 到 body，样式不能用 .cs 后代选择器，需独立声明 */
.cs-list {
  position: fixed; z-index: 300;
  background: #fdf8ec; border: 1px solid var(--line); border-radius: var(--radius-sm);
  box-shadow: 0 8px 22px rgba(40, 30, 15, 0.18); max-height: 230px; overflow: auto;
  animation: csDrop 0.16s ease both;
}
@keyframes csDrop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.cs-list .cs-item {
  padding: 7px 10px; font-size: 13px; color: var(--ink); cursor: pointer;
  transition: background 0.12s ease;
}
.cs-list .cs-item:hover { background: var(--line-soft); }
.cs-list .cs-item.sel { background: var(--accent); color: #fbe9d8; font-weight: 600; }
/* 下载列表模块筛选（紧凑） */
.dl-filter .cs { flex: none; width: 106px; }
.dl-filter .cs .cs-val { padding: 3px 8px; font-size: 12px; }
.setrow input[type='checkbox'] { width: 15px; height: 15px; accent-color: var(--accent); }
.setrow textarea {
  flex: 1; min-width: 0; padding: 6px 9px; border: 1px solid var(--line);
  border-radius: var(--radius-sm); background: #faf3e3; color: var(--ink);
  font-size: 12px; font-family: Consolas, monospace; resize: vertical; min-height: 54px;
}
.setrow input:focus-visible,
.setrow textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.range-row { display: flex; align-items: center; gap: 6px; flex: 1; }
.range-row input { flex: 1; min-width: 0; padding: 6px 9px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: #faf3e3; color: var(--ink); font-size: 13px; }
.range-sep { color: var(--ink-soft); }
.set-help { font-size: 11px; color: var(--ink-soft); flex: 1; min-width: 0; }
/* 相册选择（设置 → 相册） */
.album-sel {
  border: 1px dashed var(--line); border-radius: var(--radius-sm);
  padding: 10px 12px; margin-bottom: 14px; background: rgba(196, 176, 138, 0.06);
}
.album-sel-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.album-sel-title { font-size: 13px; font-weight: 600; color: var(--ink); }
.album-sel-sub { font-size: 11px; color: var(--ink-soft); }
.album-sel-actions { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.album-error { font-size: 12px; color: #e08b7b; margin-bottom: 6px; }
.album-empty { font-size: 12px; color: var(--ink-soft); padding: 6px 0; }
.album-list { max-height: 220px; overflow: auto; border: 1px solid var(--line-soft); border-radius: var(--radius-sm); background: #fdf8ec; }
.album-group { padding: 4px 0 6px; }
.album-group + .album-group { border-top: 1px solid var(--line-soft); }
.album-group-name {
  font-size: 11px; color: var(--accent-deep); font-weight: 600; padding: 5px 10px 2px;
  font-family: Georgia, 'STZhongsong', 'SimSun', serif; letter-spacing: 1px;
}
.album-item {
  display: flex; align-items: center; gap: 8px; padding: 4px 10px; font-size: 12px; cursor: pointer;
}
.album-item:hover { background: var(--line-soft); }
.album-check { width: 14px; height: 14px; accent-color: var(--accent); flex-shrink: 0; }
.album-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); }
.album-cnt { font-size: 11px; color: var(--ink-soft); flex-shrink: 0; }
.album-foot { font-size: 12px; color: var(--ink-soft); margin-top: 8px; }
.album-foot b { color: var(--accent-deep); }
.settings-actions {
  display: flex; gap: 8px; padding: 12px 20px 16px;
  border-top: 1px solid var(--line-soft);
}

/* 历史备份 */
.archives {
  background: var(--card); border-radius: 14px; width: min(720px, 94vw);
  max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 14px 48px rgba(40, 30, 15, 0.32);
  animation: fadeUp 0.3s ease both;
}
.archives-head-actions { display: flex; gap: 8px; }
.archives-body { padding: 12px 20px 18px; overflow: auto; flex: 1; }
.archives-empty { padding: 26px 0; text-align: center; color: var(--ink-soft); font-size: 13px; }
.archives-list { display: flex; flex-direction: column; gap: 8px; }
.arch-row {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px;
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.arch-row:hover { border-color: #c4b08a; box-shadow: 0 2px 8px rgba(40, 30, 15, 0.08); }
.arch-name { font-size: 13px; color: var(--ink); font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arch-meta { font-size: 11.5px; color: var(--ink-soft); flex: 1; min-width: 0; white-space: nowrap; }
.arch-actions { display: flex; gap: 6px; flex-shrink: 0; }
</style>
