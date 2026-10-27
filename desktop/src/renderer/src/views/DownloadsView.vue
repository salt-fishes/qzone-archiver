<script setup lang="ts">
/**
 * 下载中心（v5.5 M1）：媒体下载独立页面
 *
 * 任务完成不再等待下载；这里展示队列剩余、失败重试与目标目录入口。
 * 数据来自 backup store（事件驱动）+ 一次性 getState（补 taskId/targetDir 映射）。
 */
import { computed, onMounted, ref } from 'vue';
import { NButton, NCard, NEmpty, NProgress, NSelect, NTag, useMessage } from 'naive-ui';
import { DL_STATES, useBackupStore } from '../stores/backup';
import { MODULE_META } from '../stores/config';

const bk = useBackupStore();
const message = useMessage();

const taskOf = ref<Record<string, string>>({});
const dirOf = ref<Record<string, string>>({});
const filter = computed({
  get: () => bk.downloadFilter,
  set: (v: string) => (bk.downloadFilter = v),
});
const moduleFilter = computed({
  get: () => bk.downloadModule,
  set: (v: string) => (bk.downloadModule = v),
});
const taskFilter = computed({
  get: () => bk.downloadTask,
  set: (v: string) => (bk.downloadTask = v),
});

/** v5.5 M1：备份任务筛选项（本次任务排在最前） */
const taskOptions = computed(() => {
  const ids = new Set<string>();
  for (const d of bk.mediaDownloads) {
    const id = d.ownerTaskId || taskOf.value[d.id];
    if (id) ids.add(id);
  }
  if (bk.currentTaskId) ids.add(bk.currentTaskId);
  return [
    { label: '全部任务', value: 'all' },
    ...[...ids].map((id) => ({
      label: `${shortTask(id)}${id === bk.currentTaskId ? '（本次）' : ''}`,
      value: id,
    })),
  ];
});

const moduleOptions = computed(() => {
  const set = new Set(bk.mediaDownloads.map((d) => d.module).filter(Boolean) as string[]);
  return [
    { label: '全部模块', value: 'all' },
    ...[...set].map((m) => ({ label: MODULE_META[m]?.label || m, value: m })),
  ];
});

const summary = computed(() => {
  const s = bk.downloadSummary;
  if (s) return s;
  const list = bk.mediaDownloads;
  return {
    pending: list.filter((d) => d.state === 'pending').length,
    running: list.filter((d) => d.state === 'running').length,
    done: list.filter((d) => d.state === 'done').length,
    failed: list.filter((d) => d.state === 'failed').length,
    total: list.length,
  };
});

const left = computed(() => summary.value.pending + summary.value.running);

async function refreshQueue() {
  try {
    const st = await window.api.download.getState();
    const tasks: Record<string, string> = {};
    const dirs: Record<string, string> = {};
    for (const q of st?.queue || []) {
      if (q.id) {
        tasks[q.id] = q.taskId || '';
        dirs[q.id] = q.targetDir || '';
      }
    }
    taskOf.value = tasks;
    dirOf.value = dirs;
  } catch (e: any) {
    console.warn('读取下载队列失败', e);
  }
}

onMounted(refreshQueue);

async function pauseAll() {
  await window.api.download.pause();
  bk.pushLog('info', '下载队列已暂停');
  message.info('下载已暂停');
}

async function resumeAll() {
  await window.api.download.resume();
  bk.pushLog('info', '下载队列已恢复');
  message.success('下载已恢复');
}

/** v5.5 M1：失败条目重新入队（.part 断点保留，下一轮续传） */
async function retryFailed() {
  const r = await window.api.download.retryFailed();
  const n = r?.count || 0;
  if (!n) {
    message.info('没有失败的下载');
    return;
  }
  message.success(`已重新入队 ${n} 项`);
  await refreshQueue();
}

function openFolder(id: string) {
  const dir = dirOf.value[id];
  if (dir) window.api.fs.showInFolder(dir);
}

function shortTask(taskId?: string) {
  if (!taskId) return '';
  return taskId.length > 18 ? `${taskId.slice(0, 18)}…` : taskId;
}
</script>

<template>
  <section class="downloads">
    <header class="dl-head">
      <div>
        <h2>下载中心</h2>
        <p>任务完成后媒体仍在后台下载；这里可以查看剩余、暂停或打开目录。</p>
      </div>
      <div class="dl-actions">
        <NButton
          size="small"
          round
          :disabled="left === 0"
          @click="pauseAll"
        >
          暂停全部
        </NButton>
        <NButton
          size="small"
          round
          type="primary"
          :disabled="left === 0"
          @click="resumeAll"
        >
          恢复
        </NButton>
        <NButton
          size="small"
          round
          quaternary
          @click="refreshQueue"
        >
          刷新
        </NButton>
      </div>
    </header>

    <div class="dl-cards">
      <NCard
        size="small"
        class="dl-card"
      >
        <span class="k">排队</span><b>{{ summary.pending }}</b>
      </NCard>
      <NCard
        size="small"
        class="dl-card"
      >
        <span class="k">下载中</span><b>{{ summary.running }}</b>
      </NCard>
      <NCard
        size="small"
        class="dl-card"
      >
        <span class="k">完成</span><b>{{ summary.done }}</b>
      </NCard>
      <NCard
        size="small"
        class="dl-card"
      >
        <span class="k">失败</span><b class="fail">{{ summary.failed }}</b>
      </NCard>
      <NCard
        size="small"
        class="dl-card"
      >
        <span class="k">总计</span><b>{{ summary.total }}</b>
      </NCard>
    </div>

    <div class="dl-toolbar">
      <NSelect
        v-model:value="filter"
        size="small"
        :options="DL_STATES.map((s) => ({ label: s.label, value: s.key }))"
        style="width: 120px"
      />
      <NSelect
        v-model:value="moduleFilter"
        size="small"
        :options="moduleOptions"
        style="width: 150px"
      />
      <NSelect
        v-model:value="taskFilter"
        size="small"
        :options="taskOptions"
        style="width: 190px"
      />
      <span class="flex1" />
      <NButton
        size="small"
        round
        :disabled="summary.failed === 0"
        @click="retryFailed"
      >
        重试失败{{ summary.failed ? ` (${summary.failed})` : '' }}
      </NButton>
      <NButton
        size="small"
        quaternary
        @click="bk.clearDoneDownloads()"
      >
        清除完成/失败
      </NButton>
    </div>

    <div
      v-if="!bk.filteredDownloads.length"
      class="dl-empty"
    >
      <NEmpty description="暂无下载记录" />
    </div>

    <div
      v-else
      class="dl-list"
    >
      <div
        v-for="d in bk.filteredDownloads"
        :key="d.id"
        class="dl-row"
      >
        <div class="dl-main">
          <div class="dl-title">
            <span class="dl-name">{{ bk.downloadLabel(d) }}</span>
            <NTag
              size="tiny"
              :type="d.state === 'failed' ? 'error' : d.state === 'done' ? 'success' : 'default'"
            >
              {{ bk.stateLabel(d.state) }}
            </NTag>
            <NTag
              v-if="d.ownerTaskId || taskOf[d.id]"
              size="tiny"
              :bordered="false"
            >
              {{ shortTask(d.ownerTaskId || taskOf[d.id]) }}
            </NTag>
          </div>
          <NProgress
            v-if="d.state === 'running' || d.state === 'pending'"
            type="line"
            :percentage="d.percent || 0"
            :height="4"
            :show-indicator="false"
          />
          <div
            v-if="d.error"
            class="dl-error"
          >
            {{ d.error }}
          </div>
        </div>
        <div class="dl-side">
          <span
            v-if="d.total"
            class="dl-size"
          >{{ bk.formatBytes(d.received) }} / {{ bk.formatBytes(d.total) }}</span>
          <NButton
            v-if="dirOf[d.id]"
            size="tiny"
            quaternary
            @click="openFolder(d.id)"
          >
            打开目录
          </NButton>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.downloads {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.dl-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.dl-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.dl-head p {
  margin: 0;
  font-size: 13px;
  opacity: 0.55;
}
.dl-actions,
.dl-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dl-cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.dl-card :deep(.n-card__content) {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 14px;
}
.dl-card b {
  font-size: 20px;
}
.dl-card .fail {
  color: #b5432a;
}
.dl-card .k {
  font-size: 12px;
  opacity: 0.55;
}
.dl-toolbar {
  padding: 2px 0;
}
.flex1 {
  flex: 1;
}
.dl-empty {
  padding: 60px 0;
}
.dl-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dl-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  background: var(--surface);
}
.dl-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dl-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dl-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dl-error {
  font-size: 12px;
  color: #b5432a;
  word-break: break-all;
}
.dl-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.dl-size {
  font-size: 12px;
  opacity: 0.55;
  font-family: var(--mono-font);
}
</style>
