/**
 * v4.9 §B 渲染层引擎状态单测：backup store 收到 engine:status-changed 后
 * engineReady / engineFailed / engineState 派生正确（关窗自动感知，无需手动刷新）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const listeners = new Map();
let engineInjectCalls = 0;

const { useBackupStore } = await import('../../src/renderer/src/stores/backup');

const originalWindow = globalThis.window;

beforeAll(() => {
  globalThis.window = {
    api: {
      on: (ch, cb) => {
        listeners.set(ch, cb);
        return () => listeners.delete(ch);
      },
      download: { getState: async () => ({ queue: [] }) },
      backup: {
        engineInject: async () => {
          engineInjectCalls += 1;
          return { ok: true };
        },
      },
      config: { set: async () => ({}), get: async () => ({}) },
      fs: {},
    },
    // backup store 的用时计时器用到（watch immediate 会触发 tickStop）
    setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
    clearInterval: (t) => globalThis.clearInterval(t),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (t) => globalThis.clearTimeout(t),
  };
});

afterAll(() => {
  globalThis.window = originalWindow;
});

function makeStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const bk = useBackupStore();
  bk.initBackup();
  return bk;
}

describe('§B engine:status-changed 状态派生', () => {
  it('closed 推送 → engineReady=false、engineFailed=true、状态=closed', () => {
    const bk = makeStore();
    listeners.get('engine:status-changed')({ state: 'ready' });
    expect(bk.engineReady).toBe(true);

    listeners.get('engine:status-changed')({ state: 'closed', reason: '窗口被关闭' });
    expect(bk.engineReady).toBe(false);
    expect(bk.engineFailed).toBe(true);
    expect(bk.engineState).toBe('closed');
    expect(bk.engineStateReason).toBe('窗口被关闭');
  });

  it('crashed 推送 → 连接失败态；再次 ready → 恢复已连接', () => {
    const bk = makeStore();
    listeners.get('engine:status-changed')({ state: 'crashed', reason: '注入失败：xx' });
    expect(bk.engineFailed).toBe(true);
    expect(bk.engineState).toBe('crashed');

    listeners.get('engine:status-changed')({ state: 'ready' });
    expect(bk.engineReady).toBe(true);
    expect(bk.engineFailed).toBe(false);
  });

  it('loading 推送 → 连接中（不置失败标记）', () => {
    const bk = makeStore();
    listeners.get('engine:status-changed')({ state: 'loading' });
    expect(bk.engineState).toBe('loading');
    expect(bk.engineFailed).toBe(false);
    expect(bk.engineReady).toBe(false);
  });

  it('retryEngine 成功路径：先进入 loading，成功后不置失败', async () => {
    const bk = makeStore();
    listeners.get('engine:status-changed')({ state: 'closed' });
    const p = bk.retryEngine();
    expect(bk.engineState).toBe('loading');
    expect(bk.engineFailed).toBe(false);
    expect(await p).toBe(true);
    expect(engineInjectCalls).toBeGreaterThan(0);
  });
});
