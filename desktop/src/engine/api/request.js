/**
 * 统一请求层（v5.5 M1）：超时 / 总预算 / 可中断退避 / settle 守卫 / 错误分类
 *
 * 背景（2026-10-22 现场）：
 *  - 业务错误重试耗尽后 reject 丢失 → Promise 永不 settle，模块永久挂起；
 *  - -10000 命中 waitTime=3600s → 每次重试静默等待 1 小时且不可取消；
 *  - 重试期间暂停/取消无法打断。
 *
 * 本模块只负责“一次请求链”的可靠性；JSONP 解析仍由调用方/API.Utils 完成。
 * 结果返回原始文本（与旧 API.Utils.get 一致），分类信息挂在 Error 上：
 *   err.__networkKind = 'auth' | 'permanent' | 'rate_limited' | 'transient' | 'aborted' | 'budget'
 *   err.__authLost / __permanent / __rateLimited / __exportCancelled / __budgetExceeded
 */
(function () {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 30_000;
  const DEFAULT_TOTAL_BUDGET_MS = 120_000;
  const DEFAULT_RETRY_BASE_MS = 2_000;
  const DEFAULT_RETRY_MAX_MS = 15_000;
  const PERMANENT_CODES = new Set([-4009]);
  const AUTH_CODES = new Set([-3000]);
  const RATE_LIMIT_CODES = new Set([-18, -10000]);

  function abortError(message) {
    const err = new Error(message || '请求已取消');
    err.name = 'AbortError';
    err.__exportCancelled = true;
    err.__networkKind = 'aborted';
    return err;
  }
  function isCancelled() {
    try {
      return !!(window.__engineExportState && window.__engineExportState.cancelled);
    } catch {
      return false;
    }
  }

  function textOf(message) {
    return String(message || '未知错误')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseJson(raw) {
    try {
      return API.Utils.toJson(raw);
    } catch {
      return null;
    }
  }

  function classifyBusiness(json) {
    if (!json || typeof json !== 'object') return null;
    const code = Number(json.code);
    if (!code) return null;
    const msg = String(json.message || '');
    if (PERMANENT_CODES.has(code) || /原文已经被删除|已被删除|无法查看|无权限/.test(msg)) {
      return 'permanent';
    }
    if (AUTH_CODES.has(code)) return 'auth';
    if (RATE_LIMIT_CODES.has(code) || code === 429 || /使用人数过多|系统压力|稍后再试|操作频繁/.test(msg)) {
      return 'rate_limited';
    }
    return 'transient';
  }

  function sleep(ms, signal) {
    const wait = Math.max(0, Number(ms) || 0);
    if (!signal) return new Promise((resolve) => setTimeout(resolve, wait));
    if (signal.aborted) return Promise.reject(abortError(signal.reason));
    return new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        if (signal.removeEventListener) signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(abortError(signal.reason));
      };
      timer = setTimeout(() => {
        cleanup();
        resolve();
      }, wait);
      if (signal.addEventListener) signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * 单次 $.ajax（文本），支持 abort。
   * @returns {Promise<string>}
   */
  function ajaxOnce(opts, timeoutMs, onAbortRef, signal) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let xhr = null;
      let timer = null;
      let deadline = null;
      let signalHandler = null;

      const done = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        // v5.5 M1 补：硬超时定时器随请求结算一起清理
        if (deadline) clearTimeout(deadline);
        deadline = null;
        if (signal && signalHandler && signal.removeEventListener) {
          signal.removeEventListener('abort', signalHandler);
        }
        signalHandler = null;
        onAbortRef.current = null;
      };
      const onSignalAbort = () => {
        try {
          if (xhr && xhr.abort) xhr.abort();
        } catch {
          /* ignore */
        }
        done(reject, abortError(signal && signal.reason));
      };

      if (signal) {
        if (signal.aborted) {
          onSignalAbort();
          return;
        }
        signalHandler = onSignalAbort;
        if (signal.addEventListener) signal.addEventListener('abort', signalHandler, { once: true });
      }

      // 取消检查：引擎取消时直接 abort 当前 jqXHR
      timer = setInterval(() => {
        if (isCancelled()) {
          try {
            if (xhr && xhr.abort) xhr.abort();
          } catch {
            /* ignore */
          }
          done(reject, abortError('请求已取消'));
        }
      }, 50);

      // v5.5 M1 补：独立硬超时——不完全依赖 jQuery timeout。
      // 代理挂起/上游不响应时 jqXHR 可能长时间不回调（2026-10-28 实机：相册赞列表
      // 阶段 15 分钟无日志、无网络 IO），这里保证请求链一定在 timeoutMs+0.5s 内结算。
      deadline = setTimeout(() => {
        try {
          if (xhr && xhr.abort) xhr.abort();
        } catch {
          /* ignore */
        }
        const err = new Error(`请求超时（${Math.round(timeoutMs / 1000)}s 未完成）`);
        err.__networkKind = 'transient';
        err.__timeout = true;
        done(reject, err);
      }, timeoutMs + 500);

      xhr = $.ajax({
        url: opts.url,
        type: opts.method || 'GET',
        data: opts.data,
        dataType: 'text',
        contentType: opts.contentType,
        timeout: timeoutMs,
        xhrFields: { withCredentials: true },
        success(result) {
          done(resolve, result);
        },
        error(xhrObj, status, error) {
          if (settled) return;
          const msg = API.Utils.buildNetworkErrorMessage(
            xhrObj,
            status,
            error,
            opts.url
          );
          const err = new Error(textOf(msg));
          err.fullMessage = msg;
          err.xhr = xhrObj;
          err.status = xhrObj && xhrObj.status;
          err.raw = error;
          err.__httpStatus = status;
          done(reject, err);
        },
      });
      onAbortRef.current = () => {
        try {
          if (xhr && xhr.abort) xhr.abort();
        } catch {
          /* ignore */
        }
        done(reject, abortError('请求已取消'));
      };
    });
  }

  /**
   * 执行一次请求链。
   * @param {{
   *  url:string, data?:object, method?:string, contentType?:string,
   *  timeoutMs?:number, totalBudgetMs?:number, retries?:number,
   *  retryBaseMs?:number, retryMaxMs?:number, classifyBusiness?:boolean,
   *  onRetry?:Function, onGiveUp?:Function
   * }} opts
   */
  async function request(opts = {}) {
    const url = opts.url;
    if (!url) throw new Error('request 需要 url');
    const method = String(opts.method || 'GET').toUpperCase();
    const maxRetries = Number.isFinite(opts.retries)
      ? Math.max(0, Math.floor(opts.retries))
      : 5;
    const maxAttempts = maxRetries + 1;
    const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const totalBudgetMs =
      Number(opts.totalBudgetMs) > 0 ? Number(opts.totalBudgetMs) : DEFAULT_TOTAL_BUDGET_MS;
    const retryBaseMs =
      Number(opts.retryBaseMs) >= 0 ? Number(opts.retryBaseMs) : DEFAULT_RETRY_BASE_MS;
    const retryMaxMs = Number(opts.retryMaxMs) > 0 ? Number(opts.retryMaxMs) : DEFAULT_RETRY_MAX_MS;
    const startedAt = Date.now();
    const abortRef = { current: null };
    const signal = opts.signal;
    let attempt = 0;

    const aborted = () => (signal && signal.aborted) || isCancelled();
    const abortNow = () => abortError(signal && signal.reason);

    const budgetError = () => {
      const err = new Error(`请求总预算超时（${Math.round(totalBudgetMs / 1000)}s）：${url}`);
      err.__networkKind = 'budget';
      err.__budgetExceeded = true;
      return err;
    };

    while (attempt < maxAttempts) {
      if (aborted()) throw abortNow();
      if (Date.now() - startedAt > totalBudgetMs) throw budgetError();
      attempt += 1;

      let raw;
      try {
        raw = await ajaxOnce(
          {
            url,
            method,
            data: opts.data,
            contentType: opts.contentType,
          },
          timeoutMs,
          abortRef,
          signal
        );
      } catch (e) {
        if (aborted()) throw abortNow();
        const status = e && e.status;
        const isAuth = status === 401 || status === 403;
        const isPermanent = status === 501;
        if (isAuth) {
          e.__networkKind = 'auth';
          e.__authLost = true;
          throw e;
        }
        if (isPermanent) {
          e.__networkKind = 'permanent';
          e.__permanent = true;
          throw e;
        }
        // 5xx / 无响应计入熔断
        if (!status || status >= 500) {
          if (API.Utils.noteServerFailure && API.Utils.noteServerFailure(status || 0)) {
            const circuit = new Error(API.Utils.serverFailureMessage(status || '网络错误'));
            circuit.__networkKind = 'permanent';
            circuit.__permanent = true;
            throw circuit;
          }
        }
        if (attempt >= maxAttempts) {
          e.__networkKind = 'transient';
          throw e;
        }
        const delay = Math.min(retryMaxMs, retryBaseMs * 2 ** (attempt - 1));
        if (typeof opts.onRetry === 'function') {
          opts.onRetry({ attempt, maxAttempts, remaining: maxAttempts - attempt, delay, error: e });
        }
        await sleep(delay, signal);
        continue;
      }

      // HTTP 成功：清空连续异常计数
      try {
        if (API.Utils.noteServerSuccess) API.Utils.noteServerSuccess();
      } catch {
        /* ignore */
      }

      // POST 等场景可关闭业务错误分类（保持旧 post 语义）
      if (opts.classifyBusiness === false) return raw;

      const json = parseJson(raw);
      const kind = classifyBusiness(json);
      if (!kind) return raw;

      const msg = textOf((json && json.message) || `接口返回 code ${json && json.code}`);
      const err = new Error(msg);
      err.code = json && json.code;
      err.__networkKind = kind;
      if (kind === 'permanent') {
        err.__permanent = true;
        throw err;
      }
      if (kind === 'auth') {
        err.__authLost = true;
        throw err;
      }
      if (attempt >= maxAttempts) {
        if (kind === 'rate_limited') err.__rateLimited = true;
        throw err;
      }
      const delay = Math.min(retryMaxMs, retryBaseMs * 2 ** (attempt - 1));
      if (typeof opts.onRetry === 'function') {
        opts.onRetry({
          attempt,
          maxAttempts,
          remaining: maxAttempts - attempt,
          delay,
          error: err,
          json,
          kind,
        });
      }
      await sleep(delay, signal);
    }

    // 理论不可达；保持与旧实现一致的兜底
    throw budgetError();
  }

  window.QZoneRequest = { request, abortError, classifyBusiness };
})();
