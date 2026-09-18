<script setup lang="ts">
/**
 * 新建任务视图（v4.6）：三步向导（备份谁 → 选内容 → 位置与确认）→ 进行中 → 结果
 * 进行中/结果面板复用全局 backup store 状态，路由切换不中断任务
 */
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { NSteps, NStep, NButton, NInput, NAlert } from 'naive-ui';
import { useAuthStore } from '../stores/auth';
import { useConfigStore, MODULE_META, MODULE_KEYS, getPath } from '../stores/config';
import { useBackupStore } from '../stores/backup';
import { useTargetStore } from '../stores/target';
import TargetPicker from '../components/task/TargetPicker.vue';
import EmoticonText from '../components/common/EmoticonText.vue';
import ContentPicker from '../components/task/ContentPicker.vue';
import RunningPanel from '../components/task/RunningPanel.vue';
import ResultPanel from '../components/task/ResultPanel.vue';

const router = useRouter();
const { auth, login, ensureProfile } = useAuthStore();
const cfg = useConfigStore();
const { selectedCount, selectedModules, targetDir, settings } = storeToRefs(cfg);
const bk = useBackupStore();
const { busy, lastResult } = storeToRefs(bk);
const { startBackup, resetResult, pushLog } = bk;
const target = useTargetStore();

/* ============ 数据量参考（同一备份目标的上次记录） ============ */
type HistoryEntryLite = {
  moduleCounts?: Record<string, number>;
  size?: number;
  total?: number;
  target?: { uin?: string; nickname?: string };
};
const history = ref<HistoryEntryLite[]>([]);
onMounted(async () => {
  // §A：已登录但昵称缺失时后台重试补齐（本人卡片/问候语自动更新）
  ensureProfile();
  try {
    const r = await window.api.backup.getHistory();
    history.value = r?.history || [];
  } catch (e) {
    console.warn('读取备份历史失败', e);
  }
});

/** 当前备份目标标识：本人 = ''，好友 = uin（与历史记录的 target.uin 口径一致） */
const currentTargetKey = computed(() => String(target.effectiveUin || ''));

/**
 * v4.7 修复（反馈 ③④）：数据量参考只取**同一个 QQ** 的上次记录。
 * 此前无条件取历史第一条，导致备份不同好友时也显示上一个好友的条数，容易误导。
 */
const lastSameTarget = computed<HistoryEntryLite | null>(() => {
  const key = currentTargetKey.value;
  return history.value.find((h) => String(h.target?.uin || '') === key) || null;
});
const estimates = computed(() => lastSameTarget.value?.moduleCounts || {});
const lastSize = computed(() => lastSameTarget.value?.size || 0);
const lastTotal = computed(() => lastSameTarget.value?.total || 0);

/**
 * 备份方式文案（v4.7 反馈 ④）：优先反映「本次备份方式」的选择，
 * 未选择（按设置）时回落到各模块自己的增量配置。
 */
const MODE_LABEL: Record<string, string> = {
  Full: '全量备份（本次从头备份）',
  Last: '只备份新增内容（上次之后）',
  Custom: '按自定义时间备份',
};
const isIncremental = computed(() => {
  if (cfg.backupMode !== 'default') return cfg.backupMode === 'Last' || cfg.backupMode === 'Custom';
  const first = selectedModules.value.find((m) => MODULE_KEYS.includes(m));
  if (!first) return false;
  return getPath(settings.value[first], 'IncrementType') === 'Last';
});
const backupModeLabel = computed(
  () => MODE_LABEL[cfg.backupMode] || (isIncremental.value ? '只备份新增内容（上次之后）' : '全量备份')
);

/* ============ 向导状态 ============ */
const step = ref(1);
const starting = ref(false);

/** 向导有效状态：他人模式必须完成校验 */
const targetValid = computed(() => target.mode === 'self' || !!target.profile);

function canNext() {
  if (step.value === 1) return targetValid.value;
  if (step.value === 2) return selectedCount.value > 0;
  return true;
}

async function doStart() {
  if (!auth.loggedIn) {
    pushLog('warn', '请先扫码登录 QQ 空间再开始备份');
    return;
  }
  starting.value = true;
  try {
    await startBackup(target.effectiveUin);
  } finally {
    starting.value = false;
  }
}

function onAgain() {
  resetResult();
  target.reset();
  step.value = 1;
}

function onHome() {
  resetResult();
  target.reset();
  router.push('/');
}

function fmtSize(n: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function pickDir() {
  cfg.pickDir();
}
</script>

<template>
  <section class="new-task">
    <!-- 进行中 -->
    <RunningPanel v-if="busy" />

    <!-- 结果 -->
    <ResultPanel
      v-else-if="lastResult"
      :result="lastResult"
      :elapsed="bk.elapsedSec"
      @again="onAgain"
      @home="onHome"
    />

    <!-- 向导 -->
    <template v-else>
      <div class="nt-head">
        <h2>新建备份任务</h2>
        <p>{{ target.mode === 'other' ? '备份好友空间的公开内容' : '把你的空间记忆保存到本地' }}</p>
      </div>

      <NSteps
        :current="step"
        size="small"
        class="nt-steps"
      >
        <NStep title="备份谁的空间" />
        <NStep title="选择内容" />
        <NStep title="保存位置" />
      </NSteps>

      <div class="nt-card">
        <!-- 第①步：目标 -->
        <template v-if="step === 1">
          <TargetPicker />
        </template>

        <!-- 第②步：内容 -->
        <template v-else-if="step === 2">
          <ContentPicker :estimates="estimates" />
        </template>

        <!-- 第③步：位置与确认 -->
        <template v-else>
          <div class="loc-block">
            <h4>保存到哪里？</h4>
            <div class="loc-row">
              <NInput
                :value="targetDir"
                readonly
                placeholder="尚未选择文件夹"
                class="loc-input"
              />
              <NButton @click="pickDir">
                选择文件夹
              </NButton>
            </div>
          </div>

          <div class="confirm-block">
            <h4>确认备份</h4>
            <div class="c-row">
              <span class="c-k">备份目标</span>
              <span class="c-v">
                <template v-if="target.isOtherUser">
                  他人空间（<EmoticonText
                    v-if="target.profile?.nickname"
                    :text="target.profile.nickname"
                    :size="15"
                  />{{ target.profile?.nickname ? ' · ' : '' }}QQ {{ target.profile?.uin }}）的公开内容
                </template>
                <template v-else>我的空间（{{ auth.qqNumber || '未登录' }}）</template>
              </span>
            </div>
            <div class="c-row">
              <span class="c-k">备份内容</span>
              <span class="c-v">共 {{ selectedCount }} 项：{{ selectedModules.map((m) => MODULE_META[m].label).join('、') }}</span>
            </div>
            <div class="c-row">
              <span class="c-k">备份方式</span>
              <span class="c-v">{{ backupModeLabel }}</span>
            </div>
            <div
              v-if="lastTotal || lastSize"
              class="c-row"
            >
              <span class="c-k">数据量参考</span>
              <span class="c-v">
                {{ lastTotal ? lastTotal.toLocaleString() + ' 条' : '' }}
                {{ lastTotal && lastSize ? ' · ' : '' }}
                {{ lastSize ? fmtSize(lastSize) : '' }}
                <span class="c-hint">（按该目标上次备份估算）</span>
              </span>
            </div>
          </div>

          <NAlert
            v-if="target.isOtherUser"
            type="warning"
            :show-icon="true"
          >
            将访问好友 {{ target.profile?.uin }} 的公开内容，会留下访客记录；私密内容（日记、收藏等）无法备份。
          </NAlert>

          <NAlert
            v-if="!auth.loggedIn"
            type="info"
            :show-icon="true"
          >
            <div class="login-row">
              <span>备份前需要先登录你的 QQ 空间。</span>
              <NButton
                size="small"
                type="primary"
                round
                @click="login"
              >
                去扫码登录
              </NButton>
            </div>
          </NAlert>
        </template>

        <!-- 底部导航 -->
        <div class="nt-nav">
          <NButton
            v-if="step > 1"
            quaternary
            @click="step--"
          >
            上一步
          </NButton>
          <span class="flex1" />
          <NButton
            v-if="step < 3"
            type="primary"
            round
            :disabled="!canNext()"
            @click="step++"
          >
            下一步
          </NButton>
          <NButton
            v-else
            type="primary"
            size="large"
            round
            :loading="starting"
            :disabled="!auth.loggedIn || !targetDir || starting"
            @click="doStart"
          >
            开始备份
          </NButton>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.new-task {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.nt-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.nt-head p {
  margin: 0;
  font-size: 13px;
  opacity: 0.55;
}
.nt-steps {
  padding: 4px 4px 0;
}
.nt-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 26px 30px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
}
.loc-block h4,
.confirm-block h4 {
  margin: 0 0 10px;
  font-size: 14px;
}
.loc-row {
  display: flex;
  gap: 10px;
}
.loc-input {
  flex: 1;
}
.loc-input :deep(input) {
  font-family: var(--mono-font);
  font-size: 12.5px;
}
.confirm-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.c-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  font-size: 13px;
}
.c-k {
  flex-shrink: 0;
  width: 72px;
  opacity: 0.5;
}
.c-v {
  min-width: 0;
  word-break: break-all;
}
.c-hint {
  font-size: 11.5px;
  opacity: 0.5;
}
.login-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.nt-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
}
.flex1 {
  flex: 1;
}
</style>
