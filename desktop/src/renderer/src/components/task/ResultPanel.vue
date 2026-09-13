<script setup lang="ts">
/**
 * 任务结果面板（v4.6）：完成/部分失败汇总 + 快捷操作（打开档案/文件夹/再来一次）
 * 对勾入场使用 motion-v 弹簧动画（prefers-reduced-motion 时 motion-v 自动降级）
 */
import { computed } from 'vue';
import { NButton, NTag, NAlert } from 'naive-ui';
import { Motion } from 'motion-v';
import type { BackupResult } from '../../stores/backup';
import { MODULE_META } from '../../stores/config';

const props = defineProps<{
  result: BackupResult;
  elapsed: number;
}>();

const emit = defineEmits<{
  again: [];
  home: [];
}>();

const hasErrors = computed(() => (props.result.errors?.length || 0) > 0);

const stats = computed(() => {
  const r = props.result;
  return [
    { label: '内容条数', value: (r.total ?? 0).toLocaleString() },
    { label: '文件数', value: (r.files ?? 0).toLocaleString() },
    { label: '占用空间', value: fmtSize(r.size ?? 0) || '—' },
    { label: '用时', value: fmtElapsed(props.elapsed) },
  ];
});

const moduleChips = computed(() =>
  Object.entries(props.result.moduleCounts || {}).map(([m, n]) => ({
    label: MODULE_META[m]?.label || m,
    count: n,
  }))
);

function openArchive() {
  if (props.result.targetDir) window.api.viewer.open(props.result.targetDir);
}
function openFolder() {
  if (props.result.targetDir) window.api.fs.showInFolder(props.result.targetDir);
}

function fmtSize(n: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtElapsed(sec: number) {
  if (sec == null || sec < 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}
</script>

<template>
  <section class="result">
    <div class="result-card">
      <Motion
        :initial="{ scale: 0.4, opacity: 0 }"
        :animate="{ scale: 1, opacity: 1 }"
        :transition="{ type: 'spring', stiffness: 380, damping: 20 }"
      >
        <div
          class="badge"
          :class="{ warn: hasErrors }"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              v-if="!hasErrors"
              d="M5 12.5l4.2 4.2L19 7"
            />
            <path
              v-else
              d="M12 8v5 M12 16.5v.01"
            />
          </svg>
        </div>
      </Motion>

      <h2>{{ hasErrors ? '备份完成，部分内容失败' : '备份完成' }}</h2>
      <p class="sub">
        {{ result.target?.nickname ? `${result.target.nickname} 的` : '' }}档案已保存到本地
      </p>

      <div class="stat-row">
        <div
          v-for="s in stats"
          :key="s.label"
          class="stat"
        >
          <div class="stat-v">
            {{ s.value }}
          </div>
          <div class="stat-l">
            {{ s.label }}
          </div>
        </div>
      </div>

      <div
        v-if="moduleChips.length"
        class="chips"
      >
        <NTag
          v-for="c in moduleChips"
          :key="c.label"
          size="small"
          round
          :bordered="false"
        >
          {{ c.label }} {{ c.count.toLocaleString() }}
        </NTag>
      </div>

      <NAlert
        v-if="hasErrors"
        type="warning"
        class="err-alert"
        title="以下内容备份失败"
      >
        <div
          v-for="e in result.errors"
          :key="e.module"
          class="err-line"
        >
          {{ e.message || e.module }}
        </div>
      </NAlert>

      <div class="actions">
        <NButton
          type="primary"
          size="large"
          round
          @click="openArchive"
        >
          <template #icon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              width="17"
              height="17"
            >
              <path d="M2.5 12a9.5 9.5 0 1 0 19 0 9.5 9.5 0 0 0-19 0Z M3 12h18 M12 2.5c2.5 2.6 3.8 5.9 3.8 9.5s-1.3 6.9-3.8 9.5c-2.5-2.6-3.8-5.9-3.8-9.5s1.3-6.9 3.8-9.5Z" />
            </svg>
          </template>
          浏览档案
        </NButton>
        <NButton
          quaternary
          round
          @click="openFolder"
        >
          打开文件夹
        </NButton>
        <span class="flex1" />
        <NButton
          tertiary
          round
          @click="emit('again')"
        >
          再备一次
        </NButton>
        <NButton
          tertiary
          round
          @click="emit('home')"
        >
          返回首页
        </NButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.result {
  display: flex;
  justify-content: center;
  padding-top: 30px;
}
.result-card {
  width: 620px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 44px 34px;
  border-radius: 18px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
}
.badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: rgba(24, 160, 88, 0.12);
  color: #18a058;
  margin-bottom: 16px;
}
.badge.warn {
  background: rgba(240, 160, 32, 0.14);
  color: #f0a020;
}
.badge svg {
  width: 32px;
  height: 32px;
}
h2 {
  margin: 0 0 6px;
  font-size: 20px;
}
.sub {
  margin: 0 0 22px;
  font-size: 13px;
  opacity: 0.55;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  width: 100%;
  margin-bottom: 18px;
}
.stat-v {
  font-size: 19px;
  font-weight: 700;
}
.stat-l {
  margin-top: 2px;
  font-size: 11.5px;
  opacity: 0.5;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-bottom: 18px;
}
.err-alert {
  width: 100%;
  margin-bottom: 18px;
  text-align: left;
}
.err-line {
  font-size: 12.5px;
  line-height: 1.8;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  flex-wrap: wrap;
}
.flex1 {
  flex: 1;
}
</style>
