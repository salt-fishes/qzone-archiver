# qzone-archiver

> QQ 空间本地化备份与档案浏览工具。提供 **Windows 桌面版（Electron）** 与 **Chrome 扩展（Manifest V3）** 两种形态，均基于 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) 二次开发。**v4.0.0** 起新增桌面版，内嵌登录 → 采集 → 打包 → 内置 SPA 浏览一体化闭环。

## 简介

**qzone-archiver** 可将 QQ 空间中的说说、日志、日记、相册、视频、留言、好友、收藏、分享、访客共 **10 类内容**一键备份到本地。备份产物为「传统离线 HTML + 新一代 **SPA 档案浏览器**」双形态：解压后双击 `index.html` 即可离线浏览，支持按年份归档、全文搜索、虚拟滚动、图片 / 视频画廊、年度档案报告等现代化体验。

- 项目地址：https://github.com/salt-fishes/qzone-archiver
- 原项目：[ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport)（Apache-2.0）

## 版本一览

| 形态 | 平台 | 版本 | 获取方式 |
| --- | --- | --- | --- |
| **桌面版**（推荐） | Windows 10+（x64） | v4.0.0 | 安装版 `QZoneArchiver-4.0.0-setup.exe` / 免安装版 `QZoneArchiver-4.0.0-portable.exe`（解压即用） |
| **扩展版** | Chrome / Edge（含 macOS） | v4.0.0 | 加载仓库 `src/` 目录，或 GitHub Release 压缩包 |

> 桌面版集成了完整的备份流程，无需额外安装浏览器扩展；扩展版适合在浏览器内随用随装，或在 macOS 上使用。

## 主要特性

### 通用能力

- **全模块备份**：说说 / 日志 / 日记 / 相册 / 视频 / 留言 / 收藏 / 分享 / 好友 / 访客
- **多种备份类型**：`SPA`（默认，推荐） / `HTML` / `MarkDown` / `JSON`，可按模块独立选择
- **已删除说说恢复**：通过好友互动通知接口逆向恢复已删除说说（仅限有互动记录的内容）
- **断点续传**：导出过程支持暂停 / 恢复 / 取消，检查点覆盖采集与下载各阶段
- **增量备份**：基于最后备份时间 / 自定义时间增量拉取新内容，文件按 URL 哈希命名实现跨会话复用
- **多媒体下载方式**：浏览器直接下载（默认）/ Ajax / Aria2(RPC) / 迅雷（唤醒 / 剪贴板 / 链接清单）
- **资源全本地化**：所有页面依赖均来自本地 `vendor/`，无远程 CDN，断网可查看
- **模板预编译**：art-template 预编译为 `templates-compiled.js`，符合 MV3 CSP（禁 `eval` / `new Function`）

### 桌面版（v4.0.0 新增）

- **一体化流程**：内嵌 QQ 空间登录（扫码 / 验证码）→ 采集 → 打包 → 内置 SPA 浏览，全程无浏览器依赖
- **双安装包发布**：`setup.exe` 安装版（可选安装目录、桌面快捷方式）+ `portable.exe` 免安装版（单文件自解压，解压即用）
- **Vue 3 + Pinia 主界面**：首页 / 备份 / 设置 / 档案浏览四视图，配置记忆、登录态自动检测、备份进度与日志面板
- **引擎五层重构**：采集层 / 导出层 / 仓库层 / 打包层 / 任务层 分层解耦，与扩展端行为逐字节一致，独立演进
- **内置备份产物浏览**：备份完成后直接打开 SPA 档案浏览器窗口查看

### SPA 档案浏览器（Vue 3 + Pinia）

- `file://` 协议直接打开，无需 Web 服务器
- 按年份 / 分组 / 相册分片加载，首屏只加载索引
- 虚拟滚动列表（vue-virtual-scroller）支撑万级数据流畅浏览
- FlexSearch 全文搜索
- 原生图片 / 视频就地预览（键盘 ←/→/Esc 切换）
- 复古档案馆风格 UI（纸张纹理 + 暖色设计系统）
- anime.js 全链路动效：路由 / 章节 / 列表 / 卡片 / 模态 / 年报入场动画，数字滚动、柱状图生长、hover 弹性反馈（尊重系统「减少动态效果」）
- 相册列表多照片预览网格，说说 / 分享 / 收藏列表大尺寸缩略图
- 年度档案报告：全屏独立路由，巨型排版逐字揭示 + 粒子背景，一键导出 PNG 长图

## 快速开始

### 桌面版（Windows）

1. 从 [GitHub Releases](https://github.com/salt-fishes/qzone-archiver/releases) 下载 v4.0.0 安装包：
   - **安装版**：`QZoneArchiver-4.0.0-setup.exe`，双击按向导安装（可自定义安装目录）
   - **免安装版**：`QZoneArchiver-4.0.0-portable.exe`，下载后直接双击运行，无需安装
2. 首次启动进入「首页」，点击「登录」打开内嵌 QQ 空间页面，扫码 / 验证码登录
3. 切换到「备份」页，勾选要备份的模块与备份类型，选择保存目录后开始备份
4. 采集与下载完成后，可在「档案浏览」或备份目录中打开 SPA 档案浏览器查看

> 请仅从官方渠道（GitHub 仓库 / 官方网盘）下载，其它第三方地址存在安全风险。

### 扩展版（Chrome / Edge）

1. 从 [GitHub Releases](https://github.com/salt-fishes/qzone-archiver/releases) 下载压缩包并解压（或直接克隆仓库）
2. 打开 `chrome://extensions/`，开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `src/` 目录
4. 登录并访问需要备份的 QQ 空间（`user.qzone.qq.com/{QQ号}`）
5. 点击扩展图标，选择「个人模式 / 他人模式」，勾选模块后点击「开始备份」
6. 采集完成后点击「打包下载」获取文案内容压缩包；多媒体文件由下载工具（浏览器 / Aria2 / 迅雷）获取
7. 浏览备份：SPA 模式解压后双击根目录 `index.html` 自动跳转；HTML 模式直接打开根目录 `index.html`

## 目录结构

```
qzone-archiver/
├── src/                          # Chrome 扩展源码（加载此目录为扩展）
│   ├── manifest.json             # MV3 清单
│   ├── html/                     # 扩展页面（options / popup / about / docs / faq / privacy / usage / tools / indicator）
│   ├── css/                      # theme.css（复古暖色设计系统）+ content / options / popup
│   ├── js/                       # 扩展逻辑（background / content / api / config / templates-compiled / modules/）
│   ├── templates/                # art-template 模板（17 个，离线 HTML 导出）
│   ├── export/                   # 离线导出资源（css / images / js / maps / spa-dist）
│   ├── spa/                      # SPA 档案浏览器源码（Vue 3 + Pinia，构建到 export/spa-dist/）
│   ├── img/                      # 图标 + 表情包 + 网盘渠道图标
│   └── vendor/                   # 本地第三方库（无 CDN 依赖）
├── desktop/                      # Windows 桌面版（Electron）
│   ├── package.json              # electron + electron-builder + vue3 + pinia
│   ├── electron-builder.yml      # NSIS 安装版 + portable 免安装版打包配置
│   ├── scripts/                  # 引擎基线快照 / 模板重编译脚本
│   └── src/
│       ├── main/                 # 主进程（窗口 / IPC / 下载 / 打包 / 状态持久化）
│       ├── preload/              # ui-bridge（window.api）+ engine-bridge（引擎最小桥）
│       ├── renderer/             # Vue 3 主界面（构建产物 dist/）
│       └── engine/               # 引擎五层（采集 / 导出 / 仓库 / 打包 / 任务）
├── CODE_WIKI.md                  # 代码结构 Wiki
└── LICENSE
```

## 开发指南

### 环境要求

- Node.js 18+
- 桌面版：Windows 10+（x64）
- 扩展版：Chrome 100+

### 桌面版开发

```bash
cd desktop
npm install

# 首次：快照扩展端引擎基线（只读，仅需要时执行）
npm run sync:baseline

# 构建渲染器并启动
npm run start:dev
```

### 扩展版 SPA 开发

```bash
cd src/spa
npm install
npm run dev       # 开发服务器 http://localhost:5175
npm run build     # 构建到 src/export/spa-dist/
```

构建产物（`index.html` / `assets/index.js` / `assets/style.css`）为单 IIFE bundle，兼容 `file://` 直开。

### 模板预编译

修改 `src/templates/` 下模板后需同步更新 `src/js/templates-compiled.js`（MV3 CSP 禁止运行时 `new Function` / `eval` 编译）：

```bash
cd desktop && npm run sync:templates   # 或按 scripts/recompile-templates.mjs 手动执行
```

## 发布

### 桌面版

```bash
cd desktop
npm run dist:win   # 构建渲染器 + electron-builder，产出在 desktop/release/
```

产物：

- `QZoneArchiver-{version}-setup.exe`（NSIS 安装版）
- `QZoneArchiver-{version}-portable.exe`（免安装版，解压即用）

### 扩展版

1. 在 `src/spa` 下执行 `npm run build` 生成最新 SPA 产物
2. 将 `src/` 目录打包为 zip（排除 `node_modules` / 测试数据）
3. 打 tag 并创建 GitHub Release（参考 [v4.0.0](https://github.com/salt-fishes/qzone-archiver/releases/tag/v4.0.0)）

## 更新日志

### v4.5.0（2026-09-02）

- **桌面版架构改造收官（P0~P6 七阶段）**：引擎五层（采集 / 任务 / 仓库 / 导出 / 打包）与主进程 / 渲染层职责彻底分离，api.js 由约 3800 行瘦身为装配器，content.js / background.js 退役归档
- **稳定性修复**：备份取消后立即重新备份，媒体下载不再静默排队（下载暂停位绑定任务，任务切换自动失效）；主进程任务状态机成为唯一事实源，暂停 / 恢复 / 取消语义全面修正
- **安全加固**：引擎窗口主世界移除全部桥能力，IPC 全通道来源校验；路径守卫收敛（防目录穿越）；窗口外链协议白名单，弹窗不再继承引擎窗口能力
- **配置单一来源**：`config-spec.json` 生成 UI 表单与引擎默认值，双端永不手抄漂移（修正好友模块增量控件无效、相册默认下载行为不一致等 4 处真实配置漂移）
- **增量备份产物自持**：增量元数据随备份产物保存，产物目录拷贝到其他位置也能继续增量备份
- **可观测性**：运行日志分级落盘（`logs/main.log`，10MB×3 自动轮转），QQ 页面噪音日志降噪丢弃
- **工程质量**：渲染层真 Pinia 化、App.vue 纯壳化；140 项单元测试 + CI 五道门禁（typecheck / lint / 测试 / 构建 / 配置一致性）；发布冒烟清单制度化
- **扩展版**：同步升级版本号至 v4.5.0，功能延续 v4.0.0（SPA 构建产物刷新）

### v4.0.0（2026-08-12）

- **新增 Windows 桌面版（Electron）**：内嵌 QQ 空间登录（扫码 / 验证码）→ 采集 → 打包 → 内置 SPA 浏览一体化闭环，无需浏览器扩展
- **桌面版双安装包**：`setup.exe` 安装版 + `portable.exe` 免安装版（解压即用），扩展版同步升级至 v4.0.0
- **引擎五层重构**：采集层 / 导出层 / 仓库层 / 打包层 / 任务层 分层解耦，42 个采集函数与 43 个导出函数迁移完成，与扩展端行为逐字节一致
- **桌面版主界面**：Vue 3 + Pinia 四视图（首页 / 备份 / 设置 / 档案浏览），配置记忆、登录态自动检测、备份进度与日志面板
- **全量备份修复**：对齐扩展 INIT 阶段初始化（Data / OLD_Data），修复日记 / 留言 / 收藏 / 访客读 `.items` 崩溃；相册未勾选时按全部相册备份，避免误判跳过
- **备份产物浏览**：备份完成后内置窗口直接打开 SPA 档案浏览器

### v3.3.0（2026-08-04）

- **年报互动高光修正**：评论数不再被列表接口截断（此前评论多的说说显示为 10 条），改取真实评论总数，SPA 端自动用全量数据修正旧备份
- **年报全档案修正**：照片模块改按「照片总数」统计（此前只算相册个数），档案总数恢复正确量级
- **视频列表网格化**：视频页改为网格铺开（仿相册内部分批渲染），卡片更小更密集，滚动到底自动加载更多
- **H.265 视频播放引导**：浏览器无法解码 H.265（HEVC）视频时，提示可将视频发送到微信 / QQ，或用 VLC 等主流播放软件打开，并附文件路径

### v3.2.0（2026-08-04）

- **年度报告全面重做**：全屏独立路由，anime.js v4 巨型排版逐字揭示 + three.js 粒子背景，仿 wodniack.dev 宣传站风格
- **报告内容扩充**：扩展至 18 个章节，接入访客 / 收藏 / 分享 / 视频 / 日志 / 日记 / 留言数据，新增数字档案网格、好友分布、人物志、特别日子等可视化组件
- **报告导出长图**：一键导出 PNG 长图（分段截图 + 导出前自动滚动触发全部动画，数字准确无误）
- **移动端导航重构**：左侧图标导航 + 抽屉侧栏，与 PC 端一致；顶部导航宽度压缩 50% 以上
- **好友头像**：好友列表与详情显示 QQ 头像（本地 / 在线 / 占位三级降级）
- **评论匿名修复**：兼容评论列表接口的 poster 嵌套作者结构，评论较多的说说不再显示匿名
- **音乐播放**：报告页改用网易云 iframe 播放器，移除本地音频文件
- **已删除说说恢复优化**：降低边界探测上限防 WAF 拦截、增加 WAF 检测与请求间隔、修复 g_tk 序列化

### v3.1.0（2026-08-03）

- **SPA 全链路动画**（anime.js v3）：路由过渡、章节标题、侧边栏、首页、虚拟列表、模态、评论 / 点赞、年度档案的入场与交互动效；数字滚动、柱状图生长、hover 弹性反馈；尊重系统「减少动态效果」设置
- **相册列表多照片预览**：卡片展示前 4 张照片网格，修复封面拉伸；视频封面统一 16:9 比例
- **列表缩略图放大**：说说 / 分享 / 收藏缩略图由 56px 提升至 96px

### v3.0.0（2026-08-01）

- MV3 重构版首发：SPA 档案浏览器、已删除说说恢复、复古暖色设计系统、暂停 / 恢复 / 取消断点续传

## 未来升级方向（Roadmap）

以下为规划中的升级方向，按优先级排列，尚未实施：

### 近期（P0）

- **SPA「那年今日」**：新增 `/today` 视图，按"今天"日期筛出历年同一天的说说 / 留言 / 分享记录，数据已在现有索引中，纯前端实现
- **下载失败自动重试**：`downloadsByBrowser` / `downloadByAria2` 增加按模块配置的 `retryCount`，失败项自动重试（带退避），降低备份遗漏
- **Aria2 任务状态回查**：任务添加完成后通过 RPC `tellStatus` 批量查询，日志汇总"成功 X / 失败 Y / 等待 Z"，替代仅报"已添加 N 条"

### 中期（P1）

- **安全模式**：为方便将备份部署到服务器，提供"安全模式"开关——开启后采集阶段**不获取评论 / 点赞 / 访客 / 好友等他人互动数据**，备份仅包含自己的内容（最彻底的脱敏口径）
- **SPA 足迹地图**：将 HTML 版 ECharts 足迹地图迁移接入 SPA
- **桌面版 macOS / Linux 支持**：Electron 跨平台基础已具备，按需适配打包目标

### 长期（P2）

- **SPA 编辑与再导出**：浏览 → 导出 Markdown / JSON
- **跨会话断点续传**：将检查点持久化到 `chrome.storage.local`，关闭浏览器后可从断点继续备份
- **备份加密与完整性校验**：可选 AES 压缩密码、导出文件哈希校验
- **大数据量性能优化**：10 万+ 记录下的虚拟滚动、FlexSearch 索引内存与 Web Worker
- **更多下载工具支持**：如 IDM（需支持目录结构）
- **剔除扩展端 jQuery / Bootstrap 依赖**：将 options / popup / tools 等页面迁移到原生 JS + CSS（或轻量替代），减小 vendor 体积、降低加载与维护成本

## 致谢

- 原项目：[ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) —— Apache-2.0，感谢原作者 ShunCai
- 桌面框架：Electron、electron-builder
- 前端框架：Vue 3、Pinia、vue-router
- 虚拟滚动：vue-virtual-scroller
- 图片画廊：LightGallery
- 全文搜索：FlexSearch
- 模板引擎：art-template
- 动效：anime.js、three.js

## License

Apache-2.0（继承自原项目）
