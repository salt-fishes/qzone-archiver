<script setup lang="ts">
/** 累计档案统计（S2 概览）：从备份历史记录聚合（备份完成时自动记录） */
defineProps<{
  backups: number;
  total: number;
  files: number;
  size: number;
  loading: boolean;
}>();

function fmtSize(n: number) {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtInt(n: number) {
  return n ? n.toLocaleString() : '0';
}
</script>

<template>
  <section class="stat-strip">
    <div class="stat-cell">
      <b>{{ loading ? '…' : fmtInt(backups) }}</b>
      <span>备份次数</span>
    </div>
    <span class="sep"></span>
    <div class="stat-cell">
      <b>{{ loading ? '…' : fmtInt(total) }}</b>
      <span>最近条目</span>
    </div>
    <span class="sep"></span>
    <div class="stat-cell">
      <b>{{ loading ? '…' : fmtInt(files) }}</b>
      <span>保存文件</span>
    </div>
    <span class="sep"></span>
    <div class="stat-cell">
      <b>{{ loading ? '…' : fmtSize(size) }}</b>
      <span>总大小</span>
    </div>
  </section>
</template>

<style scoped>
/* 弱化层级：浅色信息条，避免与主 CTA 竞争注意力 */
.stat-strip {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(247, 240, 224, 0.6);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius);
}
.stat-cell {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.stat-cell b {
  font-size: 16px;
  color: var(--accent-deep);
  font-family: Consolas, 'PingFang SC', monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.stat-cell span {
  font-size: 12px;
  color: var(--ink-soft);
}
.sep {
  width: 1px;
  height: 18px;
  background: var(--line-soft);
}
@media (max-width: 640px) {
  .stat-strip {
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 10px;
  }
  .sep {
    display: none;
  }
}
</style>
