# qzone-archiver 桌面版

QQ 空间备份桌面应用（Electron + Vue 3）：内嵌登录 → 采集 → 打包 → 内置 SPA 浏览，一体化流程。

## 开发

```bash
npm install
npm run start:dev        # 构建渲染器并启动
npm run test             # 单元测试（vitest）
npm run typecheck        # vue-tsc + tsc
npm run lint             # eslint

# 引擎配置单一来源：改 src/engine/config-spec.json 后重新生成双端配置
npm run gen:config
```

## 打包发布

```bash
npm run dist:win         # 产物在 release/（NSIS 安装版 + portable 免安装版）
```

## 目录结构

```
desktop/
├── electron-builder.yml    # NSIS + portable 打包配置
├── scripts/                # 配置生成 / 引擎基线 / 模板编译等脚本
├── src/
│   ├── main/               # 主进程（窗口 / IPC / 下载 / 状态持久化）
│   ├── preload/            # ui-bridge（window.api）+ engine-bridge（引擎隔离桥）
│   ├── renderer/           # Vue 3 界面（Naive UI + motion-v）
│   └── engine/             # 采集引擎（扩展端 v3.3.0 冻结基线快照，独立演进，不回写扩展端）
└── release/                # 打包产物输出（gitignore）
```
