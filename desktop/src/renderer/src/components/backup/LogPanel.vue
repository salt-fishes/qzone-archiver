<script setup lang="ts">
/** 运行日志面板（从 BackupView 拆出）
 *  独立组件粒度：logs 变化只重渲染本面板，不牵连进度区/下载列表
 *  层级：默认折叠，点击标题展开
 */
import { ref, watch, nextTick } from 'vue';
import { useBackupStore } from '../../stores/backup';

const bk = useBackupStore();
const { logs, exportLogs } = bk;
const logBox = ref<HTMLDivElement | null>(null);
const open = ref(false);

// 展开时新日志自动滚动到底部
watch(
  () => logs.value.length,
  async () => {
    if (!open.value) return;
    await nextTick();
    if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight;
  }
);
</script>

<template>
  <section class="panel">
    <div class="panel-title-row dl-head">
      <button class="dl-toggle" @click="open = !open" :aria-expanded="open">
        <h3 class="panel-title">运行日志</h3>
        <svg class="chev" :class="{ up: open }" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6l5 5 5-5" />
        </svg>
      </button>
      <button v-if="logs.length && open" class="link-btn" @click="exportLogs">导出日志</button>
    </div>

    <div v-if="open" ref="logBox" class="log">
      <div v-for="(l, i) in logs" :key="i" :class="['line', l.level]">
        <span class="t">{{ l.time }}</span>
        <span class="msg">{{ l.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="empty">暂无日志</div>
    </div>
  </section>
</template>

<style scoped>
.dl-head {
  margin-bottom: 0;
}
.dl-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
}
.dl-toggle .panel-title {
  margin: 0;
}
.chev {
  width: 14px;
  height: 14px;
  color: var(--ink-soft);
  transition: transform 0.2s ease;
}
.chev.up {
  transform: rotate(180deg);
}
</style>
