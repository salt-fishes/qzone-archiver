<script setup lang="ts">
/**
 * 档案列表（v4.6）：历史备份按采集目标分组展示（本人 / 各目标）
 * 操作：浏览（viewer）/ 打开文件夹 / 压缩
 * §C：分组名不再拼「好友」、标签按事实显示（好友 / 他人空间）
 */
import { ref, computed, onMounted, onBeforeUnmount, h as createVNode } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NTag, NEmpty, NPopconfirm, useMessage } from 'naive-ui';
import { MODULE_META } from '../stores/config';
import { useTargetStore } from '../stores/target';
import { useAuthStore } from '../stores/auth';
import { archiveTargetLabel, archiveTargetTag } from '../utils/labels';
import TargetAvatar from '../components/common/TargetAvatar.vue';
import EmoticonText from '../components/common/EmoticonText.vue';

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
  /** v5.0：目标目录是否仍存在（加载时由主进程检查） */
  exists?: boolean;
};

const router = useRouter();
const message = useMessage();
const target = useTargetStore();
const { auth } = useAuthStore();

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
  const map = new Map<
    string,
    { key: string; label: string; nickname?: string; uin?: string; items: HistoryEntry[] }
  >();
  for (const h of history.value) {
    const uin = h.target?.uin;
    const key = uin || 'me';
    if (!map.has(key)) {
      map.set(key, {
        key,
        uin,
        // §C：label 供头像占位/纯文本兜底，无昵称时显示 QQ 号（不再拼「好友」）；
        // nickname 单独留着走 EmoticonText（表情要渲染成图）
        label: archiveTargetLabel({ uin, nickname: h.target?.nickname }),
        nickname: uin ? h.target?.nickname : undefined,
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
    const r = await window.api.zip.create(h.targetDir, dest);
    // v5.0 Z：IPC 把失败编码进 {ok:false} 而不 throw，必须校验返回值
    if (!r?.ok) throw new Error(r?.error || '压缩失败');
    message.success(
      () =>
        createVNode(
          'span',
          { style: 'display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap' },
          [
            `已压缩：${dest}`,
            createVNode(
              NButton,
              { size: 'tiny', quaternary: true, type: 'primary', onClick: () => window.api.fs.showInFolder(dest) },
              { default: () => '打开所在文件夹' },
            ),
          ],
        ),
      { duration: 6000 },
    );
  } catch (e: any) {
    message.error(`压缩失败：${e?.message || e}`, { duration: 8000 });
  } finally {
    zipping.value = null;
  }
}

/** v5.0：删除一条备份历史记录（只删记录不动文件；列表经 history-changed 自动刷新） */
async function removeHistory(h: HistoryEntry) {
  const r = await window.api.backup.deleteHistory(String(h.taskId || ''));
  if (!r?.ok) message.error(r?.error || '删除失败');
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
  // §C：已登录时预取好友列表（事实标签判定用；未登录不请求）
  if (auth.loggedIn) target.loadFriends();
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
      <h2>档案列表</h2>
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
          <TargetAvatar
            :uin="g.uin"
            :label="g.label"
            :size="30"
          />
          <span class="g-name">
            <EmoticonText
              v-if="g.nickname"
              :text="g.nickname"
              :size="16"
            />
            <template v-else>{{ g.label }}</template>
          </span>
          <NTag
            v-if="g.uin"
            size="tiny"
            round
            :bordered="false"
          >
            {{ archiveTargetTag({ uin: g.uin, isFriend: target.isFriendUin(g.uin) }) }}
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
              <!-- v4.7 反馈 ②：每条备份记录显示该目标的头像 -->
              <TargetAvatar
                :uin="h.target?.uin"
                :label="h.target?.nickname || h.name"
                :size="22"
              />
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
            <NTag
              v-if="h.exists === false"
              size="tiny"
              type="error"
              round
              :bordered="false"
            >
              目录已不存在
            </NTag>
            <NButton
              v-if="h.exists !== false"
              size="tiny"
              type="primary"
              round
              @click="openViewer(h.targetDir)"
            >
              浏览
            </NButton>
            <NButton
              v-if="h.exists !== false"
              size="tiny"
              quaternary
              round
              @click="openFolder(h.targetDir)"
            >
              文件夹
            </NButton>
            <NPopconfirm
              v-if="h.exists !== false"
              @positive-click="zip(h)"
            >
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
            <NPopconfirm @positive-click="removeHistory(h)">
              <template #trigger>
                <NButton
                  size="tiny"
                  quaternary
                  round
                  type="error"
                >
                  删除
                </NButton>
              </template>
              从列表中移除这条备份记录？不会删除磁盘上的档案文件。
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
