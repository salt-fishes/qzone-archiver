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
      // v5.5 M0：任务运行时快照（initBackup 初始化恢复用）
      task: { getState: async () => ({ task: { state: 'idle' }, runtime: { stalled: false } }) },
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

/**
 * v5.5 M0：idle 默认态 / 任务停滞 / paused reason（plans/v5.5.md §4.4）
 */
describe('v5.5 M0 idle 默认态与停滞告警', () => {
  it('初始 engineState=idle：冷启动未登录显示「未连接」而非「连接中」', () => {
    const bk = makeStore();
    expect(bk.engineState).toBe('idle');
    expect(bk.engineReady).toBe(false);
    expect(bk.engineFailed).toBe(false); // idle 不是失败态（未建窗 ≠ 连接失败）
  });

  it('backup:stalled → stalled=true + 明细；running 恢复 → 解除', () => {
    const bk = makeStore();
    listeners.get('backup:state-changed')({ taskId: 't1', state: 'running', modules: ['Blogs'] });
    listeners.get('backup:stalled')({ taskId: 't1', silentMs: 61000, lastModule: 'Blogs', lastPhase: '翻页' });
    expect(bk.stalled).toBe(true);
    expect(bk.stalledInfo.lastModule).toBe('Blogs');
    expect(bk.stalledInfo.silentMs).toBe(61000);

    // 心跳恢复：主进程补推 running → 解除
    listeners.get('backup:state-changed')({ taskId: 't1', state: 'running', modules: ['Blogs'] });
    expect(bk.stalled).toBe(false);
    expect(bk.stalledInfo).toBe(null);
  });

  it('paused(非 user 原因) → pausedReason 透传；终态清除停滞与原因', () => {
    const bk = makeStore();
    listeners.get('backup:state-changed')({ taskId: 't1', state: 'running', modules: ['Blogs'] });
    listeners.get('backup:state-changed')({ taskId: 't1', state: 'paused', pausedReason: 'engine_lost' });
    expect(bk.paused).toBe(true);
    expect(bk.pausedReason).toBe('engine_lost');

    listeners.get('backup:state-changed')({ taskId: 't1', state: 'cancelled' });
    expect(bk.pausedReason).toBe(null);
    expect(bk.stalled).toBe(false);
  });

  it('task:get-state 快照恢复：运行中任务重载后恢复 running 与停滞标记', async () => {
    // 模拟主进程快照（renderer store 初始化时调用）
    const store = await import('../../src/renderer/src/stores/backup');
    const pinia = createPinia();
    setActivePinia(pinia);
    globalThis.window.api.task.getState = async () => ({
      task: { taskId: 't-live', state: 'running', modules: ['Blogs'] },
      runtime: { stalled: true, msSinceHeartbeat: 45000, lastHeartbeat: { module: 'Blogs', phase: '翻页' } },
    });
    const bk = store.useBackupStore();
    bk.initBackup();
    await new Promise((r) => setTimeout(r, 0)); // 快照 Promise 落地
    expect(bk.taskState).toBe('running');
    expect(bk.stalled).toBe(true);
    expect(bk.stalledInfo.silentMs).toBe(45000);
    globalThis.window.api.task.getState = async () => ({ task: { state: 'idle' }, runtime: { stalled: false } });
  });
});
