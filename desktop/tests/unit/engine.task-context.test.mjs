/**
 * v5.5 M1：引擎 TaskContext 单测
 * 覆盖：可中断 sleep / withTimeout / runStep 生命周期与超时 / 取消异常兼容位
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let C;

beforeAll(() => {
  const sandbox = {
    window: {},
    console,
    setTimeout,
    clearTimeout,
    Date,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/tasks/task-context.js'), 'utf8'),
    sandbox,
    { filename: 'tasks/task-context.js' }
  );
  C = vm.runInContext('window.QZoneTasks.Context', sandbox);
});

describe('sleep', () => {
  it('无 signal 时按时 resolve', async () => {
    const t0 = Date.now();
    await C.sleep(15);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(10);
  });

  it('signal 已 abort → 同步抛取消错误', () => {
    const c = new AbortController();
    c.abort('用户取消');
    expect(() => C.sleep(1000, c.signal)).toThrow('用户取消');
  });

  it('sleep 期间 abort → 立即 reject，且带 __exportCancelled', async () => {
    const c = new AbortController();
    const p = C.sleep(1000, c.signal);
    setTimeout(() => c.abort('暂停/取消'), 5);
    const err = await p.then(
      () => null,
      (e) => e
    );
    expect(err).toBeTruthy();
    expect(err.name).toBe('AbortError');
    expect(err.__exportCancelled).toBe(true);
    expect(err.message).toContain('暂停/取消');
  });
});

describe('withTimeout', () => {
  it('未超时 → 返回原值', async () => {
    await expect(C.withTimeout(Promise.resolve('ok'), 50, '步骤 A')).resolves.toBe('ok');
  });

  it('超时 → 带 label 的 reject', async () => {
    await expect(C.withTimeout(C.sleep(80), 10, '步骤 B')).rejects.toThrow('步骤 B超时');
  });

  it('timeoutMs <= 0 → 不设超时', async () => {
    await expect(C.withTimeout(Promise.resolve(1), 0, '步骤 C')).resolves.toBe(1);
  });
});

describe('runStep', () => {
  it('onStart/onEnd 正常回调，返回结果', async () => {
    const events = [];
    const result = await C.runStep(
      'collect',
      async () => 42,
      {
        onStart: (e) => events.push(['start', e.name]),
        onEnd: (e) => events.push(['end', e.name, e.ok]),
      }
    );
    expect(result).toBe(42);
    expect(events).toEqual([
      ['start', 'collect'],
      ['end', 'collect', true],
    ]);
  });

  it('超时 → onEnd(ok:false) 并抛出', async () => {
    const events = [];
    await expect(
      C.runStep('slow', () => C.sleep(80), {
        timeoutMs: 10,
        onEnd: (e) => events.push(e),
      })
    ).rejects.toThrow('步骤 slow超时');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: 'slow', ok: false });
  });

  it('已取消的 signal → 不执行 fn，直接抛取消错误', async () => {
    const c = new AbortController();
    c.abort('任务已取消');
    let called = false;
    await expect(
      C.runStep('x', () => {
        called = true;
      }, { signal: c.signal })
    ).rejects.toMatchObject({ name: 'AbortError', __exportCancelled: true });
    expect(called).toBe(false);
  });
});

describe('取消异常', () => {
  it('createAbortError 保留 __exportCancelled，兼容旧调用方', () => {
    const err = C.createAbortError(new Error('boom'));
    expect(err.name).toBe('AbortError');
    expect(err.message).toBe('boom');
    expect(err.__exportCancelled).toBe(true);
    expect(err.cause).toBeInstanceOf(Error);
  });
});
