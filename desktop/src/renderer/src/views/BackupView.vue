<script setup lang="ts">
/** 备份视图（S3 三步向导 + 进行中面板）
 *  步骤① 选择内容（模块全选默认 + 数据量估算）→ 步骤② 保存位置 → 步骤③ 确认并开始
 *  开始后切换为进行中面板（进度/下载明细/运行日志；S4 将重做表达）
 */
import { ref, computed, onMounted } from 'vue';
import { useAuth } from '../stores/auth';
import { useConfigStore, MODULE_META, MODULE_KEYS } from '../stores/config';
import { useBackupStore } from '../stores/backup';
import StepIndicator from '../components/backup/StepIndicator.vue';
import ModulePicker from '../components/backup/ModulePicker.vue';
import DirPicker from '../components/backup/DirPicker.vue';
import DownloadPanel from '../components/backup/DownloadPanel.vue';
import LogPanel from '../components/backup/LogPanel.vue';
import SuccessPanel from '../components/backup/SuccessPanel.vue';
import ConfirmDialog from '../components/ui/ConfirmDialog.vue';

const { auth, login } = useAuth();
const cfg = useConfigStore();
const { selectedCount, selectedModules, targetDir, settings, getPath } = cfg;
const bk = useBackupStore();
const {
  busy, paused, progress, elapsedSec, lastResult,
  pushLog, startBackup, pause, resume, cancel, resetResult,
} = bk;

/** 本次备份方式：任一已选模块为「上次」即按增量提示（确认页展示） */
const isIncremental = computed(() => {
  const first = selectedModules.value.find((m) => MODULE_KEYS.includes(m));
  if (!first) return false;
  return getPath(settings.value[first], 'IncrementType') === 'Last';
});

/* ============ 向导状态 ============ */
const step = ref(1);
const starting = ref(false);

/** 取消备份（带确认，防误触丢失进度） */
const showCancelConfirm = ref(false);

/** 成功页「再次备份」：回到向导第一步 */
function onAgain() {
  resetResult();
  step.value = 1;
}

/** 数据量估算：上次备份 manifest 的各模块条目数（backup-history 最新一条） */
type HistoryEntry = {
  moduleCounts?: Record<string, number>;
  size?: number;
  total?: number;
};
const history = ref<HistoryEntry[]>([]);
const estimates = computed(() => history.value[0]?.moduleCounts || {});
const lastSize = computed(() => history.value[0]?.size || 0);
const lastTotal = computed(() => history.value[0]?.total || 0);

async function loadHistory() {
  try {
    const r = await window.api.backup.getHistory();
    history.value = r?.history || [];
  } catch (e) {
    console.warn('读取备份历史失败', e);
  }
}

function fmtSize(n: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const currentModuleLabel = computed(() => {
  const m = progress.value.module || '';
  return MODULE_META[m] ? MODULE_META[m].label : m;
});

/** 进度计数（extra 可选，避免模板嵌套可选链的类型误报） */
const progExtra = computed(() => progress.value?.extra || {});

function fmtElapsed(sec?: number) {
  if (sec == null || sec < 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function canNext() {
  if (step.value === 1) return selectedCount.value > 0;
  if (step.value === 2) return !!targetDir.value;
  return true;
}

async function doStart() {
  if (!auth.loggedIn) {
    pushLog('warn', '请先扫码登录 QQ 空间再开始备份');
    return;
  }
  starting.value = true;
  try {
    await startBackup();
  } finally {
    starting.value = false;
  }
}

// 事件订阅为应用级（App.vue onMounted initBackup），本视图不重复订阅/取消
onMounted(() => {
  loadHistory();
});
</script>

<template>
  <section class="backup-view">
    <!-- 进行中：进度 / 下载明细 / 运行日志 -->
    <template v-if="busy">
      <section class="panel">
        <div class="panel-title-row">
          <h3 class="panel-title">备份进度</h3>
          <div class="bv-actions">
            <button class="btn sm" :disabled="paused" @click="pause">暂停</button>
            <button class="btn sm" :disabled="!paused" @click="resume">恢复</button>
            <button class="btn danger sm" @click="showCancelConfirm = true">取消</button>
          </div>
        </div>
        <template v-if="progress.module">
          <div class="prog-head">
            <span class="prog-module">{{ currentModuleLabel }}</span>
            <span class="prog-phase">{{ paused ? '暂停中' : (progress.tip || progress.phase) }}</span>
            <span class="prog-percent">{{ progress.percent ?? 0 }}%</span>
          </div>
          <div class="bar">
            <div class="bar-fill" :style="{ width: (progress.percent ?? 0) + '%' }"></div>
          </div>
          <div class="prog-meta">
            <span>成功 {{ progExtra.success ?? 0 }}</span>
            <span v-if="(progExtra.skip ?? 0) > 0">跳过 {{ progExtra.skip }}</span>
            <span v-if="(progExtra.failed ?? 0) > 0" class="fail">失败 {{ progExtra.failed }}</span>
            <span class="elapsed">用时 {{ fmtElapsed(elapsedSec) }}</span>
          </div>
        </template>
        <p v-else class="prog-empty">正在启动备份…</p>
      </section>

      <!-- 下载明细 / 运行日志：独立子组件，progress 事件不再触发大列表整体 diff -->
      <DownloadPanel />
      <LogPanel />
    </template>

    <!-- 备份完成：成功页（C 端习惯：对勾动画 + 数据汇总 + 快捷操作） -->
    <template v-else-if="lastResult">
      <SuccessPanel :result="lastResult" :elapsed="elapsedSec" @again="onAgain" />
    </template>

    <!-- 未开始：三步向导 -->
    <template v-else>
      <StepIndicator :current="step" />

      <section class="panel bv-step">
        <!-- 步骤① 选择内容 -->
        <div v-if="step === 1">
          <h3 class="panel-title">选择备份内容</h3>
          <ModulePicker :estimates="estimates" />
        </div>

        <!-- 步骤② 保存位置 -->
        <div v-else-if="step === 2">
          <h3 class="panel-title">备份保存到哪里？</h3>
          <DirPicker />
        </div>

        <!-- 步骤③ 确认并开始 -->
        <div v-else>
          <h3 class="panel-title">确认并开始备份</h3>
          <div class="confirm-list">
            <div class="confirm-row">
              <span class="c-key">备份内容</span>
              <span class="c-val">
                全部 {{ selectedCount }} 项：{{ selectedModules.map((m) => MODULE_META[m].label).join('、') }}
              </span>
            </div>
            <div class="confirm-row">
              <span class="c-key">保存位置</span>
              <span class="c-val mono">{{ targetDir }}</span>
            </div>
            <div class="confirm-row">
              <span class="c-key">备份方式</span>
              <span class="c-val">{{ isIncremental ? '只备份新增内容（上次之后）' : '全量备份' }}</span>
            </div>
            <div v-if="lastTotal || lastSize" class="confirm-row">
              <span class="c-key">数据量参考</span>
              <span class="c-val">
                {{ lastTotal ? lastTotal.toLocaleString() + ' 条内容' : '' }}
                {{ lastTotal && lastSize ? ' · ' : '' }}
                {{ lastSize ? fmtSize(lastSize) : '' }}
                <span class="c-hint">（上次备份）</span>
              </span>
            </div>
          </div>
          <!-- 未登录：内联引导去扫码（不再只写日志） -->
          <div v-if="!auth.loggedIn" class="confirm-login">
            <p class="confirm-login-txt">备份前需要先登录你的 QQ 空间。</p>
            <button class="btn primary" @click="login">去扫码登录</button>
          </div>
        </div>

        <div class="bv-nav">
          <button v-if="step > 1" class="btn" @click="step--">上一步</button>
          <template v-if="step < 3">
            <span class="bv-spacer"></span>
            <button class="btn primary" :disabled="!canNext()" @click="step++">下一步</button>
          </template>
          <template v-else>
            <span class="bv-spacer"></span>
            <button class="btn primary" :disabled="starting || !auth.loggedIn" @click="doStart">开始备份</button>
          </template>
        </div>
      </section>
    </template>

    <ConfirmDialog
      :show="showCancelConfirm"
      title="取消备份？"
      message="正在进行的备份将被中止，本次进度不会保留；已下载的文件会留在目标目录。"
      confirm-text="取消备份"
      danger
      @confirm="showCancelConfirm = false; cancel()"
      @cancel="showCancelConfirm = false"
    />
  </section>
</template>

<style scoped>
.backup-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
}
.bv-step {
  padding: 20px 24px 16px;
}
.bv-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}
.bv-spacer {
  flex: 1;
}
.bv-actions {
  display: flex;
  gap: 8px;
}
.confirm-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.confirm-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  font-size: 13px;
}
.c-key {
  flex-shrink: 0;
  width: 76px;
  color: var(--ink-soft);
}
.c-val {
  color: var(--ink);
  min-width: 0;
  word-break: break-all;
}
.c-val.mono {
  font-family: Consolas, monospace;
  font-size: 12.5px;
}
.c-hint {
  font-size: 11.5px;
  color: var(--ink-soft);
}
.confirm-warn {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--err);
}
.confirm-login {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  padding: 12px 14px;
  background: rgba(154, 83, 54, 0.07);
  border: 1px dashed #d8a08a;
  border-radius: var(--radius-sm);
}
.confirm-login-txt {
  margin: 0;
  font-size: 12.5px;
  color: var(--ink-soft);
}
</style>
