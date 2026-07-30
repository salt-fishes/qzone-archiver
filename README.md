# ZoneExport

> QQ 空间本地化备份与档案浏览工具，基于 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) 二次开发，新增 SPA 单页应用档案浏览器。

## 项目简介

ZoneExport 是一个 Chrome 扩展（Manifest V3），用于将 QQ 空间内容（说说、日志、日记、相册、视频、留言、收藏、分享、好友、访客）备份到本地，并配套一个独立的 SPA 单页应用，以"档案馆"风格离线浏览备份数据。

### 主要特性

- **Chrome MV3 扩展**：兼容最新 Manifest V3 规范，支持 Chrome 100+
- **全模块备份**：说说 / 日志 / 日记 / 相册 / 视频 / 留言 / 收藏 / 分享 / 好友 / 访客 共 10 个模块
- **SPA 档案浏览器**：Vue 3 + Pinia 构建的单页应用，以复古档案馆风格离线浏览备份数据
  - 虚拟滚动列表（vue-virtual-scroller）支撑大数据量流畅浏览
  - 按年份 / 分组 / 相册分片加载，首屏只加载索引
  - FlexSearch 全文搜索（说说模块）
  - LightGallery 图片/视频画廊预览
  - 已删除说说恢复（通过好友互动通知逆向恢复）
  - file:// 协议直接打开，无需 Web 服务器
- **下载方式**：支持浏览器直接下载、迅雷链接（生成 .txt 任务清单）、Aria2 RPC
- **断点续传**：导出过程支持暂停 / 恢复 / 取消，状态持久化至 chrome.storage.session
- **文件复用**：下载文件名采用 URL 哈希，跨备份会话复用已下载文件

## 目录结构

```
zoneexport/
├── src/                        # Chrome 扩展源码
│   ├── manifest.json           # MV3 清单
│   ├── html/                   # 扩展页面（options/popup/about/docs/faq 等）
│   ├── js/                     # 扩展逻辑
│   │   ├── modules/            # 各模块备份逻辑（含 exportToSpa）
│   │   ├── api.js              # QQ 空间 API 封装
│   │   ├── background.js       # Service Worker
│   │   ├── content.js          # 内容脚本
│   │   └── config.js           # 配置
│   ├── css/                    # 扩展样式
│   ├── img/                    # 表情包等图片资源
│   ├── templates/              # art-template 模板
│   ├── vendor/                 # 本地第三方库（无 CDN 依赖）
│   └── export/                 # 备份导出页面（HTML+JS）
│       └── spa-dist/           # SPA 构建产物（gitignore）
├── src/spa/                    # SPA 单页应用源码
│   ├── src/
│   │   ├── views/              # 10 个模块视图
│   │   ├── components/         # 卡片/详情/布局/通用组件
│   │   ├── stores/             # Pinia 状态管理（11 个 store）
│   │   ├── api/                # 数据加载层
│   │   ├── styles/             # 复古档案馆主题
│   │   └── types.ts            # TypeScript 类型定义
│   ├── public/                 # 测试数据（gitignore，本地放入）
│   ├── vite.config.ts
│   └── package.json
├── tools/                      # 构建辅助脚本
│   ├── precompile-templates.js # 预编译 art-template（规避 MV3 CSP）
│   └── download-vendor.js      # 下载第三方库到 vendor/
├── CODE_WIKI.md                # 代码结构 Wiki
└── SPA_IMPLEMENTATION_PLAN.md  # SPA 实现规划
```

## 开发指南

### 环境要求

- Node.js 18+
- Chrome 100+

### SPA 开发

```bash
cd src/spa
npm install
npm run dev      # 启动 Vite dev server
npm run build    # 构建到 src/export/spa-dist/
```

构建后将 `src/export/spa-dist/` 同步到备份目录的 `Common/spa/` 即可使用。

### 扩展加载

1. 打开 `chrome://extensions/`
2. 开启"开发者模式"
3. "加载已解压的扩展程序"选择 `src/` 目录

### 模板预编译

修改 `src/templates/` 下模板后需重新预编译（MV3 CSP 禁止 `new Function`/`eval`）：

```bash
node tools/precompile-templates.js
```

## 致谢

- 原项目：[ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) —— Apache-2.0
- SPA 框架：[Vue 3](https://vuejs.org/)、[Pinia](https://pinia.vuejs.org/)
- 虚拟滚动：[vue-virtual-scroller](https://github.com/Akryum/vue-virtual-scroller)
- 图片画廊：[LightGallery](https://www.lightgalleryjs.com/)
- 全文搜索：[FlexSearch](https://github.com/nextapps-de/flexsearch)

## License

Apache-2.0（继承自原项目）
