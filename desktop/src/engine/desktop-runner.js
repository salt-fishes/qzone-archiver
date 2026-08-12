/**
 * 注入入口（P6 收口后薄壳）：desktop-runner.js
 *
 * 职责：
 *   1. 校验 QZonePlatform 与任务层（tasks/*）装配
 *   2. 主进程经 engine-bridge 调 window.__engineCommands（定义于 tasks/orchestrator.js）
 * 任务层状态/进度/下载/编排已迁至 tasks/{state,progress,downloader,orchestrator}.js。
 */
(function () {
  'use strict';

  if (!window.QZonePlatform) {
    console.error('[desktop-runner] QZonePlatform 未装配，runner 不可用');
    return;
  }
  if (!window.__engineCommands) {
    console.error('[desktop-runner] 任务层未装配（tasks/orchestrator），runner 不可用');
    return;
  }

  console.info('[desktop-runner] 注入完成，__engineCommands 可用');
})();
