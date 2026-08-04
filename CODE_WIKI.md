# qzone-archiver — Code Wiki

> 项目仓库：[https://github.com/salt-fishes/qzone-archiver](https://github.com/salt-fishes/qzone-archiver)
> 原项目：[ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport)
> 版本：v3.3.0（Manifest V3 + SPA 档案浏览器）

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [目录结构](#3-目录结构)
4. [运行机制与启动流程](#4-运行机制与启动流程)
5. [核心模块职责](#5-核心模块职责)
6. [关键类与函数说明](#6-关键类与函数说明)
7. [依赖关系](#7-依赖关系)
8. [配置与数据结构](#8-配置与数据结构)
9. [项目运行方式](#9-项目运行方式)
10. [关键约束与工程实践](#10-关键约束与工程实践)
11. [附录](#11-附录)

---

## 1. 项目概述

**qzone-archiver** 是一款基于 Chrome 扩展（Manifest V3）的 QQ 空间备份工具，将说说、日志、日记、相册、视频、留言、好友、收藏、分享、访客 10 类内容导出为本地文件，并配套 **SPA 档案浏览器** 离线浏览。

### 核心能力

- 通过注入 QQ 空间页面（`https://*.qzone.qq.com/*`）的内容脚本调用官方内部接口抓取数据
- 支持 **SPA / HTML / MarkDown / JSON** 四种备份类型，可按模块独立选择，默认 `SPA`
- 多媒体文件支持浏览器 / Ajax / Aria2 / 迅雷（唤醒 / 剪贴板 / 链接清单）等多种下载方式
- 支持 **增量备份**、**已删除说说恢复**、**暂停 / 恢复 / 取消**（细粒度检查点）
- SPA 档案浏览器：`file://` 直开、虚拟滚动、全文搜索、画廊预览

### 技术栈

| 维度 | 选型 |
|------|------|
| 平台 | Chrome Extension (Manifest V3) |
| 扩展语言 | 原生 JavaScript (ES2017+)、HTML5、CSS3 |
| 扩展 UI | Bootstrap 4 + Bootstrap Select + Flatpickr |
| 设计系统 | 自研复古暖色主题（`theme.css`，CSS 变量） |
| 模板引擎 | art-template（**预编译**为 `templates-compiled.js`） |
| SPA 前端 | Vue 3 + Pinia + vue-router（hash 模式）+ TypeScript |
| SPA 滚动 | vue-virtual-scroller（DynamicScroller / RecycleScroller） |
| SPA 搜索 | FlexSearch |
| SPA 画廊 | LightGallery 2.7.2（6 插件） |
| 构建工具 | Vite 5（IIFE + inlineDynamicImports 单文件产物） |
| 文件系统 | Filer + JSZip + FileSaver |
| 表格导出 | SheetJS (xlsx) |
| HTML → Markdown | Turndown |
| 工具库 | jQuery 3、Lodash |

---

## 2. 整体架构

项目由「扩展侧（采集）」「导出侧（离线 HTML）」「SPA（档案浏览器）」三部分构成：

```
┌──────────────────────────────────────────────────────────────────┐
│                    浏览器扩展侧（src/）                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ background.js —— Service Worker                            │  │
│  │  下载调度 / 消息中枢 / declarativeNetRequest 防盗链规则     │  │
│  │  持久态存 chrome.storage.session                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ content.js + js/modules/*.js —— 内容脚本                    │  │
│  │ 注入 QQ 空间页面，抓取数据并生成文件 / ZIP                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ popup.html  │  │ options.html│  │ tools.html  │             │
│  │ 工具栏弹窗   │  │ 设置页       │  │ 工具页       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  公共底座：utils.js / api.js / config.js                        │
└──────────────────────────────────────────────────────────────────┘
        ↓ 生成备份 ZIP
┌──────────────────────────────────────────────────────────────────┐
│                  导出侧（src/export/ + src/templates/）          │
│  离线 HTML 页面：index.html + 各模块页面 + Statistics 足迹地图    │
│  备份类型为 HTML/MarkDown/JSON 时作为浏览入口                    │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│            SPA 档案浏览器（src/spa/ → export/spa-dist/）          │
│  备份类型为 SPA 时，ZIP 根目录 index.html 重定向到                │
│  Common/spa/index.html，Vue 3 单页应用直接浏览数据                │
└──────────────────────────────────────────────────────────────────┘
```

### 备份流程时序

```
popup「开始备份」
    │ (port: 'popup')
    ▼
content.js: operator.next(OperatorType.SHOW)
    │
    ▼
弹出 indicator.html 进度模态 → initModelFolder() 创建目录
    │
    ▼（按顺序执行，未勾选模块跳过）
INIT_USER_INFO → Messages → Blogs → Diaries → Boards →
Friends → Favorites → Shares → Visitors → Photos → Videos
    │
    ▼
OTHERS_INFO（用户信息 / 统计 / SPA 静态资源）
    │
    ▼
ZIP（JSZip 压缩） → COMPLETE（打包下载）
```

---

## 3. 目录结构

```
qzone-archiver/
├── src/                            # 扩展根目录（被 Chrome 加载）
│   ├── manifest.json              # MV3 清单
│   ├── html/                      # 扩展页面
│   │   ├── options.html           # 设置页（左侧 Tab 导航）
│   │   ├── popup.html             # 工具栏弹窗
│   │   ├── tools.html             # 工具页（本地相册 / 横向 Tab）
│   │   ├── indicator.html         # 备份进度模态
│   │   ├── about.html             # 关于页（本项目 / 原项目双栏）
│   │   ├── docs.html              # 使用文档（左目录 + 右正文双栏）
│   │   ├── usage.html             # 使用说明（双栏）
│   │   ├── faq.html               # 常见问题（双栏）
│   │   └── privacy.html           # 隐私政策
│   ├── css/
│   │   ├── theme.css              # 复古暖色设计系统（CSS 变量 + 组件样式）
│   │   ├── content.css            # 注入 QQ 空间页面的样式
│   │   ├── options.css            # 设置页样式
│   │   └── popup.css              # 弹窗样式
│   ├── js/
│   │   ├── background.js         # Service Worker
│   │   ├── content.js            # 内容脚本入口（状态机 / 类 / 进度指示）
│   │   ├── api.js                # QQ 空间 REST API 封装 + API.Utils
│   │   ├── config.js             # 默认配置 + 全局状态 + 资源清单
│   │   ├── options.js / popup.js / tools.js
│   │   ├── templates-compiled.js # 预编译 art-template 模板
│   │   ├── utils.js              # 原型扩展
│   │   └── modules/              # 10 个业务模块 + common.js
│   ├── templates/                # 离线 HTML 导出模板（17 个）
│   ├── export/                   # 离线导出资源
│   │   ├── css/ images/ js/      # 含 maps（中国/世界 GeoJSON）、lib/coordtransform
│   │   └── spa-dist/             # SPA 构建产物（gitignore）
│   ├── spa/                      # SPA 源码
│   │   ├── src/
│   │   │   ├── views/            # 14 个视图（10 模块 + 已删除说说 + 首页 + 404 等）
│   │   │   ├── components/       # 卡片 / 详情模态 / 布局 / 通用组件
│   │   │   ├── stores/           # 11 个 Pinia store
│   │   │   ├── api/data-loader.ts# <script> 数据加载器
│   │   │   ├── composables/      # useFlexSearch 等组合式函数
│   │   │   ├── styles/           # 档案馆主题（tokens/base）
│   │   │   ├── utils/formatContent.ts
│   │   │   ├── types.ts router.ts main.ts App.vue
│   │   │   └── env.d.ts
│   │   ├── public/               # 测试数据（gitignore）+ export-entry.html
│   │   ├── vite.config.ts        # IIFE + file:// 兼容修复
│   │   └── package.json
│   ├── img/                      # 图标 / 表情包 / 网盘渠道图标
│   └── vendor/                   # 本地第三方库（无 CDN）
├── README.md / CODE_WIKI.md / SPA_IMPLEMENTATION_PLAN.md
├── LICENSE
└── rename-media.js               # 辅助脚本（迅雷命名修复等）
```

---

## 4. 运行机制与启动流程

### 4.1 Manifest（MV3）

由 [manifest.json](src/manifest.json) 注册：

- **`background.service_worker`**：`js/background.js`（事件触发型，无持久页面）
- **内容脚本**：注入 `https://*.qzone.qq.com/*`，按序加载 vendor 库 → `utils.js → config.js → api.js → content.js → modules/*.js`
- **`action`**：popup 为 `html/popup.html`
- **`options_ui`**：`html/options.html`（`open_in_tab: true`）
- **CSP**：`script-src 'self'`（无 `unsafe-eval`、无远程脚本），`frame-src` 仅放行迅雷域
- **权限**：cookies / storage / unlimitedStorage / downloads / declarativeContent / declarativeNetRequest / activeTab / notifications / clipboardWrite
- **`web_accessible_resources`**：放行 `indicator.html`、`export/*`、`export/spa-dist/**`、`templates/*`、`vendor/*`

### 4.2 内容脚本启动

[content.js](src/js/content.js) 末尾 IIFE 监听 `chrome.runtime.onConnect` 的 `popup` 端口，处理 `startBackup` / `initUin` / `initDiaries` / `getAlbumList` / `initConfig` 消息；随后立即 `operator.next(OperatorType.INIT)` 初始化（获取 gtk/token/uin、读取配置、初始化 Filer）。

### 4.3 状态机 `QZoneOperator.next()`

`OperatorType` 依次驱动：`INIT → SHOW → INIT_USER_INFO → 各业务模块 → OTHERS_INFO → ZIP → COMPLETE`。每一步通过 `API.Common.isExport(moduleType)` 判断用户是否勾选。

采集与下载的每个循环（翻页、逐条评论/点赞/访客、逐张相片、添加下载任务等）都埋有 **检查点** `checkExportState()`，支持暂停 / 恢复 / 取消，取消时抛出 `__exportCancelled` 异常中断导出链。

### 4.4 Service Worker 消息中枢

[background.js](src/js/background.js) 处理来自内容脚本的消息：`download_browser` / `download_list` / `download_info` / `download_resume` / `show_export_zip` / `skipLink` / `getMimeType` / `getMapJson` / `reset` 等；并通过 `chrome.declarativeNetRequest` 动态为 `gtimg.com` 资源注入 `Referer: https://user.qzone.qq.com/` 绕过防盗链。

持久状态（`BrowseDownloads` 下载映射、`QZoneDownloadId`）保存在 `chrome.storage.session`；网络请求统一使用 `fetch` + `AbortController`。

---

## 5. 核心模块职责

### 5.1 扩展侧

#### config.js — 配置与全局状态

- **`Default_Config`**：公共配置（`downloadType` 默认 `Browser`、并发、重试、`useImageProxyGateway` 等）+ 10 个模块配置（`exportType` 默认 `SPA`、`pageSize`、`randomSeconds`、`Comments`、`Like`、`Visitor`、增量相关、屏蔽词等）+ Statistics + Dev
- **`QZone_Config`**：运行时配置（`chrome.storage.sync` 读取后覆盖默认值）
- **`QZone`**：全局状态对象（每个模块的 `ROOT` / `total` / `Data` / `FILE_URLS` 等）
- **`ExportFiles`**：离线导出资源 → ZIP 内路径映射
- **`SpaExportFiles`**：SPA 资源 → `Common/spa/` 映射（`index.html` / `assets/index.js` / `assets/style.css` / `export-entry.html`）

#### api.js — REST API 封装

- **`REST_URLS`**：全部 QQ 空间内部接口 URL
- **`API.Utils`**：HTTP、文件系统、下载分发、分组、日期、URL、Cookie/鉴权、表情解析、内容格式化、LBS、文件类型识别等工具
- **`API.{Module}.*`**：各模块接口封装

#### content.js — 内容脚本主入口

定义核心类（见 §6）与全局对象 `operator` / `downloadTasks` / `browserTasks` / `thunderInfo`；`MAX_MSG` 提供各阶段进度文案；`StatusIndicator` 负责进度面板渲染。

#### modules/common.js — 备份公共逻辑

- 用户信息导出（`exportUserToHtml` / `exportUserToJson` / `exportUserToMd` / `exportUserToSpa`）
- 下载分发：`downloadsByAjax` / `downloadsByBrowser` / `downloadByAria2` / `invokeThunder` / `copyThunderTasksToClipboard` / `writeThunderTaskToFile`（生成迅雷下载链接 txt）
- 增量备份：`isNewItem` / `unionBackedUpItems` / `isGetNextPage` / `saveBackupItems` 等
- 模块判断：`isExport` / `isGetLike` / `isGetVisitor`（均含 `SPA` 导出类型）
- 翻页：`hasNextPage` / `callNextPage` / `getModulesLikeList`

#### modules/*.js — 10 个业务模块

统一「列表获取 → 评论/赞/访客 → 下载任务 → 文件导出」流程，导出 switch 支持 `HTML / MarkDown / JSON / SPA` 四种类型；其中 `exportToSpa` 生成轻量索引 + 按年分片数据。messages.js 额外包含**已删除说说恢复**（`getDeletedMessages`：从 `feeds2_html_pav_all` 通知接口二分探测 + 详情接口 `emotion_cgi_msgdetail_v6` 恢复）。

### 5.2 扩展页面

| 页面 | 职责 |
|------|------|
| popup | 显示登录/备份 QQ、模式切换、模块勾选、开始备份 |
| options | 各模块参数配置（左侧 Tab）；含 Bootstrap-Select 下拉、Flatpickr 日期、备份类型/下载工具联动显隐 |
| tools | 本地相册索引生成（仅 HTML 备份方式） |
| indicator | 备份进度模态（终端风格日志，每实例独立日志行） |
| about / docs / usage / faq / privacy | 静态文档页（`.doc-layout` 左目录 + 右正文双栏） |

### 5.3 SPA 档案浏览器

- **`api/data-loader.ts`**：`loadScript<T>` 用动态 `<script>` 标签加载数据文件（`window.<varName> = [...]`），避开 file:// 下 fetch 的 CORS 限制；路径按 dev / prod 环境解析
- **`stores/*`**：11 个 Pinia store（messages / blogs / diaries / photos / videos / boards / friends / favorites / shares / visitors / user），统一「索引 + 按年分片缓存 + 年份分组」模式
- **`views/*`**：各模块列表页（虚拟滚动 + 搜索 + 详情模态 + 年份跳转）
- **`composables/useFlexSearch.ts`**：全文搜索（FlexSearch Document 索引）
- **`composables/useLightGallery.ts`**：画廊初始化（动态加载 6 插件）
- **`utils/formatContent.ts`**：表情 `[em]` / `@提及` / 话题 / 链接渲染
- 构建产物由 Vite 打包为**单 IIFE 文件**（`inlineDynamicImports`），`index.html` 去除 `type="module"` / `crossorigin`，CSS 去除 URL hash，保证 file:// 可直开

---

## 6. 关键类与函数说明

### 6.1 content.js 类定义

- **`DownloadTask`** / **`ThunderTask`** / **`BrowserTask`**：三种下载任务（Ajax / 迅雷 / 浏览器），统一 `setState()`
- **`ThunderInfo`**：迅雷任务批次（含 `referer: 'https://user.qzone.qq.com/'` 防盗链）
- **`StatusIndicator`**：进度指示器。`setTotal` / `setIndex` / `setNextTip` / `addSuccess` / `addFailed` / `addSkip` / `complete`；渲染节流 150ms，`_formatTip` 自动追加已完成%/用时/当前项；每实例独立 `.tip-line` 日志行避免互相覆盖；文本输出经 `_.escape` 转义防 CSP 违规
- **`QZoneOperator`**：备份状态机（`init` / `showProcess` / `next`）

### 6.2 关键函数

- **`API.Utils.toJson(json, jsonpKey)`**：解析 QQ 空间 JSONP 响应
- **`API.Common.callNextPage(...)`**：递归翻页（随机等待 + 重试 + 稍后重试；检查点前置）
- **`API.Common.isGetLike` / `isGetVisitor`**：`['HTML','JSON','SPA'].includes(exportType)` 判断是否采集赞/最近访问
- **`API.Common.checkExportState()`**：导出控制检查点，配合 `chrome.storage.session` 判断暂停/取消状态
- **`API.Common.exportUserToSpa()`**：任一模块启用 SPA 时复制 `SpaExportFiles` 到 `Common/spa/`，并写 ZIP 根 `index.html` 入口
- **`API.Messages.exportToSpa(messages)`**：生成 `messages-index.js` + 按年分片 `messages-YYYY.js`（挂 `window.messagesIndex` / `window.messages_YYYY`）
- **`API.Common.writeJsonToJs(key, object, path)`**：数据写为 `window.<key> = [...]` 供 SPA 加载
- **`API.Common.writeThunderTaskToFile`**：生成迅雷下载链接 txt（`Thunder_Link` 模式）
- **`API.Common.downloadByAria2`**：Aria2 RPC 添加任务；超过 1000 条时行内提示 Aria2/Motrix 结果保留上限；可选 `getImageProxyUrl` 图片代理网关加速
- **`API.Utils.addDownloadTasks`**：任务入队（URL 哈希命名 → 跨会话文件复用；MP4 优先入队）

---

## 7. 依赖关系

### 7.1 模块依赖

```
content.js（状态机 + 类定义）
    └─► modules/*.js（业务层）
            └─► api.js（API.Utils / API.{Module}）
                 └─► modules/common.js（API.Common 公共逻辑）
                      └─► config.js（Default_Config / QZone / 资源清单）
                           └─► background.js（Service Worker 消息中枢）
                                └─► popup.js / options.js（页面通信）
```

### 7.2 第三方库（全部本地 `vendor/`，无 CDN）

jQuery、Lodash、Bootstrap 4（含 table / select）、Flatpickr、Tempus Dominus（遗留）、art-template、JSZip、FileSaver、SheetJS、Turndown、Filer、moment、x-editable、loadmask、thunder-link、popper、font-awesome 等。

### 7.3 chrome.* API 依赖

`chrome.runtime`（onMessage/onConnect/getURL/sendMessage）、`chrome.storage.sync`（配置）/`chrome.storage.session`（运行时持久态）、`chrome.downloads`（下载/重命名）、`chrome.declarativeNetRequest`（防盗链）、`chrome.declarativeContent`、`chrome.notifications`、`chrome.cookies`、`chrome.tabs`。

---

## 8. 配置与数据结构

### 8.1 配置层级

```
Default_Config（config.js 硬编码）
   │ chrome.storage.sync.get(Default_Config, ...)
QZone_Config（运行时，options.html 可改）
```

### 8.2 备份类型

各模块 `exportType`：`SPA`（默认）/ `HTML` / `MarkDown` / `JSON`。部分配置（列表展示方式、那年今日、好友特殊分组、本地相册工具）仅作用于 HTML 导出；赞与最近访问数据在 HTML/JSON/SPA 三种类型下均采集。

### 8.3 全局状态 `QZone`

`QZone.Common`（ROOT/ExportTypes/Owner/Target/ZIP_NAME/FILE_URLS/Zip/MD/Filer/ExportFiles/SpaExportFiles）+ 各模块子对象（`ROOT`/`total`/`Data`/`FILE_URLS`），Photos 另有 `Album`/`Images`/`Class`/`Access` 等。

### 8.4 备份 ZIP 目录结构

```
QQ空间备份_{QQ号}/
├── Common/
│   ├── spa/                    # SPA 静态资源（SPA 模式）
│   └── json/                   # 用户信息等（助手备份数据）
├── Messages/  Blogs/  Diaries/  Albums/  Videos/
├── Boards/    Friends/  Favorites/  Shares/  Visitors/
├── Statistics/                 # 足迹地图（HTML 模式）
└── index.html                  # 入口（SPA 模式重定向到 Common/spa/index.html）
```

### 8.5 SPA 数据文件约定

| 数据文件 | window 变量 | 说明 |
|----------|-------------|------|
| `Messages/data/messages-index.js` | `messagesIndex` | 说说轻量索引（首屏加载） |
| `Messages/data/messages-YYYY.js` | `messages_YYYY` | 按年全量分片（按需加载） |
| `Messages/data/messages-deleted.js` | `messagesDeleted` | 已删除说说（可选） |
| `Visitors/data/visitors-index.js` | `visitorsIndex` | 访客索引 |
| `Friends/data/friends-group.js` | `friendsGroup` | 好友分组聚合 |
| `Albums/data/photos-index.js` | `photosIndex` | 相册元信息 |
| `Albums/data/photos-album-<id>.js` | `photos_album_<id>` | 单相册全量 |

---

## 9. 项目运行方式

### 9.1 加载扩展

1. `chrome://extensions/` → 开发者模式 → 「加载已解压的扩展程序」选择 `src/`
2. 访问已登录的 QQ 空间主页，点击扩展图标开始备份

### 9.2 SPA 开发与构建

```bash
cd src/spa
npm install
npm run dev        # http://localhost:5175
npm run build      # 产物 → src/export/spa-dist/
```

### 9.3 浏览备份

- SPA 模式：解压后双击 `index.html`（自动跳转 `Common/spa/index.html`）
- HTML 模式：浏览器打开根目录 `index.html`

---

## 10. 关键约束与工程实践

- **MV3 CSP**：禁止 `unsafe-eval` / 远程脚本；模板必须预编译（`templates-compiled.js`），日志输出必须 `_.escape` 转义用户内容
- **file:// 兼容**：SPA 使用单 IIFE bundle + 内联动态导入 + `defer` 脚本 + 去除 CSS URL hash；数据经 `<script>` 标签加载而非 fetch
- **数据路径环境感知**：SPA 数据加载路径在 dev（vite 根映射）与 prod（`../json/`、`../../Messages/data/`）间切换
- **检查点机制**：`checkExportState()` + `__exportCancelled` 覆盖采集/下载全流程；状态存 `chrome.storage.session`
- **暂停/取消 UX**：指示器含 pausing/cancelling/finalize 状态机；禁止自动滚底
- **增量备份**：INIT 阶段不清除已备份目录，只重建索引；`isNewItem` 判定已备份项跳过重复下载；文件名按 URL 哈希生成实现复用
- **下载方式**：默认浏览器；`Thunder_Link` 生成 txt 链接清单；`Thunder_Clipboard` 仅复制到剪贴板；Aria2 任务超 1000 提示结果保留上限
- **防 WAF 拦截**：探测接口限制偏移量上限、间隔随机秒、检测 WAF 拦截响应
- **设计系统**：所有扩展页面统一 `theme.css` 变量（纸张色板 / 砖红强调色 / 衬线标题），文档页 `.doc-layout` 双栏适配宽屏

---

## 11. 附录

### 11.1 关键 REST 接口（部分）

`REST_URLS` 定义于 [api.js](src/js/api.js)：

| 用途 | 常量 |
|------|------|
| 空间概览 / 权限 | `USER_OVERVIEW_URL`（main_page_cgi） |
| 用户信息 | `USER_INFO_URL`（cgi_userinfo_get_all） |
| 说说列表 / 详情 | `MESSAGES_LIST_URL`（emotion_cgi_msglist_v6）/ `MESSAGES_DETAIL_URL`（emotion_cgi_msgdetail_v6） |
| 互动通知（已删除恢复） | `feeds2_html_pav_all` |
| 日志 / 日记 | `BLOGS_LIST_URL` / `BLOGS_INFO_URL` / `DIARY_LIST_URL` |
| 相册 / 相片 | `ALBUM_LIST_URL` / `IMAGES_LIST_URL` / `IMAGES_INFO_URL` |
| 好友 / 特别关心 | `FRIENDS_LIST_URL` / `SPECIAL_CARE_LIST_URL` |
| 点赞 / 评论 | `LIKE_LIST_URL` / `MESSAGES_VIDEOS_COMMONTS_URL` |
| 最近访问 | `VISITOR_SINGLE_LIST_URL` / `VISITOR_SIMPLE_LIST_URL` / `VISITOR_MORE_LIST_URL` |
| 分享 / 收藏 / 留言 / 视频 | `SHARE_LIST_URL` / `FAVORITE_LIST_URL` / `BOARD_LIST_URL` / `VIDEO_LIST_URL` |

> `/proxy/domain/...` 形式由扩展借助 QQ 空间域同源 Cookie 转发。

### 11.2 下载方式对比

| 配置值 | 说明 |
|--------|------|
| `Browser` | 浏览器直接下载（默认） |
| `File` | Ajax 内部下载（遗留） |
| `Aria2` | Aria2 / Motrix RPC |
| `Thunder` | 唤起迅雷 |
| `Thunder_Clipboard` | 复制迅雷链接到剪贴板 |
| `Thunder_Link` | 生成下载链接 txt（备份目录内） |
| `QZone` | 直接使用外链不下载 |

### 11.3 相关链接

- 本项目：[https://github.com/salt-fishes/qzone-archiver](https://github.com/salt-fishes/qzone-archiver)
- 原项目：[https://github.com/ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport)
- Chrome MV3 文档：[https://developer.chrome.com/docs/extensions/mv3/](https://developer.chrome.com/docs/extensions/mv3/)

---

> 本文档基于 v3.3.0 代码整理，如有出入以源码为准。
