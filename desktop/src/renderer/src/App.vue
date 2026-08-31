<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import TopBar from './components/layout/TopBar.vue';
import SideNav from './components/layout/SideNav.vue';
import ConfirmDialog from './components/ui/ConfirmDialog.vue';
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

async function finishWelcome() {
  showWelcome.value = false;
  try {
    await window.api.config.set({ onboardingDone: true });
  } catch (e) {
    console.warn('保存首次启动标记失败', e);
  }
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

    <!-- 首次启动欢迎页 -->
    <div
      v-if="showWelcome"
      class="overlay"
    >
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
              @click="openHelp('guide'); showWelcome = false"
            >
              新手教程
            </button>
            <button
              class="link-btn"
              @click="openHelp('faq'); showWelcome = false"
            >
              常见问题
            </button>
            <button
              class="link-btn"
              @click="openHelp('privacy'); showWelcome = false"
            >
              隐私政策
            </button>
          </div>
          <button
            class="btn primary"
            @click="finishWelcome"
          >
            开始使用
          </button>
        </div>
      </div>
    </div>

    <!-- 帮助：新手教程 / 常见问题 / 隐私政策 -->
    <div
      v-if="showHelp"
      class="overlay"
      @click.self="showHelp = false"
    >
      <div class="help">
        <div class="settings-head">
          <h3 class="settings-title">
            帮助中心
          </h3>
          <button
            class="btn ghost sm"
            @click="showHelp = false"
          >
            关闭
          </button>
        </div>
        <div class="settings-body">
          <nav class="settings-tabs">
            <button
              class="tab-btn"
              :class="{ active: helpTab === 'guide' }"
              @click="helpTab = 'guide'"
            >
              新手教程
            </button>
            <button
              class="tab-btn"
              :class="{ active: helpTab === 'faq' }"
              @click="helpTab = 'faq'"
            >
              常见问题
            </button>
            <button
              class="tab-btn"
              :class="{ active: helpTab === 'privacy' }"
              @click="helpTab = 'privacy'"
            >
              隐私政策
            </button>
          </nav>
          <div class="settings-content help-content">
            <template v-if="helpTab === 'guide'">
              <h4>第一步：登录</h4>
              <p>点击右上角「扫码登录」，用手机 QQ 扫描二维码授权。登录态保存在应用本地，下次启动无需重复登录。</p>
              <h4>第二步：选择备份内容</h4>
              <p>在左侧勾选需要备份的模块。每个模块的备份类型（网页版 / 单文件网页 / 文本 / 原始数据）与获取选项（评论 / 赞 / 访客等）可在「设置」中调整。</p>
              <h4>第三步：开始备份</h4>
              <p>选择保存位置后点击「开始备份」。助手会逐模块采集数据，并将说说配图、相册原图、视频等多媒体下载到目标目录，采集过程可查看进度与日志。</p>
              <h4>第四步：浏览备份</h4>
              <p>备份完成后打开目标目录，双击 <code>index.html</code> 即可离线浏览。产物完全本地化，不依赖网络。</p>
              <h4>增量备份</h4>
              <p>在设置中将模块的「增量备份」改为「上次」，再次备份时只采集新增内容，可显著加快备份速度。</p>
              <h4>备份建议</h4>
              <p>首次备份建议先备份数据量较少的模块熟悉流程；数据量大时适当调大「查询间隔」与「重试次数」，避免触发限流。</p>
            </template>

            <template v-else-if="helpTab === 'faq'">
              <h4>如何备份别人的 QQ 空间？</h4>
              <p>先登录自己的 QQ 空间，再访问对方的空间（需有访问权限），然后选择备份即可。备份会在对方访客记录中留下访问痕迹。</p>
              <h4>备份文件保存在哪里？</h4>
              <p>保存在你选择的「保存位置」目录下，其中的 <code>index.html</code> 是浏览入口。</p>
              <h4>为什么有些数据没有备份到？</h4>
              <p>评论、赞默认开启，可在「设置 → 对应模块」中关闭；最近访问默认关闭，需要时在模块设置中打开。请求间隔过短或数据量过大时也可能触发限流导致部分跳过。</p>
              <h4>相册下载的是原图吗？</h4>
              <p>开启「相册 → 获取图片详情」后下载原图；默认只下载预览图以节省时间与流量。</p>
              <h4>备份是否会导致账号异常？</h4>
              <p>助手模拟正常浏览行为，但过于频繁的备份可能触发安全风控。建议查询间隔保持默认，不要短时间重复备份。</p>
              <h4>迅雷无法唤起下载？</h4>
              <p>确认已安装迅雷，并在「公共设置」中检查迅雷任务数与唤起间隔配置。</p>
              <h4>Aria2 / Motrix 无法添加任务？</h4>
              <p>确认 RPC 服务已启用，并在「公共设置」中填写正确的 RPC 地址与密钥。</p>
              <h4>能否导出加密空间或私密相册？</h4>
              <p>仅能导出你有访问权限或公开的数据，没有权限的内容无法备份。</p>
            </template>

            <template v-else>
              <h4>我们如何收集你的信息</h4>
              <p>应用仅在你授权登录后，使用你的 QQ 登录态访问 QQ 空间，收集你选择的备份内容（说说、日志、相册等）数据。</p>
              <h4>我们如何使用你的信息</h4>
              <p>所有数据仅在本地处理：备份产物写入你选择的目录，登录态保存在应用本地。应用不上传、不分享、不出售任何你的数据。</p>
              <h4>数据的保存与清除</h4>
              <p>备份产物保存在你指定的目录，删除该目录即彻底清除；退出登录可清除应用本地的登录态。</p>
              <h4>第三方下载工具</h4>
              <p>使用迅雷 / Aria2 等第三方工具下载媒体文件时，文件经第三方工具处理；由此产生的数据流转不受本应用控制。</p>
              <h4>责任说明</h4>
              <p>请勿将他人空间的私密数据导出后传播。因导出或传播他人数据导致的隐私泄露，由使用者自行承担。</p>
            </template>
          </div>
        </div>
      </div>
    </div>
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

/* 模态遮罩 */
.overlay {
  position: fixed; inset: 0; background: rgba(50, 40, 28, 0.5);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 36px 16px; z-index: 100;
}
.settings {
  background: var(--card); border-radius: 12px; width: 100%; max-width: 720px;
  max-height: calc(100vh - 72px); overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 12px 44px rgba(40, 30, 15, 0.3); animation: fadeUp 0.3s ease both;
}
.settings-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px 12px;
}
.settings-title {
  margin: 0; font-family: Georgia, 'STZhongsong', 'SimSun', serif;
  color: var(--accent-deep); font-size: 16px; letter-spacing: 1px;
}
.settings-body { display: flex; flex: 1; min-height: 0; }
.settings-tabs {
  width: 96px; flex-shrink: 0; padding: 4px 8px 12px;
  border-right: 1px solid var(--line-soft); overflow: auto;
  display: flex; flex-direction: column; gap: 2px;
}
.tab-btn {
  border: none; background: none; padding: 7px 10px; border-radius: var(--radius-sm);
  font-size: 13px; color: var(--ink-soft); cursor: pointer; text-align: left;
  font-family: inherit; transition: background 0.15s ease, color 0.15s ease;
}
.tab-btn:hover { background: var(--line-soft); color: var(--ink); }
.tab-btn.active { background: var(--accent); color: #fbe9d8; font-weight: 600; }
.settings-content { flex: 1; min-width: 0; overflow: auto; padding: 14px 18px 18px; }
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

/* 欢迎页 */
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

/* 帮助中心 */
.help {
  background: var(--card); border-radius: 12px; width: 100%; max-width: 760px;
  max-height: calc(100vh - 72px); overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 12px 44px rgba(40, 30, 15, 0.3); animation: fadeUp 0.3s ease both;
}
.help .settings-tabs { width: 110px; }
.help-content h4 {
  margin: 18px 0 6px; font-size: 13.5px; color: var(--accent-deep); font-weight: 700;
}
.help-content h4:first-child { margin-top: 0; }
.help-content p { margin: 0 0 4px; font-size: 13px; color: var(--ink); line-height: 1.75; }
.help-content code {
  font-family: Consolas, monospace; font-size: 12px; background: #efe3c6;
  border: 1px solid #e0d0a8; border-radius: 4px; padding: 0 5px; color: var(--accent-deep);
}
</style>
