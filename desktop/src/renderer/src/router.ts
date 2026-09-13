/**
 * 渲染器路由（v4.6 C 端化：首页 / 新建任务 / 档案 / 设置）
 * file:// 协议下必须用 hash 模式
 */
import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import NewTaskView from './views/NewTaskView.vue';
import ArchivesView from './views/ArchivesView.vue';
import SettingsView from './views/SettingsView.vue';
import TutorialView from './views/TutorialView.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/new', name: 'new', component: NewTaskView },
    { path: '/archives', name: 'archives', component: ArchivesView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/tutorial', name: 'tutorial', component: TutorialView },
  ],
});
