<script setup lang="ts">
/** 侧边导航（唯一导航）：四视图 + 底部帮助入口 */

const emit = defineEmits<{ help: [] }>();

const NAV_ITEMS = [
  { to: '/', label: '概览', icon: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5' },
  { to: '/backup', label: '备份', icon: 'M4 6h16v14H4V6Z M4 10h16 M9 14l3 3 3-3 M12 17V9' },
  { to: '/archives', label: '历史', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2' },
  { to: '/settings', label: '设置', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1' },
];
</script>

<template>
  <nav class="sidenav">
    <div class="sidenav-nav">
      <router-link
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        active-class="active"
      >
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path :d="item.icon" />
        </svg>
        <span class="nav-label">{{ item.label }}</span>
      </router-link>
    </div>

    <div class="sidenav-foot">
      <button class="nav-item" @click="emit('help')">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5M12 17h.01" />
        </svg>
        <span class="nav-label">帮助中心</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.sidenav {
  width: 160px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 10px;
  background: var(--card);
  border-right: 1px solid var(--line-soft);
}
.sidenav-nav {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sidenav-foot {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line-soft);
  padding-top: 10px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 12px;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  color: var(--ink-soft);
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  width: 100%;
}
.nav-item:hover {
  background: var(--line-soft);
  color: var(--ink);
}
.nav-item.active {
  background: var(--accent);
  color: #fbe9d8;
  font-weight: 600;
}
.nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
</style>
