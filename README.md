# qzone-archiver · 桌面版

> QQ 空间本地化备份工具（Windows 桌面版）：把说说、相册、日志等记忆完整保存到自己的电脑，离线随时浏览。
> 基于 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport) 二次开发，遵循 Apache-2.0 协议。

**本分支（`desktop`）只包含桌面版**；Chrome 扩展版见 [`extension`](https://github.com/salt-fishes/qzone-archiver/tree/extension) 分支，双端开发主线见 `main` 分支。

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
| **安装版** | Windows 10+ x64 | `QZoneArchiver-x.x.x-setup.exe` |
| **免安装版** | Windows 10+ x64 | `QZoneArchiver-x.x.x-portable.exe` |

## 快速上手

1. **扫码登录**——启动应用，点右上角「扫码登录」，用手机 QQ 扫码
2. **新建任务**——选择备份谁的空间（自己 / 好友）、要备份的内容、保存位置
3. **开始备份**——完成后进入「我的档案」离线浏览

> 应用内置了图文教程与分步引导；备份好友空间仅采集对方公开内容，会像普通访问一样留下访客记录，请尊重他人隐私。
>
> 媒体文件较多时（如上万张图片），下载会在后台持续进行，界面会显示「媒体下载中 x」。建议按模块分批备份，单轮媒体量控制在几百条以内更稳。

## 开发

代码位于本仓库 `desktop/` 目录：

```bash
cd desktop
npm install
npm run start:dev      # 运行
npm run dist:win       # 打包 Windows 安装包（安装版 + 免安装版）
npm run test           # 单元测试
npm run typecheck      # 类型检查（渲染层 + 主进程）
npm run lint           # 代码检查
```

### 配置单一来源

`src/engine/config-spec.json` 是设置项的唯一定义处，改完需重新生成两端：

```bash
npm run gen:config     # 生成引擎 config.js 默认值 + 渲染层 schema.ts
```

## 许可

[Apache-2.0](LICENSE) · 感谢原项目 [ShunCai/QZoneExport](https://github.com/ShunCai/QZoneExport)
