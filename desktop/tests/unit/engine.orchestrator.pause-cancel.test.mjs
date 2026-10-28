/**
 * v5.5 M0：暂停/取消竞态单测（plans/v5.5.md §4.6）
 *
 * 背景（2026-10-22 现场事件确认路径）：pause 后 cancel 只置 cancelled 标志、
 * 不唤醒 pauseWaiters → checkExportState 永久挂起（暂停中取消 100% 挂死）；
 * 且唤醒后不重查取消 → 流程从暂停点继续跑。本文件锁定：
 *  ① pause 挂起检查点、resume 唤醒且不抛（既有行为）
 *  ② pause → cancel：唤醒全部等待者、paused 复位，检查点抛 __exportCancelled
 *  ③ cancel 后新的检查点直接抛取消错误
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let engine;

beforeAll(() => {
  const states = [];
  const sandbox = {
    window: {
      QZonePlatform: {
        notify: {
          state: (d) => states.push(d),
          log() {},
          progress() {},
          moduleDone() {},
          heartbeat() {},
        },
      },
    },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    MODULE_NAME_MAPS: {},
    QZone_Config: {},
    QZone: { Common: { Owner: { uin: 10000 }, Target: { uin: 10000 } } },
    API: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(rootDir, 'src/engine/tasks/state.js'), 'utf8'), sandbox, {
    filename: 'tasks/state.js',
  });
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/tasks/orchestrator.js'), 'utf8'),
    sandbox,
    { filename: 'tasks/orchestrator.js' }
  );
  engine = {
    commands: vm.runInContext('window.__engineCommands', sandbox),
    state: () => vm.runInContext('window.__engineExportState', sandbox),
    check: () => vm.runInContext('window.checkExportState()', sandbox),
    states,
  };
});

const settleTag = (p) =>
  p.then(
    () => 'resolved',
    (e) => (e && e.__exportCancelled ? 'cancelled' : 'rejected')
  );

/** 每个用例独立复位引擎状态（模块级单例共享） */
function resetState() {
  const s = engine.state();
  s.running = true; // 模拟任务进行中（生产 start 后 running=true）
  s.cancelled = false;
  s.paused = false;
  s.pauseWaiters = [];
  s.pauseToken = null;
  engine.states.length = 0;
}

describe('暂停/取消竞态（v5.5 M0）', () => {
  it('pause 挂起检查点 → resume 唤醒且不抛取消错误（既有行为保持）', async () => {
    resetState();

    await engine.commands.pause();
    expect(engine.state().paused).toBe(true);

    const p = engine.check();
    await new Promise((r) => setTimeout(r, 10));
    await engine.commands.resume();
    await expect(p).resolves.toBe(false);
  });

  it('pause → cancel：唤醒全部并发等待者并抛取消错误（挂死回归）', async () => {
    resetState();

    await engine.commands.pause();
    // 并发检查点同时挂起（分页循环 + 下载器都会调）
    const p1 = engine.check();
    const p2 = engine.check();
    await new Promise((r) => setTimeout(r, 10));

    await engine.commands.cancel();

    expect(await settleTag(p1)).toBe('cancelled');
    expect(await settleTag(p2)).toBe('cancelled');
    // 暂停位已清：不会残留到下一次任务
    expect(engine.state().paused).toBe(false);
    expect(engine.state().pauseWaiters).toHaveLength(0);
    expect(engine.states.some((s) => s.state === 'cancelled')).toBe(true);
  });

  it('cancel 后新的检查点直接抛取消错误（唤醒后重查取消）', async () => {
    resetState();

    await engine.commands.cancel();
    await expect(engine.check()).rejects.toMatchObject({ __exportCancelled: true });
  });

  it('暂停中取消后 paused=false：resume 幂等无害（不再推 running）', async () => {
    resetState();

    await engine.commands.pause();
    await engine.commands.cancel();
    // 引擎已 cancelled：resume 不应把任务拉回 running 语义（notify 无 running）
    await engine.commands.resume();
    expect(engine.states.filter((s) => s.state === 'running').length).toBe(0);
  });

  it('挂起（suspended）时取消 → 立即清除 cancelled，任务外请求不被误杀', async () => {
    resetState();
    const s = engine.state();
    s.suspended = true;
    s.running = false;

    await engine.commands.cancel();
    // 挂起的任务没有模块循环会走到 checkExportState 的取消分支：
    // 必须立即清标记，否则登录/好友列表请求会被永久 abort（2026-10-28 实机）
    expect(s.cancelled).toBe(false);
    expect(s.suspended).toBe(false);
  });
});
