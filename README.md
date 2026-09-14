# qzone-archiver · 浏览器扩展版

> QQ 空间本地化备份工具（Chrome / Edge 扩展）：把说说、相册、日志等记忆完整保存到自己的电脑，离线随时浏览。
> 基于 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) 二次开发，遵循 Apache-2.0 协议。

**本分支（`extension`）只包含扩展版**；Windows 桌面版见 [`desktop`](https://github.com/salt-fishes/qzone-archiver/tree/desktop) 分支，双端开发主线见 `main` 分支。

> 扩展端为 v3.3.0 冻结基线（Manifest V3），当前以维护为主，新功能集中在桌面版。

## 安装

1. 从 [Releases](https://github.com/salt-fishes/qzone-archiver/releases) 下载扩展包，或直接使用本仓库 `src/` 目录
2. 打开 `chrome://extensions`，开启右上角「开发者模式」
3. 点「加载已解压的扩展程序」，选择 `src/` 目录

## 功能

- **一键备份**：说说 / 日志 / 日记 / 相册 / 视频 / 留言 / 好友 / 收藏 / 分享 / 访客，共 10 类内容
- **离线档案**：备份产物双击 `index.html` 即可浏览，支持按年归档、全文搜索、图片视频画廊
- **增量备份**：只采集上次之后的新内容，日常同步几分钟完成
- **完全本地化**：不接入任何服务器，登录凭证与数据全部留在本机

## 使用

1. 打开 QQ 空间个人主页（`user.qzone.qq.com`）并保持登录
2. 点击浏览器工具栏的扩展图标 → 开始备份
3. 在设置页选择要备份的内容、保存位置与下载方式
4. 备份完成后打开目标目录的 `index.html` 离线浏览

> 媒体文件较多时下载会持续较长时间；建议按模块分批备份，单轮媒体量控制在几百条以内更稳。

## 目录结构

```
src/
├── manifest.json       # Manifest V3 配置
├── js/                 # 采集引擎（content / background / api / modules / config）
├── html/               # popup 与设置页
├── css/                # 样式
├── templates/          # 导出模板
├── vendor/             # 第三方库
├── export/             # 离线档案运行时资源
└── spa/                # 离线档案浏览器（Vue 3，构建产物在构建时生成）
```

## 构建 SPA 档案浏览器（可选）

`src/export/spa-dist/` 为构建产物，仓库不保存；如需自行构建：

```bash
cd src/spa
npm install
npm run build
```

## 许可

[Apache-2.0](LICENSE) · 感谢原项目 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport)
