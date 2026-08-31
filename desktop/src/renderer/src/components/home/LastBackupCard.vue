<script setup lang="ts">
/** 上次备份卡片（S2 概览）：展示最新一条备份记录，可浏览/打开文件夹 */
type HistoryEntry = {
  taskId?: string | null;
  completedAt: number;
  targetDir: string;
  name: string;
  modules: string[];
  results: Record<string, string>;
  total: number;
  moduleCounts: Record<string, number>;
  size: number;
  files: number;
};

defineProps<{ backup: HistoryEntry | null }>();

function fmtTime(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtSize(n: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function moduleOk(b: HistoryEntry) {
  return (b.modules || []).filter((m) => (b.results || {})[m] === 'ok').length || b.modules.length;
}

function browse(b: HistoryEntry) {
  window.api.viewer.open(`${b.targetDir}/index.html`);
}

function folder(b: HistoryEntry) {
  window.api.fs.showInFolder(`${b.targetDir}/index.html`);
}
</script>

<template>
  <section class="panel last-card">
    <h3 class="panel-title">
      上次备份
    </h3>

    <template v-if="backup">
      <div class="last-main">
        <div class="last-time">
          {{ fmtTime(backup.completedAt) }}
        </div>
        <div class="last-meta">
          {{ backup.name }} · 全部 {{ moduleOk(backup) }} 项
          <template v-if="backup.total">
            · {{ backup.total.toLocaleString() }} 条
          </template>
          <template v-if="backup.files">
            · {{ backup.files.toLocaleString() }} 文件
          </template>
          <template v-if="backup.size">
            · {{ fmtSize(backup.size) }}
          </template>
        </div>
      </div>
      <div class="last-actions">
        <button
          class="btn primary sm"
          @click="browse(backup)"
        >
          浏览备份
        </button>
        <button
          class="btn sm"
          @click="folder(backup)"
        >
          打开文件夹
        </button>
      </div>
    </template>

    <div
      v-else
      class="last-empty"
    >
      <p class="last-empty-txt">
        还没有历史备份，先开始你的第一次备份吧。
      </p>
      <router-link
        to="/backup"
        class="btn primary sm"
      >
        去备份
      </router-link>
    </div>
  </section>
</template>

<style scoped>
.last-card .panel-title {
  margin-bottom: 12px;
}
.last-main {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.last-time {
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.last-meta {
  font-size: 12.5px;
  color: var(--ink-soft);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.last-actions {
  display: flex;
  gap: 8px;
}
.last-empty {
  margin: 0;
  font-size: 13px;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.last-empty-txt {
  margin: 0;
}
</style>
