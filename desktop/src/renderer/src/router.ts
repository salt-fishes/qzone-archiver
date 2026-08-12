/**
 * 渲染器路由（S1 骨架）
 * file:// 协议下必须用 hash 模式
 */
import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import BackupView from './views/BackupView.vue';
import ArchivesView from './views/ArchivesView.vue';
import SettingsView from './views/SettingsView.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/backup', name: 'backup', component: BackupView },
    { path: '/archives', name: 'archives', component: ArchivesView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
});
