# qzone-archiver 五层架构改造方案

> 状态：方案（待实施） · 版本：v3.1.0 基准 · 日期：2026-08-03

## 一、现状分析（五层视角）

当前代码基于全局命名空间 `API.*` 模式（api.js 定义接口，modules/*.js 追加编排），**采集 / 任务 / 仓库 / 导出 / 打包五层职责全部交织**：

| 目标层 | 现状位置 | 交织问题 |
|---|---|---|
| **采集层** | `api.js` 的 `REST_URLS` + `API.Utils.get/post`；`modules/*.js` 的 `getAllList/getAllContents/getItemsAllCommentList` 等 | 采集循环里夹着 `checkExportState`（任务层）、进度 `indicator`（任务层） |
| **任务层** | `content.js`：`QZoneOperator` 状态机 + `exportState` + `StatusIndicator` + `DownloadTask/ThunderTask/BrowserTask` + `downloadAllFiles`；`background.js` 消息中枢 | 任务类 `DownloadTask` 同时是数据结构（仓库层） |
| **仓库层** | `modules/*.js` 的 `convert()`（标准化）+ `writeJsonToJs/writeText`（持久化）+ `initBackedUpItems/unionBackedUpItems`（增量） | 标准化逻辑分散在各模块 export() 中段 |
| **导出层** | 各模块 `exportToHtml/exportToMarkdown/exportToJson/exportToSpa` + `writeHtmlofTpl`（模板渲染）+ `config.js` 的 `ExportFiles/SpaExportFiles` 资源清单 | 导出函数与采集函数同文件共存 |
| **打包层** | `content.js` 的 `Zip.generateAsync`（JSZip）+ `saveAs` + `common.js` 的 `writeThunderTaskToFile` | 打包逻辑绑定在 UI 按钮事件里，无独立模块 |

**体量**：api.js ~3800 行、content.js ~1900 行、modules 11 个文件共 ~8000+ 行、config.js ~800 行。改造必须**渐进式、保持可运行**。

## 二、目标架构

### 2.1 新目录结构（`src/js/` 下新增五层）

```
src/js/
├── collectors/            # 采集层：纯"从 QQ 空间拿数据"
│   ├── base.js            # 分页采集基类（翻页、重试、WAF 检测、限速）
│   ├── common.js          # 用户信息 / 好友 / 点赞 / 评论 接口采集
│   ├── messages.js        # 说说：列表/全文/图片/语音/评论/赞/访客/已删除恢复
│   ├── blogs.js / diaries.js / photos.js / videos.js / boards.js
│   ├── favorites.js / shares.js / friends.js / visitors.js
│   └── index.js           # 注册表：module → collector 映射
├── tasks/                 # 任务层：调度 / 状态 / 进度 / 恢复
│   ├── orchestrator.js    # 任务编排（迁移自 QZoneOperator.next 状态机）
│   ├── state.js           # exportState：暂停/取消/恢复 + checkExportState 检查点
│   ├── progress.js        # StatusIndicator（进度指示，迁移自 content.js）
│   ├── downloader.js      # 下载调度（DownloadTask/BrowserTask/ThunderTask + downloadAllFiles）
│   └── index.js
├── repos/                 # 仓库层：标准化 + 持久化
│   ├── schema.js          # 标准化（各模块 convert → 统一标准结构）
│   ├── writer.js          # 写入：index/detail JS、JSON、Filer 封装
│   ├── incremental.js     # 增量备份：initBackedUpItems/unionBackedUpItems/saveBackupItems
│   └── modules/           # 各模块标准化实现（messages/blog/photos…）
├── exporters/             # 导出层：标准数据 → HTML/MD/JSON/SPA
│   ├── html.js            # HTML 渲染（writeHtmlofTpl + 预编译模板）
│   ├── markdown.js        # Markdown 渲染
│   ├── json.js            # JSON 渲染
│   ├── spa.js             # SPA JSON/索引/分片生成
│   ├── resources.js       # ExportFiles/SpaExportFiles 资源复制（迁移自 common.js exportUserToHtml/ToSpa）
│   └── index.js           # exportType 分发
├── packagers/             # 打包层
│   ├── zip.js             # JSZip 打包 + 进度（迁移自 content.js Zip 逻辑）
│   ├── manifest.js        # manifest / checksum / report 生成
│   ├── links.js           # 迅雷下载链接 txt（writeThunderTaskToFile）
│   └── index.js
├── background.js          # SW：仅保留消息中枢 + 浏览器下载 + DNR + 安装处理
├── content.js             # 瘦身为：入口引导 + UI 交互 + 调用 orchestrator
├── api.js                 # 瘦身为兼容层（Utils/网络原语保留，业务编排逐步外迁）
├── config.js              # 配置 + QZone 常量 + 资源清单（基本不动）
└── templates-compiled.js  # 不动
```

### 2.2 命名空间与加载顺序（MV3 约束）

content script 通过 `manifest.json` 的 `js[]` 顺序加载，**保持全局命名空间模式**（不用 ES module，避免 CSP/CORS 问题）：

```
window.QZoneCollectors = {}    # 采集层
window.QZoneTasks = {}         # 任务层（含状态、进度、下载）
window.QZoneRepo = {}          # 仓库层
window.QZoneExporters = {}     # 导出层
window.QZonePackagers = {}     # 打包层
```

`manifest.json` 加载顺序：`utils.js → config.js → api.js（网络原语）→ collectors/base → collectors/* → repos/* → exporters/* → packagers/* → tasks/* → content.js`

### 2.3 数据流（改造后）

```
采集层 collectors ──原始数据──▶ 仓库层 repos（convert 标准化 + writer 持久化 + incremental 增量）
                                   │
                                   ▼
               导出层 exporters（按 exportType 分发 HTML/MD/JSON/SPA，复制资源清单）
                                   │
                                   ▼
                任务层 tasks（orchestrator 编排、state 检查点、progress 上报）
                                   │
                                   ▼
       打包层 packagers（zip + manifest + checksum + report + 下载链接）
                                   │
                   background.js（浏览器下载执行 / 消息中枢）
```

## 三、代码映射表（现有函数 → 目标层）

| 现有代码 | 迁移目标 |
|---|---|
| `QZoneOperator.next` 状态机（content.js:1013-1197） | `tasks/orchestrator.js` |
| `exportState` / `checkExportState` / `pauseExport` / `resumeExport` / `cancelExport`（content.js:1553-1656） | `tasks/state.js` |
| `StatusIndicator`（content.js:659-927） | `tasks/progress.js` |
| `DownloadTask/ThunderTask/ThunderInfo/BrowserTask/PageInfo`（content.js:7-170）+ `downloadAllFiles/newDownloadTask/addDownloadTasks`（content.js:1775-1895） | `tasks/downloader.js` |
| `getList/getAllList/getAllFullContent/getItemsAllCommentList/getAllLikeList/getDeletedMessages`（modules/messages.js:66-868）+ 各模块同名方法 | `collectors/messages.js` 等 |
| `API.Utils.get/post/send/toJson`（api.js:506/621/546/1238）+ `REST_URLS` | 采集层 `collectors/base.js`（网络原语，或保留在 api.js 由 collectors 调用） |
| `convert()`（messages.js:1173-1227）等各模块标准化 | `repos/schema.js` + `repos/modules/*` |
| `writeJsonToJs/writeText/writeFile/createFolder/fileExists`（api.js:376/402/417/1147/866） | `repos/writer.js` |
| `initBackedUpItems/unionBackedUpItems/saveBackupItems/removeOldItems`（common.js:1162/866/884/805） | `repos/incremental.js` |
| `exportToHtml/Markdown/Json/Spa`（各模块）+ `writeHtmlofTpl/getHtmlTemplate`（common.js:340/351） | `exporters/*` |
| `exportUserToHtml/exportUserToSpa`（common.js:227/288，资源清单复制） | `exporters/resources.js` |
| `Zip.generateAsync` 打包 + `saveAs`（content.js:1271-1285） | `packagers/zip.js` |
| `writeThunderTaskToFile`（common.js:679） | `packagers/links.js` |
| `downloadsByAjax/Browser/Aria2/Thunder`（common.js:401-679） | `tasks/downloader.js` |

## 四、分层接口设计

```js
// 采集层：只返回数据，不写文件、不报进度
QZoneCollectors.Messages.getAllList()                 → Promise<items[]>      // 含翻页/重试/WAF
QZoneCollectors.Messages.getFullContent(tid)          → Promise<detail>       // 单条全文
QZoneCollectors.Common.getUserInfos()                 → Promise<userInfo>

// 仓库层：输入原始数据，输出标准数据并持久化
QZoneRepo.Messages.convert(rawItems)                  → Promise<standardItems> // 纯函数标准化
QZoneRepo.Messages.write(items)                       → Promise<void>          // 写 index/detail JS
QZoneRepo.incremental.merge(module, oldData, newData) → Promise<merged>

// 导出层：输入标准数据，渲染成目标格式
QZoneExporters.dispatch(module, exportType, items)    → Promise<void> // HTML/MD/JSON/SPA 分发
QZoneExporters.resources.copy(exportType)             → Promise<void> // ExportFiles/SpaExportFiles

// 打包层：生成交付物
QZonePackagers.zip.generate(module)                   → Promise<blob>   // JSZip + 进度回调
QZonePackagers.manifest.generate(...)                 → Promise<string> // manifest/checksum/report

// 任务层：唯一持有状态与编排
QZoneTasks.orchestrator.run(config)                   → 主入口
QZoneTasks.state.checkpoint()                         → 分页边界检查（暂停/取消挂起）
QZoneTasks.downloader.enqueue(task)                   → 提交下载任务
```

## 五、迁移步骤（6 阶段，每阶段可运行）

| 阶段 | 内容 | 验证 |
|---|---|---|
| **P0 骨架** | 新建 5 层目录 + 空命名空间 + manifest 加载顺序调整；api.js/content.js 原样保留 | 扩展正常加载，无 console 错误 |
| **P1 采集层** | 把各模块 `getAllList/getAllContent/getComments/getLikeList` 等迁到 `collectors/*`；`api.js` 保留为网络原语层（`get/post/toJson`），collectors 调用它 | 用 1 个模块（Messages）跑通采集→原导出链路，输出与改造前一致 |
| **P2 仓库层** | 迁移 `convert/writeJsonToJs/writer/incremental`；导出入口改为从 `QZoneRepo` 取标准数据 | 增量备份回归（复用上次备份），文件哈希命名不变 |
| **P3 导出层** | 迁移 `exportTo*/exportUserToSpa/writeHtmlofTpl`；各模块 `exportAllListToFiles` 改为调用 `QZoneExporters.dispatch` | 四种导出类型 + SPA 产物逐文件 diff 对比 |
| **P4 打包层** | 迁移 `Zip/saveAs/writeThunderTaskToFile` 到 `packagers/*`，新增 manifest/checksum/report | 打包 ZIP 内容与旧版一致 + 新增交付物 |
| **P5 任务层收口** | `QZoneOperator` → `orchestrator`；`content.js` 瘦身为 UI + 引导；删兼容层 | 全流程回归：暂停/恢复/取消/断点/下载重试 |

**每阶段验收标准**：用「消息模块一次完整备份 + 打包」回归 + 无语法/引用错误；P3 用文件 diff 保证导出产物字节一致。

## 六、约束与风险

| 风险 | 应对 |
|---|---|
| MV3 CSP 禁 eval/new Function | 渲染继续走 `templates-compiled.js` 预编译模板，不引入运行时编译 |
| content script 全局作用域（非 ES module） | 用 `window.QZone*` 命名空间 + manifest 顺序加载，不改模块化规范 |
| Service Worker 短生命周期 | 任务状态仍走 `chrome.storage.session`；`background.js` 保持 fetch + AbortController |
| api.js 3800 行耦合度高 | 网络原语（get/post/FS）**保留在 api.js** 作为最底层，五层都只依赖它，避免 P0 阶段伤筋动骨 |
| 11 个模块结构不一（Photos 双级、Blogs 整页抓取、Visitors 特殊） | collectors/repos 各自适配，公共模式抽 `base.js` 基类，不强求统一 |
| 改造期间功能回归 | 每阶段用真实备份做 diff 验证；P3 前导出产物必须字节一致 |
