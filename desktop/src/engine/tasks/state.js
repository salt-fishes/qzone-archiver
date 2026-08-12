/**
 * 任务层——状态与检查点（P6，迁移自 desktop-runner.js 垫片）
 * 全局备份状态 __engineExportState + 检查点 checkExportState + 配置深度合并。
 */
(function () {
  'use strict';

  // ---------- 配置深度合并（UI 设置的 QZone_Config 为部分结构，须逐级并入默认，避免丢失子项） ----------
  function mergeDeep(...sources) {
    const out = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
      for (const [key, val] of Object.entries(src)) {
        if (val && typeof val === 'object' && !Array.isArray(val) && out[key] && typeof out[key] === 'object') {
          out[key] = mergeDeep(out[key], val);
        } else {
          out[key] = val;
        }
      }
    }
    return out;
  }
  window.__mergeDeep = mergeDeep;

  // ---------- 全局导出状态 ----------
  window.__engineExportState = {
    running: false,
    paused: false,
    cancelled: false,
    pauseToken: null, // 兼容保留（pauseWaiters 为主）
    pauseWaiters: [], // 暂停时挂起的所有等待者（并发检查点会同时挂起，须全部唤醒）
    currentModule: null,
    modules: [], // 本次备份勾选的模块（首页 SPA/HTML 判断依据）
  };

  /**
   * 检查点：在分页/批次循环中调用（语义对齐 content.js checkExportState）
   * - 已取消：抛错中止
   * - 已暂停：挂起等待恢复（并发到达的多个检查点全部收集到 pauseWaiters，
   *   resume 时逐个 resolve——单值 pauseToken 只保存最后一个会丢唤醒，导致流程永久卡死）
   */
  async function checkExportState() {
    const s = window.__engineExportState;
    if (s.cancelled) {
      const err = new Error('[ExportState] 导出已取消');
      err.__exportCancelled = true;
      throw err;
    }
    if (s.paused) {
      await new Promise((resolve) => {
        s.pauseWaiters.push(resolve);
      });
    }
    return s.cancelled;
  }
  // api.js 及各模块通过全局 checkExportState() 调用
  window.checkExportState = checkExportState;

  window.QZoneTasks = window.QZoneTasks || {};
  window.QZoneTasks.State = { mergeDeep, checkExportState };
})();
