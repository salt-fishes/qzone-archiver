# qzone-archiver 桌面化改造执行计划

> 依据：`docs/superpowers/specs/2026-08-06-desktop-app-design.md`（已评审通过）
> 状态：计划（待确认） · 日期：2026-08-06 · 基准：扩展端 v3.3.0（冻结）

## 0. 计划前置说明

- 方案评审已确认：总体可行，按设计文档执行；本计划补充修正体量预估、命名空间、依赖链与新增风险（见 §6）。
- 扩展端 `src/js`、`background.js`、`content.js`、全部页面与 `manifest.json` **冻结 v3.3.0 不回写**，作为每一步产物 diff 基准。
- 一切改动落在 `desktop/` 目录。

## 0.5 执行进度

| 里程碑 | 状态 | 说明 |
|---|---|---|
| M0 基线准备 | ✅ | desktop/ 骨架 + sync-baseline 快照 v3.3.0（dbd8329） |
| M1.P0 引擎骨架 | ✅ | 五层目录 + adapters/runner；引擎 18 脚本注入 qzone 页无 console 错误 |
| M2a 桌面壳（工程侧） | ✅ | 主进程/窗口/IPC 契约全量/preload 双桥/引擎注入/登录检测（c01cdb0） |
| M1.P1 平台适配层 | ✅ | QZonePlatform 全接口经 IPC；引擎内 chrome.*/Filer/JSZip/saveAs 收敛完成；资源改经 IPC 读取 |
| M2a 验收 | ✅ | 扫码登录 + Messages 单模块备份跑通（数据 + 媒体落盘），2026-08-06 用户确认 |
| M1.P2 采集层 | ⏳ | 从 modules/* 抽取 getAllList 等至 collectors/*；api.js 保留网络原语 |
| M2b 下载打包断点 | ⏳ | 流式下载（Readable.fromWeb 背压）+ .part 断点 + archiver 打包 |

## 1. 依赖链与执行策略

```
M0 基线快照（一次性）
   │
   ├─▶ M1.P0 引擎骨架（五层空命名空间 + 适配器占位）
   │        │
   │        ▼
   │   M1.P1 平台适配层（QZonePlatform 收敛）──────────────┐
   │        │                                              │
   │        ▼                                              ▼
   │   M1.P2 采集层        ◀────────────   M2a 桌面壳+登录（依赖 P0+P1 联调）
   │        ▼
   │   M1.P3 仓库层        ◀────────────   M2b 下载+打包+断点（依赖 P1 的 download/zip 契约）
   │        ▼
   │   M1.P4 导出层        ◀────────────   M2c 主界面（依赖 P1 契约 + M2b 进度/日志事件）
   │        ▼
   │   M1.P5 打包层        ◀────────────   M2d 打包发布（依赖 M2c + M1.P5 产物）
   │        ▼
   │   M1.P6 任务层收口
   ▼
全流程回归（M1 产物 + M2 闭环）
```

**并行策略（修正方案 §4"并行"表述）：**

- 真正可并行：`M0/M1.P0` 与 `M2a` 壳部分（窗口/IPC/preload，不依赖引擎）可同时动工。
- 关键路径：**M0 → P0 → P1 → M2a 联调**（登录 + 单模块采集跑通），此链上的 P1 是全局解锁项，优先投入。
- P1 完成后，`M1.P2–P6` 与 `M2b–M2d` 按上图依赖滚动推进。

## 2. M0 准备（一次性）

| 任务 | 产出 | 验证 |
|---|---|---|
| 提交当前 `docs/`（方案文档）为基线 commit | git 基线 | `git status` 干净 |
| 核查环境（Node ≥ 18 / npm 可用） | — | `node -v` |
| 新建 `desktop/` 骨架：`package.json`（electron + electron-builder + vue3 + pinia + vite，版本与 `src/spa` 对齐）、`electron-builder.yml`、`README.md`、`.gitignore` 补充 | 目录骨架 | `npm install` 成功 |
| 编写 `desktop/scripts/sync-baseline.mjs`：快照 `src/js`（剔除页面脚本 options/popup/tools）+ `src/templates` + `src/export` → `desktop/src/engine/`，生成 `baseline-manifest.json`（源→目标+版本 v3.3.0） | 引擎基线快照 | `desktop/src/engine` 与 `src/js` 逐文件字节 diff 一致（排除页面脚本） |
| 快照内适配性微调：替换扩展专用资源引用为 `QZonePlatform` 可映射形态（`chrome.runtime.getURL` 等登记到 adapters 映射表） | adapters 映射表 | 见 P1 |

## 3. M1 引擎五层重构（desktop/src/engine/，P0–P6）

> 每阶段可运行；产物对照扩展端 v3.3.0（保留可运行作为 diff 基准）。命名空间统一 `window.QZoneCollectors / QZoneTasks / QZoneRepo / QZoneExporters / QZonePackagers / QZonePlatform`。

### P0 骨架
- 建五层目录 + `desktop-adapters.js` / `desktop-runner.js` 空命名空间占位
- 引擎脚本注入 qzone 页面（临时 debug 窗口）加载顺序：adapters → api/config/utils/templates-compiled → 五层 → runner
- **验证**：注入无 console 错误；`window.QZone*` 命名空间可见

### P1 平台适配层（全局解锁项，优先）
- `desktop-adapters.js` 实现 `QZonePlatform.{storage, fs, zip, download, notify}`，全部经 IPC → 主进程（storage→config-store/state-store；fs→批量合并写；download→DownloadManager 队列；notify→engineBridge 推送）
- 引擎侧所有 `chrome.*` / `Filer` / `JSZip` / `saveAs` 调用改为 `QZonePlatform`；api.js 网络原语（fetch/g_tk）与 REST_URLS 原样保留
- **验证**：`desktop/src/engine/` grep 无 `chrome.` / `Filer` / `JSZip` / `saveAs`；单模块（Messages）采集→导出，产物与扩展端 v3.3.0 一致

### P2 采集层
- `collectors/base.js`（分页/重试/WAF 检测/限速，迁自 api.js 网络层 + 各模块采集循环）+ 各模块 `collectors/*.js`（messages/blogs/diaries/photos/videos/boards/favorites/shares/friends/visitors/common）+ `index.js` 注册表
- 采集循环中剥离 `checkExportState` / 进度上报（迁 P3/P6）
- **验证**：Messages 单模块采集→导出一致；任务层接管检查点后暂停/取消在分页边界生效

### P3 仓库层
- `repos/schema.js`（convert 标准化）+ `writer.js`（writeJsonToJs/writeText）+ `incremental.js`（init/union/save/remove BackedUpItems）+ `modules/*`
- 导出入口改从 `QZoneRepo` 取标准数据
- **验证**：增量备份回归（复用上次备份目录），URL 哈希文件名不变

### P4 导出层
- `exporters/{html,markdown,json,spa,resources}.js`：`writeHtmlofTpl` + 预编译模板、四类导出、`ExportFiles/SpaExportFiles` 资源复制、exportType 分发
- **验证**：四类导出 + SPA 产物逐文件 diff（对照扩展端）

### P5 打包层
- `packagers/manifest.js`（manifest/checksum/report）+ `links.js`（writeThunderTaskToFile）；**zip 不进引擎**，由主进程 archiver 承担
- **验证**：ZIP 产物与扩展端一致 + 新增 manifest/checksum/report

### P6 任务层收口
- `tasks/orchestrator.js`（迁自 QZoneOperator.next）、`state.js`（exportState/检查点）、`progress.js`（StatusIndicator→notify）、`downloader.js`（DownloadTask/BrowserTask/ThunderTask/downloadAllFiles）
- `desktop-runner.js` 只留 `__engineCommands` 薄壳
- **验证**：全流程回归：暂停/恢复/取消/断点/下载重试

## 4. M2 桌面壳（desktop/，M2a–M2d）

### M2a 壳 + 登录（壳部分与 M0/P0 并行）
- 主进程：`index.js`（single-instance/窗口/IPC 注册）、`windows.js`（主窗口/引擎窗口/viewer 窗口）
- IPC：`ipc/{app,auth,config,backup,download,fs,zip,viewer}.js` 按 §3.2 契约；`services/engine-bridge.js` 注入调度 + `engineReady` 握手
- preload：`ui-bridge.js`（window.api 白名单）+ `engine-bridge.js`（最小桥）
- 引擎窗口：`persist:qzone` partition，加载 user.qzone.qq.com，扫码/密码登录；`p_skey` + USER_OVERVIEW 探测登录态
- **验证**：扫码登录 → P1 联调 → Messages 单模块采集跑通，产物落盘正确

### M2b 下载 + 打包 + 断点
- `services/download-manager.js`：net.fetch 流式（Readable.fromWeb → writeStream 背压）、`.part` 断点续传、Range 头、自设 Referer/UA、已存在跳过（Content-Length 一致）、fs.statfs 磁盘预检、空闲 60s 超时、并发 10 + 大文件限流、≥500ms/≥1% 节流；兜底 `will-download`
- `services/packager.js`：archiver zip + 进度；`services/state-store.js`：checkpoints/{taskId}.json + downloads.json
- **验证**：大文件流式不卡、失败可续、重启后 `backup:get-state`/`download:get-state` 续传

### M2c 主界面
- Vue 3 渲染器：`views/{Home,Backup,Tasks,Downloads,Archives,Settings}` + `stores/{auth,backup,download,config}` + `components/*` + `styles/`（复用 spa tokens.scss + 扩展端 theme.css 复古暖色）
- 历史备份：目录扫描 + viewer 窗口 file:// 打开备份产物 index.html（IIFE 单文件已兼容）
- **验证**：完整备份 → 打包 → 内置浏览闭环可用

### M2d 打包发布 + 文档
- electron-builder：NSIS 安装包 + portable（Windows 首发）；版本管理
- README：Mac 用户引导使用扩展版；发布 zip 打包排除项规则沿用
- **验证**：NSIS/portable 安装运行；文档就绪

## 5. 里程碑验收汇总

| 里程碑 | 验收标准 |
|---|---|
| M1 | 引擎注入跑通；单模块产物与扩展端 v3.3.0 一致；git 无扩展文件变更 |
| M2a | 扫码登录 + Messages 采集跑通，产物落盘正确 |
| M2b | 大文件流式不卡、失败可续、重启后续传 |
| M2c | 完整备份 → 打包 → 浏览闭环可用 |
| M2d | NSIS/portable 安装运行；Mac 引导文档就绪 |

## 6. 风险登记（方案 §5 基础上新增/修正）

| 风险 | 应对 |
|---|---|
| api.js 实际 5141 行，P1/P2 收敛量高于方案预估 | P1 优先投入、分模块切片推进，每切片保持可运行 |
| 引擎注入点随 qzone 页面结构变动失效 | `engineReady` 握手 + 注入失败重试 + 页面结构变化冒烟测试 |
| 渲染器构建方式未定义 | vite build → `loadFile` 加载；CSP 放宽但禁远程资源与 unsafe-eval |
| 主进程下载防盗链 | net.fetch 自设 Referer/UA（对应扩展 DNR 职责） |
| Electron 内 QQ 登录风控 | 扫码主路径 + 密码辅助；UA 贴近常规 Chrome；会话过期上报引导重登 |
| 扩展端冻结后 Bug 需人工同步 | baseline-manifest 记录版本；修复按需单向同步 + 冒烟；QZonePlatform 契约稳定预留同构 |
| 大批量小文件 IPC 写盘慢 | `QZonePlatform.fs` 批量合并写（缓冲 + 批量 flush） |

## 7. 首步执行建议

1. 确认本计划后，先落地 **M0**（提交 docs 基线 + desktop/ 骨架 + sync-baseline.mjs + 快照）。
2. M0 完成后进入 **M1.P0 + M2a 壳并行**，随即 **M1.P1** 解锁全局链路。
