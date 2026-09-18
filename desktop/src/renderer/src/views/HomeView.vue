<script setup lang="ts">
/** 首页（v4.6 简化版）：居中主视觉（图标+主 CTA）+ 一行统计 + 最近任务，其余全部让位给主要内容 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NTag, NEmpty } from 'naive-ui';
import { Motion } from 'motion-v';
import { useAuthStore } from '../stores/auth';
import { useTargetStore } from '../stores/target';
import { archiveTargetTag } from '../utils/labels';
import EmoticonText from '../components/common/EmoticonText.vue';
import TargetAvatar from '../components/common/TargetAvatar.vue';
import appIcon from '../assets/icon.png';

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
  target?: { uin: string; nickname?: string };
};

const router = useRouter();
const { auth, refresh: refreshAuth, login, initAuth, ensureProfile } = useAuthStore();
const target = useTargetStore();

const history = ref<HistoryEntry[]>([]);
const loading = ref(true);

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

const recent = computed(() => history.value.slice(0, 3));

/** 一行统计：无记录时不显示 */
const statLine = computed(() => {
  if (!history.value.length) return '';
  const last = history.value[0];
  const files = history.value.reduce((s, h) => s + (h.files || 0), 0);
  const size = fmtSize(history.value.reduce((s, h) => s + (h.size || 0), 0));
  const bits = [`已备份 ${history.value.length} 次`];
  if (last?.total) bits.push(`最近一次 ${last.total.toLocaleString()} 条`);
  if (files) bits.push(`共 ${files.toLocaleString()} 个文件`);
  if (size) bits.push(size);
  return bits.join(' · ');
});

function onStart() {
  if (!auth.loggedIn) {
    login();
    return;
  }
  router.push('/new');
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

let unsub: (() => void) | null = null;

onMounted(async () => {
  initAuth();
  refreshAuth();
  // §A：已登录但昵称缺失（引擎注入完成前）时后台重试补齐，补上后问候语/顶栏/向导自动更新
  ensureProfile();
  // §C：已登录时预取好友列表（最近任务的事实标签判定用；未登录不请求）
  if (auth.loggedIn) target.loadFriends();
  await loadHistory();
  unsub = window.api.on('backup:history-changed', () => loadHistory());
});

onBeforeUnmount(() => {
  unsub?.();
});
</script>

<template>
  <section class="home">
    <!-- 主视觉：一行说清这是什么、下一步做什么 -->
    <Motion
      tag="div"
      class="hero"
      :initial="{ opacity: 0, y: 16 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.35 }"
    >
      <img
        class="hero-icon"
        :src="appIcon"
        alt=""
      >
      <!-- §A：有昵称显示昵称；无昵称显示「你好，QQ 12345」，不再只留一个孤零零的「你好」 -->
      <h1 v-if="auth.loggedIn">
        你好<template v-if="auth.nickname">，<EmoticonText
          :text="auth.nickname"
          :size="22"
        /></template>
        <template v-else-if="auth.qqNumber">，QQ {{ auth.qqNumber }}</template>
      </h1>
      <h1 v-else>
        备份你的 QQ 空间
      </h1>
      <p class="hero-sub">
        {{ auth.loggedIn ? '把空间记忆完整保存到本地，随时离线浏览。' : '扫码登录后，一键保存说说、相册、日志到本机。' }}
      </p>
      <div class="hero-actions">
        <NButton
          type="primary"
          size="large"
          round
          class="cta"
          @click="onStart"
        >
          {{ auth.loggedIn ? '开始备份' : '扫码登录' }}
        </NButton>
        <NButton
          v-if="history.length"
          size="large"
          quaternary
          round
          @click="router.push('/archives')"
        >
          浏览档案
        </NButton>
      </div>
      <p
        v-if="statLine"
        class="hero-stat"
      >
        {{ statLine }}
      </p>
    </Motion>

    <!-- 最近任务 -->
    <div class="recent">
      <div class="recent-head">
        <h3>最近任务</h3>
        <NButton
          v-if="history.length"
          quaternary
          size="small"
          @click="router.push('/archives')"
        >
          查看全部
        </NButton>
      </div>
      <template v-if="loading && !recent.length">
        <div class="recent-empty">
          加载中…
        </div>
      </template>
      <template v-else-if="!recent.length">
        <NEmpty
          description="还没有备份记录"
          class="recent-empty"
        />
      </template>
      <template v-else>
        <div
          v-for="h in recent"
          :key="h.taskId || h.completedAt"
          class="recent-item"
          @click="router.push('/archives')"
        >
          <div class="ri-main">
            <!-- v4.7 反馈 ②：最近备份显示目标头像 -->
            <TargetAvatar
              :uin="h.target?.uin"
              :label="h.target?.nickname || h.name"
              :size="26"
            />
            <!-- v4.7.5：昵称里的 [em]e327806[/em] 也要渲染成图，不能直接插值（否则就是纯文本表情） -->
            <span class="ri-name">
              <template v-if="h.target?.nickname">
                <EmoticonText
                  :text="h.target.nickname"
                  :size="15"
                /> 的档案
              </template>
              <template v-else>{{ h.name || 'QQ 空间档案' }}</template>
            </span>
            <NTag
              v-if="h.target && h.target.uin"
              size="tiny"
              round
              :bordered="false"
            >
              {{ archiveTargetTag({ uin: h.target.uin, isFriend: target.isFriendUin(h.target.uin) }) }}
            </NTag>
          </div>
          <div class="ri-meta">
            <span>{{ fmtTime(h.completedAt) }}</span>
            <span>{{ (h.total || 0).toLocaleString() }} 条</span>
            <span v-if="h.size">{{ fmtSize(h.size) }}</span>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 26px;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 52px 30px 42px;
  border-radius: 18px;
  background:
    radial-gradient(90% 130% at 50% -10%, rgba(180, 95, 61, 0.12), transparent 60%),
    var(--surface);
  border: 1px solid var(--surface-border);
}
.hero-icon {
  width: 58px;
  height: 58px;
  border-radius: 14px;
  margin-bottom: 18px;
  box-shadow: 0 4px 16px rgba(153, 79, 49, 0.25);
}
.hero h1 {
  margin: 0 0 8px;
  font-size: 25px;
  letter-spacing: 0.5px;
}
.hero-sub {
  margin: 0 0 24px;
  font-size: 13.5px;
  opacity: 0.6;
}
.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cta {
  padding: 0 34px;
  height: 46px;
  font-size: 15px;
}
.hero-stat {
  margin: 22px 0 0;
  font-size: 12px;
  opacity: 0.45;
}
.recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.recent-head h3 {
  margin: 0;
  font-size: 15px;
}
.recent-empty {
  padding: 26px 0;
  opacity: 0.7;
}
.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) ease;
}
.recent-item + .recent-item {
  margin-top: 8px;
}
.recent-item:hover {
  transform: translateY(-1px);
  border-color: rgba(180, 95, 61, 0.45);
}
.ri-main {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 500;
  min-width: 0;
}
.ri-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ri-meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  opacity: 0.5;
  flex-shrink: 0;
}
</style>
