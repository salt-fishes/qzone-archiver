# qzone-archiver

> QQ 空间本地化备份与档案浏览工具。基于 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) 二次开发，升级至 Manifest V3，并新增 SPA 单页档案浏览器。

## 简介

**qzone-archiver** 是一款 Chrome 扩展（Manifest V3），用于将 QQ 空间中的说说、日志、日记、相册、视频、留言、好友、收藏、分享、访客共 10 类内容一键备份到本地。备份结果既包含传统离线 HTML 页面，也支持新一代 **SPA 档案浏览器**——解压后双击 `index.html` 即可离线浏览，支持按年份归档、全文搜索、虚拟滚动、图片 / 视频画廊等现代化体验。

- 项目地址：https://github.com/salt-fishes/qzone-archiver
- 原项目：[ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport)（Apache-2.0）

## 主要特性

- **Manifest V3 扩展**：兼容最新 Chrome / Edge 等 Chromium 内核浏览器
- **全模块备份**：说说 / 日志 / 日记 / 相册 / 视频 / 留言 / 收藏 / 分享 / 好友 / 访客
- **多种备份类型**：`SPA`（默认，推荐） / `HTML` / `MarkDown` / `JSON`，可按模块独立选择
- **SPA 档案浏览器**（Vue 3 + Pinia）
  - `file://` 协议直接打开，无需 Web 服务器
  - 按年份 / 分组 / 相册分片加载，首屏只加载索引
  - 虚拟滚动列表（vue-virtual-scroller）支撑万级数据流畅浏览
  - FlexSearch 全文搜索
  - 原生图片 / 视频就地预览（键盘 ←/→/Esc 切换）
  - 复古档案馆风格 UI（纸张纹理 + 暖色设计系统）
  - anime.js 全链路动效：路由/章节/列表/卡片/模态/年报入场动画，数字滚动、柱状图生长、hover 弹性反馈（尊重系统「减少动态效果」）
  - 相册列表多照片预览网格，说说/分享/收藏列表大尺寸缩略图
- **已删除说说恢复**：通过好友互动通知接口逆向恢复已删除说说（仅限有互动记录的内容）
- **多媒体下载方式**：浏览器直接下载（默认）/ Ajax / Aria2(RPC) / 迅雷（唤醒 / 剪贴板 / 链接清单）
- **断点续传**：导出过程支持暂停 / 恢复 / 取消，状态持久化至 `chrome.storage.session`，检查点覆盖采集与下载各阶段
- **增量备份**：基于最后备份时间 / 自定义时间增量拉取新内容，文件按 URL 哈希命名实现跨会话复用
- **资源全本地化**：所有扩展页面与导出页面依赖均来自本地 `vendor/`，无远程 CDN，断网可查看
- **模板预编译**：art-template 预编译为 `templates-compiled.js`，符合 MV3 CSP（禁 `eval` / `new Function`）

## 目录结构

```
qzone-archiver/
├── src/                          # Chrome 扩展源码（加载此目录为扩展）
│   ├── manifest.json             # MV3 清单
│   ├── html/                     # 扩展页面（options / popup / about / docs / faq / privacy / usage / tools / indicator）
│   ├── css/                      # theme.css（复古暖色设计系统）+ content / options / popup
│   ├── js/                       # 扩展逻辑
│   │   ├── background.js         # Service Worker（下载调度 / 消息中枢 / DNR 规则）
│   │   ├── content.js            # 内容脚本（状态机 / 类定义 / 进度指示）
│   │   ├── api.js                # QQ 空间 REST API 封装
│   │   ├── config.js             # 默认配置 + 全局状态 + 导出资源清单
│   │   ├── templates-compiled.js # 预编译模板（规避 MV3 CSP）
│   │   └── modules/              # 各模块备份逻辑（含 exportToSpa）
│   ├── templates/                # art-template 模板（17 个，离线 HTML 导出）
│   ├── export/                   # 离线导出资源（css / images / js / maps）
│   │   └── spa-dist/             # SPA 构建产物（gitignore，`npm run build` 生成）
│   ├── spa/                      # SPA 档案浏览器源码
│   │   ├── src/                  # views / components / stores / api / styles
│   │   ├── public/               # 测试数据（gitignore）+ export-entry.html
│   │   ├── vite.config.ts        # IIFE 打包 + file:// 兼容修复
│   │   └── package.json
│   ├── img/                      # 图标 + 表情包 + 网盘渠道图标
│   └── vendor/                   # 本地第三方库（无 CDN 依赖）
├── LICENSE
├── CODE_WIKI.md                  # 代码结构 Wiki
└── SPA_IMPLEMENTATION_PLAN.md    # SPA 实施计划（历史记录）
```

## 快速开始

### 1. 安装扩展

1. 从 [GitHub Releases](https://github.com/salt-fishes/qzone-archiver/releases) 下载压缩包并解压（或直接克隆仓库）
2. 打开 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择 `src/` 目录
5. 浏览器工具栏出现「qzone-archiver」图标

> 请仅从官方渠道（GitHub 仓库 / 官方网盘）下载安装，其它第三方地址存在安全风险。

### 2. 备份

1. 登录并访问需要备份的 QQ 空间（`user.qzone.qq.com/{QQ号}`）
2. 点击扩展图标，选择「个人模式 / 他人模式」，勾选要备份的模块
3. 点击「开始备份」，弹出进度面板；采集过程支持暂停 / 恢复 / 取消
4. 采集完成后点击「打包下载」获取文案内容压缩包；多媒体文件由下载工具（浏览器 / Aria2 / 迅雷）获取
5. 合并「文案内容备份文件夹」与「多媒体文件备份文件夹」为完整备份文件夹

### 3. 浏览备份

- **SPA 模式**：解压后双击根目录 `index.html`，自动跳转到 SPA 档案浏览器
- **HTML 模式**：直接用浏览器打开根目录 `index.html` 浏览各模块页面

## 开发指南

### 环境要求

- Node.js 18+
- Chrome 100+

### SPA 开发

```bash
cd src/spa
npm install
npm run dev       # 开发服务器 http://localhost:5175
npm run build     # 构建到 src/export/spa-dist/
```

构建产物（`index.html` / `assets/index.js` / `assets/style.css`）为单 IIFE bundle，兼容 `file://` 直开；构建后由扩展端按 `SpaExportFiles` 清单复制进备份 ZIP 的 `Common/spa/`。

### 模板预编译

修改 `src/templates/` 下模板后需同步更新 `src/js/templates-compiled.js`（MV3 CSP 禁止运行时 `new Function` / `eval` 编译）。

## 发布

1. 在 `src/spa` 下执行 `npm run build` 生成最新 SPA 产物
2. 将 `src/` 目录打包为 zip（排除 `node_modules` / 测试数据）
3. 打 tag 并创建 GitHub Release（参考 [v3.2.0](https://github.com/salt-fishes/qzone-archiver/releases/tag/v3.2.0)）

## 更新日志

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

- **SPA「那年今日」**：新增 `/today` 视图，按"今天"日期筛出历年同一天的说说/留言/分享记录，数据已在现有索引中，纯前端实现
- **下载失败自动重试**：`downloadsByBrowser` / `downloadByAria2` 增加按模块配置的 `retryCount`，失败项自动重试（带退避），降低备份遗漏
- **Aria2 任务状态回查**：任务添加完成后通过 RPC `tellStatus` 批量查询，日志汇总"成功 X / 失败 Y / 等待 Z"，替代仅报"已添加 N 条"

### 中期（P1）

- **安全模式**：为方便将备份部署到服务器，提供"安全模式"开关——开启后采集阶段**不获取评论 / 点赞 / 访客 / 好友等他人互动数据**，备份仅包含自己的内容（最彻底的脱敏口径）
- **SPA 足迹地图**：将 HTML 版 ECharts 足迹地图迁移接入 SPA

### 长期（P2）

- **SPA 编辑与再导出**：浏览 → 导出 Markdown / JSON
- **跨会话断点续传**：将检查点持久化到 `chrome.storage.local`，关闭浏览器后可从断点继续备份
- **备份加密与完整性校验**：可选 AES 压缩密码、导出文件哈希校验
- **大数据量性能优化**：10 万+ 记录下的虚拟滚动、FlexSearch 索引内存与 Web Worker
- **更多下载工具支持**：如 IDM（需支持目录结构）
- **剔除扩展端 jQuery / Bootstrap 依赖**：将 options / popup / tools 等页面迁移到原生 JS + CSS（或轻量替代），减小 vendor 体积、降低加载与维护成本

## 致谢

- 原项目：[ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) —— Apache-2.0，感谢原作者 ShunCai
- SPA 框架：Vue 3、Pinia、vue-router
- 虚拟滚动：vue-virtual-scroller
- 图片画廊：LightGallery
- 全文搜索：FlexSearch
- 模板引擎：art-template

## License

Apache-2.0（继承自原项目）
