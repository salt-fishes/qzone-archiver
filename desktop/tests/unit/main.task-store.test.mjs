/**
 * v5.5 M1：TaskStore 单测
 * 覆盖：创建幂等 / journal seq / checkpoint 原子写 / summary /
 *       scan 可恢复判定 / markInterrupted / prune / taskId 安全校验
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/qz-userData' },
}));

const { createTaskStore, sanitizeTaskId } = await import('../../src/main/services/task-store.js');

let root;
let clock;
let store;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'qz-task-store-'));
  clock = 1_000_000;
  store = createTaskStore({ baseDir: root, now: () => clock });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('taskId 安全校验', () => {
  it('拒绝空值、路径分隔符与 .. 穿越', () => {
    expect(() => sanitizeTaskId('')).toThrow('非法 taskId');
    expect(() => sanitizeTaskId('../evil')).toThrow('非法 taskId');
    expect(() => sanitizeTaskId('a/b')).toThrow('非法 taskId');
    expect(() => sanitizeTaskId('a\\b')).toThrow('非法 taskId');
    expect(() => sanitizeTaskId('..')).toThrow('非法 taskId');
  });

  it('保留合法字符', () => {
    expect(sanitizeTaskId('task-1792653097619-lyencr')).toBe('task-1792653097619-lyencr');
    expect(sanitizeTaskId('task_1.2')).toBe('task_1.2');
  });
});

describe('创建与 journal', () => {
  it('createTask 幂等：重复创建不覆盖 task.json，只追加一条 task-created', () => {
    const first = store.createTask({
      taskId: 'task-1',
      targetDir: 'D:/No.3',
      modules: ['Messages'],
      appVersion: '5.5.0',
    });
    expect(first.taskId).toBe('task-1');
    expect(first.protocol).toBe(2);
    expect(first.createdAt).toBe(clock);

    const again = store.createTask({ taskId: 'task-1', targetDir: 'X:/other' });
    expect(again.targetDir).toBe('D:/No.3');

    const journal = store.readJournal('task-1');
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      type: 'task-created',
      seq: 1,
      ts: clock,
      taskId: 'task-1',
      data: { targetDir: 'D:/No.3', modules: ['Messages'] },
    });
  });

  it('appendJournal seq 单调递增，数据原样落盘', () => {
    store.createTask({ taskId: 'task-1' });
    clock += 10;
    store.appendJournal('task-1', { type: 'run-started', runId: 'r1', data: { modules: ['Messages'] } });
    clock += 10;
    store.appendJournal('task-1', {
      type: 'phase-start',
      runId: 'r1',
      data: { module: 'Messages', phase: 'Messages' },
    });

    const journal = store.readJournal('task-1');
    expect(journal.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(journal[2]).toMatchObject({
      type: 'phase-start',
      runId: 'r1',
      data: { module: 'Messages', phase: 'Messages' },
    });
    expect(journal[2].ts).toBe(clock);
  });

  it('readJournal(limit) 只返回末尾 N 条', () => {
    store.createTask({ taskId: 'task-1' });
    for (let i = 0; i < 5; i++) {
      store.appendJournal('task-1', { type: 'heartbeat', data: { i } });
    }
    const tail = store.readJournal('task-1', 2);
    expect(tail).toHaveLength(2);
    // task-created 占用 seq 1，5 条 heartbeat 为 seq 2–6；末尾两条是 i=3、i=4
    expect(tail.map((e) => e.data.i)).toEqual([3, 4]);
  });
});

describe('checkpoint 与 summary', () => {
  it('saveCheckpoint 原子写入并可读回，模块/阶段字段完整', () => {
    store.createTask({ taskId: 'task-1' });
    store.saveCheckpoint('task-1', {
      state: 'running',
      runId: 'r1',
      module: 'Photos',
      phase: 'Photos_Albums_Like',
      moduleIndex: 2,
    });

    const cp = store.loadCheckpoint('task-1');
    expect(cp).toMatchObject({
      taskId: 'task-1',
      state: 'running',
      runId: 'r1',
      module: 'Photos',
      phase: 'Photos_Albums_Like',
      moduleIndex: 2,
      updatedAt: clock,
    });
    // 原子写不残留 .tmp
    expect(fs.existsSync(path.join(root, 'task-1', 'checkpoint.json.tmp'))).toBe(false);
  });

  it('saveSummary 写入终态摘要', () => {
    store.createTask({ taskId: 'task-1' });
    store.saveSummary('task-1', { state: 'completed', elapsedSec: 42, errors: [] });
    expect(store.loadSummary('task-1')).toMatchObject({
      taskId: 'task-1',
      state: 'completed',
      elapsedSec: 42,
      finishedAt: clock,
    });
  });
});

describe('scan 可恢复判定', () => {
  it('无 summary + 活跃 checkpoint → recoverable；有 summary → 终态不可恢复', () => {
    store.createTask({ taskId: 'task-run' });
    store.saveCheckpoint('task-run', { state: 'running', module: 'Photos', phase: 'Photos_Albums_Like' });

    store.createTask({ taskId: 'task-done' });
    store.saveCheckpoint('task-done', { state: 'running' });
    store.saveSummary('task-done', { state: 'completed' });

    const list = store.scan();
    const run = list.find((t) => t.taskId === 'task-run');
    const done = list.find((t) => t.taskId === 'task-done');
    expect(run).toMatchObject({
      state: 'running',
      recoverable: true,
      module: 'Photos',
      phase: 'Photos_Albums_Like',
    });
    expect(done).toMatchObject({ state: 'completed', recoverable: false });
  });

  it('只有 task.json（从未 checkpoint）→ interrupted + recoverable', () => {
    store.createTask({ taskId: 'task-bare' });
    const item = store.scan().find((t) => t.taskId === 'task-bare');
    expect(item).toMatchObject({ state: 'interrupted', recoverable: true, interrupted: false });
  });

  it('markInterrupted 保留 module/phase，并写 interrupted 事件', () => {
    store.createTask({ taskId: 'task-1' });
    store.saveCheckpoint('task-1', {
      state: 'running',
      module: 'Photos',
      phase: 'Photos_Albums_Like',
    });
    store.markInterrupted('task-1', 'app-exit');

    const cp = store.loadCheckpoint('task-1');
    expect(cp).toMatchObject({
      interrupted: true,
      interruptedReason: 'app-exit',
      module: 'Photos',
      phase: 'Photos_Albums_Like',
    });
    const item = store.scan().find((t) => t.taskId === 'task-1');
    expect(item.recoverable).toBe(true);
    expect(item.interrupted).toBe(true);
    expect(store.readJournal('task-1').at(-1)).toMatchObject({
      type: 'interrupted',
      data: { reason: 'app-exit' },
    });
  });
});

describe('prune 清理策略', () => {
  it('只清理终态任务；活跃任务永不删除', () => {
    // 活跃任务（无 summary）
    store.createTask({ taskId: 'task-active' });
    store.saveCheckpoint('task-active', { state: 'running', module: 'Photos' });

    // 3 个已终态任务，最新 2 个保留
    for (const id of ['task-old', 'task-mid', 'task-new']) {
      store.createTask({ taskId: id });
      clock += 1000;
      store.saveSummary(id, { state: 'completed' });
    }

    const prunedStore = createTaskStore({ baseDir: root, now: () => clock, maxTasks: 2 });
    const result = prunedStore.prune();
    expect(result.removed).toEqual(['task-old']);
    expect(prunedStore.readTask('task-active').task).toBeTruthy();
    expect(prunedStore.readTask('task-mid').task).toBeTruthy();
    expect(prunedStore.readTask('task-new').task).toBeTruthy();
    expect(prunedStore.readTask('task-old').task).toBe(null);
  });

  it('超过 maxAgeMs 的终态任务即使数量在内也删除', () => {
    store.createTask({ taskId: 'task-old' });
    store.saveSummary('task-old', { state: 'failed' });

    clock += 15 * 24 * 60 * 60 * 1000;
    const prunedStore = createTaskStore({
      baseDir: root,
      now: () => clock,
      maxTasks: 20,
      maxAgeMs: 14 * 24 * 60 * 60 * 1000,
    });
    const result = prunedStore.prune();
    expect(result.removed).toEqual(['task-old']);
    expect(prunedStore.readTask('task-old').task).toBe(null);
  });
});
