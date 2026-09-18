> ⚠️ **本分支已废弃（2026-09-18）。** 本仓库的扩展端 fork 停留在上游 V2 时代的代码结构，而 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) 已在其 V2 结构基础上更新到 **V3.0**（Manifest V3，WXT + TypeScript，含直写目录、断点续传与全新离线查看器），功能与维护状态均优于本仓库归档版本 —— **请改用上游扩展**。
> 本仓库（QZoneArchiver）此后只维护 **Windows 桌面端**；本分支与 tag `archive/extension-v4.8.0` 仅供追溯，不再接收任何更新。

# qzone-archiver

> QQ 空间本地化备份工具：把说说、相册、日志等记忆完整保存到自己的电脑，离线随时浏览。
> 基于 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) 二次开发，遵循 Apache-2.0 协议。

## 功能

- **一键备份**：说说 / 日志 / 日记 / 相册 / 视频 / 留言 / 好友 / 收藏 / 分享 / 访客，共 10 类内容
- **离线档案**：备份产物双击 `index.html` 即可浏览，支持按年归档、全文搜索、图片视频画廊
- **增量备份**：只采集上次之后的新内容，日常同步几分钟完成
- **备份好友空间**：输入好友 QQ 号，备份其公开内容（v4.6 新增）
- **暂停 / 恢复 / 取消**：断点续传，随时中断不丢进度
- **完全本地化**：不接入任何服务器，登录凭证与数据全部留在本机

## 下载

从 [Releases](https://github.com/salt-fishes/qzone-archiver/releases) 获取最新版本：

| 形态 | 平台 | 说明 |
| --- | --- | --- |
| **桌面版**（推荐） | Windows 10+ x64 | `QZoneArchiver-x.x.x-setup.exe`（安装版）/ `-portable.exe`（免安装版） |
| Chrome 扩展 | Chrome / Edge | 加载仓库 `src/` 目录，或在 Release 下载扩展包 |

> 💡 免安装版为单文件自解压，首次启动需解压、耗时明显长于安装版（启动后有品牌 splash 提示）——日常使用推荐安装版。

## 快速上手

1. **扫码登录**——启动应用，点右上角「扫码登录」，用手机 QQ 扫码
2. **新建任务**——选择备份谁的空间（自己 / 好友）、要备份的内容、保存位置
3. **开始备份**——完成后进入「我的档案」离线浏览

> 应用内置了图文教程与分步引导；备份好友空间仅采集对方公开内容，会像普通访问一样留下访客记录，请尊重他人隐私。

## 开发

```bash
# 桌面版（Electron + Vue3 + Naive UI）
cd desktop
npm install
npm run start:dev      # 运行
npm run dist:win       # 打包 Windows 安装包

# 测试
npm run test && npm run typecheck
```

扩展版位于 `src/`（Chrome 扩展 Manifest V3），与桌面版共享同一套采集引擎。

## 许可

[Apache-2.0](LICENSE) · 感谢原项目 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport)
