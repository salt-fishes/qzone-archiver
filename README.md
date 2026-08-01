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
  - LightGallery 图片 / 视频画廊预览
  - 复古档案馆风格 UI（纸张纹理 + 暖色设计系统）
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
3. 打 tag 并创建 GitHub Release（参考 [v3.0.0](https://github.com/salt-fishes/qzone-archiver/releases/tag/v3.0.0)）

## 致谢

- 原项目：[ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) —— Apache-2.0，感谢原作者 ShunCai
- SPA 框架：Vue 3、Pinia、vue-router
- 虚拟滚动：vue-virtual-scroller
- 图片画廊：LightGallery
- 全文搜索：FlexSearch
- 模板引擎：art-template

## License

Apache-2.0（继承自原项目）
