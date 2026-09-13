<script setup lang="ts">
/**
 * 我的档案（v4.6）：历史备份按采集目标分组展示（本人 / 各好友）
 * 操作：浏览（viewer）/ 打开文件夹 / 压缩
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NTag, NEmpty, NAvatar, NPopconfirm, useMessage } from 'naive-ui';
import { MODULE_META } from '../stores/config';

type HistoryEntry = {
  taskId?: string | null;
  completedAt: number;
  targetDir: string;
  name: string;
  modules: string[];
  total: number;
  moduleCounts: Record<string, number>;
  size: number;
  files: number;
  errors?: unknown[];
  target?: { uin: string; nickname?: string };
};

const router = useRouter();
const message = useMessage();

const history = ref<HistoryEntry[]>([]);
const loading = ref(true);
const zipping = ref<string | null>(null);

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

/** 按目标 uin 分组（旧记录无 target 字段 → 归入"我的空间"） */
const groups = computed(() => {
  const map = new Map<string, { key: string; label: string; uin?: string; items: HistoryEntry[] }>();
  for (const h of history.value) {
    const uin = h.target?.uin;
    const key = uin || 'me';
    if (!map.has(key)) {
      map.set(key, {
        key,
        uin,
        label: uin ? h.target?.nickname || `好友 ${uin}` : '我的空间',
        items: [],
      });
    }
    map.get(key)!.items.push(h);
  }
  return Array.from(map.values());
});

function openViewer(dir: string) {
  window.api.viewer.open(dir);
}
function openFolder(dir: string) {
  window.api.fs.showInFolder(dir);
}
async function zip(h: HistoryEntry) {
  if (zipping.value) return;
  zipping.value = h.targetDir;
  try {
    const dest = `${h.targetDir.replace(/[\\/]+$/, '')}.zip`;
    await window.api.zip.create(h.targetDir, dest);
    message.success(`已压缩：${dest}`);
  } catch (e: any) {
    message.error(`压缩失败：${e?.message || e}`);
  } finally {
    zipping.value = null;
  }
}

function fmtSize(n: number) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtTime(ts: number) {
  const d = new Date(ts);
  const p2 = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
function moduleLabels(h: HistoryEntry) {
  return (h.modules || [])
    .filter((m) => m !== 'Statistics')
    .map((m) => MODULE_META[m]?.label || m)
    .join('、');
}

let unsub: (() => void) | null = null;
onMounted(async () => {
  await loadHistory();
  unsub = window.api.on('backup:history-changed', () => loadHistory());
});
onBeforeUnmount(() => {
  unsub?.();
});
</script>

<template>
  <section class="archives">
    <div class="ar-head">
      <h2>我的档案</h2>
      <p>每一次备份都会生成可直接打开的离线档案</p>
    </div>

    <template v-if="loading && !history.length">
      <div class="ar-empty">
        加载中…
      </div>
    </template>
    <template v-else-if="!history.length">
      <NEmpty
        description="还没有备份档案"
        class="ar-empty"
      >
        <template #extra>
          <NButton
            type="primary"
            round
            @click="router.push('/new')"
          >
            去备份
          </NButton>
        </template>
      </NEmpty>
    </template>

    <template v-else>
      <div
        v-for="g in groups"
        :key="g.key"
        class="group"
      >
        <div class="g-head">
          <NAvatar
            round
            :size="30"
            :src="g.uin ? `https://q1.qlogo.cn/g?b=qq&nk=${g.uin}&s=60` : undefined"
            style="background: #b45f3d"
          >
            {{ (g.label || '?').slice(0, 1) }}
          </NAvatar>
          <span class="g-name">{{ g.label }}</span>
          <NTag
            v-if="g.uin"
            size="tiny"
            round
            :bordered="false"
          >
            好友
          </NTag>
          <span class="g-count">{{ g.items.length }} 次备份</span>
        </div>

        <div
          v-for="h in g.items"
          :key="h.taskId || h.completedAt"
          class="ar-item"
        >
          <div class="ai-main">
            <div class="ai-time">
              {{ fmtTime(h.completedAt) }}
              <NTag
                v-if="h.errors?.length"
                size="tiny"
                type="warning"
                round
                :bordered="false"
              >
                部分失败
              </NTag>
            </div>
            <div class="ai-meta">
              <span class="ai-modules">{{ moduleLabels(h) || '—' }}</span>
              <span>{{ (h.total || 0).toLocaleString() }} 条</span>
              <span>{{ h.files || 0 }} 个文件</span>
              <span v-if="h.size">{{ fmtSize(h.size) }}</span>
            </div>
          </div>
          <div class="ai-actions">
            <NButton
              size="tiny"
              type="primary"
              round
              @click="openViewer(h.targetDir)"
            >
              浏览
            </NButton>
            <NButton
              size="tiny"
              quaternary
              round
              @click="openFolder(h.targetDir)"
            >
              文件夹
            </NButton>
            <NPopconfirm @positive-click="zip(h)">
              <template #trigger>
                <NButton
                  size="tiny"
                  quaternary
                  round
                  :loading="zipping === h.targetDir"
                >
                  压缩
                </NButton>
              </template>
              在档案同级目录生成 .zip 压缩包？
            </NPopconfirm>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.archives {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.ar-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.ar-head p {
  margin: 0;
  font-size: 13px;
  opacity: 0.55;
}
.ar-empty {
  padding: 60px 0;
  text-align: center;
  opacity: 0.7;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.g-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}
.g-name {
  font-size: 14.5px;
  font-weight: 600;
}
.g-count {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.45;
}
.ar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  transition: border-color var(--dur-fast) ease;
}
.ar-item:hover {
  border-color: rgba(180, 95, 61, 0.4);
}
.ai-main {
  min-width: 0;
}
.ai-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 4px;
}
.ai-meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  opacity: 0.55;
}
.ai-modules {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 340px;
}
.ai-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
</style>
