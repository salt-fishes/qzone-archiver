/**
 * 计划执行器（v5.5 M1）：模块计划与失败分级
 *
 * 职责：
 *  - buildPlan：按 resumeFrom.module 跳过已完成模块，返回本次要执行的模块序列
 *  - classifyModuleError：把模块异常分为 auth_lost / rate_limited / fatal / module
 *
 * 说明（M1 边界）：
 *  - checkpoint 记录 module+phase，但模块内部阶段尚未拆成独立执行单元；
 *    本版 resume 从 checkpoint 模块的起点重跑（依赖增量去重/URL 哈希保证幂等）。
 *  - phase 用于 UI/诊断与 checkpoint 展示，后续模块按阶段拆解后再做精确续跑。
 */
(function () {
  'use strict';

  /**
   * @param {{modules?: string[], resumeFrom?: {module?: string, phase?: string}|null}} opts
   * @returns {{modules: string[], skipped: string[], startIndex: number, invalidResume: boolean, resumeFrom: object|null}}
   */
  function buildPlan(opts = {}) {
    const all = Array.isArray(opts.modules) ? [...opts.modules] : [];
    const resumeFrom =
      opts.resumeFrom && typeof opts.resumeFrom === 'object' ? opts.resumeFrom : null;
    if (!resumeFrom || !resumeFrom.module) {
      return { modules: all, skipped: [], startIndex: 0, invalidResume: false, resumeFrom: null };
    }
    const startIndex = all.indexOf(resumeFrom.module);
    if (startIndex < 0) {
      return {
        modules: all,
        skipped: [],
        startIndex: 0,
        invalidResume: true,
        resumeFrom,
      };
    }
    return {
      modules: all.slice(startIndex),
      skipped: all.slice(0, startIndex),
      startIndex,
      invalidResume: false,
      resumeFrom,
    };
  }

  /** 从 ModuleError/普通 Error 中取最内层 cause，识别请求层标记 */
  function rootCause(error) {
    let e = error;
    for (let i = 0; i < 5 && e && e.cause; i++) e = e.cause;
    return e || error || {};
  }

  /**
   * @param {Error|object} error
   * @returns {'auth_lost'|'rate_limited'|'fatal'|'module'}
   */
  function classifyModuleError(error) {
    const e = rootCause(error);
    const msg = String((e && (e.message || e.error)) || '');
    if (e && e.__authLost) return 'auth_lost';
    if (/登录|未登录|401|403|p_skey|skey/i.test(msg)) return 'auth_lost';
    if (e && e.__rateLimited) return 'rate_limited';
    if (/使用人数过多|系统压力|操作频繁|限流|429|code\s*[:=]?\s*-?(18|10000)/i.test(msg)) {
      return 'rate_limited';
    }
    if (/磁盘|空间不足|ENOSPC|EACCES|EPERM|目标目录|路径不存在|目录不可用/i.test(msg)) {
      return 'fatal';
    }
    return 'module';
  }

  /** 暂停原因 → 是否可续跑（与 shared/task-protocol 保持一致） */
  function isResumableReason(reason) {
    return reason == null || reason === 'user' || reason === 'rate_limited';
  }

  window.QZoneTasks = window.QZoneTasks || {};
  window.QZoneTasks.PlanExecutor = {
    buildPlan,
    classifyModuleError,
    isResumableReason,
  };
})();
