<script setup lang="ts">
/**
 * 任务进行中面板（v4.6）：大进度环 + 模块清单 + 日志/下载抽屉 + 暂停/恢复/取消
 * 数据全部来自 backup store（主进程状态机为唯一事实源）
 */
import { computed, ref } from 'vue';
import { NButton, NProgress, NDrawer, NDrawerContent, NTag, useDialog } from 'naive-ui';
import { AnimatePresence, Motion } from 'motion-v';
import { useBackupStore, DL_STATES } from '../../stores/backup';
import { useAuthStore } from '../../stores/auth';
import { MODULE_META, MODULE_ICONS } from '../../stores/config';
import VirtualList from '../common/VirtualList.vue';

const bk = useBackupStore();
const auth = useAuthStore();
const dialog = useDialog();

const paused = computed(() => bk.paused);
/** v5.5 M1：ack 窗口的中间态（按钮禁用 + 文案，避免重复点击） */
const pausing = computed(() => bk.taskState === 'pausing');
const resuming = computed(() => bk.taskState === 'resuming');
/**
 * v5.5 M0 补：engine_lost/auth_lost 的引擎会话已失效（窗口重建/页面离开 qzone），
 * 新引擎里没有运行中的任务，直接“恢复”只会把状态误置回 running。
 * 这两种原因只展示处置卡（重连/登录 + 取消后重发），不提供通用恢复按钮。
 */
const canResume = computed(() => {
  const r = bk.pausedReason;
  return !r || r === 'user' || r === 'rate_limited';
});
/** 当前阶段进度（0-100，阶段内原始百分比，子条显示用） */
const modulePercent = computed(() => bk.progress?.percent ?? 0);
/** 收尾可见状态（引擎已完成、等待下载落盘/统计归档） */
const finalizingActive = computed(() => bk.finalizingActive);
const finalizeTip = computed(() => {
  const f = bk.finalizing;
  if (!f) return '';
  if (f.phase === 'stats') return '正在统计归档信息…';
  const left = (f.pending || 0) + (f.running || 0);
  return left > 0
    ? `等待媒体下载落盘（剩余 ${left} 项），完成后自动进入结果页`
    : '正在准备完成页…';
});
/**
 * 总体进度：已完成模块数 + 当前模块加权进度（v5.0：阶段内单调不回退），
 * 按**实际执行的模块清单**（bk.moduleList：他人模式为引擎过滤后的清单）折算。
 * 此前用所选模块数——被剔除的隐私模块永远完不成，总进度到不了 100%。
 */
const overallPercent = computed(() => {
  const list = bk.moduleList;
  const total = list.length;
  if (!total) return modulePercent.value;
  const done = bk.doneModules.filter((m) => list.includes(m)).length;
  const frac = Math.min(100, Math.max(0, bk.moduleOverall)) / 100;
  return Math.min(99, Math.round(((done + frac) / total) * 100));
});
/** 环形进度：收尾阶段采集已 100% 完成，明确显示满环 + 「收尾中」 */
const ringPercent = computed(() => (finalizingActive.value ? 100 : overallPercent.value));
const currentLabel = computed(() => {
  const m = bk.progress?.module || '';
  return MODULE_META[m]?.label || m || '正在启动';
});
const extra = computed(() => bk.progress?.extra || {});

/** 模块清单（含完成态；以主进程推送的实际执行清单为准） */
const moduleItems = computed(() =>
  bk.moduleList.map((m) => ({
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
/** v4.7：后台仍在下载的媒体数（采集完成 ≠ 媒体下载完成） */
const dlActive = computed(() => bk.downloadingCount);

function onCancel() {
  dialog.warning({
    title: '取消备份？',
    content: '正在进行的备份将被中止，本次进度不会保留；已下载的文件会留在目标目录。',
    positiveText: '取消备份',
    negativeText: '继续备份',
    onPositiveClick: () => bk.cancel(),
  });
}

/** v5.5 M0：停滞横幅明细（最后阶段 + 无心跳时长） */
const stallDetail = computed(() => {
  const info = bk.stalledInfo;
  const mod = info?.lastModule ? MODULE_META[info.lastModule]?.label || info.lastModule : '';
  const sec = Math.round((info?.silentMs || 0) / 1000);
  const dur = sec >= 120 ? `${Math.floor(sec / 60)} 分钟${sec % 60 ? ` ${sec % 60} 秒` : ''}` : `${sec} 秒`;
  const phase = mod || info?.lastPhase || '';
  return `${phase ? `最后阶段：${phase}，` : ''}已 ${dur} 无引擎心跳`;
});

/** v5.5 M0：非用户暂停的原因卡文案与动作（引擎丢失/登录失效/限流的处置指引各不相同） */
const pauseReasonCard = computed(() => {
  const reason = bk.pausedReason;
  if (!bk.paused || !reason || reason === 'user') return null;
  if (reason === 'engine_lost') {
    return {
      type: 'error' as const,
      title: '引擎已断开（窗口被关闭或崩溃）',
      text: '已采集的文件保留在目标目录。点击「重连引擎」恢复连接；本版本暂不支持断点续跑，请取消本任务后重新发起备份。',
      actionLabel: '重连引擎',
      action: () => bk.retryEngine(),
    };
  }
  if (reason === 'auth_lost') {
    return {
      type: 'warning' as const,
      title: '登录已失效',
      text: 'QQ 空间页面已离开登录态，本次备份无法继续。请先取消本任务，再重新扫码登录并新建备份（已采集的文件保留）。',
      actionLabel: '扫码登录',
      action: () => auth.login(),
    };
  }
  return {
    type: 'warning' as const,
    title: '接口限流保护',
    text: 'QQ 空间接口连续异常，已暂停请求以避免加重限制。建议等待 10~30 分钟后点击「恢复」继续；如仍频繁限流，可到「设置 → 内容默认设置」关闭「获取赞列表 / 评论」后重新备份。',
    actionLabel: '',
    action: null,
  };
});

function fmtElapsed(sec?: number) {
  if (sec == null || sec < 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
</script>

<template>
  <section class="running">
    <!-- v5.5 M0：停滞横幅——30s 无引擎心跳时显示最后阶段与时长，提供日志/取消入口 -->
    <div
      v-if="bk.stalled && !paused"
      class="stall-banner"
    >
      <span class="sb-icon">⚠</span>
      <div class="sb-text">
        <b>备份疑似停滞</b>
        <span>{{ stallDetail }}</span>
      </div>
      <NButton
        size="tiny"
        quaternary
        @click="showLogs = true"
      >
        查看日志
      </NButton>
      <NButton
        size="tiny"
        type="error"
        secondary
        @click="onCancel"
      >
        取消备份
      </NButton>
    </div>

    <!-- v5.5 M0：非用户暂停的原因卡（引擎丢失/登录失效/限流的处置指引） -->
    <div
      v-if="pauseReasonCard"
      class="pause-reason"
      :class="pauseReasonCard.type"
    >
      <div class="pr-main">
        <b>{{ pauseReasonCard.title }}</b>
        <span>{{ pauseReasonCard.text }}</span>
      </div>
      <NButton
        v-if="pauseReasonCard.actionLabel"
        size="tiny"
        type="primary"
        secondary
        @click="pauseReasonCard.action?.()"
      >
        {{ pauseReasonCard.actionLabel }}
      </NButton>
    </div>

    <div class="run-card">
      <div class="run-progress">
        <NProgress
          type="circle"
          :percentage="ringPercent"
          :stroke-width="8"
          :size="132"
          :color="paused || pausing ? '#c9a227' : '#b5432a'"
          :rail-color="'rgba(128,128,128,0.18)'"
        >
          <div class="rp-center">
            <div class="rp-pct">
              {{ ringPercent }}%
            </div>
            <div class="rp-state">
              {{ finalizingActive ? '收尾中' : '总体进度' }}{{ paused ? ' · 已暂停' : pausing ? ' · 暂停中' : resuming ? ' · 恢复中' : '' }}
            </div>
          </div>
        </NProgress>
      </div>

      <div class="run-info">
        <div class="ri-current">
          <span class="ri-module">{{ finalizingActive ? '收尾整理' : currentLabel }}</span>
          <span class="ri-tip">{{ finalizingActive ? finalizeTip : (bk.progress?.tip || bk.progress?.phase || '') }}</span>
          <span
            v-if="!finalizingActive"
            class="ri-modpct"
          >{{ modulePercent }}%</span>
        </div>
        <!-- 当前模块副进度条（收尾阶段隐藏：阶段进度已无意义） -->
        <NProgress
          v-if="!finalizingActive"
          type="line"
          :percentage="modulePercent"
          :show-indicator="false"
          :height="5"
          :border-radius="3"
          :color="paused || pausing ? '#c9a227' : '#b5432a'"
        />
        <div class="ri-stats">
          <span>完成模块 <b>{{ bk.doneModules.filter((m) => bk.moduleList.includes(m)).length }}/{{ bk.moduleList.length }}</b></span>
          <span>成功 <b>{{ extra.success ?? 0 }}</b></span>
          <span v-if="(extra.skip ?? 0) > 0">跳过 <b>{{ extra.skip }}</b></span>
          <span
            v-if="(extra.failed ?? 0) > 0"
            class="fail"
          >失败 <b>{{ extra.failed }}</b></span>
          <span v-if="dlActive > 0">媒体下载中 <b>{{ dlActive }}</b></span>
          <span>用时 <b>{{ fmtElapsed(bk.elapsedSec) }}</b></span>
        </div>
        <div class="ri-actions">
          <!-- 收尾阶段隐藏暂停/取消：状态机已进入终态，操作会被拒绝，避免误导 -->
          <template v-if="!finalizingActive">
            <NButton
              v-if="pausing"
              size="small"
              round
              disabled
            >
              暂停中…
            </NButton>
            <NButton
              v-else-if="resuming"
              size="small"
              type="primary"
              round
              disabled
            >
              恢复中…
            </NButton>
            <NButton
              v-else-if="!paused"
              size="small"
              round
              @click="bk.pause()"
            >
              暂停
            </NButton>
            <NButton
              v-else-if="canResume"
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
          </template>
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
          <!-- v4.7：虚拟滚动（1 万条媒体不虚拟化会把界面拖垮） -->
          <VirtualList
            :items="bk.filteredDownloads"
            :item-height="34"
          >
            <template #default="{ item: d }">
              <div class="dl-row">
                <div
                  class="dl-name"
                  :title="bk.downloadLabel(d)"
                >
                  {{ bk.downloadLabel(d) }}
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
            </template>
          </VirtualList>
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
/* v5.5 M0：停滞横幅 */
.stall-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-radius: 12px;
  border: 1px solid rgba(240, 160, 32, 0.45);
  background: rgba(240, 160, 32, 0.08);
  color: #b06f00;
}
.stall-banner .sb-icon {
  font-size: 18px;
}
.sb-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
}
.sb-text b {
  font-size: 13.5px;
}
/* v5.5 M0：暂停原因卡 */
.pause-reason {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 12px;
  font-size: 12.5px;
}
.pause-reason.error {
  border: 1px solid rgba(208, 48, 80, 0.45);
  background: rgba(208, 48, 80, 0.07);
}
.pause-reason.warning {
  border: 1px solid rgba(240, 160, 32, 0.45);
  background: rgba(240, 160, 32, 0.08);
}
.pr-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.pr-main b {
  font-size: 13.5px;
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
  color: #b5432a;
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
  border-color: #b5432a;
  color: #b5432a;
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
  border-top-color: #b5432a;
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.dl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--surface-border);
  box-sizing: border-box;
  margin: 3px 0;
  height: 28px;
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
