<script setup lang="ts">
/** 应用侧边导航（v4.6）：品牌（应用图标）+ 主导航 + 底部帮助入口 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import appIcon from '../../assets/icon.png';

const route = useRoute();
const router = useRouter();
const emit = defineEmits<{ help: [] }>();

const NAV = [
  { path: '/', label: '首页', icon: 'M4 11.5 12 4l8 7.5 M6 10v10h4.5v-5h3v5H18V10' },
  { path: '/new', label: '新建任务', icon: 'M12 5v14 M5 12h14' },
  { path: '/archives', label: '档案列表', icon: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z M4 10h16 M9 14h6' },
  { path: '/settings', label: '设置', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.07-.4.1-.8.1-1.2Z' },
];

const activePath = computed(() => '/' + (route.path.split('/')[1] || ''));

/** 内置使用教程 */
function openTutorial() {
  router.push('/tutorial');
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <img class="brand-icon" :src="appIcon" alt="空间档案备份" />
      <span class="brand-name">空间档案</span>
    </div>

    <nav class="nav">
      <router-link
        v-for="item in NAV"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: activePath === item.path }"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path :d="item.icon" />
        </svg>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar-foot">
      <button
        class="foot-btn"
        @click="emit('help')"
      >
        帮助与隐私
      </button>
      <button
        class="foot-btn"
        @click="openTutorial"
      >
        使用教程
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: var(--sidebar-w);
  flex-shrink: 0;
  padding: 18px 12px 14px;
  border-right: 1px solid var(--surface-border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 10px 18px;
}
.brand-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: contain;
}
.brand-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13.5px;
  color: inherit;
  text-decoration: none;
  opacity: 0.72;
  transition: background var(--dur-fast) ease, opacity var(--dur-fast) ease, color var(--dur-fast) ease;
}
.nav-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.nav-item:hover {
  opacity: 1;
  background: var(--surface-soft);
}
.nav-item.active {
  opacity: 1;
  background: rgba(180, 95, 61, 0.13);
  color: #b5432a;
  font-weight: 600;
}
.sidebar-foot {
  margin-top: auto;
  padding: 10px 12px 0;
}
.foot-btn {
  border: none;
  background: none;
  padding: 4px 0;
  font-size: 12px;
  color: inherit;
  opacity: 0.5;
  cursor: pointer;
}
.foot-btn:hover {
  opacity: 0.85;
  text-decoration: underline;
}
</style>
