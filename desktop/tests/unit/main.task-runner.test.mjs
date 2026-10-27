/**
 * v5.5 M1：TaskRunner 单测
 * 覆盖：start（幂等 runId / journal / checkpoint）/ 并发 guard / 引擎启动失败 /
 *       pause·resume（命令 + 状态 + 下载联动）/ engine_lost 禁止 resume /
 *       cancel（引擎失败仍清理）/ 心跳检查点去重 / completed 摘要
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/userData' },
  BrowserWindow: class {},
  shell: { openExternal: async () => {} },
  net: { fetch: vi.fn() },
  powerSaveBlocker: { start: () => 1, stop: () => {} },
}));

const { createTaskRunner } = await import('../../src/main/services/task-runner.js');
const { createTaskMachine } = await import('../../src/main/services/task-machine.js');
const { createTaskStore } = await import('../../src/main/services/task-store.js');

const CTX = { taskId: 'task-1', targetDir: 'D:/No.3', modules: ['Messages', 'Photos'] };
const silentLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

let root;
let store;
let machine;
let engine;
let downloads;
let dropContext;

function makeRunner() {
  return createTaskRunner({
    machine,
    engine,
    store,
    downloads,
    dropContext,
    log: silentLog,
    now: () => 1_000_000,
  });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'qz-task-runner-'));
  store = createTaskStore({ baseDir: root, now: () => 1_000_000 });
  machine = createTaskMachine({
    persist: () => {},
    clear: () => {},
    push: () => {},
    log: () => {},
  });
  engine = {
    start: vi.fn().mockResolvedValue({ type: 'started' }),
    command: vi.fn().mockResolvedValue({ ok: true }),
  };
  downloads = {
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  dropContext = vi.fn();
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('start', () => {
  it('创建 task/journal/checkpoint，迁移 running，并等待 engine.start', async () => {
    const runner = makeRunner();
    const res = await runner.start(CTX);

    expect(res).toMatchObject({ ok: true, taskId: 'task-1', runId: 'task-1-r1' });
    expect(machine.getSnapshot().state).toBe('running');
    expect(engine.start).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1', runId: 'task-1-r1' })
    );
    expect(store.readTask('task-1').task).toBeTruthy();
    expect(store.readJournal('task-1').map((e) => e.type)).toEqual([
      'task-created',
      'run-started',
      'engine-started',
    ]);
    expect(store.loadCheckpoint('task-1')).toMatchObject({
      state: 'running',
      runId: 'task-1-r1',
    });
  });

  it('已有任务进行中 → 拒绝并发启动', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    await expect(runner.start({ ...CTX, taskId: 'task-2' })).rejects.toThrow('已有备份任务');
    expect(engine.start).toHaveBeenCalledTimes(1);
  });

  it('引擎启动失败 → 状态 failed + summary + 清理上下文', async () => {
    engine.start.mockRejectedValueOnce(new Error('engine boom'));
    const runner = makeRunner();

    await expect(runner.start(CTX)).rejects.toThrow('engine boom');
    expect(machine.getSnapshot().state).toBe('failed');
    expect(store.loadSummary('task-1')).toMatchObject({
      state: 'failed',
      runId: 'task-1-r1',
      error: 'engine boom',
    });
    expect(store.readJournal('task-1').at(-1)).toMatchObject({ type: 'finished' });
    expect(dropContext).toHaveBeenCalledWith('task-1');
  });

  it('第二次运行使用 r2（同 taskId 继续/重试）', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    machine.dispatch('cancel');
    store.saveSummary('task-1', { state: 'cancelled', runId: 'task-1-r1' });

    const second = await runner.start(CTX);
    expect(second.runId).toBe('task-1-r2');
  });

  it('resumeFrom 透传给引擎（从 checkpoint 模块继续）', async () => {
    const runner = makeRunner();
    await runner.start({ ...CTX, resumeFrom: { module: 'Photos', phase: 'Photos_Albums_Like' } });
    expect(engine.start).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeFrom: { module: 'Photos', phase: 'Photos_Albums_Like' },
      })
    );
  });
});

describe('pause / resume', () => {
  it('pause：先引擎 ack，再迁移 paused 并暂停下载', async () => {
    const runner = makeRunner();
    await runner.start(CTX);

    const res = await runner.pause();
    expect(res.ok).toBe(true);
    expect(engine.command).toHaveBeenCalledWith('pause');
    expect(machine.getSnapshot()).toMatchObject({ state: 'paused', pausedReason: 'user' });
    expect(downloads.pause).toHaveBeenCalled();
    expect(store.readJournal('task-1').map((e) => e.type)).toContain('paused');
  });

  it('resume：引擎 ack 后恢复 running 并恢复下载', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    await runner.pause();

    const res = await runner.resume();
    expect(res.ok).toBe(true);
    expect(engine.command).toHaveBeenCalledWith('resume');
    expect(machine.getSnapshot().state).toBe('running');
    expect(downloads.resume).toHaveBeenCalled();
  });

  it('engine_lost 暂停 → resume 被拒绝，不再下发引擎命令', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    machine.dispatch('engineLost', { reason: '渲染进程崩溃' });
    engine.command.mockClear();

    const res = await runner.resume();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('引擎会话已丢失');
    expect(engine.command).not.toHaveBeenCalled();
  });

  it('pause 的引擎命令失败 → 状态保持 running', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    engine.command.mockRejectedValueOnce(new Error('engine gone'));

    const res = await runner.pause();
    expect(res.ok).toBe(false);
    expect(machine.getSnapshot().state).toBe('running');
    expect(downloads.pause).not.toHaveBeenCalled();
  });
});

describe('cancel', () => {
  it('引擎取消失败仍清空下载、落 cancelled 摘要', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    engine.command.mockRejectedValueOnce(new Error('cancel failed'));

    const res = await runner.cancel();
    expect(res.ok).toBe(true);
    expect(downloads.cancel).toHaveBeenCalled();
    expect(dropContext).toHaveBeenCalledWith('task-1');
    expect(machine.getSnapshot().state).toBe('cancelled');
    expect(store.loadSummary('task-1')).toMatchObject({
      state: 'cancelled',
      runId: 'task-1-r1',
    });
  });
});

describe('checkpoint / 引擎事实', () => {
  it('心跳按 module/phase 写 checkpoint，同阶段不重复写 journal', async () => {
    const runner = makeRunner();
    await runner.start(CTX);

    runner.onHeartbeat({ taskId: 'task-1', module: 'Photos', phase: 'Photos' });
    expect(store.loadCheckpoint('task-1')).toMatchObject({
      state: 'running',
      module: 'Photos',
      phase: 'Photos',
    });
    const starts = () =>
      store.readJournal('task-1').filter((e) => e.type === 'phase-start').length;
    const n = starts();

    runner.onHeartbeat({ taskId: 'task-1', module: 'Photos', phase: 'Photos' });
    expect(starts()).toBe(n);

    runner.onHeartbeat({
      taskId: 'task-1',
      module: 'Photos',
      phase: 'Photos_Albums_Like',
    });
    expect(starts()).toBe(n + 1);
    expect(store.loadCheckpoint('task-1').phase).toBe('Photos_Albums_Like');
  });

  it('completed 事实 → 状态 completed + summary + finished journal', async () => {
    const runner = makeRunner();
    await runner.start(CTX);

    const verdict = runner.handleEngineState({
      taskId: 'task-1',
      state: 'completed',
      errors: [{ module: 'Photos', message: 'x' }],
      results: { Messages: 'ok' },
      target: { uin: '123' },
    });
    expect(verdict.ok).toBe(true);
    expect(machine.getSnapshot().state).toBe('completed');
    expect(store.loadSummary('task-1')).toMatchObject({
      state: 'completed',
      runId: 'task-1-r1',
      results: { Messages: 'ok' },
      target: { uin: '123' },
    });
    expect(store.loadSummary('task-1').errors).toHaveLength(1);
    expect(store.readJournal('task-1').at(-1)).toMatchObject({
      type: 'finished',
      data: { state: 'completed', errors: 1 },
    });
  });

  it('终态后引擎补发事实 → 幂等，不重复写 summary/journal', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    await runner.cancel();
    const before = store.readJournal('task-1').length;

    const verdict = runner.handleEngineState({ taskId: 'task-1', state: 'cancelled' });
    expect(verdict).toMatchObject({ ok: true, idempotent: true });
    expect(store.readJournal('task-1')).toHaveLength(before);
    expect(store.loadSummary('task-1').state).toBe('cancelled');
  });

  it('module-done → 写 phase-end', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    runner.handleModuleDone({ module: 'Messages' });
    expect(store.readJournal('task-1').at(-1)).toMatchObject({
      type: 'phase-end',
      data: { module: 'Messages' },
    });
  });

  it('failed 事实 → 状态 failed + summary（fatal 错误）', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    const verdict = runner.handleEngineState({
      taskId: 'task-1',
      state: 'failed',
      error: '磁盘空间不足',
    });
    expect(verdict.ok).toBe(true);
    expect(machine.getSnapshot().state).toBe('failed');
    expect(store.loadSummary('task-1')).toMatchObject({
      state: 'failed',
      error: '磁盘空间不足',
    });
    expect(store.readJournal('task-1').at(-1)).toMatchObject({
      type: 'finished',
      data: { state: 'failed' },
    });
  });

  it('getState 返回任务快照、runId 与可恢复任务', async () => {
    const runner = makeRunner();
    await runner.start(CTX);
    // 另一个中断任务
    store.createTask({ taskId: 'task-old', targetDir: 'D:/old', modules: ['Messages'] });
    store.saveCheckpoint('task-old', { state: 'running', module: 'Photos', phase: 'Photos' });

    const snap = runner.getState();
    expect(snap.task.taskId).toBe('task-1');
    expect(snap.runId).toBe('task-1-r1');
    expect(snap.recoverable.map((t) => t.taskId)).toContain('task-old');
  });
});
