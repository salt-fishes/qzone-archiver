/**
 * v4.9 §A 昵称三层兜底（主进程侧）单测
 *
 * 根因回顾：昵称唯一来源是引擎 getLoginStatus（注入完成后才可用），旧实现
 * ① 引擎未就绪时只返回 {loggedIn, qqNumber}（无昵称）且 ② 只在 loggedIn 变化时
 * 推送 → 昵称补齐后 UI 永远收不到。本文件锁定修复后的行为：
 *  ① 无昵称 → configStore.lastProfile 缓存兜底（换账号不用旧昵称）
 *  ② 昵称补齐后必须再推一次（状态签名比较，而非只看 loggedIn）
 *  ③ 签名不变不重复推
 *  ④ 登录成功但昵称为空 → 短间隔重试补齐，拿到即推送一次
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpGlobal;

const { engineBridgeMock, sendToUiMock } = vi.hoisted(() => ({
  engineBridgeMock: {
    getCookie: vi.fn(),
    getLoginStatus: vi.fn(),
  },
  sendToUiMock: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => tmpGlobal) },
  // §B：登录态轮询会按需 createEngineWindow——提供可构造的最小 BrowserWindow
  BrowserWindow: class {
    constructor() {
      this.webContents = {
        on: () => {},
        setWindowOpenHandler: () => {},
        getURL: () => 'https://user.qzone.qq.com/',
        isLoading: () => false,
        session: {},
      };
    }
    loadURL() {}
    loadFile() {}
    on() {}
    setWindowOpenHandler() {}
    isDestroyed() {
      return false;
    }
    show() {}
    focus() {}
    close() {}
    minimize() {}
  },
  shell: { openExternal: async () => {} },
}));

vi.mock('../../src/main/services/engine-bridge.js', () => ({
  engineBridge: engineBridgeMock,
  sendToUi: sendToUiMock,
  getActiveTaskContext: () => null,
}));

const { getAuthStatus, watchAuthStatus, stopWatchAuthStatus } = await import(
  '../../src/main/ipc/auth.js'
);
const { configStore } = await import('../../src/main/services/config-store.js');

let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-status-'));
  tmpGlobal = tmpDir;
});

afterAll(() => {
  stopWatchAuthStatus();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  stopWatchAuthStatus();
  configStore.reset({});
  // 默认：已登录、引擎未就绪（getLoginStatus 失败、cookie 有 uin）
  engineBridgeMock.getCookie.mockImplementation(async (name) => {
    if (name === 'p_skey') return 'psk';
    if (name === 'uin') return '12345';
    return '';
  });
  engineBridgeMock.getLoginStatus.mockRejectedValue(new Error('引擎未注入'));
});

describe('§A① getAuthStatus 昵称缓存兜底', () => {
  it('引擎未注入（无昵称）→ 用 lastProfile 缓存兜底', async () => {
    configStore.set({ lastProfile: { qqNumber: '12345', nickname: '穗稔', avatar: '' } });
    const s = await getAuthStatus();
    expect(s.loggedIn).toBe(true);
    expect(s.qqNumber).toBe('12345');
    expect(s.nickname).toBe('穗稔');
    expect(s.fromCache).toBe(true);
  });

  it('无缓存 → 只返回 loggedIn + qqNumber（不含 undefined 键）', async () => {
    const s = await getAuthStatus();
    expect(s).toEqual({ loggedIn: true, qqNumber: '12345' });
  });

  it('换账号不使用旧账号的昵称缓存', async () => {
    configStore.set({ lastProfile: { qqNumber: '99999', nickname: '别人', avatar: '' } });
    const s = await getAuthStatus();
    expect(s.nickname).toBeUndefined();
    expect(s.fromCache).toBeUndefined();
  });

  it('引擎注入完成（拿到昵称）→ 返回真实昵称并落缓存', async () => {
    engineBridgeMock.getLoginStatus.mockResolvedValue({ qqNumber: '12345', nickname: '穗稔', avatar: 'a1' });
    const s = await getAuthStatus();
    expect(s.nickname).toBe('穗稔');
    expect(s.fromCache).toBeUndefined();
    const cached = configStore.get().lastProfile;
    expect(cached.qqNumber).toBe('12345');
    expect(cached.nickname).toBe('穗稔');
  });
});

describe('§A② 状态签名推送（watchAuthStatus）', () => {
  it('昵称补齐后必须再推一次；签名不变不重复推', async () => {
    watchAuthStatus(10);
    await new Promise((r) => setTimeout(r, 80)); // 基准签名建立（无昵称）
    sendToUiMock.mockClear();

    await new Promise((r) => setTimeout(r, 80)); // 状态不变
    expect(sendToUiMock).not.toHaveBeenCalled(); // ③ 签名不变不重复推

    // 引擎注入完成：昵称出现 → 签名变化 → 必须再推一次
    engineBridgeMock.getLoginStatus.mockResolvedValue({ qqNumber: '12345', nickname: '穗稔', avatar: 'a1' });
    await new Promise((r) => setTimeout(r, 120));
    const pushes = sendToUiMock.mock.calls.filter(([, p]) => p?.nickname === '穗稔');
    expect(pushes.length).toBeGreaterThanOrEqual(1); // ② 补齐后再推
  }, 5000);
});

describe('§A③ 登录成功昵称补齐重试', () => {
  it('登录成功但昵称为空 → 重试拿到昵称后推送一次（fake timers）', async () => {
    vi.useFakeTimers();
    try {
      // 初始：未登录
      engineBridgeMock.getCookie.mockResolvedValue('');
      engineBridgeMock.getLoginStatus.mockRejectedValue(new Error('not ready'));
      watchAuthStatus(1_000_000_000); // 轮询周期极大：只靠手动推进触发
      await vi.advanceTimersByTimeAsync(20); // 基准 '0|'
      sendToUiMock.mockClear();

      // 扫码成功：p_skey 出现，但引擎尚未注入完（无昵称）→ 轮询推登录态并启动重试
      engineBridgeMock.getCookie.mockImplementation(async (name) => (name === 'p_skey' ? 'psk' : '12345'));
      await vi.advanceTimersByTimeAsync(1_000_000_000);
      const justLogin = sendToUiMock.mock.calls.filter(([, p]) => p?.loginJustSucceeded);
      expect(justLogin.length).toBe(1);

      // 重试 1.5s × N：第 3 次重试时引擎就绪返回昵称 → 恰好推送一次
      let calls = 0;
      engineBridgeMock.getLoginStatus.mockImplementation(async () => {
        calls += 1;
        if (calls >= 3) return { qqNumber: '12345', nickname: '穗稔' };
        throw new Error('not ready');
      });
      await vi.advanceTimersByTimeAsync(1500 * 4);
      const withNick = sendToUiMock.mock.calls.filter(([, p]) => p?.nickname === '穗稔');
      expect(withNick.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
