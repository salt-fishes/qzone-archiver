import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import MessagesView from '@/views/MessagesView.vue'
import MessagesDeletedView from '@/views/MessagesDeletedView.vue'
import VisitorsView from '@/views/VisitorsView.vue'
import FavoritesView from '@/views/FavoritesView.vue'
import BoardsView from '@/views/BoardsView.vue'
import SharesView from '@/views/SharesView.vue'
import VideosView from '@/views/VideosView.vue'
import FriendsView from '@/views/FriendsView.vue'
import BlogsView from '@/views/BlogsView.vue'
import PhotosView from '@/views/PhotosView.vue'
import DiariesView from '@/views/DiariesView.vue'
import NotFoundView from '@/views/NotFoundView.vue'

// hash 模式路由，确保 file:// 协议下导航正常
// 视图采用静态 imports，合并进 index.js，避免动态分片导致扩展端 SpaExportFiles 清单需同步维护
// 未实现的模块复用 BlogsView 占位，通过 props.module 区分文案
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/messages', name: 'messages', component: MessagesView },
    { path: '/messages-deleted', name: 'messages-deleted', component: MessagesDeletedView },
    { path: '/visitors', name: 'visitors', component: VisitorsView },
    { path: '/favorites', name: 'favorites', component: FavoritesView },
    { path: '/boards', name: 'boards', component: BoardsView },
    { path: '/shares', name: 'shares', component: SharesView },
    { path: '/videos', name: 'videos', component: VideosView },
    { path: '/blogs', name: 'blogs', component: BlogsView },
    { path: '/diaries', name: 'diaries', component: DiariesView },
    { path: '/photos', name: 'photos', component: PhotosView },
    { path: '/friends', name: 'friends', component: FriendsView },
    { path: '/:pathMatch(.*)*', name: 'notFound', component: NotFoundView }
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    // 带年份/分组参数的跳转由组件内部控制虚拟滚动位置，不自动回到顶部
    if (to.query.year || to.query.group) return false
    return { top: 0 }
  }
})

export default router
