<script setup lang="ts">
/**
 * 任务进行中面板（v4.6）：大进度环 + 模块清单 + 日志/下载抽屉 + 暂停/恢复/取消
 * 数据全部来自 backup store（主进程状态机为唯一事实源）
 */
import { computed, ref } from 'vue';
import { NButton, NProgress, NDrawer, NDrawerContent, NTag, useDialog } from 'naive-ui';
import { AnimatePresence, Motion } from 'motion-v';
import { useBackupStore, DL_STATES } from '../../stores/backup';
import { useConfigStore, MODULE_META, MODULE_ICONS } from '../../stores/config';

const bk = useBackupStore();
const cfg = useConfigStore();
const dialog = useDialog();

const paused = computed(() => bk.paused);
/** 当前模块进度（0-100） */
const modulePercent = computed(() => bk.progress?.percent ?? 0);
/**
 * 总体进度：已完成模块数 + 当前模块的百分比，按所选模块总数折算
 * （引擎逐模块推进，当前模块百分比来自其内部采集进度）
 */
const overallPercent = computed(() => {
  const total = cfg.selectedModules.length;
  if (!total) return modulePercent.value;
  const done = bk.doneModules.length;
  const frac = Math.min(100, Math.max(0, modulePercent.value)) / 100;
  return Math.min(99, Math.round(((done + frac) / total) * 100));
});
const currentLabel = computed(() => {
  const m = bk.progress?.module || '';
  return MODULE_META[m]?.label || m || '正在启动';
});
const extra = computed(() => bk.progress?.extra || {});

/** 模块清单（含完成态） */
const moduleItems = computed(() =>
  cfg.selectedModules.map((m) => ({
    key: m,
    label: MODULE_META[m]?.label || m,
    icon: MODULE_ICONS[m] || '',
    done: bk.doneModules.includes(m),
    active: bk.progress?.module === m,
  }))
);

const showLogs = ref(false);
const showDownloads = ref(false);

const dlCount = computed(() => bk.dlCount);
const dlFailed = computed(() => bk.mediaDownloads.filter((d) => d.state === 'failed').length);

function onCancel() {
  dialog.warning({
    title: '取消备份？',
    content: '正在进行的备份将被中止，本次进度不会保留；已下载的文件会留在目标目录。',
    positiveText: '取消备份',
    negativeText: '继续备份',
    onPositiveClick: () => bk.cancel(),
  });
}

function fmtElapsed(sec?: number) {
  if (sec == null || sec < 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
</script>

<template>
  <section class="running">
    <div class="run-card">
      <div class="run-progress">
        <NProgress
          type="circle"
          :percentage="overallPercent"
          :stroke-width="8"
          :size="132"
          :color="paused ? '#f0a020' : '#b45f3d'"
          :rail-color="'rgba(128,128,128,0.18)'"
        >
          <div class="rp-center">
            <div class="rp-pct">
              {{ overallPercent }}%
            </div>
            <div class="rp-state">
              总体进度{{ paused ? ' · 已暂停' : '' }}
            </div>
          </div>
        </NProgress>
      </div>

      <div class="run-info">
        <div class="ri-current">
          <span class="ri-module">{{ currentLabel }}</span>
          <span class="ri-tip">{{ bk.progress?.tip || bk.progress?.phase || '' }}</span>
          <span class="ri-modpct">{{ modulePercent }}%</span>
        </div>
        <!-- 当前模块副进度条 -->
        <NProgress
          type="line"
          :percentage="modulePercent"
          :show-indicator="false"
          :height="5"
          :border-radius="3"
          :color="paused ? '#f0a020' : '#b45f3d'"
        />
        <div class="ri-stats">
          <span>完成模块 <b>{{ bk.doneModules.length }}/{{ cfg.selectedModules.length }}</b></span>
          <span>成功 <b>{{ extra.success ?? 0 }}</b></span>
          <span v-if="(extra.skip ?? 0) > 0">跳过 <b>{{ extra.skip }}</b></span>
          <span
            v-if="(extra.failed ?? 0) > 0"
            class="fail"
          >失败 <b>{{ extra.failed }}</b></span>
          <span>用时 <b>{{ fmtElapsed(bk.elapsedSec) }}</b></span>
        </div>
        <div class="ri-actions">
          <NButton
            v-if="!paused"
            size="small"
            round
            @click="bk.pause()"
          >
            暂停
          </NButton>
          <NButton
            v-else
            size="small"
            type="primary"
            round
            @click="bk.resume()"
          >
            恢复
          </NButton>
          <NButton
            size="small"
            quaternary
            type="error"
            round
            @click="onCancel"
          >
            取消
          </NButton>
          <span class="flex1" />
          <NButton
            size="small"
            quaternary
            round
            @click="showLogs = true"
          >
            运行日志
            <template v-if="bk.logs.length">
              （{{ bk.logs.length }}）
            </template>
          </NButton>
          <NButton
            size="small"
            quaternary
            round
            @click="showDownloads = true"
          >
            下载明细
            <template v-if="dlCount">
              （{{ dlCount }}<span
                v-if="dlFailed"
                class="dl-fail"
              >/失败 {{ dlFailed }}</span>）
            </template>
          </NButton>
        </div>

        <!-- 模块清单 -->
        <AnimatePresence>
          <div class="mod-track">
            <div
              v-for="m in moduleItems"
              :key="m.key"
              class="mt-item"
              :class="{ done: m.done, active: m.active, paused: paused && m.active }"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path :d="m.icon" />
              </svg>
              <span class="mt-label">{{ m.label }}</span>
              <Motion
                v-if="m.done"
                tag="span"
                :initial="{ scale: 0.4, opacity: 0 }"
                :animate="{ scale: 1, opacity: 1 }"
                :transition="{ type: 'spring', stiffness: 500, damping: 24 }"
                class="mt-done"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><path d="M5 12.5l4.2 4.2L19 7" /></svg>
              </Motion>
              <span
                v-else-if="m.active"
                class="mt-spin"
              />
            </div>
          </div>
        </AnimatePresence>
      </div>
    </div>

    <!-- 日志抽屉 -->
    <NDrawer
      v-model:show="showLogs"
      :width="560"
      placement="right"
    >
      <NDrawerContent
        title="运行日志"
        closable
      >
        <div class="log-list app-scroll">
          <div
            v-for="(l, i) in [...bk.logs].reverse()"
            :key="i"
            class="log-line"
            :class="l.level"
          >
            <span class="log-time">{{ l.time }}</span>
            <span class="log-msg">{{ l.message }}</span>
          </div>
        </div>
        <template #footer>
          <NButton
            size="small"
            @click="bk.exportLogs()"
          >
            导出日志
          </NButton>
        </template>
      </NDrawerContent>
    </NDrawer>

    <!-- 下载明细抽屉 -->
    <NDrawer
      v-model:show="showDownloads"
      :width="620"
      placement="right"
    >
      <NDrawerContent
        title="下载明细"
        closable
      >
        <div class="dl-toolbar">
          <NTag
            v-for="s in DL_STATES"
            :key="s.key"
            size="small"
            round
            :bordered="false"
            :type="bk.downloadFilter === s.key ? 'primary' : 'default'"
            style="cursor: pointer"
            @click="bk.downloadFilter = s.key"
          >
            {{ s.label }}
          </NTag>
          <span class="flex1" />
          <NButton
            size="tiny"
            quaternary
            @click="bk.clearDoneDownloads()"
          >
            清除已完成
          </NButton>
        </div>
        <div class="dl-list app-scroll">
          <div
            v-for="d in bk.filteredDownloads"
            :key="d.id"
            class="dl-item"
          >
            <div
              class="dl-name"
              :title="d.url"
            >
              {{ bk.downloadName(d.url) }}
            </div>
            <NTag
              size="tiny"
              round
              :bordered="false"
              :type="d.state === 'failed' ? 'error' : d.state === 'done' ? 'success' : 'default'"
            >
              {{ bk.stateLabel(d.state) }}
            </NTag>
          </div>
          <div
            v-if="!bk.dlFilterCount"
            class="dl-empty"
          >
            暂无下载任务
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>
  </section>
</template>

<style scoped>
.running {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.run-card {
  display: flex;
  gap: 30px;
  align-items: flex-start;
  padding: 28px 32px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
}
.run-progress {
  flex-shrink: 0;
}
.rp-center {
  text-align: center;
}
.rp-pct {
  font-size: 24px;
  font-weight: 700;
}
.rp-state {
  font-size: 11.5px;
  opacity: 0.55;
  margin-top: 2px;
}
.run-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ri-current {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.ri-module {
  font-size: 17px;
  font-weight: 700;
}
.ri-tip {
  font-size: 12.5px;
  opacity: 0.55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ri-modpct {
  margin-left: auto;
  font-size: 12.5px;
  font-weight: 600;
  color: #b45f3d;
  flex-shrink: 0;
}
.ri-stats {
  display: flex;
  gap: 18px;
  font-size: 12.5px;
  opacity: 0.75;
}
.ri-stats b {
  font-weight: 700;
}
.fail {
  color: #d03050;
}
.ri-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.flex1 {
  flex: 1;
}
.dl-fail {
  color: #d03050;
}
.mod-track {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}
.mt-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--surface-border);
  font-size: 12.5px;
  opacity: 0.55;
}
.mt-item svg {
  width: 14px;
  height: 14px;
}
.mt-item.active {
  border-color: #b45f3d;
  color: #b45f3d;
  opacity: 1;
  font-weight: 600;
}
.mt-item.paused {
  border-color: #f0a020;
  color: #f0a020;
}
.mt-item.done {
  opacity: 1;
  border-color: rgba(24, 160, 88, 0.5);
}
.mt-done {
  display: inline-flex;
  color: #18a058;
}
.mt-done svg {
  width: 13px;
  height: 13px;
}
.mt-spin {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1.8px solid rgba(180, 95, 61, 0.25);
  border-top-color: #b45f3d;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.log-list {
  height: 100%;
  overflow-y: auto;
  font-family: var(--mono-font);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.log-line {
  display: flex;
  gap: 10px;
  line-height: 1.6;
}
.log-time {
  opacity: 0.45;
  flex-shrink: 0;
}
.log-line.error .log-msg {
  color: #d03050;
}
.log-line.warn .log-msg {
  color: #f0a020;
}
.log-line.success .log-msg {
  color: #18a058;
}
.dl-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
.dl-list {
  height: calc(100% - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dl-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}
.dl-name {
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dl-empty {
  text-align: center;
  padding: 40px 0;
  opacity: 0.45;
  font-size: 13px;
}
</style>
