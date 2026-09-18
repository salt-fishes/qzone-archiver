/**
 * v4.9 §B + K2 引擎窗口生命周期单测
 *
 * 背景（反馈 #4/#8）：旧实现退出登录不关引擎窗；引擎窗手动关闭只置空不广播，
 * UI 的 engineReady 从不清零（重试注入还直接抛「引擎窗口不存在」）。
 * 本文件锁定修复后的行为：
 *  ① closed / render-process-gone / did-fail-load / 注入成功 → 统一推送 engine:status-changed
 *     并归位 engineBridge.ready
 *  ② K2：console 中转随窗口生命周期挂载——引擎窗重建后仍生效（不再只挂第一个窗）
 *  ③ 重连=重建：waitForEngineLoad 等 did-finish-load 后注入
 *  ④ 退出登录：备份进行中拒绝；空闲时关引擎窗并广播
 *  ⑤ 按需创建：登录态轮询发现已登录且引擎窗不存在 → 自动拉起（用户手动关窗后不拉起）
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpGlobal;

/** 极简 EventEmitter（vi.hoisted 内无法 await node:events） */
class FakeEmitter {
  constructor() {
    this._ls = {};
  }
  on(ev, fn) {
    (this._ls[ev] = this._ls[ev] || []).push(fn);
    return this;
  }
  once(ev, fn) {
    const g = (...a) => {
      this.off(ev, g);
      fn(...a);
    };
    return this.on(ev, g);
  }
  off(ev, fn) {
    const a = this._ls[ev];
    const i = a ? a.indexOf(fn) : -1;
    if (i >= 0) a.splice(i, 1);
  }
  removeListener(ev, fn) {
    return this.off(ev, fn);
  }
  emit(ev, ...args) {
    (this._ls[ev] || []).slice().forEach((fn) => fn(...args));
  }
}

const { FakeWindow, ipcHandlers, engineInjectMock, sendToUiMock } = vi.hoisted(() => {
  class FakeEmitter2 {
    constructor() {
      this._ls = {};
    }
    on(ev, fn) {
      (this._ls[ev] = this._ls[ev] || []).push(fn);
      return this;
    }
    once(ev, fn) {
      const g = (...a) => {
        this.off(ev, g);
        fn(...a);
      };
      return this.on(ev, g);
    }
    off(ev, fn) {
      const a = this._ls[ev];
      const i = a ? a.indexOf(fn) : -1;
      if (i >= 0) a.splice(i, 1);
    }
    removeListener(ev, fn) {
      return this.off(ev, fn);
    }
    emit(ev, ...args) {
      (this._ls[ev] || []).slice().forEach((fn) => fn(...args));
    }
  }
  class FakeWin extends FakeEmitter2 {
    constructor(opts) {
      super();
      this.opts = opts || {};
      this.created = Date.now();
      this.isDestroyed = () => false;
      // 模拟真实行为：loadURL 完成后触发 did-finish-load（下一微任务，供生命周期监听与 waitForEngineLoad 使用）
      this.loadURL = async (url) => {
        this._url = url || '';
        await Promise.resolve();
        this.webContents.emit('did-finish-load');
      };
      this.loadFile = async () => {};
      this.show = () => {};
      this.focus = () => {};
      this.minimize = () => {};
      this.close = () => this.emit('closed');
      this.setWindowOpenHandler = () => {};
      this._url = '';
      const wc = new FakeEmitter2();
      wc.getURL = () => this._url;
      wc.isLoading = () => false;
      wc.setWindowOpenHandler = () => {};
      wc.session = {
        clearStorageData: async () => {},
        clearCache: async () => {},
        cookies: { get: async () => [], remove: async () => {} },
      };
      this.webContents = wc;
      FakeWin.created.push(this);
    }
  }
  FakeWin.created = [];
  return {
    FakeWindow: FakeWin,
    ipcHandlers: new Map(),
    engineInjectMock: { ready: false, inject: async () => {} },
    sendToUiMock: (ch, p) => pushes.push({ ch, p }),
  };
});

const pushes = [];

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => tmpGlobal) },
  BrowserWindow: FakeWindow,
  shell: { openExternal: async () => {}, openPath: async () => '' },
  net: { fetch: async () => ({ ok: false }) },
  session: {
    fromPartition: vi.fn(() => ({
      clearStorageData: async () => {},
      clearCache: async () => {},
      cookies: { get: async () => [], remove: async () => {} },
    })),
  },
  ipcMain: {
    handle: (ch, fn) => ipcHandlers.set(ch, fn),
    on: () => {},
  },
}));

vi.mock('../../src/main/services/engine-bridge.js', () => {
  const bridge = {
    inject: (...a) => engineInjectMock.inject(...a),
    // ready 读写透传到 engineInjectMock（pushEngineStatus 归位的就是它）
    get ready() {
      return engineInjectMock.ready;
    },
    set ready(v) {
      engineInjectMock.ready = v;
    },
    getCookie: async () => 'psk',
    getLoginStatus: async () => {
      throw new Error('引擎未注入');
    },
  };
  return {
    engineBridge: bridge,
    sendToUi: sendToUiMock,
    getActiveTaskContext: () => null,
    pushEngineStatus: (state, reason) => {
      engineInjectMock.ready = state === 'ready';
      sendToUiMock('engine:status-changed', { state, ...(reason ? { reason } : {}) });
    },
  };
});

const { windows, createEngineWindow, waitForEngineLoad, isEngineDismissed } = await import(
  '../../src/main/windows.js'
);
const { registerBackupIpc } = await import('../../src/main/ipc/backup.js');
const { registerAuthIpc } = await import('../../src/main/ipc/auth.js');
const { taskMachine } = await import('../../src/main/services/task-machine.js');
const { logger } = await import('../../src/main/services/logger.js');

let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-lifecycle-'));
  tmpGlobal = tmpDir;
  registerAuthIpc();
  registerBackupIpc();
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  pushes.length = 0;
  // 复位引擎窗单例状态
  if (windows.engine && !windows.engine.isDestroyed()) {
    windows.engine = null;
  }
  engineInjectMock.ready = false;
});

const engineStatusPushes = () => pushes.filter((p) => p.ch === 'engine:status-changed');
const lastPush = () => engineStatusPushes().at(-1);

describe('§B① 引擎状态统一广播', () => {
  it('注入成功 → ready 推送且 engineBridge.ready=true', async () => {
    const injectSpy = vi.spyOn(engineInjectMock, 'inject').mockResolvedValue(undefined);
    createEngineWindow(); // loadURL 完成自动触发 did-finish-load → 注入
    await new Promise((r) => setTimeout(r, 10));
    expect(injectSpy).toHaveBeenCalledTimes(1);
    expect(lastPush().p.state).toBe('ready');
    expect(engineInjectMock.ready).toBe(true);
  });

  it('窗口 closed → closed 推送 + ready 归位 + 单例置空 + dismissed 置位', async () => {
    createEngineWindow();
    engineInjectMock.ready = true; // 模拟已就绪
    windows.engine.emit('closed');
    expect(windows.engine).toBe(null);
    expect(lastPush().p.state).toBe('closed');
    expect(engineInjectMock.ready).toBe(false);
    expect(isEngineDismissed()).toBe(true);
  });

  it('render-process-gone → crashed 推送（含原因）', () => {
    createEngineWindow();
    windows.engine.webContents.emit('render-process-gone', {}, { reason: 'oom' });
    expect(lastPush().p.state).toBe('crashed');
    expect(lastPush().p.reason).toContain('oom');
    expect(engineInjectMock.ready).toBe(false);
  });

  it('主框架 did-fail-load → crashed；子框架失败忽略', () => {
    createEngineWindow();
    windows.engine.webContents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', 'https://user.qzone.qq.com', false);
    expect(engineStatusPushes().length).toBe(0); // 子框架
    windows.engine.webContents.emit('did-fail-load', {}, -3, 'ERR_ABORTED', 'https://user.qzone.qq.com', true);
    expect(lastPush().p.state).toBe('crashed');
  });

  it('离开 qzone 页面（跳转扫码登录页）→ loading 推送', () => {
    createEngineWindow();
    engineInjectMock.ready = true;
    windows.engine.webContents.emit('did-navigate', {}, 'https://xui.ptlogin2.qq.com/cgi-bin/xlogin');
    expect(lastPush().p.state).toBe('loading');
    expect(engineInjectMock.ready).toBe(false);
  });
});

describe('§K2 console 中转随引擎窗重建仍生效', () => {
  it('第一个窗与重建后的窗都能收到 console-message 并落日志', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // 第一个引擎窗
    const a = createEngineWindow();
    a.webContents.emit('console-message', { message: '[e:info] 注入脚本第一段日志', level: 1 });
    expect(infoSpy).toHaveBeenCalledWith('[info] [engine] 注入脚本第一段日志');
    // 窗口关闭（旧实现只挂一次监听，这里模拟断链场景）
    a.emit('closed');
    infoSpy.mockClear();
    // 重建第二个引擎窗（新实现：attachEngineLifecycle 在 createEngineWindow 内重挂）
    const b = createEngineWindow();
    expect(b).not.toBe(a);
    b.webContents.emit('console-message', { message: '[e:error] 重建后的日志', level: 3 });
    expect(errorSpy).toHaveBeenCalledWith('[error] [engine] 重建后的日志');
  });
});

describe('§B③ 重连=重建', () => {
  it('waitForEngineLoad：已加载完成立即返回；未加载等 did-finish-load', async () => {
    const loaded = createEngineWindow();
    loaded._url = 'https://user.qzone.qq.com/330';
    await expect(waitForEngineLoad(loaded, 100)).resolves.toBeUndefined();

    const pending = createEngineWindow();
    pending._url = '';
    Object.defineProperty(pending.webContents, 'isLoading', { value: () => true });
    const p = waitForEngineLoad(pending, 500);
    setTimeout(() => pending.webContents.emit('did-finish-load'), 10);
    await expect(p).resolves.toBeUndefined();
  });

  it('waitForEngineLoad：超时拒绝', async () => {
    const w = createEngineWindow();
    await new Promise((r) => setTimeout(r, 0)); // 让构造期的 loadURL/did-finish-load 先走完
    Object.defineProperty(w.webContents, 'isLoading', { value: () => true });
    await expect(waitForEngineLoad(w, 30)).rejects.toThrow(/加载超时/);
  });

  it('backup:engine-inject：窗口不存在时重建并注入成功', async () => {
    const handler = ipcHandlers.get('backup:engine-inject');
    expect(handler).toBeTypeOf('function');
    const injectSpy = vi.spyOn(engineInjectMock, 'inject').mockResolvedValue(undefined);
    const r = await handler();
    expect(r.ok).toBe(true);
    // 生命周期注入一次（loadURL 完成触发）+ 重连流程显式注入一次
    expect(injectSpy.mock.calls.length).toBe(2);
    expect(lastPush().p.state).toBe('ready');
  });

  it('backup:engine-inject：注入失败 → crashed 推送 + ok:false', async () => {
    const handler = ipcHandlers.get('backup:engine-inject');
    vi.spyOn(engineInjectMock, 'inject').mockRejectedValue(new Error('脚本注入中断'));
    const r = await handler();
    expect(r.ok).toBe(false);
    expect(lastPush().p.state).toBe('crashed');
    expect(lastPush().p.reason).toContain('脚本注入中断');
  });
});

describe('§B④⑤ 退出登录与按需创建', () => {
  it('备份进行中退出登录被拒绝', async () => {
    const logout = ipcHandlers.get('auth:logout');
    taskMachine.dispatch('prepare', { taskId: 'task-busy', targetDir: 'X:/bk', modules: [] });
    taskMachine.dispatch('start', {});
    const r = await logout();
    expect(r.error).toContain('请先取消备份');
    taskMachine.dispatch('cancel'); // 复位状态机
  });

  it('空闲退出登录 → 关闭引擎窗并推送 closed', async () => {
    const logout = ipcHandlers.get('auth:logout');
    createEngineWindow();
    const r = await logout();
    expect(r).toBe(null);
    const closedPush = engineStatusPushes().find((p) => p.p.state === 'closed');
    expect(closedPush).toBeTruthy();
  });

  it('登录态轮询发现已登录且引擎窗不存在 → 自动拉起；用户手动关窗后不拉起', async () => {
    vi.useFakeTimers();
    try {
      const { watchAuthStatus, stopWatchAuthStatus } = await import('../../src/main/ipc/auth.js');
      // 复位 dismissed 标记（此前测试的 closed 会置位）：建一次窗即复位，再手动摘除引用
      createEngineWindow();
      windows.engine = null;

      const bridge = (await import('../../src/main/services/engine-bridge.js')).engineBridge;
      const origGetCookie = bridge.getCookie;
      bridge.getCookie = async () => '';
      watchAuthStatus(1_000_000);
      await vi.advanceTimersByTimeAsync(20);
      expect(windows.engine).toBe(null);

      // 登录态出现（如持久化 session 的冷启动）→ 轮询自动拉起引擎窗
      bridge.getCookie = origGetCookie; // mock 返回 'psk' → 已登录
      await vi.advanceTimersByTimeAsync(1_000_000);
      expect(windows.engine).not.toBe(null);
      stopWatchAuthStatus();

      // 用户手动关窗 → dismissed；轮询不再自动拉起
      windows.engine.emit('closed');
      expect(isEngineDismissed()).toBe(true);
      watchAuthStatus(1_000_000);
      await vi.advanceTimersByTimeAsync(1_000_000);
      expect(windows.engine).toBe(null);
      stopWatchAuthStatus();
    } finally {
      vi.useRealTimers();
    }
  });
});
