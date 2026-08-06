# qzone-archiver 桌面化改造设计（引擎五层重构 + 桌面版，扩展端冻结）

> 状态：方案（待评审） · 日期：2026-08-06 · 基准：v3.3.0

## 0. 决策记录

| 决策项 | 结论 |
|---|---|
| 目标形态 | 一体化完整版（内嵌登录 → 采集 → 打包 → 内置 SPA 浏览），完全替代扩展 |
| 技术栈 | Electron（主 UI Vue 3 + Pinia，与现有 SPA 一致） |
| 采集架构 | **方案 A：引擎窗口 + 注入采集**（隐藏 BrowserWindow 加载 user.qzone.qq.com，复用现有采集链路） |
| 主界面 | 全新设计（复古暖色设计系统直接套用），扩展端 options/popup/tools 保留不动 |
| 项目组织 | 桌面版与扩展版同仓库（本仓库即桌面版项目），新增 `desktop/` 目录承载桌面代码 |
| 扩展端策略 | **当前冻结 v3.3.0 不动**（src/js、background.js、content.js、所有页面与 manifest.json 均不回写）；扩展版继续独立发布。**接口设计预留后续改造**：QZonePlatform 契约环境无关，扩展端未来可按同一五层蓝图引入 `platform/extension/` 实现，复用桌面引擎 |
| 平台首发 | Windows（electron-builder NSIS + portable）；Mac 用户引导使用扩展版 |
| 合并策略 | **M1 引擎五层重构（在 desktop/src/engine 内）与 M2 桌面壳并行推进**；引擎基线一次性快照自扩展端 |
| 登录 | qzone 页面原生扫码 + 账号密码；登录态由 Electron session partition 持久化 |
| 下载 | 主进程原生流式下载（net.fetch pipe），大文件零整块缓冲 |

---

## 1. 总体架构

### 1.1 进程模型

```
┌────────────────────────────── qzone-archiver-desktop（Electron） ──────────────────────────────┐
│                                                                                                 │
│  ┌───────────────────┐   IPC(invoke/send)   ┌────────────────────────┐                          │
│  │ 主 UI 窗口（Vue3） │◄────────────────────►│ 主进程 Main             │                          │
│  │ window.api        │                      │ 窗口管理 / IPC 总线      │                          │
│  │ 概览/备份/任务/下载 │                      │ 下载管理器（流式）        │                          │
│  │ /历史/设置          │                      │ 打包器（archiver）      │                          │
│  └───────────────────┘                      │ 配置/状态持久化          │                          │
│          ▲                                  └───────────┬────────────┘                          │
│          │ IPC（推送事件）                               │ IPC（引擎桥）                          │
│  ┌───────┴──────────────────────────────────────────────▼───────────────────────────┐        │
│  │ 引擎窗口（隐藏，partition: persist:qzone）                                        │        │
│  │   https://user.qzone.qq.com 登录页 / 已登录页                                       │        │
│  │   注入：desktop-adapters(QZonePlatform) + 引擎五层 + desktop-runner                │        │
│  │   采集在同源页面运行，cookie 自动携带，g_tk 原样工作                                  │        │
│  └───────────────────────────────────────────────────────────────────────────────────┘        │
│                                                                                                 │
│  内置 SPA 浏览窗口（file:// 打开备份产物 index.html，可选复用）                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

> 引擎五层位于 `desktop/src/engine/`（扩展端快照 + M1 重构产物），见 §2、§3.7。

### 1.2 数据流

```
引擎窗口：collectors 采集 ──raw──▶ repos 标准化/持久化（经 QZonePlatform.fs → IPC → 主进程写盘）
                                    │
                                    ▼
            exporters（HTML/MD/JSON/SPA，直接写入目标备份文件夹）
                                    │
                   tasks（orchestrator 编排 / state 检查点 / progress 上报）
                                    │ download:enqueue
主进程：DownloadManager 流式下载媒体（直写目标文件夹，与采集并行）
        打包器（用户点导出时）archiver zip + manifest/checksum/report
```

### 1.3 与扩展的两处关键差异

1. **两段式 → 一段式**：扩展"采集打包文案 + 合并两个文件夹"的流程消失，桌面版全部内容直写用户选择的目标文件夹。
2. **状态能力增强**：检查点与下载队列持久化到磁盘，支持跨会话断点续传（扩展仅 session 内）。

---

## 2. M1：引擎五层重构（desktop/src/engine/，扩展端冻结）

沿用 [ARCH_REFACTOR_PLAN.md](../../../ARCH_REFACTOR_PLAN.md) 六阶段方案，但**执行地点改为桌面引擎拷贝**：

- 基线：扩展端 v3.3.0 的 `src/js` + `templates` + `export` 资源，经 `desktop/scripts/sync-baseline.mjs` 一次性快照到 `desktop/src/engine/`
- 五层重构全部在 `desktop/src/engine/` 内进行；**扩展端 src/js、background.js、content.js 等一律不改、不加目录**
- 本文档补充 **平台适配层** 补丁（原"background.js 抽象"不再需要——扩展端 background.js 冻结，其职责由桌面主进程与适配器承担，见 §2.2）

### 2.1 平台适配层（补丁 1）

引擎五层只允许调用环境无关接口 `QZonePlatform`，禁止直接调用 chrome.* / Filer / JSZip / saveAs：

```js
window.QZonePlatform = {
  storage:  { get(key), set(key, value), remove(key) },              // 桌面：IPC → 主进程 config-store/state-store
  fs:       { writeFile(path, data), readFile(path), exists(path), mkdir(path) }, // 桌面：IPC → 主进程写盘
  zip:      { generate(srcDir) → Blob（含进度回调） },               // 桌面：主进程 archiver（引擎侧仅保留 links.js）
  download: { enqueue(task), pause(), resume(), cancel() },          // 桌面：主进程 DownloadManager
  notify:   { progress(evt), log(evt), state(evt) }                  // 桌面：engineBridge → IPC → 主 UI
};
```

- 桌面实现：位于 `desktop/src/engine/desktop-adapters.js`（IPC → 主进程），由 desktop-runner 注入（见 §3.4）
- **预留扩展端实现**：接口按环境无关设计。扩展端未来改造时在 `src/js/platform/extension/*` 提供同一 `QZonePlatform` 实现（chrome.storage / Filer / JSZip / background 下载链路），即可复用桌面端已重构的五层引擎；当前阶段不落地
- **重构验收硬性要求**：`desktop/src/engine/` 代码 grep 不得出现 `chrome.` / `Filer` / `JSZip` / `saveAs` 直接调用
- 网络原语：引擎窗口同源运行，api.js 的 fetch/g_tk 逻辑原样保留；`chrome.runtime.getURL` 等扩展 API 由 desktop-adapters 提供等价映射

### 2.2 background.js 职责的桌面替代（原补丁 2）

扩展端 background.js 冻结不动。桌面端不存在浏览器下载 / DNR / chrome.storage.session，对应职责：

| 扩展端 background.js 职责 | 桌面端替代 |
|---|---|
| 浏览器下载（downloadByBrowser/getInProgressTask） | 主进程 DownloadManager 流式下载（§3.3） |
| DNR referer 规则 | 主进程 net.fetch 自设 Referer/UA 头 |
| chrome.storage.session 状态 | 主进程 state-store（检查点 + 队列，§3.5） |
| 消息中枢 | 主进程 IPC 总线（§3.2） |

> 扩展端 background.js 当前冻结；后续改造时这些职责收敛为 `src/js/platform/extension/download.js` + `storage.js`，与桌面端实现同一 `QZonePlatform` 接口。

### 2.3 基线 → 重构后结构对比（desktop/src/engine/）

#### 基线（扩展端 v3.3.0 快照，冻结不动）

```
src/js/                        # 扩展端现状，仅作只读基线
├── api.js                  # ~3800 行：REST_URLS + API.* 网络原语 + 业务编排 + FS 工具（职责交织）
├── background.js           # SW：消息中枢 + 浏览器下载 + DNR + 安装处理
├── content.js              # ~1900 行：QZoneOperator 状态机 + StatusIndicator UI + 下载任务类 + exportState
├── config.js               # 默认配置 + 全局状态 + 导出资源清单
├── utils.js                # 工具函数
├── templates-compiled.js   # 预编译模板
├── options.js / popup.js / tools.js   # 扩展页面交互（桌面端另行实现，本仓库保留不动）
└── modules/                # 采集/导出/下载交织的模块
    ├── common.js           # 导出编排 + 资源复制 + 下载实现(Browser/Ajax/Aria2/Thunder) + 迅雷链接
    ├── messages.js         # 说说：采集(66-868) + convert(1173-1227) + 导出
    ├── blogs.js  diaries.js  photos.js  videos.js  boards.js
    ├── favorites.js  shares.js  friends.js  visitors.js
```

#### 重构后（desktop/src/engine/，M1 产物）

```
desktop/src/engine/
├── baseline-manifest.json   # 基线快照清单（源 → 目标 + 版本）
├── desktop-adapters.js      # 【新增】QZonePlatform 桌面实现（IPC → 主进程）
├── desktop-runner.js        # 【新增】注入入口：装配适配器 + __engineCommands
├── api.js                   # 瘦身：仅网络原语 get/post/send/toJson + REST_URLS + FS 工具
├── config.js  utils.js  templates-compiled.js   # 自基线快照
├── collectors/              # 【新】采集层：纯拿数据，不写文件不报进度
│   ├── base.js              # 分页基类（翻页/重试/WAF 检测/限速）
│   ├── common.js            # 用户信息/好友/点赞/评论 采集
│   ├── messages.js  blogs.js  diaries.js  photos.js  videos.js
│   ├── boards.js  favorites.js  shares.js  friends.js  visitors.js
│   └── index.js             # 模块 → collector 注册表
├── tasks/                   # 【新】任务层：唯一持有状态与编排
│   ├── orchestrator.js      # 编排（迁移自 QZoneOperator.next 状态机）
│   ├── state.js             # exportState/检查点（迁移自 content.js:1553-1656）
│   ├── progress.js          # StatusIndicator → notify 接口（迁移自 content.js:659-927）
│   ├── downloader.js        # DownloadTask/BrowserTask/ThunderTask/downloadAllFiles（content.js:7-170/1775-1895）
│   └── index.js
├── repos/                   # 【新】仓库层：标准化 + 持久化
│   ├── schema.js            # convert 标准化
│   ├── writer.js            # writeJsonToJs/writeText 等（经 desktop-adapters.fs → IPC）
│   ├── incremental.js       # initBackedUpItems/unionBackedUpItems/saveBackupItems（common.js:805-1162）
│   ├── modules/             # 各模块标准化实现
│   └── index.js
├── exporters/               # 【新】导出层：标准数据 → 目标格式
│   ├── html.js              # writeHtmlofTpl + 预编译模板
│   ├── markdown.js  json.js  spa.js
│   ├── resources.js         # ExportFiles/SpaExportFiles 资源复制（common.js:227-288）
│   └── index.js             # exportType 分发
├── packagers/               # 【新】打包层（桌面端精简）
│   ├── manifest.js          # manifest/checksum/report（新增）
│   ├── links.js             # writeThunderTaskToFile（common.js:679）
│   └── index.js
├── templates/               # 离线 HTML 模板（自扩展端快照）
└── export-resources/        # export/ 静态资源（自扩展端快照）
```

> 说明：zip.js 不进桌面引擎——打包由主进程 `archiver` 承担（§3.5）；links.js 保留在引擎侧（引擎窗口内生成迅雷链接 txt 后经 fs 落盘）。
> 扩展端全部文件（src/js 等）当前冻结，无任何结构变更；上图五层结构同时作为扩展端未来改造的目标蓝图（届时按同一结构调整 src/js，并补 `platform/extension/` 实现）。

### 2.4 分阶段步骤（P0–P6，均在 desktop/src/engine/ 内）

| 阶段 | 内容 | 验证 |
|---|---|---|
| **P0 骨架** | 快照基线 → desktop/src/engine；建五层目录 + desktop-adapters/desktop-runner 空命名空间 | 引擎注入到 qzone 页面无 console 错误 |
| **P1 平台适配层** | 先把 storage/fs/zip/download/notify 收敛到 desktop-adapters.js，引擎代码改经 QZonePlatform 访问 | 单模块采集→导出，产物与扩展端 v3.3.0 一致 |
| **P2 采集层** | 各模块 `getAllList/getAllContent/getComments/getLikeList` 迁至 collectors/*；api.js 保留为网络原语 | 单模块（Messages）跑通采集→导出，产物一致 |
| **P3 仓库层** | 迁移 convert/writeJsonToJs/incremental；导出入口改从 QZoneRepo 取标准数据 | 增量备份回归，哈希命名不变 |
| **P4 导出层** | 迁移 exportTo*/exportUserToSpa/writeHtmlofTpl 到 exporters/* | 四类导出 + SPA 产物逐文件 diff（对照扩展端） |
| **P5 打包层** | 迁移 manifest/links 到 packagers/*；zip 改主进程 archiver（saveAs/JSZip 不进桌面） | ZIP 产物与扩展端一致 + 新增 manifest/checksum/report |
| **P6 任务层收口** | QZoneOperator → orchestrator（tasks/）；desktop-runner 只留 __engineCommands 薄壳 | 全流程回归：暂停/恢复/取消/断点/下载重试 |

> 与 ARCH_REFACTOR_PLAN 的差异：原 6 阶段中间插入 P1（适配层先行收敛），且执行地点为桌面引擎拷贝，扩展端零改动。

### 2.5 扩展端未来五层改造（预留方案）

> 前提：仅当桌面端五层稳定（M1 完成）后启动；以 `QZonePlatform` 接口契约为唯一约束，扩展端与桌面端同构。

#### 目标结构（与 desktop/src/engine 同构 + platform/extension）

```
src/js/
├── api.js                  # 瘦身：仅网络原语 + REST_URLS + FS 工具
├── background.js           # 瘦身：消息中枢 + 下载入口(platform.download) + DNR + 安装
├── content.js              # 瘦身：入口引导 + UI 交互 + 调用 tasks.orchestrator
├── config.js  utils.js  templates-compiled.js   # 不变
├── options.js / popup.js / tools.js   # 不变
├── platform/               # 【新增】平台适配层（QZonePlatform）
│   ├── index.js            # 装配 + 环境选择
│   └── extension/
│       ├── storage.js      # chrome.storage.local/session 实现
│       ├── fs.js           # Filer 文件实现
│       ├── zip.js          # JSZip 打包实现（含进度）
│       ├── download.js     # background.js 下载链路收敛（chrome.downloads + DNR）
│       └── notify.js       # StatusIndicator / indicator 实现
├── collectors/             # 移植自 desktop/src/engine/collectors
├── tasks/                  # 移植自 desktop/src/engine/tasks
├── repos/                  # 移植自 desktop/src/engine/repos
├── exporters/              # 移植自 desktop/src/engine/exporters
└── packagers/              # 移植自 desktop/src/engine/packagers（zip.js 用 JSZip 实现）
```

#### 桌面端 ↔ 扩展端差异点（仅 platform 实现不同，五层核心一致）

| QZonePlatform 接口 | 桌面端实现（desktop-adapters.js） | 扩展端实现（platform/extension/*） |
|---|---|---|
| storage | 主进程 config-store / state-store | chrome.storage.local / session |
| fs | IPC → 主进程写盘 | Filer |
| zip | 主进程 archiver（打包不进引擎） | JSZip（content 侧，MV3 CSP 下用预编译/无 new Function） |
| download | 主进程 DownloadManager 流式 | background.js chrome.downloads（DNR referer 规则保留） |
| notify | engineBridge → IPC → 主 UI | StatusIndicator / indicator.html |

#### 改造步骤（E0–E6）

| 阶段 | 内容 | 验证 |
|---|---|---|
| **E0 骨架 + 适配层** | 落地 platform/extension/* + manifest 加载顺序（platform 先于五层）；api.js/content.js 原样 | 扩展正常加载，无 console 错误 |
| **E1 收敛** | 把 api.js/content.js/modules 中分散的 chrome.* / Filer / JSZip / saveAs 替换为 QZonePlatform 调用 | 全流程回归，产物与改造前 v3.3.0 一致 |
| **E2 采集层** | 从 desktop/src/engine/collectors 移植替换 modules 采集逻辑 | 单模块（Messages）采集→导出一致 |
| **E3 仓库层** | 移植 repos/*（convert/写入/增量） | 增量备份回归，哈希命名不变 |
| **E4 导出层** | 移植 exporters/*（四类导出 + SPA） | 产物逐文件 diff |
| **E5 打包层** | 移植 packagers/*；zip.js 用 JSZip 实现（区别于桌面 archiver） | ZIP 产物与改造前一致 |
| **E6 任务层收口** | 移植 tasks/*；QZoneOperator → orchestrator；content.js/background.js 瘦身 | 暂停/恢复/取消/断点/下载重试回归 |

#### 复用与同步策略

- 五层核心代码（collectors/repos/exporters/tasks）以**桌面端为参照直接移植**，因接口同构，仅 platform 实现不同
- 改造后扩展端与桌面端进入**双向同构**：同一份五层代码、两种 platform 实现；用 diff 校验脚本（对照 desktop/src/engine）防漂移，Bug 修复可双侧同步
- 扩展端既有硬约束全部继承：MV3（无 unsafe-eval，模板已预编译）、vendor 本地化、file:// SPA 兼容

---

## 3. M2：桌面版（本仓库 `desktop/` 目录）

### 3.1 项目目录结构（新建）

```
desktop/                       # 桌面版代码（与扩展端同仓库，本仓库即桌面版项目）
├── package.json               # electron + electron-builder + vue
├── electron-builder.yml       # NSIS 安装包 + portable；Windows 首发
├── README.md                  # 含「Mac 用户请使用扩展版」引导
├── scripts/
│   └── sync-baseline.mjs      # 一次性快照扩展端引擎基线（src/js + templates + export）→ desktop/src/engine
├── src/
│   ├── main/                  # 主进程
│   │   ├── index.js           # 启动：single-instance / 窗口创建 / 注册 IPC
│   │   ├── windows.js         # 主窗口 / 引擎窗口 / viewer 窗口管理
│   │   ├── ipc/               # 按域拆分（见 §3.2）
│   │   │   ├── app.js  auth.js  config.js  backup.js
│   │   │   ├── download.js  fs.js  zip.js  viewer.js
│   │   └── services/
│   │       ├── download-manager.js  # 流式下载（见 §3.3）
│   │       ├── packager.js          # archiver zip + manifest/checksum/report
│   │       ├── config-store.js      # userData/state/config.json
│   │       ├── state-store.js       # 检查点 + 下载队列
│   │       └── engine-bridge.js     # 引擎注入调度 + engineReady + __engineCommands 转发
│   ├── preload/
│   │   ├── ui-bridge.js        # window.api（主 UI，contextBridge 白名单）
│   │   └── engine-bridge.js    # window.engineBridge（引擎窗口最小桥）
│   ├── renderer/               # Vue 3 主界面
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.ts  App.vue  router.ts
│   │       ├── views/          # HomeView BackupView TasksView DownloadsView ArchivesView SettingsView
│   │       ├── components/  stores/（auth/backup/download/config）
│   │       ├── styles/         # tokens.scss（复用 spa）+ desktop.scss
│   │       └── api/            # window.api 类型化封装
│   └── engine/                 # 引擎层（扩展端基线快照 + M1 五层重构产物，非手改）
│       ├── baseline-manifest.json  # 基线快照清单（源 → 目标 + 版本）
│       ├── desktop-adapters.js # QZonePlatform 桌面实现（IPC → 主进程）
│       ├── desktop-runner.js   # 注入入口：装配适配器 + __engineCommands
│       ├── api.js  config.js  utils.js  templates-compiled.js   # 自基线快照
│       ├── collectors/  repos/  exporters/  tasks/   # M1 重构产物（自基线拆分）
│       ├── packagers/          # 仅 manifest.js + links.js；zip 由主进程 archiver 承担
│       ├── templates/          # 离线 HTML 模板（自扩展端快照）
│       └── export-resources/   # export/ 静态资源（自扩展端快照）
└── docs/                       # 桌面版文档
```

### 3.2 IPC 契约（主进程）

#### 请求-响应（UI → Main，`ipcMain.handle`）

| 通道 | 参数 → 返回 |
|---|---|
| `app:get-info` | — → `{ version, platform, arch }` |
| `app:open-external` | `{ url }` → `void` |
| `auth:get-status` | — → `{ loggedIn, qqNumber?, nickname?, avatar? }` |
| `auth:show-login` | — → `void`（显示引擎窗口至前台） |
| `auth:get-overview` | — → `OverviewData` |
| `auth:logout` | — → `void` |
| `config:get` / `config:set` / `config:reset` / `config:import` / `config:export` | `Partial<Config>` / `{ path }` |
| `backup:start` | `{ taskId, modules, config, targetDir }` → `{ ok, error? }` |
| `backup:pause` / `resume` / `cancel` | `{ taskId }` → `{ ok }` |
| `backup:get-state` | — → `TaskState`（重启恢复） |
| `download:start` / `pause` / `resume` / `cancel` | `{ taskId, targetDir }` → `{ ok }` |
| `download:get-state` | — → `{ queue, done, failed, inProgress }` |
| `fs:select-directory` | `{ title? }` → `{ canceled, path? }` |
| `fs:open-path` / `fs:show-in-folder` | `{ path }` → `void` |
| `zip:create` | `{ srcDir, destPath }` → `{ path }` |
| `viewer:open` | `{ backupPath }` → `void` |

#### 推送事件（Main → UI，`webContents.send`）

| 通道 | 载荷 |
|---|---|
| `auth:status-changed` | `{ loggedIn, qqNumber?, nickname? }` |
| `backup:progress` | `{ taskId, module, phase, done, total, percent, extra? }` |
| `backup:log` | `{ taskId, level, time, message }` |
| `backup:module-done` | `{ taskId, module, summary }` |
| `backup:state-changed` | `{ taskId, state }` |
| `backup:completed` | `{ taskId, outputPath, summary }` |
| `download:progress` | `{ taskId, done, total, currentUrl }` |
| `download:item-failed` | `{ taskId, url, error }` |
| `download:state-changed` | `{ taskId, state }` |
| `zip:progress` | `{ srcDir, percent, current }` |
| `log:batch` | `{ lines[] }` |

#### 引擎窗口桥

```
引擎 preload：window.engineBridge.post('backup:progress'|'backup:log'|'backup:state-changed'|'download:enqueue'|'auth:status-changed', payload)
注入脚本：   window.__engineCommands = { start(config, modules, targetDir), pause(), resume(), cancel(), getLoginStatus() }
```

#### 主 UI preload 形态

```ts
window.api = {
  app / auth / config / backup / download / fs / zip / viewer: {...如上},
  on(channel, cb): () => void
}
```

### 3.3 下载管理器（主进程，流式）

| 项 | 设计 |
|---|---|
| 默认方案 | `net.fetch` 流式 → `Readable.fromWeb` → `fs.createWriteStream` 背压 pipe，内存恒定 ~8MB/任务 |
| 兜底方案 | `will-download` + `downloadURL`（Chromium 下载管理器，异常重定向场景） |
| 断点续传 | 失败/取消保留 `.part` + 已收字节；重试发 `Range: bytes=N-`；不支持 Range 则全量重下 |
| 已存在跳过 | 目标存在且 Content-Length 一致 → 跳过（URL 哈希命名复用） |
| 背压 | 写流 `drain` 暂停/恢复请求 |
| 磁盘预检 | `fs.statfs` 剩余空间 < 预估文件大小 → 暂停队列并告警 |
| 空闲超时 | 60s 无数据自动 abort 重试 |
| 并发 | `downloadThread`（默认 10）；>50MB 大文件单独限流槽位 |
| 进度节流 | ≥500ms 或 ≥1% 双阈值上报，IPC 不洪水 |
| 日志降噪 | 每文件仅 start/done/failed |
| 模式 | 原生（默认）/ Aria2（RPC 照旧）/ 迅雷（唤醒/剪贴板/链接清单照旧）；扩展端"浏览器下载"模式在桌面端映射为原生流式下载 |

### 3.4 引擎窗口（登录 + 注入 + 生命周期）

- 加载 `https://user.qzone.qq.com`；未登录显示页面供扫码/密码登录；partition `persist:qzone` 持久化 cookie
- 登录检测：`p_skey` cookie + `USER_OVERVIEW_URL` 探测；会话过期 → 上报 `auth:status-changed` → UI 引导重登
- 就绪注入顺序：desktop-adapters（QZonePlatform 桌面实现）→ 引擎五层（desktop/src/engine）→ desktop-runner（`__engineCommands`）
- `engineReady` 标志：页面 load + 注入完成后方接受 `backup:start`
- 安全：引擎窗口 `nodeIntegration:false` + `contextIsolation:true`，Node 能力仅经 preload 白名单桥出，不暴露给 qzone 远程 JS
- 写盘优化：引擎所有文件写入走 `QZonePlatform.fs` → IPC 批量合并写，避免逐文件 IPC 开销

### 3.5 打包与断点续传

- zip：主进程 `archiver`（替代 JSZip），进度回调 `zip:progress`
- manifest/checksum/report：同 M1 的 packagers/manifest.js
- 检查点：`userData/state/checkpoints/{taskId}.json`；下载队列 `userData/state/downloads.json`
- 重启恢复：UI 调 `backup:get-state` / `download:get-state` → 续采 + 续下

### 3.6 主界面（全新设计）

- 顶栏（应用名 / 登录状态 / 帮助·GitHub）+ 左侧导航 + 内容区（桌面密度）
- 视图：概览（登录卡片 + 空间概览 + 上次备份 + 开始）/ 备份（模块勾选 + 增量时间/方式/并发 + 目标目录）/ 任务中心（进度 + 日志流 + 暂停/恢复/取消）/ 下载（队列 + 成功/失败/重试）/ 历史备份（扫描 + 内置 SPA 浏览）/ 设置（公共配置 + 下载器 + Aria2/迅雷 + 开发者 Key）
- 设计系统复用：`spa/src/styles/tokens.scss` + 扩展端 `theme.css`（复古暖色）

### 3.7 引擎代码共享（扩展端冻结 → 一次性基线）

- 扩展端（src/js 及全部扩展文件）**冻结为 v3.3.0**，桌面版不回写任何改动；扩展版继续独立发布，两者从此分叉
- 初始化：`desktop/scripts/sync-baseline.mjs` 从扩展端**一次性**快照引擎基线（src/js + templates + export 资源）到 `desktop/src/engine/`，写入 `baseline-manifest.json` 记录版本
- 此后 M1 五层重构与所有改动在 `desktop/src/engine/` 内独立演进；扩展端若修复 Bug，按需**人工单向同步**到桌面引擎并冒烟测试（不做自动同步）。未来扩展端完成同构改造后，此流程可升级为双向同构（同一引擎代码、两种 platform 实现，diff 校验）
- 平台适配器当前仅桌面端持有（desktop-adapters.js），**接口契约预留扩展端**：引擎层只调 `QZonePlatform` 接口，未来扩展端按同一五层蓝图补 `platform/extension/` 实现后，与桌面引擎同构、双向复用

---

## 4. 里程碑计划

| 里程碑 | 内容 | 验收标准 |
|---|---|---|
| **M1（与 M2 并行）** | desktop/src/engine 内完成五层重构 + 桌面适配层（P0–P6） | 引擎注入跑通、单模块产物与扩展端 v3.3.0 一致；扩展端零改动（git 无扩展文件变更） |
| **M2a** | 桌面壳：electron 启动 / 窗口 / IPC 契约 / preload / 引擎注入 / 登录 | 扫码登录 + 单模块（Messages）采集跑通，产物落盘正确 |
| **M2b** | 下载管理器 + 打包 + 断点续传 | 大文件流式下载不卡、失败可续、重启后续传 |
| **M2c** | 主界面全视图 + 历史备份 + 内置浏览 | 完整备份 → 打包 → 浏览闭环可用 |
| **M2d** | electron-builder 打包发布 + 文档 | NSIS/portable 安装运行；Mac 引导文档就绪 |

## 5. 风险与对策

| 风险 | 应对 |
|---|---|
| QQ 登录页在 Electron 环境异常（风控/验证） | 引擎窗口即 Chromium 同源环境，行为与扩展一致；预留"扫码"为主路径，密码为辅 |
| WAF 拦截（历史问题） | 复用现有 WAF 检测/限速/重试逻辑（collectors/base.js），与扩展无差异 |
| 扩展端冻结，桌面引擎独立演进（双向漂移） | 基线快照记录版本（baseline-manifest.json）；扩展端只读杜绝反向漂移；Bug 修复按需单向同步并冒烟；QZonePlatform 接口契约保持稳定，预留扩展端未来同构接入 |
| 大批量小文件经 IPC 写盘慢 | `QZonePlatform.fs` 批量合并写（缓冲 + 批量 flush） |
| 大文件下载内存/卡顿 | 全程流式（§3.3），主进程与渲染进程零整块缓冲 |
| 重构对照基准 | 扩展端 v3.3.0 保留可运行，作为桌面引擎每一步的产物 diff 基准（扩展版继续独立发布） |
