<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';

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
  if (!r.canceled && r.path) targetDir.value = r.path;
}

async function startBackup() {
  const modules = MODULES.filter((m) => selected.value[m]);
  if (!targetDir.value) {
    pushLog('warn', '请先选择备份目标目录');
    return;
  }
  busy.value = true;
  pushLog('info', `开始备份：${modules.join(', ')} → ${targetDir.value}`);
  const r = await window.api.backup.start({ modules, targetDir: targetDir.value });
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
      </div>
    </header>

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
