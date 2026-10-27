/**
 * 任务上下文（v5.5 M1）：AbortSignal + 可中断 sleep + step 超时包装
 *
 * 背景：引擎的采集/导出节奏大量使用 `API.Utils.sleep`（裸 setTimeout）。
 * 窗口被隐藏/后台节流时 sleep 会被放大，暂停/取消也无法立刻打断。
 * 本模块提供：
 *  - createAbortError / throwIfAborted：统一取消异常（保留 __exportCancelled 兼容）
 *  - sleep(ms, signal)：AbortSignal 可中断；暂停/取消立即 reject
 *  - withTimeout(promise, ms, label)：单步 deadline
 *  - runStep(name, fn, opts)：onStart/onEnd + deadline + 取消检查
 *
 * 不依赖 API/QZone_Config；供 plan-executor 与后续采集改造使用。
 */
(function () {
  'use strict';

  class TaskAbortError extends Error {
    constructor(message) {
      super(message || '任务已中止');
      this.name = 'AbortError';
      this.__exportCancelled = true;
    }
  }

  function createAbortError(reason) {
    // 跨 realm（vm/iframe）时 instanceof Error 可能失效，按 message 鸭子类型兜底
    if (reason && (reason instanceof Error || typeof reason.message === 'string')) {
      const err = new TaskAbortError(reason.message || undefined);
      err.cause = reason;
      return err;
    }
    return new TaskAbortError(typeof reason === 'string' ? reason : undefined);
  }

  function throwIfAborted(signal) {
    if (signal && signal.aborted) throw createAbortError(signal.reason);
  }

  /**
   * 可中断 sleep。
   * @param {number} ms
   * @param {AbortSignal} [signal]
   */
  function sleep(ms, signal) {
    const wait = Math.max(0, Number(ms) || 0);
    if (!signal) return new Promise((resolve) => setTimeout(resolve, wait));
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        if (signal.removeEventListener) signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(createAbortError(signal.reason));
      };
      timer = setTimeout(() => {
        cleanup();
        resolve();
      }, wait);
      if (signal.addEventListener) signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * 给 Promise 加 deadline。
   * @param {Promise|any} promise
   * @param {number} ms 0/负数 = 不设超时
   * @param {string} [label]
   */
  function withTimeout(promise, ms, label) {
    const timeoutMs = Number(ms) || 0;
    if (timeoutMs <= 0) return Promise.resolve(promise);
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label || '操作'}超时（${Math.round(timeoutMs)}ms）`)),
        timeoutMs
      );
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  /**
   * 执行一个步骤：取消检查 → onStart → deadline → onEnd。
   * @param {string} name
   * @param {() => any|Promise<any>} fn
   * @param {{signal?: AbortSignal, timeoutMs?: number, onStart?: Function, onEnd?: Function}} [opts]
   */
  async function runStep(name, fn, opts = {}) {
    const { signal, timeoutMs = 0, onStart, onEnd } = opts;
    throwIfAborted(signal);
    if (typeof onStart === 'function') onStart({ name, at: Date.now() });
    try {
      const result = await withTimeout(Promise.resolve().then(fn), timeoutMs, `步骤 ${name}`);
      throwIfAborted(signal);
      if (typeof onEnd === 'function') onEnd({ name, ok: true });
      return result;
    } catch (e) {
      if (typeof onEnd === 'function') onEnd({ name, ok: false, error: e });
      throw e;
    }
  }

  window.QZoneTasks = window.QZoneTasks || {};
  window.QZoneTasks.Context = {
    TaskAbortError,
    createAbortError,
    throwIfAborted,
    sleep,
    withTimeout,
    runStep,
  };
})();
