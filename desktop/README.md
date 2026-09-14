# qzone-archiver 桌面版

QQ 空间备份桌面应用（Electron + Vue 3）：内嵌登录 → 采集 → 打包 → 内置 SPA 浏览，一体化流程。

## 开发

```bash
npm install
npm run start:dev        # 构建渲染器并启动（构建前自动同步表情资产）
npm run test             # 单元测试（vitest）
npm run typecheck        # vue-tsc + tsc
npm run lint             # eslint

# 引擎配置单一来源：改 src/engine/config-spec.json 后重新生成双端配置
npm run gen:config

# 生成产物（均为 gitignore，不进库；构建/打包脚本会自动跑，也可手动重建）
npm run gen:emoticons    # 内置表情 → 渲染层 public/emoticons + 双端清单
npm run gen:icon         # 打包图标：build/icon.png(512) + build/icon.ico(多尺寸)
```

> 表情与图标都是**生成产物**：`build:renderer` 会先跑 `sync-emoticons`，
> `dist` / `dist:win` 会先跑 `gen:icon`。纯净 checkout 直接构建/打包即可，
> 不需要手工补文件（缺失时的表现分别是界面表情不显示、打包用默认图标）。

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
