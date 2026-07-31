# qzone-archiver — Code Wiki

> 本项目仓库：[https://github.com/salt-fishes/qzone-archiver](https://github.com/salt-fishes/qzone-archiver)
> 原项目：[https://github.com/ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport)
> 原作者博客：[https://lvshuncai.com/archives/qzone-export.html](https://lvshuncai.com/archives/qzone-export.html)
> 版本：3.0（Manifest V3 + SPA）

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
10. [附录](#10-附录)

---

## 1. 项目概述

**qzone-archiver** 是一款基于 Chrome 扩展（Manifest V3）的浏览器插件，用于将用户在 QQ 空间中的数据（说说、日志、日记、相册、视频、留言、好友、收藏、分享、访客等）一键导出为本地文件，便于永久保存、迁移与归档。

### 核心能力

- 通过注入 QQ 空间页面（`https://*.qzone.qq.com/*`）的内容脚本，调用 QQ 空间官方内部接口抓取数据
- 支持 **HTML / Markdown / JSON** 三种文案内容导出格式
- 支持 **图片、视频、语音** 等多媒体文件下载（浏览器、Aria2、迅雷、外链 4 种下载方式）
- 支持 **增量备份**，可在已有备份基础上仅拉取新增内容
- 内置 **足迹地图**（基于 ECharts + 中国 / 世界地图 GeoJSON）与 **那年今日** 回顾
- 备份结果压缩为 ZIP 包下载，导出的 HTML 离线即可浏览

### 技术栈

| 维度 | 选型 |
|------|------|
| 平台 | Chrome Extension (Manifest V2) |
| 语言 | 原生 JavaScript (ES2017+)、HTML5、CSS3 |
| UI 框架 | Bootstrap 4 + Bootstrap Table + Bootstrap Select |
| 模板引擎 | [art-template](https://aui.github.io/art-template/) (`template.js`) |
| HTML → Markdown | Turndown |
| 图像 / 视频预览 | LightGallery 全套插件 |
| 数据可视化 | ECharts 4 + 中国 / 世界 GeoJSON |
| 坐标转换 | coordtransform（GCJ02 ↔ WGS84 ↔ BD09） |
| 文件系统 | Filer（HTML5 File System API 封装）+ JSZip + FileSaver |
| 表格导出 | SheetJS (xlsx) |
| 工具库 | jQuery 3、Lodash |

---

## 2. 整体架构

项目采用 **三层分离 + 双侧代码** 架构：

```
┌─────────────────────────────────────────────────────────────────┐
│                       浏览器扩展侧（src/）                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   后台脚本（background.js）—— 浏览器下载调度、消息中枢   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   内容脚本（content.js + js/modules/*.js）               │   │
│  │   注入 QQ 空间页面，抓取数据并组织为本地文件 / ZIP      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │ popup.html/js   │  │ options.html/js  │  │ tools.html   │   │
│  │ 工具栏弹窗       │  │ 设置页            │  │ 本地相册工具 │   │
│  └─────────────────┘  └──────────────────┘  └──────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   公共底座：utils.js / api.js / config.js                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓ 生成离线备份包
┌─────────────────────────────────────────────────────────────────┐
│                     导出页侧（src/export/）                     │
│  离线 HTML 模板 + common.js（API/TPL） + 各业务页脚本 + 地图   │
│  用户使用浏览器打开备份 ZIP 解压后即可浏览                     │
└─────────────────────────────────────────────────────────────────┘
```

### 双侧代码区分

| 维度 | 扩展侧（采集） | 导出侧（展示） |
|------|----------------|----------------|
| 位置 | `src/js/`、`src/html/` | `src/export/js/`、`src/templates/` |
| 职责 | 调 QQ 空间接口、组织数据、下载文件 | 渲染离线 HTML、提供交互 |
| 入口 | `manifest.json` 中的 `content_scripts` / `background` | 备份包内的 `index.html` |
| 共享 | `vendor/` 第三方库；`config.js` 中 `ExportFiles` 映射 | `export/js/common.js` 提供同名 `API` 全局对象 |
| 命名空间 | `API.{Module}.*`（来自 `api.js` + `modules/*.js`） | `API.{Module}.*`（来自 `export/js/common.js` + `export/js/*.js`） |

### 备份流程时序

```
用户点击 popup「开始备份」
        │
        ▼ (port: 'popup')
content.js 监听 startBackup 消息
        │
        ▼
QZoneOperator.next(OperatorType.SHOW)
        │
        ▼
showProcess() → 弹出 indicator.html 模态
        │
        ▼
initModelFolder() → 创建 HTML5 文件系统目录
        │
        ▼ (顺序执行各业务模块)
INIT_USER_INFO → Messages → Blogs → Diaries → Boards →
Friends → Favorites → Shares → Visitors → Photos → Videos
        │
        ▼
OTHERS_INFO（导出用户信息、统计、配置）
        │
        ▼
ZIP（JSZip 压缩） → COMPLETE（提示用户打包下载）
```

---

## 3. 目录结构

```
zoneexport/
├── src/                              # 扩展程序根目录（被 Chrome 加载）
│   ├── manifest.json                # 扩展清单（MV2，定义权限、内容脚本、后台脚本）
│   │
│   ├── js/                           # 扩展侧 JavaScript
│   │   ├── background.js            # 后台脚本：下载调度、消息路由、规则注入
│   │   ├── content.js               # 内容脚本入口：状态机、任务调度、类定义
│   │   ├── api.js                   # QQ空间 REST API + API.Utils 工具集
│   │   ├── utils.js                 # 原型扩展（Date/String/Array）
│   │   ├── config.js                # 默认配置 Default_Config + 全局状态 QZone
│   │   ├── popup.js                 # 工具栏弹窗逻辑
│   │   ├── options.js               # 设置页逻辑
│   │   ├── tools.js                 # 本地相册工具页逻辑
│   │   └── modules/                 # 各业务模块的备份实现
│   │       ├── common.js            #   公共备份逻辑（用户信息、下载分发、增量、模板写入）
│   │       ├── blogs.js             #   日志备份
│   │       ├── boards.js            #   留言板备份
│   │       ├── diaries.js           #   日记备份
│   │       ├── favorites.js         #   收藏备份
│   │       ├── friends.js           #   好友备份
│   │       ├── messages.js          #   说说备份
│   │       ├── photos.js            #   相册备份（最复杂）
│   │       ├── shares.js            #   分享备份
│   │       ├── videos.js            #   视频备份
│   │       └── visitors.js         #   访客备份
│   │
│   ├── html/                         # 扩展界面 HTML
│   │   ├── popup.html               # 工具栏弹窗（模块勾选、QQ 号显示）
│   │   ├── options.html             # 设置页（每个模块的备份参数）
│   │   ├── tools.html               # 工具页（本地相册索引生成）
│   │   ├── indicator.html           # 备份进度模态窗
│   │   └── about.html               # 关于页
│   │
│   ├── css/                          # 扩展界面样式
│   │   ├── popup.css                # 弹窗样式
│   │   ├── options.css              # 设置页样式（含自定义滚动条、Tab）
│   │   └── content.css              # 注入 QQ 空间页面的样式
│   │
│   ├── templates/                    # 离线导出 HTML 模板（17 个）
│   │   ├── index.html               # 个人首页
│   │   ├── messages.html / blogs.html / diaries.html / boards.html
│   │   ├── photos.html / albums.html / videos.html
│   │   ├── friends.html / favorites.html / shares.html / visitors.html
│   │   ├── bloginfo.html / bloginfo_static.html      # 日志详情（动态 / 静态）
│   │   ├── diaryinfo.html / diaryinfo_static.html    # 日记详情（动态 / 静态）
│   │   └── statistics.html          # 足迹地图页
│   │
│   ├── export/                       # 离线导出资源
│   │   ├── css/common.css           # 所有导出页的全局样式
│   │   ├── images/                  # earth.svg / share.svg / favicon.ico 等
│   │   └── js/
│   │       ├── common.js            # 核心：API 命名空间 + TPL 模板常量
│   │       ├── albums.js / blogs.js / boards.js / diaries.js / ...
│   │       ├── sidebar.js           # 左侧目录生成
│   │       ├── statistics.js        # ECharts 足迹地图
│   │       ├── lib/coordtransform.min.js
│   │       └── maps/                # ECharts 地图配置
│   │           ├── config.js        # 中英文名映射
│   │           ├── china/china.js           # 中国省级 GeoJSON
│   │           ├── china/china-cities.js   # 中国城市级 GeoJSON
│   │           └── world/world.js          # 世界地图 GeoJSON
│   │
│   ├── img/                          # 扩展图标 + 表情包（48 张微信新表情）
│   │   ├── icon-128.png
│   │   └── emoji/2_02.png ... smiley_83b.png
│   │
│   └── vendor/                       # 第三方库（jQuery / lodash / bootstrap / 等）
│       ├── jquery / lodash / bootstrap / bootstrap-table / bootstrap-select
│       ├── jszip / FileSaver / blob / ponyfill / sheetjs / template
│       ├── turndown / filer / loadmask / thunder / x-editable-4-bs4
│       └── jquery-resizable-columns
└── CODE_WIKI.md                      # 本文档
```

---

## 4. 运行机制与启动流程

### 4.1 扩展加载时

由 [manifest.json](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/manifest.json) 注册：

- **后台脚本**：[background.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/background.js)（`persistent: false`，事件触发型）
- **内容脚本**：在 `https://*.qzone.qq.com/*` 页面注入以下脚本（按顺序加载）：
  ```
  vendor/thunder/thunder-link.js → vendor/jquery/jquery.min.js
  → vendor/bootstrap/... → vendor/turndown/turndown.js → vendor/lodash/lodash.min.js
  → vendor/filer/filer.min.js → vendor/jszip/jszip.min.js → vendor/FileSaver/FileSaver.min.js
  → vendor/ponyfill/ponyfill.min.js → vendor/blob/Blob.js → vendor/sheetjs/xlsx.full.min.js
  → vendor/template/template.js
  → js/utils.js → js/config.js → js/api.js → js/content.js
  → js/modules/common.js → js/modules/messages.js → ... → js/modules/visitors.js
  ```
- **页面操作（Page Action）**：仅在 QQ 空间用户主页（`https://user.qzone.qq.com/{uin}`）显示图标与弹窗
- **设置页**：`html/options.html`
- **权限**：cookies、storage、unlimitedStorage、downloads、downloads.shelf、declarativeContent、declarativeNetRequest、clipboardWrite、`<all_urls>`

### 4.2 内容脚本启动

[content.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/content.js) 末尾的 IIFE：

```js
chrome.runtime.onConnect.addListener(function(port) {
    if (port.name === 'popup') {
        port.onMessage.addListener(function(request) {
            switch (request.subject) {
                case 'startBackup': /* 接收 popup 启动指令 */
                    QZone.Common.ExportTypes = request.exportType;
                    QZone.Photos.Album.Select = request.albums || [];
                    operator.next(OperatorType.SHOW);
                    break;
                case 'initUin': /* 返回当前 QQ 号 */
                case 'initDiaries': /* 检测私密日志密码 */
                case 'getAlbumList': /* 获取相册列表（用于 popup 选择） */
                case 'initConfig': /* 返回 chrome.storage 配置 */
            }
        });
    }
});
operator.next(OperatorType.INIT);  // 立即执行初始化
```

### 4.3 状态机 `QZoneOperator.next()`

`OperatorType` 枚举定义在 [content.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/content.js) 中，依次驱动整个备份流程：

```
INIT → SHOW → INIT_USER_INFO →
Messages → Blogs → Diaries → Boards →
Friends → Favorites → Shares → Visitors → Photos → Videos →
OTHERS_INFO → ZIP → COMPLETE
```

每一步通过 `API.Common.isExport(moduleType)` 判断用户是否勾选该模块，未勾选则跳过。

### 4.4 后台脚本消息中枢

[background.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/background.js) 监听来自 content 的消息，主要分为：

| 消息类型 | 作用 |
|----------|------|
| `download_browser` | 通过 `chrome.downloads.download()` 下载文件，支持并发数控制 |
| `download_list` / `download_info` | 查询下载列表 / 单个下载项状态 |
| `download_resume` | 恢复被中断的下载 |
| `show_export_zip` | 在下载管理器中显示备份 ZIP |
| `skipLink` | 在新标签打开指定 URL |
| `getMimeType` | HEAD 请求识别文件 MIME 后缀 |
| `getMapJson` | 加载地图 GeoJSON（绕过 CSP） |
| `reset` | 清空 `BrowseDownloads` 任务映射 |

`background.js` 还通过 `chrome.declarativeNetRequest` 动态添加 Referer 修改规则，对 `gtimg.com` 资源注入 `Referer: https://user.qzone.qq.com/` 以绕过防盗链。

---

## 5. 核心模块职责

### 5.1 扩展侧 JS 模块

#### 5.1.1 [config.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/config.js) — 配置与全局状态

定义三部分核心内容：

- **`Default_Config`**：默认配置，包含 `Common`（公共：下载工具、并发、重试）与每个业务模块（`Messages`、`Blogs`、`Diaries`、`Photos`、`Videos`、`Boards`、`Friends`、`Favorites`、`Shares`、`Visitors`、`Statistics`、`Dev`）。每个模块配置项包括：`exportType`、`pageSize`、`randomSeconds`、`Comments`、`Like`、`Visitor`、`IncrementType`、`IncrementTime`、`IncrementField` 等。
- **`QZone_Config`**：运行时配置（从 `chrome.storage.sync` 读取后覆盖默认值）。
- **`QZone`**：运行时全局状态对象，每个模块子对象包含 `ROOT`、`IMAGES_ROOT`、`Data`、`OLD_Data`、`total`、`FILE_URLS`（已下载 URL → 文件名映射，用于去重）。
- **`FOLDER_ROOT`**：备份根目录 `/QQ空间备份`。
- **`MODULE_NAME_LIST` / `MODULE_NAME_MAPS`**：模块标识符列表与中文名映射。
- **`ExportFiles`**：扩展侧资源 → 备份包内目标路径的映射表（决定哪些资源会被复制进 ZIP）。

#### 5.1.2 [api.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/api.js) — REST API 与工具

约 4600 行，包含：

- **`REST_URLS`**：所有 QQ 空间内部接口的 URL 常量（30+ 条）。
- **`emojis` / `emotionMap` / `parseEmoji`**：微信新表情数据与解析器。
- **`API` 全局对象**：包含 13 个子命名空间：
  ```
  API.Utils       工具方法（HTTP、文件、日期、URL、命名、格式化、统计等）
  API.Common      公共备份逻辑（用户信息、下载分发、模板渲染）
  API.Blogs       日志模块
  API.Diaries     日记模块
  API.Friends     好友模块
  API.Messages    说说模块
  API.Boards      留言模块
  API.Photos      相册模块
  API.Videos      视频模块
  API.Favorites   收藏模块
  API.Shares      分享模块
  API.Visitors    访客模块
  API.Statistics  数据统计模块
  ```

`API.Utils` 中常用的方法（150+ 个）：

| 类别 | 方法 |
|------|------|
| HTTP | `send(url, responseType, timeout)`、`get(url, params)`、`post(url, data)`、`downloadFile(url)` |
| 文件系统 | `createFolder(path)`、`writeText(content, filepath)`、`writeFile(buffer, filepath)`、`Zip(root)`、`switchToRoot()` |
| 下载任务 | `downloadByBrowser(task)`、`downloadByAria2(task)`、`downloadByThunder(taskInfo)`、`getDownloadList(state)`、`resumeDownload(downloadId)`、`makeDownloadUrl`、`makeViewUrl` |
| 命名 | `newUid()`、`newSimpleUid(len, radix)`、`filenameValidate(name)`、`prefixNumber(num, length)` |
| 日期 | `formatDate(time, str)`、`parseDate(time)`、`toDate(time)` |
| URL / 参数 | `getUrlParam(name)`、`toParams(url)`、`toUrl(url, params)`、`toHttps`、`toHttp` |
| Cookie / 鉴权 | `getCookie(name)`、`getQZoneToken()`、`initGtk(url)`、`initUin()` |
| 分组 | `groupedByTime`、`groupedByField`、`sort`、`unionItems` |
| 编码 | `utf8ToBase64`、`base64ToUtf8`、`toArrayBuffer`、`toJson(json, jsonpKey)` |
| 表情 | `addEmoticonDowanloadTask`、`formatEmoticon`、`formatEmoticonPath`、`getEmoticonFileName`、`parseEmoji` |
| 内容 | `escHTML`、`formatContent`、`formatMention`、`formatTopic`、`formatLink`、`getImagesMarkdown` |
| LBS | `getLbsInfo(lat, lng)`、`toTxLbs(lat, lng, type)` |
| 用户 | `getUserUrl`、`getUserLogoUrl`、`getUserLogoLocalUrl`、`getUserLink`、`getMessageLink` |
| 文件类型 | `getMimeType(url)`、`getMimeTypeOnContent(url)`、`getFileSuffixByUrl(url)`、`autoFileSuffix` |
| 其他 | `sleep(ms)`、`timeoutPromise(promise, ms)`、`randomSeconds(min, max)`、`notification(title, message)`、`isQzoneUrl()`、`isThunder()`、`isAria2()`、`isFile()`、`isBrowser()` |

#### 5.1.3 [content.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/content.js) — 内容脚本主入口

定义 6 个核心类与状态机：

- **`DownloadTask`** — Ajax 下载任务
- **`ThunderTask`** — 迅雷下载任务
- **`ThunderInfo`** — 迅雷任务批次（含 taskGroupName、tasks、threadCount、referer）
- **`BrowserTask`** — 浏览器下载任务
- **`PageInfo`** — 分页信息
- **`StatusIndicator`** — 备份进度指示器（与 `MAX_MSG` 提示文案配合）
- **`QZoneOperator`** — 备份流程状态机

并定义：

- **`MAX_MSG`** — 各阶段进度提示文案（约 60 条目，含 HTML 富文本）
- **`OperatorType`** — 状态枚举
- 全局变量 `operator`、`downloadTasks`、`thunderInfo`、`browserTasks`
- `API.Utils.addDownloadTasks` / `newDownloadTask` / `downloadAllFiles` / `getDownloadTasks` / `getFailedTasks`（**这些方法在 content.js 中通过 monkey patch 挂到 `API.Utils` 上**）

#### 5.1.4 [utils.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/utils.js) — 原型扩展

仅 100 行，扩展 `Date.prototype.format`、`String.prototype.format`（支持数组 / 对象 / 嵌套路径）、`String.prototype.replaceAll`、`Array.prototype.getIndex`、`Array.prototype.remove`，作为后续脚本依赖的语法糖。

#### 5.1.5 [modules/common.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/common.js) — 备份公共逻辑

定义 `API.Common.*` 的全部备份公共方法（48 个）：

| 类别 | 方法 |
|------|------|
| 用户信息 | `initUserInfo`、`exportUser`、`exportUserToJson`、`exportUserToMd`、`exportUserToHtml`、`exportUserAvatar`、`exportOthers` |
| 模板渲染 | `writeHtmlofTpl(name, params, indexHtmlePath)`、`getHtmlTemplate(name, params)`、`writeJsonToJs(key, object, path)` |
| 内容格式化 | `formatContent`、`addCommentEmoticonDownloadTasks`、`downloadUserAvatar`、`downloadUserAvatars` |
| 下载分发 | `downloadsByAjax(tasks)`、`downloadsByBrowser(tasks)`、`downloadByAria2(tasks)`、`invokeThunder(thunderInfo)`、`copyThunderTasksToClipboard(thunderInfo)`、`writeThunderTaskToFile(thunderInfo)`、`handerThunderInfo` |
| 增量备份 | `isFullBackup`、`isLast`、`isCustom`、`isPreBackupPos`、`isNewItem`、`removeOldItems`、`removeNewItems`、`unionBackedUpItems`、`isGetNextPage` |
| 备份状态 | `saveBackupItems`、`getBackupItems`、`resetQZoneBackupItems`、`initBackedUpItems`、`getOldModuleData`、`getNewModuleData`、`getSaveModuleData`、`isNewExport`、`hasIncrementBackup`、`exportBackupItemsToJson` |
| 翻页 | `hasNextPage`、`callNextPage`、`getModulesLikeList` |
| 模块判断 | `isExport(moduleType)`、`isOnlyFileExport`、`isGetLike`、`isGetVisitor`、`setCompareFiledInfo` |

#### 5.1.6 业务模块（modules/*.js）

每个业务模块统一遵循「列表获取 → 评论/赞/访客 → 下载任务 → 文件导出」四段式：

| 模块 | 主入口 `export()` 流程 |
|------|------------------------|
| [messages.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/messages.js) | `getAllList` → `getAllFullContent` → `getImages` → `getVoice` → `getComments` → `getLikeList` → `getVisitorList` → `addMediaToTasks` → `addDownloadEmoticonTasks` → `exportAllToFiles` |
| [blogs.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/blogs.js) | `getAllList` → `getAllInfo` → `getAllComments` → `getLikeList` → `getVisitorList` → `addMediaToTasks` → `addDownloadEmoticonTasks` → `exportAllToFiles` |
| [diaries.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/diaries.js) | 同 blogs，目标为私密日志 |
| [boards.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/boards.js) | `getAllList` → `addMediaToTasks` → `exportAllToFiles` |
| [friends.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/friends.js) | `getAllList` → `getInteractiveInfo` → `getZoneAccess` → `getSpecialCare` → `addDownloadImagesTasks` → `exportAllToFiles` |
| [favorites.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/favorites.js) | `getAllList` → `addMediaToTasks` → `exportAllToFiles` |
| [shares.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/shares.js) | `getAllList` → `getItemsAllCommentList` → `addMediaToTasks` → `getAllLikeList` → `getAllVisitorList` → `exportAllListToFiles` |
| [photos.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/photos.js) | `initAlbums` → `getAllAlbumsComments` → `getAlbumsLikeList` → `getAllVisitorList` → `getAllAlbumImageListByListType` → `getAllImagesInfos` → `refreshAllPhotoAlbumInfo` → `getAllImagesComments` → `addPhotoUniKey` → `getPhotosLikeList` → `addDownloadEmoticonTasks` → `addAlbumsDownloadTasks` → `exportAllListToFiles` |
| [videos.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/videos.js) | `getAllList` → `getAllComments` → `getAllLikeList` → `addDownloadEmoticonTasks` → `addDownloadTasks` → `exportAllToFiles` |
| [visitors.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/modules/visitors.js) | `getAllList` → `addMediaToTasks` → `exportAllListToFiles` |

每个模块还提供 `exportToHtml` / `exportToMarkdown` / `exportToJson` 三个导出方法，支持按年份分组生成文件。

### 5.2 扩展侧界面

| 页面 | 文件 | 职责 |
|------|------|------|
| 工具栏弹窗 | [popup.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/popup.html) + [popup.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/popup.js) | 显示登录 QQ / 备份 QQ / 模式；勾选要备份的模块；选择相册；点击「开始备份」触发 `QZoneOperator.next(OperatorType.SHOW)` |
| 设置页 | [options.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/options.html) + [options.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/options.js) | 配置每个模块的参数（页大小、并发、增量、屏蔽词、分享来源识别规则、Aria2 / 迅雷参数等）；配置写入 `chrome.storage.sync` |
| 工具页 | [tools.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/tools.html) + [tools.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/tools.js) | 本地相册索引生成器：读取本地相册文件夹，生成 `index.html` 与 `albums.json`，便于在本地浏览历史备份 |
| 进度指示器 | [indicator.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/indicator.html) | 备份进度模态窗，被 `content.js` 通过 `chrome.extension.getURL()` 加载并注入页面 |
| 关于页 | [about.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/about.html) | 项目说明 |

### 5.3 导出侧 JS 模块

#### 5.3.1 [export/js/common.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/export/js/common.js) — 离线页核心

约 2700 行，**重新定义了 `API` 全局对象**（与扩展侧 `api.js` 平行但更精简），包含：

- 原型扩展（`Date.format`、`String.format`、`replaceAll` 等）
- `API.Utils`：离线版工具（`initTable`、`groupedByTime`、`getImagesMarkdown`、`getLink`、`newUid`、`formatFileSize`、`base64ToUtf8` 等）
- `API.Common`：用户 URL / 头像 / 表情下载路径 / HTML 转义 / 话题与提及转换 / 综合内容格式化 / 模态窗注册（评论、访客、点赞、查看全文、图片加载完成等事件）
- `API.{Messages|Blogs|Photos|Videos|Shares|Favorites|Visitors|Friends}`：每个模块的展示辅助函数（如 `API.Blogs.getBlogLabel`、`API.Videos.getVideoUrl`、`API.Friends.getShowFriendTime` 等）
- `TPL`：21 个 `template.js` 模板字符串常量（`COMMON_COMMENT`、`MESSAGES_ITEM`、`BLOGS_LIST`、`FRIENDS_GROUP_LIST` 等）

#### 5.3.2 [export/js/statistics.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/export/js/statistics.js) — 足迹地图

约 780 行，基于 ECharts 实现 QQ 空间打卡足迹可视化。关键函数：

- `getNameMap(mapType)` — 返回中英文名映射
- `getAllLbs()` / `API.Messages.getAllLbs` — 聚合所有说说的 LBS 坐标
- `getSummaryProvinceTrace(mapType, lbsItems, isAll)` — 通过 rayCasting 算法将坐标归入省份多边形
- `transformCoord(lbsItems, mapType)` — 世界地图场景下调用 `coordtransform.gcj02towgs84` 将腾讯 GCJ02 转为 WGS84
- `initMap(mapType)` — 入口，构建 ECharts option：标题、toolbox（保存图片、切换中国/世界地图、重置）、visualMap（颜色渐变）、geo（地图）、3 个 series（scatter 打卡点、map 途径省份、scatter 涟漪首都五角星）
- `getInteractivePasserby` / `getInteractiveOldFriends` / `getIntimacyFriends` / `getOldFriends` / `getNewFriends` / `getFirstFriend` / `getLastFriend` — 好友互动分析

入口：`$(function(){ API.Statistics.initMap('china'); })`

#### 5.3.3 [export/js/sidebar.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/export/js/sidebar.js) — 左侧目录

扫描页面内 `h1-h6` / `.h1-.h6` / `.sidebar-h1-.sidebar-h6` 标题，为每个生成 UID 与左侧目录链接，监听 `onhashchange` 与 `resize` 事件。

#### 5.3.4 其他导出页脚本

`albums.js` / `blogs.js` / `boards.js` / `diaries.js` / `favorites.js` / `friends.js` / `messages.js` / `photos.js` / `shares.js` / `videos.js`：每个对应一类导出页面，负责在该页加载时初始化 LightGallery、注册评论/访客/点赞模态、初始化 tooltip 等。

`visitors.js` 为空文件，访客相关逻辑由 `API.Visitors`（在 `common.js` 中定义）与 `API.Common.registerShowVisitorsWin` 提供。

---

## 6. 关键类与函数说明

### 6.1 类定义（content.js）

#### `DownloadTask`

```js
class DownloadTask {
    constructor(module, dir, name, url, source) { /* ... */ }
    setState(downloadState) { /* ... */ }
}
```

Ajax 下载任务（与 `downloadTasks` 数组配合），由 `API.Utils.newDownloadTask` 创建。

#### `ThunderTask`

迅雷单个下载任务，被 `ThunderInfo` 批量组织后通过 `API.Common.invokeThunder` 唤起迅雷。

#### `ThunderInfo`

```js
class ThunderInfo {
    constructor(taskGroupName, threadCount, tasks) { /* ... */ }
    addTask(task) { /* ... */ }
    delTask(index) { /* ... */ }
    removeTask(url) { /* ... */ }
}
```

迅雷任务批次，包含 `referer: 'https://user.qzone.qq.com/'` 用于绕过防盗链。

#### `BrowserTask`

```js
class BrowserTask {
    constructor(module, url, root, folder, name, source) {
        this.filename = root + '/' + folder + '/' + name;
        // ...
    }
    setId(id) { /* ... */ }
    setState(downloadState) { /* ... */ }
}
```

#### `StatusIndicator`

```js
class StatusIndicator {
    constructor(type) { /* 初始化 id=type+'_Tips', tip=MAX_MSG[type] */ }
    setTotal(total) / setIndex(index) / setTotalPage(totalPage) / setNextTip(tip)
    addDownload(pageSize) / addSuccess(item) / addFailed(item) / addSkip(item)
    setSuccess(item) / setFailed(item) / setSkip(count)
    print() / complete()
}
```

负责将进度渲染到 `#${type}_Tips` 元素，调用 `String.format(this)` 进行模板替换。

#### `QZoneOperator`

```js
class QZoneOperator {
    async next(moduleType) { /* 状态机驱动 */ }
    init() { /* 获取 gtk / token / uin / 相册路由；读取配置；初始化 Filer */ }
    async initModelFolder() { /* 创建各模块文件夹 */ }
    async showProcess() { /* 加载 indicator.html、绑定下载按钮 */ }
}
```

### 6.2 关键函数

#### `API.Utils.toJson(json, jsonpKey)` — JSONP 响应解析

QQ 空间所有接口返回 JSONP 格式（如 `_Callback({...})`、`shine0_Callback({...})`），通过正则剥离回调包装后 `JSON.parse`。是整个数据抓取的核心解析器。

#### `API.Common.callNextPage(pageIndex, moduleConfig, total, items, call, ...args)` — 递归翻页

所有业务模块列表获取统一使用。机制：

1. 当前页取完后，根据 `total` 与 `pageSize` 判断是否还有下一页
2. `await API.Utils.randomSeconds(CONFIG.randomSeconds.min, max)` 随机等待
3. 递归调用 `call(...args)` 取下一页
4. 失败时根据 `listRetryCount` 重试，达到上限后调用 `waitCount` 进入「稍后」等待

#### `API.Common.unionBackedUpItems(moduleConfig, old_items, new_items)` — 增量合并

合并历史备份数据与新拉取数据，根据 `IncrementField` 去重：

```js
const unionItems = API.Utils.unionItems(OLD_Data, newData);
// 内部使用 Map 按 IncrementField 去重
```

#### `API.Utils.addDownloadTasks(module, item, url, module_dir, source, FILE_URLS, suffix)` — 下载任务入队

定义在 [content.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/content.js) 末尾，挂到 `API.Utils` 上：

1. 通过 `FILE_URLS.get(url)` 检查是否已下载过，去重
2. 生成文件名（`newSimpleUid` 或自动识别后缀）
3. 调用 `API.Utils.newDownloadTask` 同时入队到三处：`downloadTasks`、`browserTasks`、`thunderInfo.tasks`
4. MP4 文件 `unshift` 到队首（视频有时效性，尽早下载）

#### `API.Utils.downloadAllFiles()` — 下载分发

根据 `QZone_Config.Common.downloadType` 路由到具体下载实现：

```
File              → API.Common.downloadsByAjax(downloadTasks)
Browser           → API.Common.downloadsByBrowser(browserTasks)
Aria2             → API.Common.downloadByAria2(downloadTasks)
Thunder           → API.Common.invokeThunder(thunderInfo)
Thunder_Clipboard → API.Common.copyThunderTasksToClipboard(thunderInfo)
Thunder_Link      → API.Common.writeThunderTaskToFile(thunderInfo)
QZone             → 直接使用外链，不下载
```

#### `API.Common.writeHtmlofTpl(name, params, indexHtmlePath)` — 模板渲染并写入

读取 `templates/{name}.html`，通过 `template.js` 编译注入 `params` 数据，写入到目标 HTML 文件路径。所有模块的 HTML 导出最终都通过此函数完成。

#### `API.Photos.getImageFileName(photo, prefix)` — 相片命名（13 种模式）

支持 13 种命名规则（`Default / Time / Time_Lbs1 / Time_Lbs2 / ALL / UploadTime / ShootTime / ShootTime_ShootLbs / ShootTime_Lbs1 / ShootTime_Lbs2 / UploadTime_UploadLbs / UploadTime_Lbs1 / UploadTime_Lbs2`），结合上传时间、拍摄时间、上传地点、拍摄地点生成文件名。

#### `API.Messages.getUniKey(tid)` / `API.Blogs.getUniKey(blogid)` / `API.Photos.getUniKey(albumId)` — 统一主键

各模块为内容生成点赞 / 评论接口所需的 `uniKey`（基于 tid / blogid / albumId 拼接规则字符串）。

#### `background.js: downloadByBrowser(request)` — 浏览器下载

```js
const downloadByBrowser = function(request) {
    return new Promise(async resolve => {
        // 查询当前进行中下载数
        let dataList = await getInProgressTask();
        // 根据配置 downloadThread 并发数等待
        while (request.downloadThread > 0 && dataList.length >= request.downloadThread) {
            await new Promise(r => setTimeout(r, 1000));
            dataList = await getInProgressTask();
        }
        // 对需要 referer 的 URL（gtimg.com）先通过 XHR 拿 blob
        if (isMatch) {
            const xhr = await send(task.url, 'blob');
            task.url = URL.createObjectURL(xhr.response);
        }
        chrome.downloads.download(task, function(downloadId) {
            BrowseDownloads.set(downloadId, task);  // 用于后续重命名
            resolve(downloadId);
        });
    });
}
```

#### `background.js: chrome.downloads.onDeterminingFilename` — 重命名监听

拦截下载文件名确定事件，根据 `BrowseDownloads` 中保存的预期文件名重命名实际下载文件，使最终文件名符合备份目录结构预期。识别到 `QQ空间备份*.zip` 时记录 downloadId，供「查看备份」按钮使用。

---

## 7. 依赖关系

### 7.1 模块间依赖图

```
              ┌────────────────────────────────────────────────┐
              │                  content.js                      │
              │  (QZoneOperator + 类定义 + API.Utils 扩展)       │
              └───────────────┬────────────────────────────────┘
                              │ 调用
              ┌───────────────▼────────────────────────────────┐
              │             modules/*.js (业务层)               │
              │  每个 API.{Module}.export() 主入口             │
              └───────────────┬────────────────────────────────┘
                              │ 调用
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  api.js      │    │ modules/common.js│    │  config.js       │
│  API.Utils   │    │  API.Common       │    │  Default_Config  │
│  API.{Module}│    │  下载分发 / 模板   │    │  QZone 状态      │
└──────┬───────┘    └─────────┬────────┘    └──────────────────┘
       │                      │
       └──────────┬───────────┘
                  ▼
       ┌─────────────────────────────┐
       │     background.js           │
       │  下载调度 + 消息中枢 + DNR  │
       └─────────────────────────────┘
                  ▲
                  │ chrome.runtime.sendMessage
       ┌──────────┴───────────────────┐
       │  popup.js / options.js        │
       │  （通过 port 与 content 通信）│
       └──────────────────────────────┘
```

### 7.2 第三方库依赖

| 库 | 路径 | 用途 |
|----|------|------|
| jquery | `vendor/jquery/` | DOM 操作、Ajax |
| lodash | `vendor/lodash/` | 工具函数（`_.chunk`、`_.isEmpty` 等） |
| bootstrap | `vendor/bootstrap/` | UI 框架 + 表格 + 下拉选择 |
| bootstrap-table | `vendor/bootstrap/js/bootstrap-table.min.js` | 下载任务列表展示 |
| bootstrap-select | `vendor/bootstrap-select/` | 相册多选下拉框 |
| template.js | `vendor/template/template.js` | art-template 模板引擎 |
| jszip | `vendor/jszip/` | 生成 ZIP 备份压缩包 |
| FileSaver | `vendor/FileSaver/` | 浏览器保存文件 |
| Blob.js / ponyfill | `vendor/blob/` `vendor/ponyfill/` | Blob Polyfill |
| sheetjs (xlsx) | `vendor/sheetjs/` | 表格导出 Excel |
| turndown | `vendor/turndown/` | HTML 转 Markdown |
| filer | `vendor/filer/` | HTML5 File System API 封装 |
| loadmask | `vendor/loadmask/` | 加载遮罩 |
| thunder-link | `vendor/thunder/` | 迅雷链接生成 |
| x-editable | `vendor/x-editable-4-bs4/` | 设置页行内编辑 |
| jquery-resizable-columns | `vendor/jquery-resizable-columns/` | 表格列宽调整 |
| coordtransform | `export/js/lib/coordtransform.min.js` | 坐标系转换 |
| ECharts | 通过 CDN 加载（statistics.html 中） | 足迹地图 |
| LightGallery | 通过 CDN 加载（导出页中） | 图片 / 视频画廊 |
| moment.js | 通过 CDN 加载 | 好友相识时间格式化 |

### 7.3 chrome.* API 依赖

| API | 用途 |
|-----|------|
| `chrome.runtime.onMessage` / `onConnect` | content ↔ background ↔ popup 消息通信 |
| `chrome.runtime.sendMessage` | 跨上下文调用 |
| `chrome.storage.sync` | 配置持久化（自动同步） |
| `chrome.storage.local` | 备份大数据持久化 |
| `chrome.downloads.download` | 浏览器下载 |
| `chrome.downloads.search` / `resume` / `show` / `onDeterminingFilename` | 下载状态查询、恢复、显示、重命名 |
| `chrome.declarativeContent` | PageStateMatcher，控制 PageAction 显示 |
| `chrome.declarativeNetRequest` | 动态修改 Referer / 请求头 |
| `chrome.notifications` | 桌面通知 |
| `chrome.cookies` | 读取 QQ 空间登录 Cookie |
| `chrome.tabs.create` / `query` | 打开新标签 / 查询当前标签 |
| `chrome.extension.getURL` | 获取扩展内资源 URL（用于 indicator.html） |

---

## 8. 配置与数据结构

### 8.1 配置层级

```
Default_Config (config.js，硬编码默认值)
       │
       ▼ chrome.storage.sync.get(Default_Config, ...)
QZone_Config (运行时配置，用户可在 options.html 修改)
```

### 8.2 每模块配置字段示例（以 Messages 为例）

```js
{
    exportType: "HTML",              // 内容备份类型 HTML/MarkDown/JSON/Folder/File
    pageSize: 20,                   // 每页条数
    randomSeconds: { min: 1, max: 2 },  // 请求随机等待秒数
    isFull: true,                   // 是否获取全文
    isShowMore: false,              // 是否展开全文
    Comments: {
        isFull: true,
        pageSize: 20,
        randomSeconds: { min: 1, max: 2 }
    },
    IncrementType: "Full",          // 增量备份类型 Full/Increment
    IncrementTime: "2005-06-06 00:00:00",  // 增量起始时间
    IncrementField: "created_time", // 增量判断字段
    isFilterKeyword: false,         // 是否启用屏蔽词过滤
    FilterKeyWords: [...],          // 屏蔽词列表
    hasThatYearToday: true,         // 是否生成"那年今日"
    Like:    { isGet: false, randomSeconds: {...} },
    Visitor: { isGet: false, pageSize: 24, randomSeconds: {...} }
}
```

### 8.3 全局状态 `QZone` 结构

```js
var QZone = {
    Common: {
        ROOT: 'Common',
        ExportTypes: [...],          // 用户勾选的模块
        Owner: { uin, nickname },    // 当前登录用户
        Target: { uin, route },      // 备份目标用户
        Config: { ZIP_NAME: 'QQ空间备份' },
        FILE_URLS: Map,              // 全局已下载文件映射
        Zip: JSZip,                  // 压缩包实例
        MD: TurndownService,         // HTML → Markdown 实例
        Filer: Filer,                // HTML5 文件系统实例
        ExportFiles: [...]           // 资源映射表
    },
    Messages: { ROOT, IMAGES_ROOT, total, Data, OLD_Data, FILE_URLS },
    Blogs:    { ROOT, IMAGES_ROOT, total, Data, OLD_Data, FILE_URLS },
    // ...
    Photos: {
        ROOT: 'Albums',
        Album: { total, Data, Select },  // Select = 用户选中的相册 ID 列表
        Images: { /* albumId -> photos[] */ },
        Class:    { 100: "最爱", 101: "人物", ... },  // 默认相册分类
        Access:   { 1: "所有人可见", 3: "仅自己可见", ... },
        AccessType: { 1: "公开", 3: "仅主人可见", ... },
        ViewType: { 1: "个性", 5: "亲子", ... }
    },
    Shares: {
        ShareType: { 1: "日志", 2: "相册", 3: "照片", 4: "网页", 5: "视频", ... }
    },
    Visitors: {
        Data: { items, total, totalPage }
    }
}
```

### 8.4 备份目录结构（ZIP 内）

```
QQ空间备份_{QQ号}/
├── Common/                       # 公共资源
│   ├── css/common.css
│   ├── js/sidebar.js
│   ├── js/common.js
│   └── images/{index.jpg, video-play.png, loading.gif, favicon.ico}
├── Messages/                     # 说说
│   ├── index.html                # 年份汇总
│   ├── 2023.html / 2024.html ... # 按年份分组
│   ├── json/messages.js          # JS 变量形式的数据（供离线页消费）
│   └── images/                   # 说说配图
├── Blogs/                        # 日志
│   ├── index.html / {year}.html
│   ├── json/blogs.js
│   ├── info/{blogId}.html        # 单篇日志详情
│   └── images/
├── Diaries/                      # 日记（结构同 Blogs）
├── Albums/                       # 相册
│   ├── index.html
│   ├── json/albums.js
│   ├── json/{albumId}.js
│   ├── {分类名}/{相册名}/        # 相册文件夹
│   │   ├── index.html            # 相册内相片预览页
│   │   ├── json/{albumId}.js
│   │   └── *.jpg                 # 相片文件
├── Videos/                       # 视频
├── Boards/                       # 留言板
├── Friends/                      # 好友
├── Favorites/                    # 收藏
├── Shares/                       # 分享
├── Visitors/                     # 访客
└── Statistics/                   # 足迹统计
    ├── index.html
    ├── js/maps/                  # 地图配置 + GeoJSON
    ├── js/lib/coordtransform.min.js
    └── images/{earth.svg, share.svg}
```

### 8.5 `ExportFiles` 资源映射

定义在 [config.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/config.js) 末尾，列举了 31 个扩展资源 → 备份包内目标路径的映射。备份开始时 `API.Common.initBackedUpItems()` 会将这些文件复制到 ZIP 中，确保离线页可正常加载。

---

## 9. 项目运行方式

### 9.1 加载扩展（开发者模式）

1. 打开 Chrome，访问 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目下的 `src/` 目录
5. 浏览器工具栏出现「qzone-archiver」图标

### 9.2 触发备份

1. 在 Chrome 中访问 `https://user.qzone.qq.com/{你的QQ号}`（确保已登录 QQ 空间）
2. PageAction 图标变为可点击状态，点击弹出 [popup.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/popup.html)
3. 确认「登录 QQ」与「备份 QQ」正确，根据需要切换「个人模式」/「他人模式」
4. 勾选要备份的模块（说说、日志、日记、相册、视频、留言、好友、收藏、分享、访客）
5. 如选择「相册」可点击「相册列表」下拉框筛选需要备份的具体相册
6. 点击「开始备份」按钮
7. 页面弹出 [indicator.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/indicator.html) 模态窗，显示实时进度
8. 各模块按 `OperatorType` 状态机顺序执行，期间自动下载多媒体文件
9. 完成后点击「打包下载」生成 ZIP；如使用「迅雷 / Aria2 / 浏览器」下载方式可点击「查看下载列表」管理任务

### 9.3 配置修改

- 点击 popup 弹窗中的「点击这里更换下载工具」链接，或右键扩展图标 → 「选项」打开 [options.html](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/html/options.html)
- Tab 切换至各模块，可调整：每页条数、随机等待、并发数、增量备份、屏蔽词、分享来源识别规则、Aria2 RPC、迅雷参数、相册命名规则、相片清晰度匹配等
- 保存后写入 `chrome.storage.sync`，下次备份时生效

### 9.4 浏览备份

1. 解压下载的 ZIP 文件
2. 用浏览器打开根目录 `index.html`，即可查看个人首页与各模块入口
3. 各模块 `index.html` 提供年份导航与列表 / 表格切换
4. 单篇日志 / 日记详情可点击进入
5. 相册页支持 LightGallery 全屏预览、旋转、缩放、缩略图、视频播放
6. 说说 / 分享 / 收藏 / 留言页支持评论、点赞、访客列表模态窗
7. 统计页（`Statistics/index.html`）展示基于 ECharts 的足迹地图与好友互动分析

### 9.5 开发调试

- 内容脚本调试：在 QQ 空间页面打开 DevTools，Console 即可看到 `QZone`、`API`、`operator` 等全局对象
- 后台脚本调试：`chrome://extensions/` → 「检查视图：背景页」
- 弹窗调试：右键弹窗 → 「检查」
- 设置页调试：在 options.html 页面打开 DevTools

### 9.6 关键约束

- **Manifest V2 限制**：项目使用 MV2，未来若迁移到 MV3 需重写 `background.js` 为 Service Worker、用 `chrome.declarativeNetRequest` 静态规则替代动态注入等
- **CSP**：`script-src 'self' 'unsafe-eval'` 允许 `template.js` 编译模板；同时允许特定 CDN（jsdelivr / staticfile 等）加载 ECharts、LightGallery、moment 等
- **HTML5 File System**：使用 `filer` 库基于已废弃的 `window.webkitRequestFileSystem`，仅在 Chrome 内核浏览器可用，且配额限制为 10GB
- **QQ 空间接口时效性**：所有 REST URL 来自逆向工程，腾讯可能随时变更；视频下载有时效性，MP4 任务会被 `unshift` 到队首尽早下载
- **下载防盗链**：通过 `declarativeNetRequest` 给 `gtimg.com` 资源注入 `Referer: https://user.qzone.qq.com/`；部分场景需要先通过 background 的 XHR 拿 blob 再走 `chrome.downloads`

---

## 10. 附录

### 10.1 REST API 列表（部分）

完整定义在 [api.js](file:///c:/Users/15572/Documents/trae_projects/zoneexport/src/js/api.js) 开头的 `REST_URLS` 中：

| 常量 | URL | 用途 |
|------|-----|------|
| `USER_OVERVIEW_URL` | `/proxy/domain/r.qzone.qq.com/cgi-bin/main_page_cgi` | 空间概览（权限判断） |
| `USER_INFO_URL` | `/proxy/domain/base.qzone.qq.com/cgi-bin/user/cgi_userinfo_get_all` | 个人信息 |
| `MESSAGES_LIST_URL` | `/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6` | 说说列表 |
| `MESSAGES_DETAIL_URL` | `/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msgdetail_v6` | 说说详情（全文） |
| `MESSAGES_IMAGES_URL` | `/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_get_pics_v6` | 说说配图 |
| `MESSAGES_VIDEOS_COMMONTS_URL` | `/proxy/domain/taotao.qzone.qq.com/cgi-bin/emotion_cgi_getcmtreply_v6` | 说说 / 视频评论 |
| `MESSAGES_VOICE_INFO_URL` | `/proxy/domain/snsapp.qzone.qq.com/cgi-bin/sound/GetVoice` | 语音说说详情 |
| `BLOGS_LIST_URL` | `/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_abs` | 日志摘要列表 |
| `BLOGS_INFO_URL` | `/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/blog_output_data` | 日志详情 |
| `BLOGS_COMMENTS_URL` | `/proxy/domain/b.qzone.qq.com/cgi-bin/blognew/get_comment_list` | 日志评论 |
| `DIARY_LIST_URL` | `/proxy/domain/b.qzone.qq.com/cgi-bin/privateblog/privateblog_get_titlelist` | 私密日志列表 |
| `PHOTOS_ROUTE_URL` | `/proxy/domain/route.store.qq.com/GetRoute` | 相册路由 |
| `ALBUM_LIST_URL` | `/proxy/domain/photo.qzone.qq.com/fcgi-bin/fcg_list_album_v3` | 相册列表 |
| `IMAGES_LIST_URL` | `/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_list_photo` | 相片列表 |
| `IMAGES_INFO_URL` | `/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_floatview_photo_list_v2` | 相片详情 |
| `ALBUM_PHOTOS_COMMENTS_URL` | `/proxy/domain/app.photo.qzone.qq.com/cgi-bin/app/cgi_pcomment_xml_v2` | 相册 / 相片评论 |
| `FRIENDS_LIST_URL` | `/proxy/domain/r.qzone.qq.com/cgi-bin/tfriend/friend_show_qqfriends.cgi` | 好友列表 |
| `FRIENDSHIP_INFO_URL` | `/proxy/domain/r.qzone.qq.com/cgi-bin/friendship/cgi_friendship` | 好友互动信息 |
| `BOARD_LIST_URL` | `/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb` | 留言列表 |
| `VIDEO_LIST_URL` | `/proxy/domain/taotao.qq.com/cgi-bin/video_get_data` | 视频列表 |
| `FAVORITE_LIST_URL` | `/proxy/domain/fav.qzone.qq.com/cgi-bin/get_fav_list` | 收藏列表 |
| `SHARE_LIST_URL` | `/p/h5/pc/api/sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzsharegetmylistbytype` | 分享列表 |
| `LIKE_COUNT_URL` | `/proxy/domain/r.qzone.qq.com/cgi-bin/user/qz_opcnt2` | 点赞数目 |
| `LIKE_LIST_URL` | `/proxy/domain/users.qzone.qq.com/cgi-bin/likes/get_like_list_app` | 点赞列表 |
| `VISITOR_SINGLE_LIST_URL` | `/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_single` | 单条说说 / 日志浏览记录 |
| `VISITOR_SIMPLE_LIST_URL` | `/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_simple` | 相册浏览记录 |
| `VISITOR_MORE_LIST_URL` | `/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_more` | 空间访问记录 |
| `SPECIAL_CARE_LIST_URL` | `/proxy/domain/r.qzone.qq.com/cgi-bin/tfriend/specialcare_get.cgi` | 特别关心 |
| `USER_CARD_URL` | `https://h5.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/user/cgi_personal_card` | 用户名片 |
| `MAP_LBS_INFO` | `https://apis.map.qq.com/ws/geocoder/v1` | 坐标 → 地址（腾讯地图） |
| `TO_TX_LBS` | `https://apis.map.qq.com/ws/coord/v1/translate` | 坐标转换（腾讯地图） |

> 所有 `/proxy/domain/...` 形式的 URL 都会被 Chrome 转发至 `user.qzone.qq.com` 域下，借扩展的同源 Cookie 绕过跨域限制。

### 10.2 模块代码量统计（粗略）

| 文件 | 行数 | 备注 |
|------|------|------|
| `js/api.js` | ~4600 | 最大文件，含全部 REST 接口封装 |
| `js/content.js` | ~1687 | 状态机 + 类定义 + MAX_MSG |
| `js/config.js` | ~900 | 默认配置 + 全局状态 |
| `js/modules/common.js` | ~1400 | 公共备份逻辑 |
| `js/modules/photos.js` | ~1936 | 业务模块最大 |
| `js/modules/messages.js` | ~1500 | 说说最复杂业务 |
| `js/modules/videos.js` | ~732 | |
| `js/modules/shares.js` | ~682 | |
| `js/modules/visitors.js` | ~481 | |
| `js/background.js` | ~425 | |
| `export/js/common.js` | ~2700 | 导出侧核心 |
| `export/js/statistics.js` | ~780 | 足迹地图 |

### 10.3 下载方式对比

| 方式 | 配置值 | 优点 | 缺点 |
|------|--------|------|------|
| 浏览器下载 | `Browser` | 原生支持、稳定 | 受浏览器并发限制、需关闭「下载前询问」 |
| Ajax 内部下载 | `File` | 完全内置 | 已被废弃、易失败 |
| Aria2 | `Aria2` | 多线程、高速 | 需用户自建 Aria2 服务 |
| 迅雷（助手唤醒） | `Thunder` | 调用本地迅雷、支持 Referer | 需安装迅雷、唤醒不稳定 |
| 迅雷（剪切板） | `Thunder_Clipboard` | 兼容性好 | 需迅雷开启剪切板接管 |
| 迅雷（链接） | `Thunder_Link` | 仅生成链接到文件 | 需用户手动添加任务 |
| QQ空间外链 | `QZone` | 不下载、最快 | URL 有时效性、备份失效 |

### 10.4 已知问题与潜在改进

- `visitors.js` 的 `exportToJson` 中 `groupedByTime(visitorInfo, "time", "year")` 传入整个对象而非 `.items`，可能导致年份分组失败
- `visitors.js` 的 `exportToHtml` 中 `createFolder(moduleFolder + '/json')` 重复调用
- `shares.js` 的 `export` 中调用 `API.Videos.addDownloadEmoticonTasks`（应为 `API.Shares.addDownloadEmoticonTasks`，虽功能等价但命名不一致）
- `export/js/visitors.js` 为空文件，访客页交互完全依赖 `common.js`
- 项目使用 Manifest V2，已于 2024 年起逐步被 Chrome 弃用，未来需迁移到 MV3

### 10.5 相关链接

- 本项目主页：[https://github.com/salt-fishes/qzone-archiver](https://github.com/salt-fishes/qzone-archiver)
- 原项目：[https://github.com/ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport)
- 原作者博客：[https://lvshuncai.com/archives/qzone-export.html](https://lvshuncai.com/archives/qzone-export.html)
- Chrome 扩展开发文档：[https://developer.chrome.com/docs/extensions/mv3/](https://developer.chrome.com/docs/extensions/mv3/)

---

> 本 Wiki 基于代码版本（v2.0）静态分析生成，如有疑问以源码为准。
