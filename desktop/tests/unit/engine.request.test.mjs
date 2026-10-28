/**
 * v5.5 M1：统一请求层 request.js 单测
 * 覆盖：401 认证失败不重试 / -4009 永久错误 / 限流耗尽带 __rateLimited /
 *       总预算 / 取消中断在途请求 / 成功路径
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let sandbox;
let QZoneRequest;
let ajaxCalls = [];
let ajaxImpl = () => {};

beforeAll(() => {
  sandbox = {
    window: { __engineExportState: { cancelled: false } },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    API: {
      Utils: {
        toJson: (raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw),
        buildNetworkErrorMessage: (xhr, status, error) =>
          `HTTP ${xhr?.status || 0} ${error || status || '网络错误'}`,
        noteServerSuccess() {},
        noteServerFailure() {
          return false;
        },
        serverFailureMessage: (s) => `连续异常 HTTP ${s}`,
      },
    },
    $: {},
  };
  sandbox.$.ajax = (opts) => {
    ajaxCalls.push(opts);
    ajaxImpl(opts);
    return { abort() {} };
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(rootDir, 'src/engine/api/request.js'), 'utf8'), sandbox, {
    filename: 'api/request.js',
  });
  QZoneRequest = vm.runInContext('window.QZoneRequest', sandbox);
});

beforeEach(() => {
  ajaxCalls = [];
  sandbox.window.__engineExportState.cancelled = false;
});

const base = {
  url: 'https://user.qzone.qq.com/cgi-bin/list',
  retries: 2,
  retryBaseMs: 10,
  timeoutMs: 100,
  totalBudgetMs: 500,
};

describe('错误分类', () => {
  it('401 → __authLost，不重试', async () => {
    ajaxImpl = (opts) => opts.error.call(opts, { status: 401 }, 'error', 'Unauthorized');
    const err = await QZoneRequest.request(base).then(
      () => null,
      (e) => e
    );
    expect(err).toBeTruthy();
    expect(err.__authLost).toBe(true);
    expect(err.__networkKind).toBe('auth');
    expect(ajaxCalls).toHaveLength(1);
  });

  it('业务 -4009 → __permanent，不重试', async () => {
    ajaxImpl = (opts) =>
      opts.success.call(opts, JSON.stringify({ code: -4009, message: '无权限访问' }));
    const err = await QZoneRequest.request(base).then(
      () => null,
      (e) => e
    );
    expect(err.__permanent).toBe(true);
    expect(err.__networkKind).toBe('permanent');
    expect(ajaxCalls).toHaveLength(1);
  });

  it('限流 -18 重试耗尽 → __rateLimited，共 retries+1 次', async () => {
    ajaxImpl = (opts) =>
      opts.success.call(opts, JSON.stringify({ code: -18, message: '系统压力有点大' }));
    const err = await QZoneRequest.request(base).then(
      () => null,
      (e) => e
    );
    expect(err.__rateLimited).toBe(true);
    expect(err.__networkKind).toBe('rate_limited');
    expect(ajaxCalls).toHaveLength(3);
  });

  it('HTTP 5xx 重试耗尽 → __networkKind=transient', async () => {
    ajaxImpl = (opts) => opts.error.call(opts, { status: 500 }, 'error', 'server');
    const err = await QZoneRequest.request(base).then(
      () => null,
      (e) => e
    );
    expect(err.__networkKind).toBe('transient');
    expect(ajaxCalls).toHaveLength(3);
  });
});

describe('预算与取消', () => {
  it('总预算耗尽 → __budgetExceeded，提前停止重试', async () => {
    ajaxImpl = (opts) =>
      opts.success.call(opts, JSON.stringify({ code: -18, message: '系统压力有点大' }));
    const started = Date.now();
    const err = await QZoneRequest.request({
      ...base,
      retries: 100,
      retryBaseMs: 50,
      totalBudgetMs: 20,
    }).then(
      () => null,
      (e) => e
    );
    expect(err.__budgetExceeded).toBe(true);
    expect(Date.now() - started).toBeLessThan(400);
    expect(ajaxCalls.length).toBeLessThan(5);
  });

  it('jQuery 不回调时硬超时兜底 → __timeout，不再永久挂起', async () => {
    ajaxImpl = () => {
      /* 永不回调，模拟代理/上游挂起且 jQuery timeout 不触发 */
    };
    const started = Date.now();
    const err = await QZoneRequest.request({
      ...base,
      retries: 0,
      timeoutMs: 30,
      totalBudgetMs: 500,
    }).then(
      () => null,
      (e) => e
    );
    expect(err.__timeout).toBe(true);
    expect(err.__networkKind).toBe('transient');
    expect(Date.now() - started).toBeLessThan(800);
    expect(ajaxCalls).toHaveLength(1);
  });

  it('在途请求期间取消 → 立即 reject __exportCancelled，不再发下一发', async () => {
    ajaxImpl = () => {
      /* 永不回调，模拟请求挂起 */
    };
    const p = QZoneRequest.request({ ...base, retries: 5, retryBaseMs: 10 }).then(
      () => null,
      (e) => e
    );
    await new Promise((r) => setTimeout(r, 10));
    sandbox.window.__engineExportState.cancelled = true;
    const err = await p;
    expect(err.__exportCancelled).toBe(true);
    expect(err.__networkKind).toBe('aborted');
    expect(ajaxCalls).toHaveLength(1);
  });

  it('AbortSignal abort → 中断在途请求并带原因', async () => {
    ajaxImpl = () => {
      /* 永不回调 */
    };
    const controller = new AbortController();
    const p = QZoneRequest.request({ ...base, signal: controller.signal }).then(
      () => null,
      (e) => e
    );
    await new Promise((r) => setTimeout(r, 10));
    controller.abort('用户暂停');
    const err = await p;
    expect(err.__exportCancelled).toBe(true);
    expect(err.__networkKind).toBe('aborted');
    expect(err.message).toContain('用户暂停');
    expect(ajaxCalls).toHaveLength(1);
  });

  it('成功路径返回原始文本，重复回调只结算一次', async () => {
    ajaxImpl = (opts) => {
      opts.success.call(opts, JSON.stringify({ code: 0, data: 42 }));
      Promise.resolve().then(() => opts.success.call(opts, JSON.stringify({ code: 0, data: 99 })));
    };
    const raw = await QZoneRequest.request(base);
    expect(JSON.parse(raw).data).toBe(42);
  });
});
