# 空间档案备份 · qzone-archiver

> 把 QQ 空间里的说说、相册、日志等记忆完整备份到自己的电脑，离线也能随时翻看。

[![Release](https://img.shields.io/github/v/release/salt-fishes/qzone-archiver?label=release)](https://github.com/salt-fishes/qzone-archiver/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2B%20x64-0078D4)](#下载与安装)

## 这是什么

空间档案备份是一款 Windows 桌面应用。它通过你本机登录的 QQ 空间会话采集内容，把说说、相册、日志、视频等整理成一份可以直接双击打开的离线档案。

- 不接入任何自建服务器，登录凭证与备份数据都留在本机
- 备份产物是普通文件夹，复制、压缩、换电脑都能继续用
- 基于 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) 二次开发，遵循 Apache-2.0

## 功能

- **10 类内容**：说说、日志、日记、相册、视频、留言、好友、收藏、分享、访客
- **任务可控**：准备 / 运行 / 暂停 / 收尾 / 完成 / 失败全程可见；暂停、取消秒级生效
- **异常可解释**：引擎崩溃、登录失效、QQ 空间限流会进入暂停并说明原因，处理后可继续
- **备份策略可选**：支持全量、上次之后、自定义时间三种策略，日常同步可选增量
- **独立下载中心**：任务完成后媒体继续后台下载，可暂停 / 继续 / 重试失败 / 打开目录
- **离线查看器**：档案自带 SPA 查看器，支持按年浏览、全文搜索、图片与视频画廊
- **备份他人空间**：输入对方 QQ 号，采集其公开内容；访客、日记、好友、收藏等仅本人可见的内容会自动跳过
- **手动检查更新**：应用内查询 GitHub Releases，只提示新版本，不自动下载、不静默安装

## 下载与安装

从 [Releases](https://github.com/salt-fishes/qzone-archiver/releases/latest) 获取最新版本：

| 形态 | 文件 | 说明 |
| --- | --- | --- |
| 安装版（推荐） | `QZoneArchiver-<版本>-setup.exe` | 支持选择安装目录，创建桌面 / 开始菜单快捷方式 |
| 免安装版 | `QZoneArchiver-<版本>-portable.exe` | 单文件自解压，首次启动较慢 |

**系统要求**：Windows 10 / 11 x64；能正常访问 QQ 空间；登录需要手机 QQ 扫码。备份大量照片和视频时请预留足够磁盘空间。

> 免安装版每次启动都要先解压，日常使用推荐安装版。升级覆盖安装不会删除已备份的档案。

## 快速上手

1. **扫码登录**：启动应用，点右上角「扫码登录」，用手机 QQ 扫码
2. **新建任务**：选择备份谁的空间（自己 / 好友）、要备份的模块、保存目录
3. **开始备份**：运行中可随时暂停 / 继续 / 取消；完成后进入「档案列表」离线浏览
4. **查看档案**：双击档案目录里的 `index.html`，或从应用内打开查看器

> 应用内内置了图文教程与首次使用引导。

## 可备份的内容

| 模块 | 内容 | 备份他人空间 |
| --- | --- | --- |
| 说说 | 正文、全文、配图、评论、点赞 | 支持（公开内容） |
| 日志 | 日志正文、配图、评论、点赞 | 支持（公开内容） |
| 日记 | 日记正文、配图 | 仅本人 |
| 相册 | 相册列表、照片原图、评论、点赞 | 支持（有权限的相册） |
| 视频 | 视频列表、封面、评论 | 支持（公开内容） |
| 留言 | 留言板内容与回复 | 支持（公开内容） |
| 好友 | 好友列表、分组、备注 | 仅本人 |
| 收藏 | 收藏的说说 / 日志等 | 仅本人 |
| 分享 | 分享内容、评论 | 支持（公开内容） |
| 访客 | 访客列表 | 仅本人 |

他人空间里无权限访问的相册会标记「未备份」并说明原因；仅本人可见的模块会在任务开始时自动跳过并提示。

## 任务控制与下载

- **暂停 / 继续**：暂停会立即中断在途请求与等待，继续时从当前模块的检查点接着跑
- **取消**：取消会停止采集并清理本任务的待下载项，不影响已完成的档案
- **自动暂停**：登录失效、QQ 空间限流、引擎异常时任务会暂停并显示原因，不会假装还在运行
- **下载中心**：任务完成后媒体仍在后台下载；可暂停全部、继续、重试失败项、打开文件所在目录
- **数据量大时**：点赞或评论数量很多时，界面会提示建议关闭「获取赞列表 / 评论」，避免触发限流

> 本版暂不支持「重启应用后继续未完成任务」与「只重试失败模块」，这两项计划在 v5.6 提供。跨次备份的增量采集不受影响。

## 归档与离线查看

每个备份目录都是一份独立档案：

```
备份目录/
├─ index.html          # 双击打开离线查看器
├─ manifest.json       # 档案清单与模块统计
├─ report.json         # 备份报告
├─ Messages/ Blogs/ Albums/ ...
└─ Common/             # 查看器资源、用户信息、公共图片
```

- 档案不依赖应用运行，复制到其他电脑也能直接打开
- 查看器支持按年浏览、全文搜索、图片 / 视频查看与深色模式
- 旧档案不需要重新备份即可继续浏览；查看器界面升级会随新备份写入

## 检查更新

应用侧边栏提供「检查更新」页面：

- 手动点击「检查更新」，查询 GitHub Releases 的最新版本
- 只读取版本号与安装包列表，不自动下载、不后台上传数据
- 发现新版本后可选择下载安装版或免安装版，也可以直接打开发布页
- 网络无法访问 GitHub API 时，会给出提示并保留手动打开发布页的入口

## 隐私与安全

- **完全本地**：没有自建服务器，备份数据只写入你选择的目录
- **登录态**：QQ 登录 Cookie 保存在 Electron 的本地会话分区，仅用于访问 QQ 空间
- **日志**：应用日志位于 `%APPDATA%\qzone-archiver-desktop\logs`，可在设置中一键打开
- **他人空间**：仅采集对方公开内容；访问会像普通浏览一样留下访客记录，请尊重他人隐私
- **免责声明**：本项目依赖 QQ 空间内部 Web 接口，仅用于备份自己的数据；使用风险由使用者自行承担。本项目与腾讯 / QQ 空间无隶属关系

## 常见问题

**扫码后一直显示「未连接」？**
先点顶栏「未连接 · 点击重试」；仍失败时检查网络与 QQ 空间是否可正常打开，再到设置里打开日志目录查看 `main.log`。

**任务暂停了，显示「限流」怎么办？**
QQ 空间对短时间大量请求会限流。等待 10–30 分钟后点「继续」即可；数据量大时建议关闭「获取赞列表 / 评论」。

**为什么备份他人空间没有访客 / 日记 / 好友 / 收藏？**
这些内容仅空间主人可见，任务会自动跳过并提示，属于正常现象。

**卸载应用会删除备份吗？**
不会主动删除你选择的备份目录。档案是普通文件夹，建议重要数据额外做一份冷备份。

**检查更新失败？**
可能是 GitHub API 网络受限。稍后重试，或直接打开 [Releases 页面](https://github.com/salt-fishes/qzone-archiver/releases) 手动下载。

## 开发

环境：Node.js 24+、npm 10+、Windows（打包 Windows 安装包需要）。

```bash
cd desktop
npm install

npm run start:dev        # 构建渲染层并启动应用
npm run typecheck        # vue-tsc + tsc
npm run lint             # eslint
npm run test             # vitest 单元测试

node scripts/gen-engine-config.mjs --check   # 引擎配置一致性
npm run build:renderer   # 只构建渲染层
npm run build:viewer     # 构建离线查看器
npm run dist:win         # 生成 NSIS 安装版 + portable 免安装版
```

产物输出到 `desktop/release/`。本仓库的 `package-lock.json` 在 Windows 生成，CI 使用 `npm install` 而非 `npm ci`，避免跨平台可选依赖被裁剪。

### 项目结构

```
desktop/
├─ src/main/          # Electron 主进程：窗口、IPC、任务、下载、状态持久化
├─ src/preload/       # window.api（UI）与引擎桥
├─ src/renderer/      # Vue 3 + Naive UI 渲染层
├─ src/engine/        # QQ 空间采集引擎（api / collectors / repos / exporters / tasks）
├─ src/shared/        # IPC 契约、模块清单、更新检查纯函数
├─ archive-viewer/    # 离线查看器源码（构建产物在 engine/export-resources）
└─ scripts/           # 配置生成、图标 / 表情同步、纯净门禁
```

## 贡献与规范

- [CONTRIBUTING.md](CONTRIBUTING.md)：开发环境、分支与提交规范、测试与 PR 流程
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)：社区行为准则
- [SECURITY.md](SECURITY.md)：漏洞报告方式与支持范围
- [Issue 模板](.github/ISSUE_TEMPLATE)：Bug 报告 / 功能建议

提交前请至少跑通：

```bash
cd desktop
npm run typecheck && npm run lint && npm run test
```

请勿提交任何真实用户数据、登录 Cookie、备份档案、日志或截图中的个人信息。

## 版本与发布

- 版本遵循语义化版本；桌面端与查看器版本独立
- 当前桌面端：**5.5.1**；查看器：**4.3.0**
- 每次发布提供安装版与免安装版，更新说明见 [Releases](https://github.com/salt-fishes/qzone-archiver/releases)；版本索引见 [CHANGELOG.md](CHANGELOG.md)

## 许可与致谢

本项目基于 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) 二次开发，遵循 [Apache-2.0](LICENSE)。原始版权与修改说明见 [NOTICE](NOTICE)。

扩展端已停止维护：历史源码保存在 `extension` 分支与 `archive/extension-v4.8.0` tag，仅供追溯；请改用上游 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) V3.0。

感谢所有提交 issue、反馈日志与帮助测试的用户。
