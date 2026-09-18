# tests/probe —— 端到端探针（R1 骨架）

> v4.9 R1 建骨架；用例由 v5.1 B6 填充（SEQUENCE.md 决策）。
> 探针 = 对**真实构建产物 / 真实应用**跑的端到端检查，区别于 `tests/unit`（对源码的快速单测）。

## 定位

- 单测跑得快、天天跑；探针跑得慢、发版前跑。
- 探针只读：不修改仓库与用户数据（涉及 userData 的用例自行建临时目录并清理）。

## 约定

- 一个用例一个 `.mjs` 脚本，`node tests/probe/<name>.mjs` 直接可跑；
  退出码 0 = 通过，非 0 = 失败（失败时输出定位信息）。
- 依赖真实 Electron 环境的用例标注 `[manual]`（发版冒烟时人工执行），CI 不跑本目录。

## 用例清单（v5.1 B6 起逐步填充）

| 脚本 | 覆盖 | 状态 |
| --- | --- | --- |
| `smoke-asar.mjs`（规划） | 拆 asar 校验产物：EMOTICONS_DIR 层级 / CSP / 表情条目数 / renderFallback / 日志自检行 | TODO v5.1 |
| `smoke-backup.mjs`（规划） | 启动产物 → 登录 → 小模块备份 → 断言任务日志 backup-<taskId>.log 可独立回答"停在哪" | TODO v5.1 |
