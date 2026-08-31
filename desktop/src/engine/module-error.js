/**
 * 模块级错误协议（P2-5，架构改造计划 §4.4）
 *
 * 模块层 catch 统一包装上抛 ModuleError；orchestrator（tasks/orchestrator.js）
 * 统一捕获并记录结构化错误（module/phase/code/message），不再依赖各模块自行处理。
 *
 * 用法：
 *   } catch (error) {
 *     indicator.complete();
 *     throw new ModuleError({ module: 'Blogs', phase: 'run', cause: error });
 *   }
 *
 * 本文件须在 modules/* 之前注入（engine-bridge.js ENGINE_SCRIPTS）。
 */
class ModuleError extends Error {
  /**
   * @param {{module?:string, phase?:string, code?:string, cause?:Error|string}} opts
   */
  constructor(opts) {
    opts = opts || {};
    const cause = opts.cause;
    const message = (cause && (cause.message || String(cause))) || opts.code || '模块执行失败';
    super(message);
    this.name = 'ModuleError';
    this.module = opts.module;
    this.phase = opts.phase || 'run';
    this.code = opts.code || (cause && cause.name) || 'MODULE_FAILED';
    this.cause = cause;
    if (cause && cause.stack) {
      this.stack = this.stack + '\nCaused by: ' + cause.stack;
    }
  }
}
