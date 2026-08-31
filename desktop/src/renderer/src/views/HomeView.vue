<script setup lang="ts">
/** 概览视图（S2）：登录态 + 累计档案统计 + 上次备份 + 主 CTA + 隐私条
 *  统计来自主进程备份完成时自动记录的历史（backup:get-history），不依赖目录扫描 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import LoginCard from '../components/home/LoginCard.vue';
import StatSummary from '../components/home/StatSummary.vue';
import LastBackupCard from '../components/home/LastBackupCard.vue';
import PrivacyNote from '../components/home/PrivacyNote.vue';

const router = useRouter();
const { auth, refresh: refreshAuth, login, initAuth } = useAuth();

type HistoryEntry = {
  taskId?: string | null;
  completedAt: number;
  targetDir: string;
  name: string;
  modules: string[];
  results: Record<string, string>;
  total: number;
  moduleCounts: Record<string, number>;
  size: number;
  files: number;
};

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

/** 数据概览：备份次数 + 最近一次条目数（避免增量备份重复累计误导）+ 累计文件/空间 */
const stats = computed(() => {
  const list = history.value;
  const last = list[0];
  return {
    backups: list.length,
    total: last?.total || 0,
    files: list.reduce((s, h) => s + (h.files || 0), 0),
    size: list.reduce((s, h) => s + (h.size || 0), 0),
  };
});

/** 上次备份（最新一条记录） */
const lastBackup = computed<HistoryEntry | null>(() => history.value[0] || null);

/** 主 CTA：未登录先引导扫码，已登录进入备份向导 */
function onStart() {
  if (!auth.loggedIn) {
    login();
    return;
  }
  router.push('/backup');
}

let unsub: (() => void) | null = null;

onMounted(async () => {
  initAuth();
  refreshAuth();
  await loadHistory();
  // 备份完成时主进程自动记录并广播，概览实时刷新
  unsub = window.api.on('backup:history-changed', () => loadHistory());
});

onBeforeUnmount(() => {
  unsub?.();
});
</script>

<template>
  <section class="home">
    <!-- 主行动：欢迎/登录 + 主 CTA（首屏焦点） -->
    <div class="home-hero">
      <section
        v-if="auth.loggedIn"
        class="panel welcome-card"
      >
        <h2 class="welcome-title">
          欢迎回来{{ auth.nickname ? `，${auth.nickname}` : '' }}
        </h2>
        <p class="welcome-sub">
          你的空间记忆已备妥，随时可以开启新一轮备份。
        </p>
      </section>
      <LoginCard v-else />
      <div class="hero-cta">
        <button
          class="btn primary cta-btn"
          @click="onStart"
        >
          <svg
            class="cta-ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect
              x="5"
              y="10"
              width="14"
              height="10"
              rx="2"
            />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          开始备份
        </button>
        <p class="cta-hint">
          {{ auth.loggedIn ? '选择内容，一键备份到本地' : '登录后即可开始备份你的空间' }}
        </p>
      </div>
    </div>

    <StatSummary
      :backups="stats.backups"
      :total="stats.total"
      :files="stats.files"
      :size="stats.size"
      :loading="loading"
    />

    <LastBackupCard :backup="lastBackup" />
    <PrivacyNote />
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
}
.home-hero {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
  align-items: stretch;
}
@media (max-width: 720px) {
  .home-hero {
    grid-template-columns: 1fr;
  }
}
.welcome-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 24px 26px;
}
.welcome-title {
  margin: 0;
  font-family: Georgia, 'STZhongsong', 'SimSun', serif;
  font-size: 19px;
  letter-spacing: 1px;
  color: var(--accent-deep);
}
.welcome-sub {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  color: var(--ink-soft);
}
/* 主 CTA：视觉锚点 */
.hero-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 30px;
  background:
    linear-gradient(160deg, rgba(154, 83, 54, 0.1), rgba(154, 83, 54, 0.02)) 0 0 / cover,
    var(--card);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  text-align: center;
}
.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 14px 40px;
  font-size: 16px;
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(126, 63, 41, 0.25);
}
.cta-ico {
  width: 17px;
  height: 17px;
}
.cta-hint {
  margin: 0;
  font-size: 12px;
  color: var(--ink-soft);
}
</style>
