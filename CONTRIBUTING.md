# 贡献指南

感谢你愿意参与空间档案备份。本文说明开发环境、提交规范、测试要求与 PR 流程。

> 本仓库只维护 Windows 桌面端。Chrome 扩展端已停止维护，历史源码在 `extension` 分支，仅供追溯。

## 开发环境

- Windows 10 / 11 x64（打包 Windows 安装包需要）
- Node.js 24+、npm 10+
- Git

```bash
git clone https://github.com/salt-fishes/qzone-archiver.git
cd qzone-archiver/desktop
npm install
npm run start:dev
```

> 使用 `npm install` 而不是 `npm ci`：lockfile 在 Windows 生成，跨平台可选依赖（esbuild / rollup 平台二进制）会被 npm 裁剪，`npm ci` 的严格校验在 Linux 上会失败。

常用命令：

```bash
npm run typecheck        # vue-tsc + tsc
npm run lint             # eslint
npm run test             # vitest
node scripts/gen-engine-config.mjs --check   # 引擎配置与 spec 一致性
npm run build:renderer   # 只构建渲染层
npm run build:viewer     # 构建离线查看器
npm run dist:win         # 生成安装版 + 免安装版
```

## 目录结构

```
desktop/src/main/       Electron 主进程：窗口 / IPC / 任务 / 下载 / 持久化
desktop/src/preload/    window.api 与引擎桥
desktop/src/renderer/   Vue 3 + Naive UI 渲染层
desktop/src/engine/     QQ 空间采集引擎（api / collectors / repos / exporters / tasks）
desktop/src/shared/     IPC 契约、模块清单、纯函数
desktop/archive-viewer/ 离线查看器源码
desktop/tests/unit/     单元测试
```

## 分支与提交

- 从 `main` 切出功能分支：`feat/<简短描述>`、`fix/<简短描述>`
- 一个 PR 只做一件事；避免把格式调整、依赖升级和功能混在一起
- 提交信息使用 Conventional Commits：

```
feat(task): 支持任务级下载队列
fix(engine): 修复相册分页游标不前进
docs: 重写 README
chore(release): v5.5.0 版本同步
test: 补充分页错误传播用例
```

常用 scope：`engine`、`task`、`download`、`ui`、`main`、`docs`、`release`。提交信息与 PR 标题用中文或英文均可，但同一 PR 内保持一致。

## 代码风格

- 2 空格缩进、单引号、保留分号；遵循仓库现有 ESLint 配置
- 引擎层保持 `api / collectors / repos / exporters / packagers / tasks` 的分层，不在 collector 里直接写 UI 或主进程逻辑
- 主进程 / preload / 渲染层之间的通道必须登记在 `desktop/src/shared/ipc-contract.mjs`
- 新增用户可见文案使用中文；日志保留必要的英文接口名 / 错误码
- 不要提交生成产物：`desktop/src/renderer/dist/`、`desktop/build/`、`desktop/release/`、`desktop/src/renderer/public/emoticons/`

## 测试要求

- 修 bug 时优先补一条能复现问题的回归测试
- 改任务状态机、分页、下载、更新检查等核心逻辑时必须补测试
- PR 合并前至少通过：

```bash
cd desktop
node scripts/gen-engine-config.mjs --check
npm run typecheck
npm run lint
npm run test
```

- 改动渲染层样式或构建配置时再跑 `npm run build:renderer`
- 发版前维护者会额外跑纯净 checkout 门禁与安装包冒烟

## 数据与隐私红线

提交 issue、日志、截图或测试数据前，请务必删除：

- QQ 号、昵称、头像、Cookie、`p_skey` / `skey` / `g_tk`
- 真实备份档案、照片、视频、评论内容
- 含个人路径的日志（如 `C:\Users\<你的用户名>\...`）
- `%APPDATA%\qzone-archiver-desktop` 下的配置、任务与日志原文

测试请使用自造数据或脱敏后的最小样本。

## PR 流程

1. Fork 仓库并从 `main` 切分支
2. 完成改动与测试，确保 `typecheck / lint / test` 通过
3. 提交 PR，填写模板中的变更说明、测试方式与隐私检查
4. CI 通过后由维护者 review；必要时会请补充回归测试或拆小 PR
5. 合并后由维护者按发布流程发版

## 发布流程（维护者）

1. 同步版本号：`desktop/package.json`、`desktop/package-lock.json`、`CODE_WIKI.md`
2. 跑门禁：`node scripts/check-clean-checkout.mjs`（或等价的五步手动门禁）
3. 写 `RELEASE_v<版本>.md`
4. `npm run dist:win`，自检 `desktop/release/` 产物与 asar 内容
5. 提交并推送 `main`，打 tag `v<版本>`
6. `gh release create v<版本> --target main --notes-file RELEASE_v<版本>.md <setup> <portable>`
7. 发布后核对 `/releases/latest` 与资产，并回填版本记录

## 行为准则

参与本项目即表示同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要公开提交可利用细节。
