# qzone-archiver 桌面版

QQ 空间历史数据备份桌面版（Electron）：内嵌登录 → 采集 → 打包 → 内置 SPA 浏览，一体化完整流程，完全替代浏览器扩展。

> **Mac 用户请使用 [扩展版](https://github.com/salt-fishes/qzone-archiver)**。本桌面版首发支持 Windows（NSIS 安装包 + portable 免安装版）。

## 目录结构

```
desktop/
├── package.json            # electron + electron-builder + vue3 + pinia
├── electron-builder.yml    # NSIS + portable 打包配置
├── scripts/
│   └── sync-baseline.mjs   # 一次性快照扩展端引擎基线 → src/engine
├── src/
│   ├── main/               # 主进程（窗口/IPC/下载/打包/状态持久化）
│   ├── preload/            # ui-bridge（window.api）+ engine-bridge（引擎最小桥）
│   ├── renderer/           # Vue 3 主界面
│   └── engine/             # 引擎五层（扩展端 v3.3.0 冻结基线快照 + M1 重构产物）
└── docs/                   # 桌面版文档
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
npm run dist:win   # NSIS 安装包 + portable，产物在 release/
```

## 引擎基线说明

`src/engine/` 是扩展端 `src/js` + `src/templates` + `src/export` 在 v3.3.0 的一次性快照（见 `baseline-manifest.json`），此后五层重构在此独立演进，**不回写扩展端**。扩展端继续独立发布；Bug 修复按需人工单向同步到桌面引擎并冒烟测试。
