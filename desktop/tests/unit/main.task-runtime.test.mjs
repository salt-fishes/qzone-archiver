/**
 * v5.5 M0：任务运行时（task-runtime）单测
 *  ① running 态 30s 无心跳 → 推 backup:stalled（含最后阶段与时长）；只推事实，不改状态机
 *  ② 心跳恢复 → 复位停滞并补推 running（状态机仍 running 时）
 *  ③ 非 running 态不判停滞；离开 running 自动解除
 *  ④ powerSaveBlocker：busy 态持有、终态释放；holdPowerSave/releasePowerSave 收尾续期
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/userData' },
  BrowserWindow: class {},
  shell: { openExternal: async () => {} },
  powerSaveBlocker: { start: () => 1, stop: () => {} },
}));

vi.mock('../../src/main/services/engine-bridge.js', () => ({
  sendToUi: (ch, p) => pushes.push({ ch, p }),
}));

const { createTaskRuntime } = await import('../../src/main/services/task-runtime.js');
const { PushChannels } = await import('../../src/shared/ipc-contract.mjs');

const pushes = [];

function makeMachine() {
  const m = {
    state: 'idle',
    taskId: null,
    modules: [],
    startedAt: null,
    getSnapshot() {
      return { state: m.state, taskId: m.taskId, modules: [...m.modules], startedAt: m.startedAt };
    },
  };
  return m;
}

function makeRuntime(machine, now) {
  const powerCalls = [];
  const powerSaveBlocker = {
    start: () => {
      powerCalls.push('start');
      return 1;
    },
    stop: () => powerCalls.push('stop'),
  };
  const rt = createTaskRuntime({
    machine,
    powerSaveBlocker,
    now,
    push: (ch, p) => pushes.push({ ch, p }),
    log: { info() {}, warn() {}, task: () => ({ warn() {}, info() {}, error() {} }) },
  });
  return { rt, powerCalls };
}

describe('心跳看门狗（v5.5 M0）', () => {
  it('running 态 30s 无心跳 → 推 backup:stalled（不改状态机状态）', () => {
    pushes.length = 0;
    let t = 1_000_000;
    const machine = makeMachine();
    machine.state = 'running';
    machine.taskId = 'task-1';
    machine.startedAt = t;
    const { rt } = makeRuntime(machine, () => t);

    rt.recordHeartbeat({ taskId: 'task-1', module: 'Blogs', phase: '翻页' });
    t += 31_000; // 静默 31s
    rt.tick();

    const stall = pushes.find((p) => p.ch === PushChannels.backupStalled);
    expect(stall).toBeTruthy();
    expect(stall.p.taskId).toBe('task-1');
    expect(stall.p.lastModule).toBe('Blogs');
    expect(stall.p.lastPhase).toBe('翻页');
    expect(stall.p.silentMs).toBe(31_000);
    // 只推事实：状态机快照不被修改
    expect(machine.state).toBe('running');
    // 停滞期间不重复推送
    t += 10_000;
    rt.tick();
    expect(pushes.filter((p) => p.ch === PushChannels.backupStalled)).toHaveLength(1);
  });

  it('心跳恢复 → 复位停滞并补推 running；30s 内心跳不误报', () => {
    pushes.length = 0;
    let t = 2_000_000;
    const machine = makeMachine();
    machine.state = 'running';
    machine.taskId = 'task-2';
    const { rt } = makeRuntime(machine, () => t);

    rt.recordHeartbeat({ module: 'Photos' });
    t += 10_000;
    rt.tick();
    expect(pushes.filter((p) => p.ch === PushChannels.backupStalled)).toHaveLength(0);

    t += 25_000; // 累计 35s 无心跳 → 停滞
    rt.tick();
    expect(pushes.filter((p) => p.ch === PushChannels.backupStalled)).toHaveLength(1);

    t += 60_000;
    rt.recordHeartbeat({ module: 'Photos' });
    const running = pushes.filter((p) => p.ch === PushChannels.backupStateChanged && p.p.state === 'running');
    expect(running).toHaveLength(1);
    t += 10_000;
    rt.tick();
    expect(pushes.filter((p) => p.ch === PushChannels.backupStalled)).toHaveLength(1); // 不再累计
  });

  it('非 running 态不判停滞；离开 running 自动解除', () => {
    pushes.length = 0;
    let t = 3_000_000;
    const machine = makeMachine();
    machine.state = 'running';
    machine.taskId = 'task-3';
    const { rt } = makeRuntime(machine, () => t);

    rt.recordHeartbeat({});
    t += 40_000;
    machine.state = 'paused'; // 用户暂停：无心跳是预期
    rt.tick();
    expect(pushes.filter((p) => p.ch === PushChannels.backupStalled)).toHaveLength(0);

    // 暂停期间停滞标记复位后，恢复 running 且心跳一直没来 → 重新判定
    machine.state = 'running';
    rt.tick();
    expect(pushes.filter((p) => p.ch === PushChannels.backupStalled)).toHaveLength(1);
  });
});

describe('powerSaveBlocker（v5.5 M0）', () => {
  it('busy 态持有、终态释放；hold/release 显式续期', () => {
    let t = 4_000_000;
    const machine = makeMachine();
    const { rt, powerCalls } = makeRuntime(machine, () => t);

    machine.state = 'preparing';
    rt.tick();
    expect(powerCalls).toEqual(['start']);

    machine.state = 'completed';
    rt.tick();
    expect(powerCalls).toEqual(['start', 'stop']);

    // 收尾期（引擎完成后等下载落盘）：显式持有，结束释放
    rt.holdPowerSave();
    expect(powerCalls).toEqual(['start', 'stop', 'start']);
    rt.releasePowerSave();
    expect(powerCalls).toEqual(['start', 'stop', 'start', 'stop']);
  });
});
