/**
 * P3-1 任务状态机单测（架构改造计划 §5.1）
 * 覆盖：状态转移表 / 非法转移 guard / 同态幂等 / 终态 checkpoint 清除 /
 *       失败明细入快照 / 终态后新任务复位
 * 依赖注入 stub（persist/clear/push），不触碰 electron。
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/userData' },
  BrowserWindow: class {},
  shell: { openExternal: async () => {} },
}));

const { createTaskMachine, TASK_STATES } = await import('../../src/main/services/task-machine.js');

function makeMachine() {
  const persisted = [];
  const cleared = [];
  const pushed = [];
  const m = createTaskMachine({
    persist: (id, data) => persisted.push({ id, data }),
    clear: (id) => cleared.push(id),
    push: (p) => pushed.push(p),
  });
  return { m, persisted, cleared, pushed };
}

const CTX = { taskId: 'task-1', targetDir: 'D:/bk', modules: ['Blogs'], config: { a: 1 } };

describe('状态转移表', () => {
  it('正常生命周期：prepare → start → pause → resume → complete', () => {
    const { m, persisted, cleared, pushed } = makeMachine();
    expect(TASK_STATES).toContain('idle');

    expect(m.dispatch('prepare', CTX).ok).toBe(true);
    expect(m.getSnapshot().state).toBe('preparing');
    expect(m.getSnapshot().taskId).toBe('task-1');
    expect(m.getSnapshot().targetDir).toBe('D:/bk');

    expect(m.dispatch('start', CTX).ok).toBe(true);
    expect(m.getSnapshot().state).toBe('running');
    // 非终态持久化 checkpoint（prepare + start 两次）
    expect(persisted.length).toBe(2);
    expect(persisted[1].data.state).toBe('running');

    expect(m.dispatch('pause').ok).toBe(true);
    expect(m.getSnapshot().state).toBe('paused');

    expect(m.dispatch('resume').ok).toBe(true);
    expect(m.getSnapshot().state).toBe('running');

    const r = m.dispatch('complete', { errors: [] });
    expect(r.ok).toBe(true);
    expect(m.getSnapshot().state).toBe('completed');
    expect(m.getSnapshot().completedAt).toBeGreaterThan(0);
    // 终态清除 checkpoint
    expect(cleared).toEqual(['task-1']);
    // 每次成功转移推送 {taskId, state}
    expect(pushed.at(-1)).toEqual({ taskId: 'task-1', state: 'completed' });
  });

  it('引擎 running 事件统一入口：preparing→running 与 paused→running', () => {
    const { m } = makeMachine();
    m.dispatch('prepare', CTX);
    expect(m.dispatch('engineRunning', { taskId: 'task-1' }).ok).toBe(true);
    expect(m.getSnapshot().state).toBe('running');

    m.dispatch('pause');
    expect(m.dispatch('engineRunning', {}).ok).toBe(true);
    expect(m.getSnapshot().state).toBe('running');
  });
});

describe('guard：非法转移拒绝', () => {
  it('idle 态直接 start / pause / resume 均拒绝', () => {
    const { m } = makeMachine();
    expect(m.dispatch('start', CTX).ok).toBe(false);
    expect(m.dispatch('pause').ok).toBe(false);
    expect(m.dispatch('resume').ok).toBe(false);
    expect(m.getSnapshot().state).toBe('idle');
  });

  it('completed 态不可 pause/cancel；idle 态不可 complete', () => {
    const { m } = makeMachine();
    m.dispatch('prepare', CTX);
    m.dispatch('start', CTX);
    m.dispatch('complete', { errors: [] });
    expect(m.dispatch('pause').ok).toBe(false);
    expect(m.dispatch('cancel').ok).toBe(false);
    expect(m.getSnapshot().state).toBe('completed');
  });

  it('未知事件拒绝', () => {
    const { m } = makeMachine();
    const r = m.dispatch('noSuchEvent');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/未知事件/);
  });
});

describe('幂等与终态后复位', () => {
  it('同态事件幂等（主进程已 pause，引擎 paused 事件随后到达）', () => {
    const { m, pushed } = makeMachine();
    m.dispatch('prepare', CTX);
    m.dispatch('start', CTX);
    m.dispatch('pause');
    const before = pushed.length;
    const r = m.dispatch('pause'); // 引擎 paused 事件
    expect(r.ok).toBe(true);
    expect(r.idempotent).toBe(true);
    expect(pushed.length).toBe(before); // 幂等不重复推送
  });

  it('cancelled 后新任务 prepare 复位上下文（P0 回归：取消→立即再备份）', () => {
    const { m } = makeMachine();
    m.dispatch('prepare', CTX);
    m.dispatch('start', CTX);
    m.dispatch('cancel');
    expect(m.getSnapshot().state).toBe('cancelled');

    const ctx2 = { taskId: 'task-2', targetDir: 'D:/bk2', modules: ['Photos'], config: null };
    const r = m.dispatch('prepare', ctx2);
    expect(r.ok).toBe(true);
    const snap = m.getSnapshot();
    expect(snap.state).toBe('preparing');
    expect(snap.taskId).toBe('task-2');
    expect(snap.targetDir).toBe('D:/bk2');
    expect(snap.errors).toEqual([]);
    expect(snap.error).toBe(null);
    expect(snap.completedAt).toBe(null);
  });
});

describe('失败明细与错误记录', () => {
  it('complete 事件携带模块级 errors 入快照（P0-3 遗留项）', () => {
    const { m } = makeMachine();
    m.dispatch('prepare', CTX);
    m.dispatch('start', CTX);
    const errors = [{ module: 'Photos', phase: 'run', code: 'MODULE_FAILED', message: '网络断了' }];
    m.dispatch('complete', { errors });
    expect(m.getSnapshot().errors).toEqual(errors);
  });

  it('fail 事件记录错误消息并进入终态', () => {
    const { m, cleared } = makeMachine();
    m.dispatch('prepare', CTX);
    m.dispatch('start', CTX);
    m.dispatch('fail', { taskId: 'task-1', error: '引擎未就绪' });
    const snap = m.getSnapshot();
    expect(snap.state).toBe('failed');
    expect(snap.error).toBe('引擎未就绪');
    expect(cleared).toContain('task-1');
  });
});
