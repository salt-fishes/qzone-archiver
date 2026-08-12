<script setup lang="ts">
/** 备份成功页（C 端习惯：对勾动画 + 核心数据汇总 + 快捷操作） */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { MODULE_META } from '../../stores/config';
import type { BackupResult } from '../../stores/backup';

const props = defineProps<{
  result: BackupResult;
  elapsed: number;
}>();
const emit = defineEmits<{ (e: 'again'): void }>();

const router = useRouter();

function fmtElapsed(sec?: number) {
  if (sec == null || sec < 0) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function fmtSize(n?: number) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtTime(ts?: number) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const modules = computed(() =>
  Object.entries(props.result.moduleCounts || {})
    .map(([k, v]) => ({ key: k, label: MODULE_META[k]?.label || k, count: v }))
    .sort((a, b) => (b.count || 0) - (a.count || 0))
);

function openDir() {
  if (props.result.targetDir) window.api.fs.openPath(props.result.targetDir);
}
function openHome() {
  if (props.result.targetDir) window.api.fs.openPath(props.result.targetDir + '/index.html');
}
function goHome() {
  router.push('/');
}
</script>

<template>
  <section class="success-panel">
    <div class="sc-hero">
      <div class="sc-check">
        <svg viewBox="0 0 52 52" aria-hidden="true">
          <circle class="sc-circle" cx="26" cy="26" r="24" fill="none" />
          <path class="sc-tick" fill="none" stroke-linecap="round" stroke-linejoin="round" d="M14 27l8 8 16-16" />
        </svg>
      </div>
      <h2 class="sc-title">备份完成</h2>
      <p class="sc-sub">{{ result.name || 'QQ 空间档案' }} · 内容已全部保存到本地</p>
      <p v-if="result.completedAt" class="sc-time">完成于 {{ fmtTime(result.completedAt) }}</p>
    </div>

    <div class="sc-stats">
      <div class="sc-stat">
        <span class="k">备份用时</span>
        <span class="v">{{ fmtElapsed(elapsed) }}</span>
      </div>
      <div class="sc-stat">
        <span class="k">内容总量</span>
        <span class="v">{{ (result.total || 0).toLocaleString() }} 条</span>
      </div>
      <div class="sc-stat">
        <span class="k">占用空间</span>
        <span class="v">{{ fmtSize(result.size) }}</span>
      </div>
      <div class="sc-stat">
        <span class="k">文件数量</span>
        <span class="v">{{ (result.files || 0).toLocaleString() }} 个</span>
      </div>
    </div>

    <div v-if="modules.length" class="sc-modules">
      <span v-for="m in modules" :key="m.key" class="sc-mod">
        {{ m.label }} <b>{{ (m.count || 0).toLocaleString() }}</b>
      </span>
    </div>

    <div class="sc-path">
      <span class="lbl">保存位置</span>
      <span class="path mono" :title="result.targetDir">{{ result.targetDir }}</span>
    </div>

    <div class="sc-actions">
      <button class="btn primary sc-btn-main" @click="openDir">打开备份文件夹</button>
      <button class="btn sc-btn" @click="openHome">浏览备份首页</button>
      <span class="sc-spacer"></span>
      <button class="link-btn" @click="emit('again')">再次备份</button>
      <button class="link-btn" @click="goHome">返回概览</button>
    </div>
  </section>
</template>

<style scoped>
.success-panel {
  max-width: 640px;
  width: 100%;
  margin: 8px auto;
  padding: 36px 36px 28px;
  background: var(--paper, #fffdf7);
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(23, 19, 13, 0.07);
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* —— 顶部：对勾 + 标题 —— */
.sc-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.sc-check {
  width: 92px;
  height: 92px;
}
.sc-check svg {
  width: 100%;
  height: 100%;
}
.sc-circle {
  stroke: #2fbf71;
  stroke-width: 3;
  stroke-dasharray: 160;
  stroke-dashoffset: 160;
  animation: sc-draw 0.5s ease forwards;
}
.sc-tick {
  stroke: #2fbf71;
  stroke-width: 5;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: sc-draw 0.35s 0.4s ease forwards;
}
@keyframes sc-draw {
  to { stroke-dashoffset: 0; }
}
.sc-title {
  margin: 14px 0 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.5px;
}
.sc-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--ink-soft);
}
.sc-time {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ink-soft);
}

/* —— 统计卡 —— */
.sc-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  width: 100%;
  margin-top: 26px;
}
.sc-stat {
  padding: 14px 8px 12px;
  background: rgba(47, 191, 113, 0.07);
  border: 1px solid rgba(47, 191, 113, 0.18);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.sc-stat .k {
  font-size: 11.5px;
  color: var(--ink-soft);
}
.sc-stat .v {
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
}

/* —— 模块清单 —— */
.sc-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  width: 100%;
  margin-top: 18px;
}
.sc-mod {
  padding: 5px 12px;
  font-size: 12.5px;
  color: var(--ink-soft);
  background: var(--bg-soft, #f5f1e8);
  border-radius: 999px;
}
.sc-mod b {
  color: var(--ink);
  font-weight: 600;
}

/* —— 保存位置 —— */
.sc-path {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin-top: 20px;
}
.sc-path .lbl {
  font-size: 12px;
  color: var(--ink-soft);
}
.sc-path .path {
  max-width: 100%;
  font-size: 12.5px;
  color: var(--ink);
  background: var(--bg-soft, #f5f1e8);
  border-radius: 8px;
  padding: 7px 12px;
  word-break: break-all;
  text-align: center;
}

/* —— 操作按钮 —— */
.sc-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-top: 26px;
  padding-top: 20px;
  border-top: 1px dashed var(--line-soft);
}
.sc-btn-main {
  padding: 10px 22px;
  font-size: 14px;
  border-radius: 10px;
  background: #2fbf71;
  border-color: #2fbf71;
  color: #fff;
}
.sc-btn-main:hover {
  background: #29a964;
  border-color: #29a964;
}
.sc-btn {
  padding: 10px 20px;
  font-size: 14px;
  border-radius: 10px;
}
.sc-spacer {
  flex: 1;
}

@media (max-width: 560px) {
  .success-panel {
    padding: 26px 18px 20px;
  }
  .sc-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .sc-actions {
    flex-wrap: wrap;
    justify-content: center;
  }
  .sc-spacer {
    flex-basis: 100%;
  }
}
</style>
