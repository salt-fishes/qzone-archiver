# qzone-archiver 桌面版（v4.0.0）

QQ 空间历史数据备份桌面版（Electron）：内嵌登录 → 采集 → 打包 → 内置 SPA 浏览，一体化完整流程，完全替代浏览器扩展。

> **Mac 用户请使用 [扩展版](https://github.com/salt-fishes/qzone-archiver)**。本桌面版首发支持 Windows 10+（x64）。

## 发布形态（v4.0.0）

桌面版同时产出两种安装包（见 `desktop/release/`）：

| 产物 | 说明 |
| --- | --- |
| `QZoneArchiver-4.0.0-setup.exe` | **安装版**：NSIS 安装向导，可选安装目录、创建桌面 / 开始菜单快捷方式 |
| `QZoneArchiver-4.0.0-portable.exe` | **免安装版**：单文件自解压，下载后直接双击运行，解压即用，不写系统注册表 |

## 目录结构

```
desktop/
├── package.json            # electron + electron-builder + vue3 + pinia
├── electron-builder.yml    # NSIS 安装版 + portable 免安装版打包配置
├── scripts/
│   └── sync-baseline.mjs   # 一次性快照扩展端引擎基线 → src/engine
├── src/
│   ├── main/               # 主进程（窗口/IPC/下载/打包/状态持久化）
│   ├── preload/            # ui-bridge（window.api）+ engine-bridge（引擎最小桥）
│   ├── renderer/           # Vue 3 主界面
│   └── engine/             # 引擎五层（扩展端 v3.3.0 冻结基线快照 + 五层重构产物）
└── release/                # 打包产物输出（gitignore）
```

## 开发

```bash
# 首次：快照扩展端引擎基线（扩展端冻结 v3.3.0，只读）
npm run sync:baseline

# 安装依赖
npm install

# 构建渲染器并启动
npm run start:dev
```

## 打包发布

```bash
npm run dist:win   # 构建渲染器 + electron-builder，产出在 release/
```

- 安装版：`QZoneArchiver-{version}-setup.exe`（NSIS）
- 免安装版：`QZoneArchiver-{version}-portable.exe`（portable，解压即用）

## 引擎基线说明

`src/engine/` 是扩展端 `src/js` + `src/templates` + `src/export` 在 v3.3.0 的一次性快照（见 `baseline-manifest.json`），此后五层重构在此独立演进，**不回写扩展端**。扩展端继续独立发布；Bug 修复按需人工单向同步到桌面引擎并冒烟测试。
