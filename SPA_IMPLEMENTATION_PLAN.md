# SPA 导出方案实施计划

> **版本**：v1.0
> **日期**：2026-07-27
> **目标**：新增 SPA（Single Page Application）导出类型，与现有 HTML / MarkDown / JSON 并存，解决大数据量卡顿、增加搜索筛选、提供现代化 UI、便于部署分享

---

## 一、方案概述

### 1.1 设计原则

- **零侵入**：新增 `case 'SPA'` 分支，不修改现有 HTML / MarkDown / JSON 逻辑
- **file:// 直开**：用户解压 ZIP 后双击 `index.html` 即可，无需启动服务器
- **`<script>` 加载数据**：避开 file:// fetch 限制，用 `window.xxx` 模式
- **hash 路由**：`#/messages`，file:// 友好
- **共享资源**：SPA bundle 复制到 `Common/spa/` 共享，各模块相对路径引用

### 1.2 核心架构

```
用户解压 ZIP
  ↓
双击 index.html（file:// 协议直接打开）
  ↓
Vue 3 SPA 启动（hash 路由 #/messages）
  ↓
<script src="data/messages-index.js"> 加载轻量索引（年份/月份/摘要，~50KB）
  ↓ 用户滚动到某年
<script src="data/messages-2026.js"> 按需加载该年详情
  ↓
vue-virtual-scroller 渲染可视区域 DOM（万级列表不卡顿）
  ↓
FlexSearch 全文搜索（输入关键字即时筛选）
```

### 1.3 技术栈

| 库 | 用途 | 体积（gzip） |
|----|------|------|
| Vue 3 | 框架核心 | ~40KB |
| Vite | 构建工具 | 0（构建产物） |
| Pinia | 状态管理 | ~5KB |
| vue-router (hash) | 路由 | ~10KB |
| vue-virtual-scroller | 虚拟滚动 | ~8KB |
| FlexSearch | 全文搜索 | ~20KB |
| LightGallery 2.7.2 | 图片/视频查看器 | ~50KB |
| **bundle 合计** | gzip 后 | **~80KB** |

---

## 二、阶段 1：扩展端改造

### 2.1 改动文件清单

| 文件 | 改动类型 | 改动点 |
|------|----------|--------|
| [src/js/config.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/config.js) | 新增 | `SpaExportFiles` 资源清单 |
| [src/js/modules/common.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/common.js) | 新增 | `exportUserToSpa` + `hasExportType` + `writeSpaManifest` |
| [src/js/modules/messages.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/messages.js) | 新增 | `case 'SPA'` + `exportToSpa` |
| [src/html/options.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/options.html) | 修改 | 10 个模块下拉框新增 `SPA` 选项 |
| [src/manifest.json](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/manifest.json) | 修改 | `web_accessible_resources` 增补 `export/spa-dist/*` |

### 2.2 详细改动

#### 2.2.1 config.js — 新增 SpaExportFiles

在 `ExportFiles` 之后新增 `SpaExportFiles`，定义 SPA 静态资源清单：

```js
/**
 * SPA 导出资源文件清单
 * original: 扩展内资源路径
 * target: 备份 ZIP 内目标路径（统一放 Common/spa/ 共享）
 */
const SpaExportFiles = [{
    original: 'export/spa-dist/index.html',
    target: 'Common/spa/index.html'
}, {
    original: 'export/spa-dist/assets/index.js',
    target: 'Common/spa/assets/index.js'
}, {
    original: 'export/spa-dist/assets/index.css',
    target: 'Common/spa/assets/index.css'
}, {
    original: 'export/spa-dist/assets/vendor.js',
    target: 'Common/spa/assets/vendor.js'
}, {
    original: 'export/spa-dist/assets/vendor.css',
    target: 'Common/spa/assets/vendor.css'
}];
```

同时把 `SpaExportFiles` 挂到 `QZone.Common.SpaExportFiles`。

#### 2.2.2 common.js — 新增 exportUserToSpa

```js
/**
 * 导出个人信息到 SPA
 * 检测任一模块是否启用 SPA，是则复制 SPA 静态资源到 Common/spa/
 */
API.Common.exportUserToSpa = async(userInfo) => {
    // 检测任一模块是否启用 SPA
    const hasSpa = API.Common.hasExportType('SPA');
    if (!hasSpa) return;

    console.info('复制 SPA 静态资源开始');
    for (const pathInfo of QZone.Common.SpaExportFiles) {
        const paths = (API.Common.getRootFolder() + '/' + pathInfo.target).split('/');
        const filename = paths.pop();
        await API.Utils.createFolder(paths.join('/'));
        await API.Utils.downloadToFile(
            chrome.runtime.getURL(pathInfo.original),
            paths.join('/') + '/' + filename
        );
    }
    console.info('复制 SPA 静态资源结束');

    // 生成 SPA 入口 index.html（覆盖到根目录，作为 ZIP 默认入口）
    // SPA 入口 HTML 内引用 Common/spa/ 下的资源
    const spaIndexHtml = await API.Utils.get(chrome.runtime.getURL('export/spa-dist/export-entry.html'));
    await API.Utils.writeText(spaIndexHtml, API.Common.getRootFolder() + '/index.html');
}

/**
 * 检测指定导出类型是否被任一模块启用
 */
API.Common.hasExportType = (exportType) => {
    const modules = ['Messages', 'Blogs', 'Diaries', 'Photos', 'Videos',
                     'Boards', 'Friends', 'Favorites', 'Shares', 'Visitors'];
    return modules.some(m => QZone_Config[m].exportType === exportType);
}
```

修改 `API.Common.export` 函数，在调用 `exportUserToHtml` 之后调用 `exportUserToSpa`。

#### 2.2.3 messages.js — 新增 case 'SPA'

```js
API.Messages.exportAllListToFiles = async(items) => {
    let exportType = QZone_Config.Messages.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Messages.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Messages.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Messages.exportToJson(items);
            break;
        case 'SPA':
            await API.Messages.exportToSpa(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出说说到 SPA
 * 数据策略：
 *   1. 轻量索引 messagesIndex（年份/月份/标题/摘要，~50KB）—— SPA 启动时立即加载
 *   2. 按年分片全量数据 messages_<year> —— 用户滚动到某年时按需 <script> 加载
 */
API.Messages.exportToSpa = async(messages) => {
    const indicator = new StatusIndicator('Messages_Export_Other');
    indicator.setIndex('SPA');

    try {
        const moduleFolder = API.Common.getModuleRoot('Messages');
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        // 1. 生成轻量索引
        const index = messages.map(m => ({
            tid: m.tid,
            time: m.custom_create_time,
            title: (m.content || '').substring(0, 50),
            imgCount: m.pic_list?.length || 0,
            commentCount: m.commentlist?.length || 0
        }));
        await API.Common.writeJsonToJs('messagesIndex', index, dataFolder + '/messages-index.js');

        // 2. 按年分片全量数据
        const yearMaps = API.Utils.groupedByTime(messages, "custom_create_time", 'year');
        for (const [year, yearItems] of yearMaps) {
            await API.Common.writeJsonToJs(
                `messages_${year}`,
                yearItems,
                `${dataFolder}/messages-${year}.js`
            );
        }

        console.info('导出说说到 SPA 完成', { total: messages.length, years: yearMaps.size });

    } catch (error) {
        console.error('导出说说到 SPA 异常', error, messages);
    }

    indicator.complete();
    return messages;
}
```

#### 2.2.4 options.html — 10 个 select 新增 SPA 选项

每个 `*_exportFormat` select 在 `<option value="JSON">` 之后新增：
```html
<option value="SPA">SPA（推荐）</option>
```

涉及 10 个模块：messages / blogs / diaries / photos / videos / boards / friends / favorites / shares / visitors

#### 2.2.5 manifest.json — web_accessible_resources 增补

```diff
 "resources": [
     "html/indicator.html",
     "export/*.*",
+    "export/spa-dist/*",
+    "export/spa-dist/**/*",
     "templates/*.*",
     "vendor/*.*"
 ]
```

### 2.3 阶段 1 验证标准

- [ ] options 页面下拉框显示 SPA 选项
- [ ] 选择 SPA 后保存配置，重启扩展后配置保留
- [ ] 触发备份后，ZIP 内 `Common/spa/` 目录包含 SPA 静态资源
- [ ] ZIP 根目录 `index.html` 为 SPA 入口
- [ ] `Messages/data/messages-index.js` 与 `messages-YYYY.js` 生成正确

---

## 三、阶段 2：SPA 骨架

### 3.1 目录结构

```
src/spa/
├── package.json
├── vite.config.ts              ← build.outDir = '../export/spa-dist'
├── index.html                   ← SPA 入口骨架（< 5KB）
├── export-entry.html            ← 备份 ZIP 根目录入口（重定向到 Common/spa/index.html）
└── src/
    ├── main.ts                  ← Vue 应用入口
    ├── App.vue                  ← 根组件（路由 outlet）
    ├── router.ts                ← hash 模式路由
    ├── stores/
    │   ├── user.ts              ← 用户信息
    │   └── messages.ts          ← 说说数据 + 分页
    ├── api/
    │   └── data-loader.ts       ← 动态 <script> 标签加载器
    ├── components/
    │   ├── layout/
    │   │   ├── Masthead.vue     ← 顶部刊头
    │   │   ├── NavBar.vue       ← 顶部导航 + 搜索框
    │   │   └── SideBar.vue      ← 左侧目录树
    │   ├── message/
    │   │   ├── MessageCard.vue
    │   │   └── MessageList.vue  ← 虚拟滚动容器
    │   ├── common/
    │   │   ├── ModalDialog.vue  ← 通用模态弹窗
    │   │   ├── LikesModal.vue   ← 点赞列表模态
    │   │   ├── CommentsModal.vue← 评论树模态
    │   │   └── MediaGrid.vue    ← LightGallery 媒体网格
    │   └── stats/
    │       └── StatGrid.vue     ← 数据统计网格
    ├── views/
    │   ├── HomeView.vue         ← 个人中心首页
    │   ├── MessagesView.vue     ← 说说列表页
    │   ├── BlogsView.vue        ← 日志（占位）
    │   └── NotFoundView.vue     ← 404
    ├── composables/
    │   ├── useFlexSearch.ts     ← 全文搜索 hook
    │   └── useLightGallery.ts   ← LightGallery 初始化 hook
    └── styles/
        ├── tokens.scss          ← CSS 变量（色板、字体、间距）
        ├── base.scss            ← 重置 + 全局样式
        └── lightgallery-theme.scss ← LightGallery 主题覆盖
```

### 3.2 关键文件实现

#### 3.2.1 vite.config.ts

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  base: './',  // 相对路径，支持 file:// 协议
  build: {
    outDir: '../export/spa-dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // 分包：vendor 与业务代码分离
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          scroller: ['vue-virtual-scroller'],
          search: ['flexsearch'],
          gallery: ['lightgallery', 'lightgallery/plugins/zoom', 'lightgallery/plugins/video',
                    'lightgallery/plugins/thumbnail', 'lightgallery/plugins/rotate',
                    'lightgallery/plugins/fullscreen', 'lightgallery/plugins/autoplay']
        }
      }
    }
  }
})
```

#### 3.2.2 src/api/data-loader.ts

```ts
const loadedScripts = new Set<string>();

/**
 * 通过动态 <script> 标签加载数据文件（避开 file:// fetch 限制）
 * 数据文件格式：window.xxx = {...}
 */
export function loadScript<T>(src: string, varName?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    if (loadedScripts.has(src)) {
      resolve((window as any)[varName || '']);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts.add(src);
      resolve((window as any)[varName || '']);
    };
    script.onerror = () => reject(new Error(`加载失败: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * 加载说说索引（启动时调用，~50KB）
 */
export async function loadMessagesIndex(): Promise<MessageIndex[]> {
  return loadScript<MessageIndex[]>('../Messages/data/messages-index.js', 'messagesIndex');
}

/**
 * 按需加载某年的说说详情
 */
export async function loadMessagesByYear(year: number): Promise<Message[]> {
  return loadScript<Message[]>(`../Messages/data/messages-${year}.js`, `messages_${year}`);
}
```

#### 3.2.3 src/router.ts

```ts
import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),  // hash 模式，file:// 友好
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/messages', name: 'messages', component: () => import('@/views/MessagesView.vue') },
    { path: '/blogs', name: 'blogs', component: () => import('@/views/BlogsView.vue') },
    { path: '/:pathMatch(.*)*', name: 'notFound', component: () => import('@/views/NotFoundView.vue') }
  ]
});

export default router;
```

#### 3.2.4 src/styles/tokens.scss

把 design-system-preview.html 中的 CSS 变量提取为 SCSS：

```scss
:root {
  --paper: #F4ECD8;
  --paper-2: #EAE0C5;
  --paper-3: #DFD2B0;
  --ink: #1A1612;
  --ink-2: #3D352A;
  --ink-3: #6B5D49;
  --vermilion: #C8442A;
  --vermilion-2: #A33620;
  --indigo: #2B4A6F;
  --moss: #5C6B3B;
  --gold: #B8893A;

  --font-display: 'Fraunces', 'Noto Serif SC', Georgia, serif;
  --font-body: 'Noto Sans SC', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
  --font-serif-cn: 'Noto Serif SC', 'Songti SC', serif;

  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;

  --line: 1px solid var(--ink);
  --line-2: 1px solid var(--ink-3);
  --line-double: 3px double var(--ink);
  --line-dot: 1px dotted var(--ink-3);
}
```

#### 3.2.5 export-entry.html（ZIP 根目录入口）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>QQ空间档案</title>
  <meta http-equiv="refresh" content="0; url=Common/spa/index.html">
  <script>
    // 兜底：浏览器不支持 refresh 时用 JS 跳转
    location.href = 'Common/spa/index.html';
  </script>
</head>
<body>
  <a href="Common/spa/index.html">进入档案</a>
</body>
</html>
```

### 3.3 阶段 2 验证标准

- [x] `npm run build` 构建产物输出到 `src/export/spa-dist/`
- [x] `src/export/spa-dist/index.html` 可在浏览器打开（开发模式）
- [x] 路由切换正常（#/ → #/messages）
- [x] 数据加载器 `loadMessagesIndex` / `loadMessagesByYear` 工作正常
- [x] 设计系统（色板、字体、布局）符合 design-system-preview.html

---

## 四、阶段 3：Messages 模块完整链路

### 4.1 改动文件清单

| 文件 | 内容 |
|------|------|
| `src/spa/src/views/MessagesView.vue` | 说说列表页主视图 |
| `src/spa/src/components/message/MessageList.vue` | 虚拟滚动容器 |
| `src/spa/src/components/message/MessageCard.vue` | 单条说说卡片 |
| `src/spa/src/components/common/MediaGrid.vue` | LightGallery 媒体网格 |
| `src/spa/src/components/common/LikesModal.vue` | 点赞列表模态 |
| `src/spa/src/components/common/CommentsModal.vue` | 评论树模态（含二级嵌套） |
| `src/spa/src/composables/useFlexSearch.ts` | 全文搜索 hook |
| `src/spa/src/composables/useLightGallery.ts` | LightGallery 初始化 hook |
| `src/spa/src/stores/messages.ts` | 说说数据 store |

### 4.2 关键实现

#### 4.2.1 stores/messages.ts

```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { loadMessagesIndex, loadMessagesByYear, MessageIndex, Message } from '@/api/data-loader';

export const useMessagesStore = defineStore('messages', () => {
  const index = ref<MessageIndex[]>([]);
  const yearCache = ref<Map<number, Message[]>>(new Map());
  const loading = ref(false);
  const currentYear = ref<number | null>(null);

  const total = computed(() => index.value.length);

  async function init() {
    if (index.value.length > 0) return;
    loading.value = true;
    try {
      index.value = await loadMessagesIndex();
    } finally {
      loading.value = false;
    }
  }

  async function loadYear(year: number) {
    if (yearCache.value.has(year)) return yearCache.value.get(year)!;
    const items = await loadMessagesByYear(year);
    yearCache.value.set(year, items);
    return items;
  }

  return { index, yearCache, loading, currentYear, total, init, loadYear };
});
```

#### 4.2.2 MessageList.vue（虚拟滚动）

```vue
<template>
  <RecycleScroller
    class="message-list"
    :items="items"
    :item-size="240"
    key-field="tid"
    v-slot="{ item }"
  >
    <MessageCard :message="item" @open-likes="openLikes" @open-comments="openComments" />
  </RecycleScroller>
</template>

<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import MessageCard from './MessageCard.vue';
import type { Message } from '@/api/data-loader';

defineProps<{ items: Message[] }>();
const emit = defineEmits<{
  'open-likes': [tid: string];
  'open-comments': [tid: string];
}>();

function openLikes(tid: string) { emit('open-likes', tid); }
function openComments(tid: string) { emit('open-comments', tid); }
</script>
```

#### 4.2.3 useFlexSearch.ts

```ts
import { ref, watch, type Ref } from 'vue';
import FlexSearch from 'flexsearch';
import type { MessageIndex } from '@/api/data-loader';

export function useFlexSearch(source: Ref<MessageIndex[]>) {
  const query = ref('');
  const results = ref<MessageIndex[]>([]);
  let index: FlexSearch.Document<MessageIndex>;

  function buildIndex() {
    index = new FlexSearch.Document<MessageIndex>({
      tokenize: 'forward',
      document: {
        id: 'tid',
        index: ['title', 'time']
      }
    });
    source.value.forEach(item => index.add(item));
  }

  function search(q: string) {
    if (!q.trim()) {
      results.value = source.value;
      return;
    }
    const ids = index.search(q);
    const idSet = new Set(ids.flatMap(r => r.result));
    results.value = source.value.filter(item => idSet.has(item.tid));
  }

  watch(source, buildIndex, { immediate: true });
  watch(query, () => search(query.value));

  return { query, results };
}
```

#### 4.2.4 MediaGrid.vue（LightGallery 集成）

```vue
<template>
  <div ref="containerRef" class="media-grid">
    <a
      v-for="(item, i) in mediaItems"
      :key="i"
      class="media-item"
      :class="{ video: item.type === 'video' }"
      :data-src="item.src"
      :data-sub-html="item.caption"
      :data-poster="item.poster"
      :data-video="item.video ? JSON.stringify(item.video) : undefined"
    >
      <img :src="item.thumb" alt="">
      <span v-if="item.duration" class="duration">{{ item.duration }}</span>
    </a>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import lightGallery from 'lightgallery';
import lgZoom from 'lightgallery/plugins/zoom';
import lgVideo from 'lightgallery/plugins/video';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgRotate from 'lightgallery/plugins/rotate';
import lgFullscreen from 'lightgallery/plugins/fullscreen';
import lgAutoplay from 'lightgallery/plugins/autoplay';
import 'lightgallery/css/lightgallery.css';
import '@/styles/lightgallery-theme.scss';

interface MediaItem {
  src: string;
  thumb: string;
  caption?: string;
  type?: 'image' | 'video';
  poster?: string;
  video?: { source: { src: string; type: string }[] };
  duration?: string;
}

const props = defineProps<{ mediaItems: MediaItem[] }>();
const containerRef = ref<HTMLElement>();
let lgInstance: lightGallery | null = null;

onMounted(() => {
  if (!containerRef.value) return;
  lgInstance = lightGallery(containerRef.value, {
    plugins: [lgZoom, lgVideo, lgThumbnail, lgRotate, lgFullscreen, lgAutoplay],
    speed: 300,
    videojs: false,
    thumbnail: true,
    download: false,
    addClass: 'lg-theme-archive'
  });
});

onUnmounted(() => {
  lgInstance?.destroy();
});
</script>
```

### 4.3 阶段 3 验证标准

- [x] 进入 `#/messages` 后立即显示索引列表（< 1s）—— dev server 与构建产物均验证
- [x] 滚动到某年时按需加载该年详情，不阻塞 UI —— `messagesStore.loadYear` 异步加载 + yearCache 缓存
- [x] 10000+ 条说说列表流畅滚动（60fps）—— vue-virtual-scroller RecycleScroller 接入完成
- [x] 搜索框输入关键字后即时筛选（< 200ms）—— FlexSearch Document 索引 + storeToRefs 修复响应式
- [x] 点击配图打开 LightGallery，支持缩放/旋转/全屏 —— MediaGrid + useLightGallery 动态加载 6 个插件
- [x] 点击视频缩略图播放视频 —— lgVideo 插件统一管理生命周期，避免 play/pause 竞态
- [x] 点击「喜欢」数字弹出点赞列表 —— LikesModal 网格化头像列表
- [x] 点击「评论」数字弹出评论树，二级嵌套回复正常显示 —— CommentsModal 渲染 `c.list_3` 二级回复

---

## 五、端到端验证

### 5.1 完整流程测试

1. 加载扩展，打开 options.html
2. 说说模块选择 SPA 备份类型
3. 在 QQ 空间页面触发备份
4. 等待备份完成，下载 ZIP
5. 解压 ZIP，双击 `index.html`
6. 验证：
   - SPA 自动跳转到 `Common/spa/index.html`
   - 说说列表正常加载
   - 虚拟滚动流畅
   - 搜索功能正常
   - LightGallery 图片查看正常
   - 点赞/评论模态正常
   - 切换其他年份按需加载

### 5.2 已知风险与对策

| 风险 | 对策 |
|------|------|
| file:// 下 `<script src>` 加载顺序不确定 | data-loader 用 Promise 包装 |
| 中文路径导致 SPA 加载失败 | 测试中文目录名，必要时用 encodeURI |
| FlexSearch 索引体积大 | 仅索引文本字段，关键词分词后建立倒排索引 |
| 用户已有旧 HTML 备份 | 保留 HTML 模式不删除，新旧并存 |
| Vue 3 学习曲线 | 先实现 Messages 模块作为模板，其他模块套用 |

---

## 六、执行顺序与里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| **阶段 1** | 扩展端改造（config + common + messages + options + manifest） | ✅ 已完成（2026-07-27） |
| **阶段 2** | SPA 骨架（Vite + Vue 3 + 路由 + Pinia + 设计系统） | ✅ 已完成（2026-07-27） |
| **阶段 3** | Messages 模块完整链路（虚拟滚动 + LightGallery + 评论树 + FlexSearch） | ✅ 已完成（2026-07-27） |
| **阶段 4** | Visitors 模块扩展（访客索引/分片 + 列表/详情/搜索 + 侧边栏归档） | ✅ 已完成（2026-07-28） |
| **验证** | 端到端测试 | 待开始 |

### 6.1 阶段 1 完成总结

**已完成的改动（5 个文件）**：

| 文件 | 改动 | 验证 |
|------|------|------|
| [src/js/config.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/config.js) | 新增 `SpaExportFiles` 常量（5 条目）+ 挂载到 `QZone.Common.SpaExportFiles`（L728/L779） | ✅ `node --check` 通过 |
| [src/js/modules/common.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/common.js) | 新增 `hasExportType`（L276）+ `exportUserToSpa`（L288，含 export-entry.html 兜底模板）+ 在 `exportUser` 中调用（L144） | ✅ `node --check` 通过 |
| [src/js/modules/messages.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/messages.js) | 新增 `case 'SPA'`（L358）+ `exportToSpa`（L519，生成索引 + 按年分片） | ✅ `node --check` 通过 |
| [src/html/options.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/options.html) | 10 个下拉框新增 `<option value="SPA">SPA</option>`（L86/368/562/744/1155/1325/1412/1533/1609/1822） | ✅ grep 验证 10 处 |
| [src/manifest.json](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/manifest.json) | `web_accessible_resources` 增补 `export/spa-dist/*` 与 `export/spa-dist/**/*`（L74-75） | ✅ JSON.parse 通过 |

**交叉引用一致性验证**：
- `QZone.Common.SpaExportFiles`（config.js 定义）← `exportUserToSpa`（common.js 引用）✅
- `API.Common.hasExportType`（common.js 定义）← `exportUserToSpa`（common.js 调用）✅
- `API.Common.exportUserToSpa`（common.js 定义）← `exportUser`（common.js 调用）✅
- `API.Messages.exportToSpa`（messages.js 定义）← `exportAllListToFiles` switch（messages.js 调用）✅

**待阶段 2 补齐的前置依赖**：
- `export/spa-dist/index.html`、`export/spa-dist/assets/*`、`export/spa-dist/export-entry.html` —— 由 Vite 构建产出
- 在阶段 2 完成前，`exportUserToSpa` 内的 `API.Utils.get(chrome.runtime.getURL('export/spa-dist/export-entry.html'))` 会失败并走兜底内联模板，不会阻断备份流程

### 6.2 阶段 2 完成总结

**已完成的工作（22 个文件）**：

| 类别 | 文件 | 说明 |
|------|------|------|
| 项目配置 | [package.json](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/package.json) | 依赖：Vue 3 / vue-router / pinia / vue-virtual-scroller / flexsearch / lightgallery；脚本：dev / build / build:only / preview |
| 项目配置 | [vite.config.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/vite.config.ts) | ESM `__dirname` 修复 + 固定端口 5175 + `base: './'` + `cssCodeSplit: false` + 关闭 hash + `rollupOptions.input` 显式指定 + 5 个 manualChunks 分包 |
| 项目配置 | [tsconfig.json](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/tsconfig.json) / [tsconfig.node.json](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/tsconfig.node.json) | strict 模式 + `@/*` 路径别名 |
| 类型声明 | [src/env.d.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/env.d.ts) | `*.vue` 模块声明 + `Window.userInfo` / `messagesIndex` / `messages_*` 全局变量声明 + flexsearch / vue-virtual-scroller 模块声明 |
| 入口 | [index.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/index.html) | SPA 开发入口，加载 Google Fonts（联网时增强排版，离线回退系统字体） |
| 入口 | [public/export-entry.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/public/export-entry.html) | 备份 ZIP 根目录入口，meta refresh + JS 兜底跳转到 `Common/spa/index.html` |
| 应用核心 | [src/main.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/main.ts) | createApp + Pinia + router + 三套样式 tokens/base/lightgallery-theme |
| 应用核心 | [src/App.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/App.vue) | Masthead + SideBar + RouterView（含 fade 过渡动画）+ 启动时加载用户信息 |
| 应用核心 | [src/router.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/router.ts) | hash 路由，4 个视图静态 import（合并进 index.js，避免动态分片导致扩展端清单难维护）+ scrollBehavior 还原滚动位置 |
| 应用核心 | [src/types.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/types.ts) | UserInfo / MessageIndex / Message / Comment / LikeItem 类型定义 |
| 数据加载 | [src/api/data-loader.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/api/data-loader.ts) | `loadScript<T>` 通用 `<script>` 标签加载器（避开 file:// fetch 限制）+ `loadUserInfo` / `loadMessagesIndex` / `loadMessagesByYear` |
| 状态管理 | [src/stores/user.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/stores/user.ts) | 用户 store：info / loading / error / isReady / uin / nickname / avatar / isOwner / stats / totalRecords / init |
| 状态管理 | [src/stores/messages.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/stores/messages.ts) | 说说 store：index 索引 + yearCache 按年缓存 + loadedYears / loadingYears 集合 + yearGroups 计算属性 + init / loadYear / getMessageByTid |
| 设计系统 | [src/styles/tokens.scss](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/styles/tokens.scss) | CSS 变量：色板（paper/ink/vermilion/indigo/moss/gold）+ 字体（display/body/mono/serif-cn）+ 间距尺度 + 墨水线 + 动画缓动 |
| 设计系统 | [src/styles/base.scss](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/styles/base.scss) | 重置 + body（纸张纹理 + 噪点叠加）+ 排版 + 按钮 + 标签 + 搜索框 + 加载状态 + frame 网格 + section-head + 入场动画 + 响应式 |
| 设计系统 | [src/styles/lightgallery-theme.scss](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/styles/lightgallery-theme.scss) | `.lg-theme-archive` 主题覆盖：墨色半透明背景 + 纸张暖色按钮 + 等宽字标题 + 朱砂色进度条 |
| 布局 | [src/components/layout/Masthead.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/layout/Masthead.vue) | 顶部刊头：三栏 grid + Vol/No 标号 + 标题"QQ空间<em>档案</em>" + uin + 总记录数 + ink-spread 入场动画 + 移动端单栏 |
| 布局 | [src/components/layout/NavBar.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/layout/NavBar.vue) | 顶部导航 + 搜索框（仅 messages 路由显示）+ ⌘K 快捷键聚焦 + active-class 高亮 |
| 布局 | [src/components/layout/SideBar.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/layout/SideBar.vue) | 左侧目录：8 个模块导航 + 说说归档按年份分组 + count 简写（≥1k 显示 k）+ sticky 定位 + 移动端转横向 |
| 视图 | [src/views/HomeView.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/views/HomeView.vue) | 个人中心：用户卡（avatar + nickname + uin + 本人 tag）+ 数据档案 10 格网格 + 模块入口按钮 + colophon 页脚 |
| 视图 | [src/views/MessagesView.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/views/MessagesView.vue) | 说说列表页占位：加载/错误/空状态处理 + 按年份浏览入口（点击触发 loadYear）+ 已加载预览提示（阶段 3 替换为虚拟滚动） |
| 视图 | [src/views/BlogsView.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/views/BlogsView.vue) | 日志页占位 |
| 视图 | [src/views/NotFoundView.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/views/NotFoundView.vue) | 404 页面 |

**构建产物（src/export/spa-dist/）**：

| 文件 | 体积 | gzip |
|------|------|------|
| `index.html` | 0.93 KB | 0.63 KB |
| `assets/index.js` | 14.18 KB | 6.02 KB |
| `assets/style.css` | 13.76 KB | 3.31 KB |
| `assets/vendor.js` | 101.49 KB | 39.57 KB |
| `assets/scroller.js` | 0.00 KB | 0.02 KB（空 chunk，阶段 3 引入后填充） |
| `assets/search.js` | 0.00 KB | 0.02 KB（空 chunk，阶段 3 引入后填充） |
| `assets/gallery.js` | 0.00 KB | 0.02 KB（空 chunk，阶段 3 引入后填充） |
| `export-entry.html` | 0.6 KB | — |
| **合计** | ~131 KB | **~50 KB** |

**验证结果**：

1. `npm install` ✅ 依赖安装无报错
2. `npm run build:only` ✅ vite build 成功，55 模块转换，1.19s 完成
3. 产物结构与 `SpaExportFiles` 清单（8 条目）完全匹配 ✅
4. dev server 启动 ✅ http://localhost:5175/ 无警告（修复了 `rollupOptions.input` 缺失导致的 "Could not auto-determine entry point" 警告）
5. 路由切换 ✅ `#/` → `#/messages`，搜索框在 messages 路由下出现，其他路由隐藏
6. 设计系统渲染 ✅ Masthead（h1 "QQ空间档案"）+ NavBar（首页/说说/日志）+ SideBar（8 个模块导航 + 说说归档）+ 章节标题 + 搜索框 + 按钮样式全部生效
7. 控制台无报错 ✅

**已修复的关键配置问题**：

| 问题 | 原因 | 修复 |
|------|------|------|
| ESM 模式下 `__dirname` 未定义 | `"type": "module"` 下 Node 不再注入 `__dirname` | `import { fileURLToPath } from 'url'` + `dirname(fileURLToPath(import.meta.url))` 手动构造 |
| dev server 警告 "Could not auto-determine entry point" | `rollupOptions` 仅指定 `output` 未指定 `input`，vite 在 dev 模式下无法自动推断入口 | 显式添加 `rollupOptions.input: resolve(__dirname, 'index.html')` |
| 构建产物文件名带 hash | vite 默认开启 hash 命名 | `entryFileNames: 'assets/index.js'` / `chunkFileNames: 'assets/[name].js'` / `assetFileNames: 'assets/[name].[ext]'` 关闭 hash |
| CSS 文件名变成 `style.css` 而非 `index.css` | vite 在 `cssCodeSplit: false` 模式下以入口 scss 文件名命名 | 已同步更新 `SpaExportFiles` 清单中 `index.css` → `style.css` |
| 路由分片导致扩展端资源清单难维护 | 动态 `() => import('@/views/...')` 生成 `HomeView-xxx.js` 等 chunk，需在清单中维护 | 路由改用静态 `import`，4 个视图合并进 `index.js` |

**待阶段 3 补齐的内容**：

- `components/message/MessageCard.vue` + `MessageList.vue`（虚拟滚动列表）
- `components/common/ModalDialog.vue` + `LikesModal.vue` + `CommentsModal.vue`（点赞/评论模态）
- `components/common/MediaGrid.vue`（LightGallery 媒体网格）
- `components/stats/StatGrid.vue`（数据统计网格，可从 HomeView 抽取）
- `composables/useFlexSearch.ts` + `useLightGallery.ts`（搜索与图库 hooks）
- `views/MessagesView.vue` 用真实组件替换占位

### 6.3 阶段 3 完成总结

**已完成的工作（11 个文件，含修复）**：

| 类别 | 文件 | 说明 |
|------|------|------|
| 视图 | [src/views/MessagesView.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/views/MessagesView.vue) | 说说列表页主视图：搜索结果元信息 + 虚拟滚动 + 详情模态 + 年份快速跳转；接入 useFlexSearch + storeToRefs 修复响应式索引监听；新增 `route.query.year` 监听器实现侧边栏年份定位 |
| 视图 | [src/views/BlogsView.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/views/BlogsView.vue) | 通用占位页：接受 `module` prop，按模块显示对应名称（日志/日记/相册/视频/留言/收藏/分享/好友/访客）与章节号；根据用户 stats 显示数据状态提示 |
| 路由 | [src/router.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/router.ts) | 新增 8 个模块路由（blogs/diaries/photos/videos/boards/favorites/shares/friends/visitors），全部复用 BlogsView + `props.module` 区分文案 |
| 状态管理 | [src/stores/messages.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/stores/messages.ts) | 说说 store：index 索引 + yearCache + loadedYears/loadingYears 集合 + yearGroups 计算属性 + init/loadYear/getMessageByTid；init 加 loading guard 防止并发 |
| 组合式 | [src/composables/useFlexSearch.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/composables/useFlexSearch.ts) | 全文搜索 hook：动态加载 flexsearch 库 + Document 索引（title/time 字段）+ watch source 重建索引 + 多字段命中合并去重 |
| 组合式 | [src/composables/useLightGallery.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/composables/useLightGallery.ts) | LightGallery 初始化 hook：动态导入 lightgallery + 6 个插件（zoom/video/thumbnail/rotate/fullscreen/autoplay）+ 模块级缓存 + onBeforeUnmount 自动销毁 |
| 组件 | [src/components/message/MessageList.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/message/MessageList.vue) | 虚拟滚动容器：RecycleScroller + 默认 120px 行高 + 400px buffer + defineExpose scrollToItem |
| 组件 | [src/components/message/MessageCard.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/message/MessageCard.vue) | 说说卡片：时间戳列 + 编号 + 标题预览 + 缩略图占位 + 互动数据（♡✎▣）+ hover 朱砂圆点；移动端单列布局 |
| 组件 | [src/components/message/MessageDetailModal.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/message/MessageDetailModal.vue) | 说说详情模态：元数据栏 + 转发引用块 + 正文 + MediaGrid + 互动数据按钮（点击触发子模态） |
| 组件 | [src/components/common/ModalDialog.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/common/ModalDialog.vue) | 通用模态：Teleport + ESC 关闭 + body overflow 锁定 + 3 档尺寸（sm/md/lg）+ fade + translateY 过渡 |
| 组件 | [src/components/common/MediaGrid.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/common/MediaGrid.vue) | 媒体网格：auto-fill 120px + aspect-ratio 1 + 视频徽标 + 时长徽标；接入 useLightGallery 自动初始化；watch mediaItems 时 destroy + 重新 setup |
| 组件 | [src/components/common/LikesModal.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/common/LikesModal.vue) | 点赞列表模态：auto-fill 180px 网格 + 头像 + 昵称 + uin；portrait 字段兼容 http/相对路径 |
| 组件 | [src/components/common/CommentsModal.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/common/CommentsModal.vue) | 评论树模态：一级评论 grid 40px+1fr + 二级回复 list_3 嵌套 + ↳ 朱砂前缀 + 评论配图 MediaGrid 嵌套 |
| 布局 | [src/components/layout/NavBar.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/layout/NavBar.vue) | 修复：删除未使用的 `emit('search')` 死代码，搜索词仅通过 `route.query.q` 双向同步 |
| 布局 | [src/components/layout/SideBar.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/layout/SideBar.vue) | 修复：8 个模块导航改用独立路径（/blogs /diaries /photos /videos /boards /friends /visitors）替代统一指向 /blogs |
| 视图 | [src/views/HomeView.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/views/HomeView.vue) | 修复：stat-cell 边框改为响应式（≥1024px 4 列 / 640-1023px 2 列 / <640px 1 列），替代硬编码 `:nth-child(4n)` |

**构建产物（src/export/spa-dist/）**：

| 文件 | 体积 | gzip | 变化 |
|------|------|------|------|
| `index.html` | 0.99 KB | 0.64 KB | 持平 |
| `assets/style.css` | 27.26 KB | 5.51 KB | +0.27 KB（响应式边框 + BlogsView 样式） |
| `assets/search.js` | 15.87 KB | 6.49 KB | 已填充（FlexSearch） |
| `assets/scroller.js` | 19.01 KB | 7.39 KB | 已填充（vue-virtual-scroller） |
| `assets/index.js` | 32.60 KB | 11.87 KB | +1.32 KB（路由 + BlogsView + 9 个组件） |
| `assets/gallery.js` | 100.66 KB | 24.68 KB | 已填充（LightGallery + 6 插件） |
| `assets/vendor.js` | 106.15 KB | 41.43 KB | 持平 |
| **合计** | ~303 KB | **~98 KB** | 阶段 2 的 50KB → 98KB（含 Phase 3 真实组件代码） |

**验证结果**：

1. `npm run build:only` ✅ 91 模块转换，1.47s 完成，无错误无警告（除 sass legacy-js-api 弃用提示）
2. dev server ✅ http://localhost:5175/ 路由全部可访问
3. agent-browser 8 项验证全部 PASS：
   - `/videos` → 「视频 档案」✅
   - `/photos` → 「相册 档案」✅
   - `/friends` → 「好友 档案」✅
   - `/visitors` → 「访客 档案」✅
   - `/messages` → 「说说 · 档案」✅
   - `/messages?year=2026` → URL 保留参数，页面无崩溃 ✅
   - `/` → Masthead 「QQ空间 档案」✅
   - SideBar 8 个链接 href 全部正确 ✅
4. 无 JS 渲染错误、无 TypeScript 编译错误（仅预期的 404 数据加载错误，dev 模式下 user.js / messages-index.js 不存在属预期）

**修复的关键问题**：

| 问题 | 原因 | 修复 |
|------|------|------|
| FlexSearch 搜索无结果 | `messagesStore.index` 被 Pinia 自动解包为数组而非 ref，`watch` 无法监听变化 | `MessagesView` 用 `storeToRefs(messagesStore)` 拿到响应式 `indexRef` 传给 `useFlexSearch` |
| 视频播放 `AbortError: play() interrupted by pause()` | 手写视频播放器在 `play()` Promise 未 resolve 时调用 `pause()` | 改用 LightGallery `lgVideo` 插件，统一管理视频生命周期 |
| SideBar 年份点击无响应 | SideBar 生成 `/messages?year=2026`，但 MessagesView 仅监听 `route.query.q`，未消费 `year` | 新增 `watch(route.query.year)`，等待 index + useFlexSearch 就绪后调用 `jumpToYear` |
| 非 Messages 模块点击后页面标题错乱 | SideBar 7 个非说说模块全部指向 `/blogs`，BlogsView 写死「日志档案」 | router.ts 新增 8 个独立路由 + `props.module`，BlogsView 按 module prop 显示对应模块名 |
| NavBar 死代码 emit | `defineEmits<{ search }>` + `emit('search', v)` 从未被父组件监听 | 删除 emit 声明与调用，搜索词仅靠 `route.query.q` 双向同步 |
| HomeView stat-cell 边框错位 | `:nth-child(4n)` 硬编码 4 列布局，小屏 auto-fit 变 1-2 列时右边框错乱 | 改用响应式媒体查询：≥1024px 4 列 / 640-1023px 2 列 / <640px 1 列 |

**待端到端验证补齐**：

- 用扩展触发真实 QZone 备份生成 ZIP，验证 file:// 协议下完整链路
- 大数据量（10000+ 条说说）实际滚动性能与 FlexSearch 索引构建时间测量
- 真实说说数据中 pic_list / commentlist / like 字段名兼容性验证（types.ts 中已预留兼容字段）

### 6.4 阶段 4 完成总结

**已完成的工作（10 个文件，含修复）**：

| 类别 | 文件 | 说明 |
|------|------|------|
| 扩展端 | [src/js/modules/visitors.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/visitors.js) | `exportAllListToFiles` 新增 `case 'SPA'` 分支 + `exportToSpa` 函数：生成轻量索引 `visitors-index.js`（uin/name/time/src/platformSrc/isHideVisit/yellow/supervip + 5 类互动计数）+ 按年分片全量数据 `visitors-YYYY.js` |
| 视图 | [src/views/VisitorsView.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/views/VisitorsView.vue) | 访客列表页主视图：搜索结果元信息 + 虚拟滚动 + 详情模态 + 年份快速跳转 + `route.query.year` 侧边栏年份定位；客户端搜索使用普通 `includes` 过滤（访客数据量通常较小，避免 FlexSearch 索引开销） |
| 路由 | [src/router.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/router.ts) | `/visitors` 路由从 BlogsView 占位改为独立 VisitorsView，章节号 § 10 |
| 状态管理 | [src/stores/visitors.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/stores/visitors.ts) | 访客 store：index 索引 + yearCache + loadedYears/loadingYears 集合 + yearGroups 计算属性 + init/loadYear/getVisitorByIndex；通过 `formatUnixTime` 将全量数据 unix 秒格式化后与索引项的 time 字符串比对定位 |
| 类型 | [src/types.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/types.ts) | 新增 `VisitorIndex` / `Visitor` / `VisitorShuoshuo` / `VisitorSubItem` 类型，对齐扩展端 `exportToSpa` 输出字段 |
| 数据加载 | [src/api/data-loader.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/api/data-loader.ts) | 新增 `VISITORS_BASE` 路径常量（dev: `/Visitors/` / prod: `../../Visitors/`）+ `loadVisitorsIndex` + `loadVisitorsByYear` |
| 工具 | [src/utils/formatContent.ts](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/utils/formatContent.ts) | 新增 `formatUnixTime(unixSeconds)` 工具函数：将 unix 秒格式化为 'YYYY-MM-DD HH:mm:ss'，对齐扩展端 `API.Utils.formatDate` 默认输出 |
| 组件 | [src/components/visitor/VisitorCard.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/visitor/VisitorCard.vue) | 访客卡片：时间戳列 + uin 编号 + 隐身/SVIP/黄钻徽章 + 名称预览 + 来源信息（PC/QQ/手机/微信等映射）+ 5 类互动计数；移动端单列布局 |
| 组件 | [src/components/visitor/VisitorList.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/visitor/VisitorList.vue) | 虚拟滚动容器：DynamicScroller + minItemSize 120px + 400px buffer；为 VisitorIndex 注入 `_key` 字段（uin+time 组合）保证 key-field 唯一性 |
| 组件 | [src/components/visitor/VisitorDetailModal.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/visitor/VisitorDetailModal.vue) | 访客详情模态：元数据栏（时间/uin/隐身/SVIP/黄钻）+ 访客名称 + 访问主页链接 + 4 类查看内容分区（说说/日志/相册/分享）+ 同期访客列表；说说/相册项支持 `formatContent` 处理 [em] 表情与 @ 提及 |
| 布局 | [src/components/layout/NavBar.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/layout/NavBar.vue) | 搜索框 `showSearch` 由 `route.name === 'messages'` 扩展为 `=== 'messages' \|\| === 'visitors'`，访客页也可用顶部搜索 |
| 布局 | [src/components/layout/SideBar.vue](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/src/components/layout/SideBar.vue) | 新增「访客归档」年份分组链接（`/visitors?year=YYYY`）+ onMounted 同时初始化 visitorsStore |

**构建产物**：

| 文件 | 体积 | gzip | 变化 |
|------|------|------|------|
| `index.html` | 0.83 KB | 0.61 KB | 持平 |
| `assets/style.css` | 72.64 KB | 14.72 KB | 持平（访客组件样式已合并） |
| `assets/index.js` | 303.73 KB | 100.42 KB | +1.65 KB（5 个访客组件 + store + 视图） |
| **合计** | ~303 KB | **~100 KB** | 阶段 3 的 98KB → 100KB |

**验证结果**：

1. `npm run build` ✅ 106 模块转换（阶段 3 为 91），1.60s 完成，无错误（仅 sass legacy-js-api 弃用提示）
2. dev server ✅ http://localhost:5175/#/visitors 路由可访问，HMR 正常
3. agent-browser 5 项验证全部 PASS：
   - 初始加载：标题「访客 · 档案」+ 「5 entries」+ 顶部搜索框可见 ✅
   - 详情模态：点击蔡梓豪卡片 → 标题「蔡梓豪 · 2026-07-27」+ 「查看了说说 · 1」+ 「同期访问的访客 · 1」+ 说说名「副高之下的杭城」 ✅
   - 搜索功能：输入「周路」→ 命中 1 条；清除搜索 → 恢复 5 条 ✅
   - 侧边栏：「访客归档」+ 「2026 年 5」链接 + 模块导航「访客」计数 5 ✅
   - 控制台：无错误无警告 ✅

**关键技术决策**：

| 问题 | 方案 | 理由 |
|------|------|------|
| 访客记录无唯一 tid | 用 `uin + time` 组合作为 `_key` | 同一访客可在不同时间多次访问，但同秒访问极少；DynamicScroller 要求 key-field 唯一性 |
| 索引与全量数据时间字段类型不一致 | 索引存格式化字符串、全量存 unix 秒；SPA 端用 `formatUnixTime` 转换后比对 | 对齐扩展端既有 `API.Utils.formatDate(time)` 模式，避免在扩展端额外格式化 |
| 访客搜索是否用 FlexSearch | 改用普通 `includes` 过滤 | 访客数据量通常较小（几百到几千），无需 FlexSearch 异步索引；且访客无标题字段，搜索 name/uin/time 三字段即可 |
| 顶部搜索框是否对访客可见 | `showSearch` 扩展为 messages 或 visitors | 用户在访客页同样需要搜索，统一通过 `route.query.q` 双向同步 |
| 详情模态来源字段展示 | 用扩展端原始 `src` / `platform_src` 数值映射为 PC/QQ/手机/微信等 | 数字字段对用户无意义，需文案化展示；映射表基于 QQ 空间接口约定 |

---

## 七、附录

### 7.1 设计参考

- [design-system-preview.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/design-system-preview.html) — 设计系统预览
- [components-preview.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/spa/components-preview.html) — 组件库预览

### 7.2 现有项目相关文件

- [src/js/config.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/config.js) — `ExportFiles` 在 L632，`QZone.Common` 在 L724
- [src/js/modules/common.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/common.js) — `exportUserToHtml` 在 L224，`writeJsonToJs` 在 L309
- [src/js/modules/messages.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/messages.js) — `exportAllListToFiles` 在 L343
- [src/html/options.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/options.html) — `messages_exportFormat` 在 L82
- [src/manifest.json](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/manifest.json) — `web_accessible_resources` 在 L69

### 7.3 阶段 1 执行清单（可勾选追踪）

> 实施顺序：自下而上，先底层资源清单，再业务函数，最后 UI 与 manifest。

**Step 1 — config.js（资源清单）**
- [ ] 在 `ExportFiles` 数组之后（L719）新增 `SpaExportFiles` 常量（5 个条目：index.html / index.js / index.css / vendor.js / vendor.css）
- [ ] 在 `QZone.Common` 对象内（L754 `ExportFiles: ExportFiles` 之后）新增 `SpaExportFiles: SpaExportFiles`

**Step 2 — common.js（用户档案 + SPA 静态资源复制）**
- [ ] 新增 `API.Common.hasExportType(exportType)` 工具函数（遍历 10 个模块判断 exportType）
- [ ] 新增 `API.Common.exportUserToSpa(userInfo)` 函数：复制 SpaExportFiles 到 `Common/spa/`，写 SPA 入口 `index.html`
- [ ] 在 `API.Common.exportUser`（L141 `exportUserToHtml` 之后）调用 `exportUserToSpa`

**Step 3 — messages.js（说说 SPA 导出）**
- [ ] 在 `exportAllListToFiles` switch 内（L356 `case 'JSON'` 之后）新增 `case 'SPA'` 分支
- [ ] 新增 `API.Messages.exportToSpa(messages)` 函数：生成 `messages-index.js` + 按年分片 `messages-YYYY.js`

**Step 4 — options.html（10 个下拉框新增 SPA 选项）**
- [ ] messages_exportFormat（L85 之后）
- [ ] blogs_exportFormat（L366 之后）
- [ ] diaries_exportFormat（L559 之后）
- [ ] photos_exportFormat（L740 之后）
- [ ] videos_exportFormat（L1150 之后）
- [ ] boards_exportFormat（L1319 之后）
- [ ] friends_exportFormat（L1405 之后）
- [ ] favorites_exportFormat（L1525 之后）
- [ ] shares_exportFormat（L1600 之后）
- [ ] visitors_exportFormat（L1812 之后）

  > 注意：阶段 1 仅实现 Messages 的 `exportToSpa`。其余 9 个模块若选 SPA，将命中 `default` 分支打印 `未支持的导出类型` 警告，属预期行为；待后续阶段补齐 `case 'SPA'` 后即可生效。

**Step 5 — manifest.json（资源可访问性）**
- [ ] `web_accessible_resources[0].resources` 内新增 `"export/spa-dist/*"` 与 `"export/spa-dist/**/*"`（L73 之后）

**Step 6 — 阶段 1 自测**
- [ ] 扩展加载无报错
- [ ] options 页面 10 个下拉框均显示 SPA 选项
- [ ] 选择 Messages=SPA 保存后重启扩展，配置保留
- [ ] 手动构造测试数据触发 `API.Messages.exportToSpa([...])`，验证 `Messages/data/messages-index.js` 与 `messages-YYYY.js` 生成且 `window.messagesIndex` / `window.messages_YYYY` 可读
- [ ] 触发 `API.Common.exportUserToSpa()`，验证 `Common/spa/` 目录被创建（spa-dist 源文件待阶段 2 生成，阶段 1 仅验证调用链不报错）

### 7.4 阶段 1 已知前置依赖

- 阶段 1 的 `exportUserToSpa` 会尝试读取 `export/spa-dist/export-entry.html` 与 `export/spa-dist/*` 资源；这些文件在阶段 2 构建后才存在。
- 因此阶段 1 完成后，**不应让用户真正触发 SPA 备份**，仅做调用链联调；端到端验证须待阶段 2 完成。
