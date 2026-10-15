/**
 * 收尾可见状态单测（2026-10-11 实机反馈）：
 * backup:finalizing → finalizingActive 派生；终态/完成事件清除；
 * state-changed 携带的模块清单（他人模式为引擎过滤后的实际执行清单）对齐 moduleList。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const listeners = new Map();

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
        engineInject: async () => ({ ok: true }),
        getHistory: async () => ({ history: [] }),
      },
      config: { set: async () => ({}), get: async () => ({}) },
      fs: {},
    },
    // backup store 的用时计时器用到
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

describe('收尾状态（backup:finalizing）', () => {
  it('active 推送 → finalizingActive=true 且携带剩余计数；完成事件清除', () => {
    const bk = makeStore();
    listeners.get('backup:finalizing')({ active: true, phase: 'downloads', pending: 7, running: 3, total: 100 });
    expect(bk.finalizingActive).toBe(true);
    expect(bk.finalizing).toMatchObject({ phase: 'downloads', pending: 7, running: 3, total: 100 });

    // 完成页出现（record 已由主进程携带）→ 收尾态清除
    listeners.get('backup:completed')({ record: { targetDir: 'D:/bk', total: 1 } });
    expect(bk.finalizingActive).toBe(false);
  });

  it('取消/失败等终态事件清除收尾态（不残留"收尾中"界面）', () => {
    const bk = makeStore();
    listeners.get('backup:finalizing')({ active: true, phase: 'downloads', pending: 1, running: 0, total: 1 });
    expect(bk.finalizingActive).toBe(true);

    listeners.get('backup:state-changed')({ taskId: 'task-x', state: 'cancelled' });
    expect(bk.finalizingActive).toBe(false);
  });

  it('active:false 推送（收尾正常结束）清除收尾态', () => {
    const bk = makeStore();
    listeners.get('backup:finalizing')({ active: true, phase: 'stats', pending: 0, running: 0, total: 0 });
    expect(bk.finalizingActive).toBe(true);

    listeners.get('backup:finalizing')({ active: false });
    expect(bk.finalizingActive).toBe(false);
  });
});

describe('实际执行模块清单（state-changed.modules）', () => {
  it('引擎过滤后的清单覆盖所选清单（他人模式分母对齐）', () => {
    const bk = makeStore();
    // prepare/start 携带所选清单（含他人模式会被剔除的 Friends）
    listeners.get('backup:state-changed')({
      taskId: 'task-m', state: 'running', modules: ['Messages', 'Friends', 'Visitors'],
    });
    expect(bk.activeModules).toEqual(['Messages', 'Friends', 'Visitors']);
    expect(bk.moduleList).toEqual(['Messages', 'Friends', 'Visitors']);

    // 引擎 running 事件（同态）携带过滤后的实际执行清单 → 覆盖
    listeners.get('backup:state-changed')({
      taskId: 'task-m', state: 'running', modules: ['Messages', 'Visitors'],
    });
    expect(bk.moduleList).toEqual(['Messages', 'Visitors']);

    // 结束计时器（测试收尾，避免遗留 interval）
    listeners.get('backup:state-changed')({ taskId: 'task-m', state: 'completed' });
  });
});
