/**
 * v5.5 M0 补：MIME 探测超时单位回归
 *
 * 背景：engine 侧 autoFileSuffixTimeOut 以【秒】配置（默认 30），
 * desktop-adapters 曾直接透传给主进程；主进程 setTimeout 按【毫秒】解释，
 * 结果 30s 变成 30ms，net.fetch 立刻 abort → 自动后缀识别几乎必然失败
 * （2026-10-22 现场：D:\No.3 里大量无后缀媒体文件）。
 *
 * 本测试锁定适配层必须把秒换算成毫秒再发 IPC。
 * 引擎脚本依赖 window.engineBridge，按既有 engine.*.test.mjs 惯例用 node:vm 注入。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const calls = [];
let sandbox;
let platform;

beforeAll(() => {
  // desktop-adapters.js 顶层会包装 console；用 stub 避免污染测试进程
  const consoleStub = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
  sandbox = {
    console: consoleStub,
    setTimeout,
    clearTimeout,
    Uint8Array,
    ArrayBuffer,
    Blob,
    URL,
    TextDecoder,
    TextEncoder,
    window: {
      engineBridge: {
        invoke(channel, payload) {
          calls.push({ channel, payload });
          return Promise.resolve('image/jpeg');
        },
        post() {},
      },
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/desktop-adapters.js'), 'utf8'),
    sandbox,
    { filename: 'desktop-adapters.js' }
  );
  platform = vm.runInContext('window.QZonePlatform', sandbox);
});

describe('MIME 探测超时单位（v5.5 M0 补）', () => {
  it('配置秒 → IPC 毫秒：30 秒必须传 30000', async () => {
    calls.length = 0;
    await platform.network.getMimeType('https://example.com/a.jpg', 30);
    expect(calls).toHaveLength(1);
    expect(calls[0].channel).toBe('engine:network-mimetype');
    expect(calls[0].payload).toEqual({ url: 'https://example.com/a.jpg', timeout: 30000 });
  });

  it('字符串秒值同样换算（设置页可能回传字符串）', async () => {
    calls.length = 0;
    await platform.network.getMimeType('https://example.com/b.png', '15');
    expect(calls[0].payload.timeout).toBe(15000);
  });

  it('缺省/非法值回退 30 秒', async () => {
    calls.length = 0;
    await platform.network.getMimeType('https://example.com/c.gif');
    await platform.network.getMimeType('https://example.com/d.gif', 0);
    expect(calls.map((c) => c.payload.timeout)).toEqual([30000, 30000]);
  });
});
