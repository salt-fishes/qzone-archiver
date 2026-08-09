<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue';

const MODULES = [
  'Messages',
  'Blogs',
  'Diaries',
  'Photos',
  'Videos',
  'Boards',
  'Favorites',
  'Shares',
  'Friends',
  'Visitors',
  'Statistics',
];

const appInfo = ref<{ version: string; platform: string }>({ version: '', platform: '' });
const auth = reactive<{ loggedIn: boolean; qqNumber?: string; nickname?: string }>({ loggedIn: false });
const engineReady = ref(false);
const busy = ref(false);
const targetDir = ref('');
const selected = ref<Record<string, boolean>>({ Messages: true });
const logs = ref<{ time: string; level: string; message: string }[]>([]);
const progress = ref<{ module?: string; phase?: string; percent?: number }>({});
const showSettings = ref(false);

/** 有导出类型（备份类型）设置的模块 */
const MODULE_KEYS = [
  'Messages',
  'Blogs',
  'Diaries',
  'Photos',
  'Videos',
  'Boards',
  'Favorites',
  'Shares',
  'Friends',
  'Visitors',
];
const EXPORT_TYPES = ['SPA', 'HTML', 'MarkDown', 'JSON'];

/** 设置默认值（与引擎 config.js 默认对齐） */
function defaultSettings() {
  const modules: Record<string, { exportType: string }> = {};
  for (const m of MODULE_KEYS) modules[m] = { exportType: 'SPA' };
  return {
    Common: {
      downloadType: 'Browser',
      downloadThread: 10,
      downloadSleep: 2,
      Aria2: { rpc: 'http://localhost:6800/jsonrpc', token: '' },
      AvatarHost: 1,
      isAutoFileSuffix: true,
    },
    modules,
  };
}

/** 从已保存配置合并默认值（顶层按模块键覆盖） */
function mergeSettings(saved?: any) {
  const base = defaultSettings();
  if (!saved || typeof saved !== 'object') return base;
  if (saved.Common) base.Common = { ...base.Common, ...saved.Common, Aria2: { ...base.Common.Aria2, ...(saved.Common.Aria2 || {}) } };
  if (saved.modules) {
    for (const m of MODULE_KEYS) {
      const sm = saved.modules[m];
      if (sm && typeof sm === 'object') base.modules[m] = { ...base.modules[m], ...sm };
    }
  }
  return base;
}

const settings = ref(defaultSettings());

async function openSettings() {
  const c = await window.api.config.get();
  settings.value = mergeSettings(c?.engineSettings);
  showSettings.value = true;
}

/** 深拷贝为纯 JSON（reactive proxy 无法跨 IPC structured clone） */
function toPlain<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

async function saveSettings() {
  try {
    await window.api.config.set({ engineSettings: toPlain(settings.value) });
    pushLog('info', '设置已保存');
  } catch (e) {
    pushLog('error', `设置保存失败：${(e as Error)?.message || e}`);
  }
  showSettings.value = false;
}

function resetSettings() {
  settings.value = defaultSettings();
}

/** 构造传给引擎备份的 QZone_Config（完整顶层键，避免浅合并丢失子项） */
function buildEngineConfig() {
  const s = settings.value;
  const cfg: Record<string, any> = {
    Common: {
      downloadType: s.Common.downloadType,
      downloadThread: Number(s.Common.downloadThread) || 10,
      downloadSleep: Number(s.Common.downloadSleep) || 2,
      Aria2: { rpc: s.Common.Aria2.rpc || '', token: s.Common.Aria2.token || '' },
      AvatarHost: Number(s.Common.AvatarHost) || 1,
      isAutoFileSuffix: s.Common.isAutoFileSuffix,
    },
  };
  for (const m of MODULE_KEYS) {
    cfg[m] = { exportType: s.modules[m].exportType };
  }
  return cfg;
}

let unsubs: (() => void)[] = [];

function pushLog(level: string, message: string) {
  const time = new Date().toLocaleTimeString();
  logs.value.push({ time, level, message });
  if (logs.value.length > 500) logs.value.splice(0, logs.value.length - 500);
}

async function refreshAuth() {
  const s = await window.api.auth.getStatus();
  Object.assign(auth, s);
}

async function login() {
  await window.api.auth.showLogin();
}

async function pickDir() {
  const r = await window.api.fs.selectDirectory('选择备份目标文件夹');
  if (!r.canceled && r.path) {
    targetDir.value = r.path;
    window.api.config.set({ targetDir: r.path });
  }
}

async function startBackup() {
  const modules = MODULES.filter((m) => selected.value[m]);
  if (!targetDir.value) {
    pushLog('warn', '请先选择备份目标目录');
    return;
  }
  busy.value = true;
  pushLog('info', `开始备份：${modules.join(', ')} → ${targetDir.value}`);
  const r = await window.api.backup.start({ modules, targetDir: targetDir.value, config: buildEngineConfig() });
  if (!r.ok) {
    pushLog('error', `启动失败：${r.error}`);
    busy.value = false;
  }
}

async function pause() {
  await window.api.backup.pause();
  pushLog('info', '已暂停');
}
async function resume() {
  await window.api.backup.resume();
  pushLog('info', '已恢复');
}
async function cancel() {
  await window.api.backup.cancel();
  busy.value = false;
  pushLog('info', '已取消');
}

function openFolder() {
  if (targetDir.value) window.api.fs.showInFolder(targetDir.value);
}

onMounted(async () => {
  window.api.app.getInfo().then((i) => (appInfo.value = i));

  // 恢复上次记忆的配置（目标目录 / 模块勾选 / 设置）
  let configLoaded = false;
  try {
    const c = await window.api.config.get();
    if (c?.targetDir) targetDir.value = c.targetDir;
    if (c?.selectedModules && typeof c.selectedModules === 'object') {
      for (const m of MODULES) selected.value[m] = !!c.selectedModules[m];
    }
    if (c?.engineSettings) settings.value = mergeSettings(c.engineSettings);
  } catch (e) {
    console.warn('读取配置失败', e);
  }
  configLoaded = true;

  // 模块勾选变化时记忆
  watch(
    selected,
    (v) => {
      if (!configLoaded) return;
      window.api.config.set({ selectedModules: { ...v } });
    },
    { deep: true }
  );

  // 设置调整自动保存（防抖；直接关闭/退出也留得住）
  let settingsTimer: number | undefined;
  watch(
    settings,
    (v) => {
      if (!configLoaded) return;
      window.clearTimeout(settingsTimer);
      settingsTimer = window.setTimeout(() => {
        window.api.config.set({ engineSettings: toPlain(v) }).catch((e) => {
          console.warn('设置自动保存失败', e);
        });
      }, 300);
    },
    { deep: true }
  );

  await refreshAuth();

  unsubs.push(
    window.api.on('auth:status-changed', (p) => {
      Object.assign(auth, p);
    }),
    window.api.on('backup:state-changed', (p) => {
      if (p.state === 'engine-ready') engineReady.value = true;
      if (p.state === 'running') busy.value = true;
      if (p.state === 'completed') busy.value = false;
      if (p.state === 'cancelled') busy.value = false;
      pushLog('info', `状态：${p.state}`);
    }),
    window.api.on('backup:progress', (p) => {
      progress.value = p;
    }),
    window.api.on('backup:log', (p) => {
      pushLog(p.level || 'info', p.message || '');
    }),
    window.api.on('backup:module-done', (p) => {
      pushLog('success', `模块完成：${p.module}`);
    }),
    window.api.on('backup:completed', (p) => {
      busy.value = false;
      pushLog('success', '备份完成');
      if (targetDir.value) {
        pushLog('info', `入口文件：${targetDir.value}\\index.html（双击浏览备份）`);
      }
    }),
    window.api.on('download:item-failed', (p) => {
      pushLog('error', `下载失败：${p.url} — ${p.error}`);
    })
  );
});

onBeforeUnmount(() => {
  unsubs.forEach((fn) => fn());
});
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">QQ空间档案备份 <span class="ver">v{{ appInfo.version }}</span></div>
      <div class="status">
        <span :class="['dot', auth.loggedIn ? 'ok' : 'no']"></span>
        <template v-if="auth.loggedIn">
          {{ auth.nickname || auth.qqNumber }}（已登录）
          <button @click="window.api.auth.logout()">退出</button>
        </template>
        <template v-else>
          未登录 <button @click="login">扫码登录</button>
        </template>
        <button @click="refreshAuth">刷新</button>
        <button @click="openSettings">设置</button>
      </div>
    </header>

    <div v-if="showSettings" class="overlay" @click.self="showSettings = false">
      <div class="settings">
        <h3>设置</h3>
        <div class="group">
          <h4>公共设置</h4>
          <div class="setrow">
            <span>文件下载方式</span>
            <select v-model="settings.Common.downloadType">
              <option value="Browser">浏览器下载（下载到备份目录）</option>
              <option value="Thunder_Link">迅雷（生成链接 txt）</option>
              <option value="Thunder_Clipboard">迅雷（仅复制到剪贴板）</option>
              <option value="Aria2">Aria2 / Motrix</option>
            </select>
          </div>
          <div class="setrow">
            <span>文件下载并发数</span>
            <input type="number" min="1" max="50" v-model.number="settings.Common.downloadThread" />
          </div>
          <div class="setrow">
            <span>文件下载间隔（秒）</span>
            <input type="number" min="0" step="0.5" v-model.number="settings.Common.downloadSleep" />
          </div>
          <div class="setrow">
            <span>Aria2 RPC 地址</span>
            <input v-model="settings.Common.Aria2.rpc" placeholder="http://localhost:6800/jsonrpc" />
          </div>
          <div class="setrow">
            <span>Aria2 密钥</span>
            <input v-model="settings.Common.Aria2.token" placeholder="留空则不校验" />
          </div>
          <div class="setrow">
            <span>头像服务器编号（0 自动）</span>
            <input type="number" min="0" max="4" v-model.number="settings.Common.AvatarHost" />
          </div>
          <div class="setrow">
            <span>自动识别文件后缀</span>
            <input type="checkbox" v-model="settings.Common.isAutoFileSuffix" />
          </div>
        </div>
        <div class="group">
          <h4>模块备份类型</h4>
          <div v-for="m in MODULE_KEYS" :key="m" class="setrow">
            <span>{{ m }}</span>
            <select v-model="settings.modules[m].exportType">
              <option v-for="t in EXPORT_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>
        <div class="row">
          <button @click="saveSettings">保存</button>
          <button @click="resetSettings">恢复默认</button>
          <button @click="showSettings = false">关闭</button>
        </div>
      </div>
    </div>

    <main class="body">
      <section class="card">
        <h3>引擎状态</h3>
        <p :class="engineReady ? 'ok' : 'no'">
          {{ engineReady ? '引擎已就绪' : '引擎加载中（登录窗口就绪后自动注入）' }}
        </p>
      </section>

      <section class="card">
        <h3>备份设置</h3>
        <div class="row">
          <span>目标目录</span>
          <input v-model="targetDir" placeholder="选择备份保存位置" readonly />
          <button @click="pickDir">选择</button>
          <button v-if="targetDir" @click="openFolder">打开</button>
        </div>
        <div class="row wrap">
          <label v-for="m in MODULES" :key="m" class="mod">
            <input type="checkbox" v-model="selected[m]" /> {{ m }}
          </label>
        </div>
        <div class="row">
          <button :disabled="busy || !auth.loggedIn" @click="startBackup">开始备份</button>
          <button :disabled="!busy" @click="pause">暂停</button>
          <button :disabled="!busy" @click="resume">恢复</button>
          <button :disabled="!busy" @click="cancel">取消</button>
        </div>
        <p v-if="progress.module" class="progress">
          {{ progress.module }} / {{ progress.phase }} — {{ progress.percent }}%
        </p>
      </section>

      <section class="card">
        <h3>日志</h3>
        <div class="log">
          <div v-for="(l, i) in logs" :key="i" :class="l.level">
            <span class="t">{{ l.time }}</span> {{ l.message }}
          </div>
          <div v-if="logs.length === 0" class="empty">暂无日志</div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
:root {
  --paper: #f6efe3;
  --ink: #3a322a;
  --brick: #9c4a2f;
  --line: #d8c9b0;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  background: var(--paper);
  color: var(--ink);
}
.app {
  min-height: 100vh;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #efe4cf;
  border-bottom: 1px solid var(--line);
}
.brand {
  font-size: 18px;
  font-weight: 600;
}
.ver {
  font-size: 12px;
  color: #8a7a63;
}
.status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.dot.ok {
  background: #5cb85c;
}
.dot.no {
  background: #d9534f;
}
.body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
}
.card {
  background: #fffaf0;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px 16px;
}
.card h3 {
  margin: 0 0 10px;
  font-size: 14px;
  color: var(--brick);
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.row.wrap {
  flex-wrap: wrap;
}
input[readonly] {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #faf3e6;
}
button {
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff6e8;
  cursor: pointer;
}
button:hover {
  background: #f3e2c8;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.mod {
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.progress {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--brick);
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(60, 50, 38, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 16px;
  z-index: 100;
}
.settings {
  background: #fffaf0;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 18px 20px;
  max-width: 560px;
  width: 100%;
  max-height: calc(100vh - 64px);
  overflow: auto;
  box-shadow: 0 8px 28px rgba(60, 50, 38, 0.25);
}
.settings h3 {
  margin: 0 0 12px;
  color: var(--brick);
  font-size: 16px;
}
.settings .group {
  margin-bottom: 16px;
}
.settings h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #8a6d3b;
  border-bottom: 1px dashed var(--line);
  padding-bottom: 4px;
}
.setrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 13px;
}
.setrow span {
  width: 150px;
  flex-shrink: 0;
}
.setrow input[type='text'],
.setrow input:not([type]),
.setrow input[type='number'] {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #faf3e6;
}
.setrow select {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #faf3e6;
  font-size: 13px;
}
.log {
  max-height: 320px;
  overflow: auto;
  background: #2e2a26;
  color: #d8d2c8;
  border-radius: 6px;
  padding: 10px;
  font-size: 12px;
  font-family: Consolas, monospace;
  line-height: 1.7;
}
.log .t {
  color: #8a837a;
  margin-right: 6px;
}
.log .error {
  color: #e08b7b;
}
.log .warn {
  color: #e0b56a;
}
.log .success {
  color: #7bc47f;
}
.log .empty {
  color: #6a645c;
}
</style>
