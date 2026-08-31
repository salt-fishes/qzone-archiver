<script setup lang="ts">
/** 下载明细面板（从 BackupView 拆出）
 *  独立组件粒度：progress 事件变化只重渲染 BackupView 进度区，
 *  下载列表 DOM 不再随每次进度事件整体 diff（修复大列表渲染卡顿）
 *  层级：默认折叠，点击标题展开——备份时进度区为唯一视觉焦点
 */
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useBackupStore } from '../../stores/backup';
import { MODULE_META } from '../../stores/config';

const bk = useBackupStore();
const { dlCount, downloadFilter, filteredDownloads } = storeToRefs(bk);
const { DL_STATES, clearDoneDownloads, downloadName, formatBytes, stateLabel } = bk;

const open = ref(false);
</script>

<template>
  <section class="panel">
    <div class="panel-title-row dl-head">
      <button
        class="dl-toggle"
        :aria-expanded="open"
        @click="open = !open"
      >
        <h3 class="panel-title">
          下载明细
        </h3>
        <svg
          class="chev"
          :class="{ up: open }"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6l5 5 5-5" />
        </svg>
      </button>
      <button
        v-if="dlCount && open"
        class="link-btn"
        @click="clearDoneDownloads"
      >
        清除完成/失败
      </button>
    </div>

    <template v-if="open">
      <div class="dl-filter">
        <div class="dl-chips">
          <button
            v-for="s in DL_STATES"
            :key="s.key"
            class="chip"
            :class="{ on: downloadFilter === s.key }"
            @click="downloadFilter = s.key"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
      <div
        v-if="filteredDownloads.length"
        class="dl-list"
      >
        <div
          v-for="d in filteredDownloads"
          :key="d.id"
          class="dl-row"
        >
          <span
            v-if="d.module"
            class="dl-mod"
          >{{ MODULE_META[d.module]?.label ?? d.module }}</span>
          <div class="dl-main">
            <span
              class="dl-name"
              :title="d.url"
            >{{ d.name || downloadName(d.url) }}</span>
            <div
              v-if="d.state === 'running' && d.total"
              class="dl-bar"
            >
              <div
                class="dl-bar-fill"
                :style="{ width: (d.percent ?? 0) + '%' }"
              />
            </div>
          </div>
          <span class="dl-size">{{ formatBytes(d.received) }}{{ d.total ? ' / ' + formatBytes(d.total) : '' }}</span>
          <span
            v-if="d.total && d.state === 'running'"
            class="dl-pct"
          >{{ d.percent ?? 0 }}%</span>
          <span
            class="dl-state"
            :class="d.state"
          >{{ stateLabel(d.state) }}</span>
          <span
            v-if="d.error"
            class="dl-error"
            :title="d.error"
          >{{ d.error }}</span>
        </div>
      </div>
      <p
        v-else
        class="dl-empty"
      >
        {{ dlCount ? '无匹配的下载任务' : '暂无下载任务' }}
      </p>
    </template>
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
