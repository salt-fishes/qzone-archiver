<script setup lang="ts">
/** 历史视图（S5）：备份记录列表（自动记录，无需手动选择目录） */
import { ref, onMounted, onBeforeUnmount } from 'vue';

type HistoryEntry = {
  taskId?: string | null;
  completedAt: number;
  targetDir: string;
  name: string;
  total: number;
  moduleCounts: Record<string, number>;
  size: number;
  files: number;
  /** P3-1：模块级失败明细落库后，历史卡片显示「部分失败」标记 */
  errors?: { module: string; message?: string }[];
};

const history = ref<HistoryEntry[]>([]);
const loading = ref(true);
let unsub: (() => void) | null = null;

// zip 打包（后端链路：window.api.zip.create → packager archiver，进度经 zip:progress 推送）
const zipping = ref<string | null>(null);
const zipPercent = ref(0);
let unsubZip: (() => void) | null = null;

async function loadHistory() {
  try {
    const r = await window.api.backup.getHistory();
    history.value = r?.history || [];
  } catch (e) {
    console.warn('读取备份历史失败', e);
  } finally {
    loading.value = false;
  }
}

function openViewer(b: HistoryEntry) {
  window.api.viewer.open(`${b.targetDir}/index.html`);
}
function openFolder(b: HistoryEntry) {
  window.api.fs.showInFolder(`${b.targetDir}/index.html`);
}

async function zipBackup(b: HistoryEntry) {
  if (zipping.value) return;
  zipping.value = b.targetDir;
  zipPercent.value = 0;
  const dest = `${b.targetDir}.zip`;
  try {
    const r = await window.api.zip.create(b.targetDir, dest);
    if (r?.ok) {
      window.api.fs.showInFolder(dest);
    } else {
      console.warn('zip 打包失败', r?.error);
    }
  } catch (e) {
    console.warn('zip 打包失败', e);
  } finally {
    zipping.value = null;
  }
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function formatTime(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

onMounted(async () => {
  await loadHistory();
  unsub = window.api.on('backup:history-changed', () => loadHistory());
  unsubZip = window.api.on('zip:progress', (p: any) => {
    zipPercent.value = p?.percent ?? 0;
  });
});
onBeforeUnmount(() => {
  unsub?.();
  unsubZip?.();
});
</script>

<template>
  <section class="archives-view">
    <div class="av-head">
      <h2 class="view-title">
        历史备份
      </h2>
      <p class="view-desc">
        每次备份完成会自动记录在这里，无需手动选择目录。
      </p>
    </div>

    <div
      v-if="loading"
      class="av-empty"
    >
      加载中…
    </div>
    <div
      v-else-if="history.length === 0"
      class="av-empty"
    >
      <p>暂无备份记录</p>
      <p class="av-empty-sub">
        完成一次备份后，记录会自动出现在这里。
      </p>
      <router-link
        class="btn primary"
        to="/backup"
      >
        去备份
      </router-link>
    </div>

    <div
      v-else
      class="av-list"
    >
      <div
        v-for="b in history"
        :key="b.taskId || b.targetDir"
        class="av-row"
      >
        <div class="av-info">
          <span
            class="av-name"
            :title="b.targetDir"
          >{{ b.name }}</span>
          <span class="av-meta">
            {{ formatTime(b.completedAt) }}
            <template v-if="b.total"> · {{ b.total.toLocaleString() }} 条</template>
            <template v-if="b.files"> · {{ b.files.toLocaleString() }} 文件</template>
            <template v-if="b.size"> · {{ formatSize(b.size) }}</template>
          </span>
          <span
            v-if="b.errors?.length"
            class="av-err"
            :title="b.errors.map((e) => `${e.module}: ${e.message || '失败'}`).join('\n')"
          >部分失败（{{ b.errors.length }} 模块）</span>
        </div>
        <div class="av-actions">
          <button
            class="btn primary sm"
            @click="openViewer(b)"
          >
            浏览
          </button>
          <button
            class="btn sm"
            :disabled="!!zipping && zipping !== b.targetDir"
            @click="zipBackup(b)"
          >
            {{ zipping === b.targetDir ? `打包中 ${zipPercent}%` : '打包 zip' }}
          </button>
          <button
            class="btn sm"
            @click="openFolder(b)"
          >
            打开文件夹
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.archives-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 760px;
}
.av-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.view-title {
  margin: 0;
  font-family: Georgia, 'STZhongsong', 'SimSun', serif;
  font-size: 20px;
  color: var(--accent-deep);
  letter-spacing: 1px;
}
.view-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--ink-soft);
}
.av-empty {
  padding: 46px 20px;
  background: var(--card);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius);
  text-align: center;
  font-size: 14px;
  color: var(--ink-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.av-empty p {
  margin: 0;
}
.av-empty-sub {
  font-size: 12px;
  margin-bottom: 6px !important;
}
.av-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.av-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--card);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.av-row:hover {
  border-color: #c8b28a;
  box-shadow: 0 2px 8px rgba(80, 60, 30, 0.06);
}
.av-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.av-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.av-meta {
  font-size: 12px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.av-err {
  font-size: 12px;
  color: var(--warn, #c0392b);
  white-space: nowrap;
  cursor: help;
}
.av-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
