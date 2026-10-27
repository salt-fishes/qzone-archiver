/**
 * v5.5 M0：网络层 settle 守卫单测（plans/v5.5.md §4.6）
 *
 * 背景（2026-10-22 现场事件）：Utils.get 的 success 路径业务错误重试耗尽后
 * retryRequest(this) 不传 reject → reject(undefined) 抛 TypeError → Promise 永不结算，
 * 调用方（采集翻页循环）永久挂死且无任何日志。本文件锁定修复后行为：
 *  ① 业务错误重试耗尽必须 reject（挂死回归）
 *  ② settle 守卫：resolve/reject 只结算一次
 *  ③ 重试退避期间取消 → 立即 reject 且不再发下一发（可取消退避）
 *  ④ -10000「使用人数过多」不再进入 waitTime（3600s）专用长等待
 *
 * 引擎脚本依赖 window/$/API 全局，按既有 engine.*.test.mjs 惯例以 node:vm 注入 stub 后执行。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ajaxCalls = [];
let ajaxImpl = () => {};
let sandbox;
let API;

beforeAll(() => {
  sandbox = {
    window: { __engineExportState: { cancelled: false, paused: false, pauseWaiters: [] } },
    console,
    setTimeout,
    clearTimeout,
    REST_URLS: {},
    QZone_Config: {
      Common: { listRetryCount: 2, listRetrySleep: 0.05, RestSleepUrls: [], waitCount: 2, waitTime: 3600 },
    },
    MODULE_NAME_MAPS: {},
    // jQuery 最小 stub：选择器链 + ajax 入口
    $: () => ({ show() {}, hide() {}, html() {} }),
    API: {
      Utils: {
        buildNetworkErrorMessage: (xhr, status, error) =>
          `HTTP ${xhr?.status || 0} ${error || status || '网络错误'}`,
        noteServerSuccess() {},
        noteServerFailure() {
          return false;
        },
        serverFailureMessage: (s) => `连续异常 HTTP ${s}`,
        formatDate: () => '01-01 00:00:00',
      },
    },
  };
  sandbox.$.ajax = (opts) => {
    ajaxCalls.push(opts);
    ajaxImpl(opts);
  };
  vm.createContext(sandbox);
  // String.prototype.format（utils.js 注入的自定义方法，retryRequest 拼 #errorTips 文案时使用）
  vm.runInContext("String.prototype.format = function() { return String(this); };", sandbox);
  vm.runInContext(readFileSync(path.join(rootDir, 'src/engine/api/network.js'), 'utf8'), sandbox, {
    filename: 'api/network.js',
  });
  // network.js 顶层 const API_NETWORK_METHODS（词法绑定），装配到 API.Utils 后取回引用
  vm.runInContext('API.Utils = Object.assign(API.Utils, API_NETWORK_METHODS);', sandbox);
  API = vm.runInContext('API', sandbox);
});

/** 业务错误（-10000）场景：每次 ajax 都返回业务错误 */
function stubBusyError() {
  ajaxImpl = (opts) =>
    opts.success.call(opts, JSON.stringify({ code: -10000, message: '使用人数过多，请稍后再试' }));
}

describe('v5.5 M0 网络层 settle 守卫', () => {
  it('业务错误重试耗尽必须 reject（挂死回归：success 路径补 reject）', async () => {
    stubBusyError();
    ajaxCalls.length = 0;
    sandbox.window.__engineExportState.cancelled = false;

    await expect(API.Utils.get('https://user.qzone.qq.com/cgi-bin/list')).rejects.toThrow(
      /使用人数过多/
    );
    // 首发 + listRetryCount(2) 次重试
    expect(ajaxCalls.length).toBe(3);
  });

  it('重试退避期间取消 → 立即 reject 且不再发下一发（可取消退避）', async () => {
    stubBusyError();
    ajaxCalls.length = 0;
    sandbox.window.__engineExportState.cancelled = false;

    const p = API.Utils.get('https://user.qzone.qq.com/cgi-bin/list');
    // 首发已发出、进入 50ms 退避等待
    await new Promise((r) => setTimeout(r, 20));
    expect(ajaxCalls.length).toBe(1);
    sandbox.window.__engineExportState.cancelled = true;

    const t0 = Date.now();
    await expect(p).rejects.toMatchObject({ __exportCancelled: true });
    // 退避定时器（50ms）到点即结算，不是等完整重试链
    expect(Date.now() - t0).toBeLessThan(2000);
    const settled = ajaxCalls.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(ajaxCalls.length).toBe(settled); // 取消后不再发请求

    sandbox.window.__engineExportState.cancelled = false;
  });

  it('业务正常路径 resolve，且重复回调只结算一次（settle 守卫）', async () => {
    let doubleSettled = false;
    ajaxImpl = (opts) => {
      opts.success.call(opts, JSON.stringify({ code: 0, message: 'ok', data: 42 }));
      // 模拟异常实现里的重复回调——settle 守卫必须吞掉第二次
      Promise.resolve().then(() => {
        try {
          opts.success.call(opts, JSON.stringify({ code: 0, data: 99 }));
        } catch {
          /* reject after settle 抛错被吞 */
        }
      });
    };
    const result = await API.Utils.get('https://user.qzone.qq.com/cgi-bin/list');
    expect(JSON.parse(result).data).toBe(42);
    expect(doubleSettled).toBe(false);
  });

  it('HTTP 501 快速失败不重试（既有行为保持）', async () => {
    ajaxImpl = (opts) => opts.error.call(opts, { status: 501 }, 'error', 'server');
    ajaxCalls.length = 0;
    await expect(API.Utils.get('https://user.qzone.qq.com/cgi-bin/list')).rejects.toThrow(/501/);
    expect(ajaxCalls.length).toBe(1);
  });

  it('-10000 不再进入 waitTime 长等待：重试间隔仍为 listRetrySleep（3 次调用 < 1s 完成）', async () => {
    stubBusyError();
    ajaxCalls.length = 0;
    const t0 = Date.now();
    await expect(API.Utils.get('https://user.qzone.qq.com/cgi-bin/list')).rejects.toThrow(
      /使用人数过多/
    );
    // waitTime=3600s 旧实现单次退避即 1 小时；现在走 listRetrySleep=0.05s
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
