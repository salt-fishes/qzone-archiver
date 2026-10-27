/**
 * TaskRunner（v5.5 M1）：主进程任务编排唯一入口
 *
 * 职责：
 *  - 命令生命周期：start / pause / resume / cancel 的校验、状态机迁移、journal、summary
 *  - 启动确认：委托 EngineClient（等 started，超时失败）
 *  - 阶段检查点：消费引擎心跳里的 module/phase，写 TaskStore checkpoint（同阶段去重）
 *  - 引擎事实：running/paused/completed/cancelled → 状态机 + journal + summary
 *
 * 边界（M1 阶段）：
 *  - 终态收尾（等下载落盘/统计/完成页推送）仍由 ipc/engine.js 负责；
 *    TaskRunner 只负责“状态与持久化事实”，收尾链后续再迁入。
 *  - 引擎窗口崩溃/登录失效的 paused(reason) 仍由 windows.js 直接 dispatch；
 *    后续 M1.2 统一到 runner.onEngineLost/onAuthLost。
 */
import { taskMachine as defaultMachine, canResumePaused } from './task-machine.js';
import { engineClient as defaultEngine } from './engine-client.js';
import { taskStore as defaultStore } from './task-store.js';
import { downloadManager as defaultDownloads } from './download-manager.js';
import { dropTaskContext as defaultDropContext } from './engine-bridge.js';
import { logger } from './logger.js';

/**
 * @param {{
 *   machine?: object, engine?: object, store?: object, downloads?: object,
 *   dropContext?: Function, log?: object, now?: ()=>number
 * }} [deps]
 */
export function createTaskRunner(deps = {}) {
  const machine = deps.machine || defaultMachine;
  const engine = deps.engine || defaultEngine;
  const store = deps.store || defaultStore;
  const downloads = deps.downloads || defaultDownloads;
  const dropContext = deps.dropContext || defaultDropContext;
  const log = deps.log || logger;
  const now = deps.now || (() => Date.now());

  let currentRunId = null;
  /** @type {{module?: string|null, phase?: string|null}|null} */
  let lastCheckpoint = null;

  function runIdFor(taskId) {
    // run-started 数量 + 1；journal 很小，启动时读一次可接受
    const events = store.readJournal(taskId, 0);
    const n = events.filter((e) => e.type === 'run-started').length + 1;
    return `${taskId}-r${n}`;
  }

  function summary(taskId, data) {
    try {
      return store.saveSummary(taskId, data);
    } catch (e) {
      log.warn(`[task-runner] 写 summary 失败：${e?.message || e}`);
      return null;
    }
  }

  function journal(taskId, event) {
    try {
      return store.appendJournal(taskId, event);
    } catch (e) {
      log.warn(`[task-runner] 写 journal 失败：${e?.message || e}`);
      return null;
    }
  }

  /**
   * 启动任务。
   * @param {{taskId?:string, targetDir?:string, modules?:string[], config?:object, targetUin?:string, runId?:string}} [ctx]
   */
  async function start(ctx = {}) {
    const { taskId, targetDir, modules } = ctx;
    if (!taskId) throw new Error('start 需要 taskId');
    if (!targetDir) throw new Error('请先选择备份目标目录');
    if (!Array.isArray(modules) || modules.length === 0) throw new Error('请至少选择一个备份模块');

    const state = machine.getSnapshot().state;
    if (!['idle', 'completed', 'cancelled', 'failed'].includes(state)) {
      throw new Error(`已有备份任务${state === 'paused' ? '处于暂停' : '进行中'}，请先完成或取消`);
    }

    currentRunId = ctx.runId || runIdFor(taskId);
    lastCheckpoint = null;
    const runId = currentRunId;
    store.createTask({ ...ctx, runId });
    journal(taskId, {
      type: 'run-started',
      runId,
      data: { modules, targetDir, targetUin: ctx.targetUin || null },
    });
    store.saveCheckpoint(taskId, {
      state: 'preparing',
      runId,
      module: null,
      phase: null,
      startedAt: now(),
    });

    let r = machine.dispatch('prepare', { ...ctx, runId });
    if (!r.ok) {
      summary(taskId, { state: 'failed', runId, error: r.error });
      currentRunId = null;
      throw new Error(r.error);
    }
    r = machine.dispatch('start', { ...ctx, runId });
    if (!r.ok) {
      summary(taskId, { state: 'failed', runId, error: r.error });
      currentRunId = null;
      throw new Error(r.error);
    }
    store.saveCheckpoint(taskId, {
      state: 'running',
      runId,
      module: null,
      phase: null,
      startedAt: machine.getSnapshot().startedAt || now(),
    });

    try {
      await engine.start({ ...ctx, runId });
      journal(taskId, { type: 'engine-started', runId });
      return { ok: true, taskId, runId };
    } catch (e) {
      const message = e?.message || String(e);
      log.error(`[task-runner] 引擎启动失败 taskId=${taskId}: ${message}`);
      machine.dispatch('fail', { taskId, error: message });
      store.saveCheckpoint(taskId, {
        state: 'failed',
        runId,
        module: lastCheckpoint?.module || null,
        phase: lastCheckpoint?.phase || null,
        error: message,
      });
      summary(taskId, { state: 'failed', runId, error: message, elapsedSec: 0 });
      journal(taskId, { type: 'finished', runId, data: { state: 'failed', error: message } });
      currentRunId = null;
      try {
        dropContext(taskId);
      } catch {
        /* 上下文清理失败不掩盖启动错误 */
      }
      throw e;
    }
  }

  async function pause() {
    const snap = machine.getSnapshot();
    if (snap.state !== 'running') {
      return { ok: false, error: `当前状态 ${snap.state} 不可暂停` };
    }
    journal(snap.taskId, { type: 'pause-request', runId: currentRunId });
    try {
      await engine.command('pause');
    } catch (e) {
      journal(snap.taskId, {
        type: 'pause-request',
        runId: currentRunId,
        data: { ok: false, error: e?.message || String(e) },
      });
      return { ok: false, error: e?.message || String(e) };
    }
    const r = machine.dispatch('pause', { reason: 'user' });
    if (!r.ok) return { ok: false, error: r.error };
    journal(snap.taskId, { type: 'paused', runId: currentRunId, data: { reason: 'user' } });
    try {
      await downloads.pause();
    } catch (e) {
      log.warn(`[task-runner] 下载暂停联动失败：${e?.message || e}`);
    }
    return { ok: true };
  }

  async function resume() {
    const snap = machine.getSnapshot();
    if (snap.state !== 'paused') {
      return { ok: false, error: `当前状态 ${snap.state} 不可恢复` };
    }
    if (!canResumePaused(snap.pausedReason)) {
      journal(snap.taskId, {
        type: 'resume-request',
        runId: currentRunId,
        data: { ok: false, reason: snap.pausedReason },
      });
      return {
        ok: false,
        error: '引擎会话已丢失，请取消本任务后重新发起备份（已采集的文件保留在目标目录）',
      };
    }
    journal(snap.taskId, { type: 'resume-request', runId: currentRunId });
    try {
      await engine.command('resume');
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
    const r = machine.dispatch('resume');
    if (!r.ok) return { ok: false, error: r.error };
    journal(snap.taskId, { type: 'resumed', runId: currentRunId });
    try {
      await downloads.resume();
    } catch (e) {
      log.warn(`[task-runner] 下载恢复联动失败：${e?.message || e}`);
    }
    return { ok: true };
  }

  async function cancel() {
    const snap = machine.getSnapshot();
    if (!['preparing', 'running', 'paused'].includes(snap.state)) {
      return { ok: false, error: `当前状态 ${snap.state} 不可取消` };
    }
    journal(snap.taskId, { type: 'cancel-request', runId: currentRunId });
    const r = machine.dispatch('cancel');
    if (!r.ok) return { ok: false, error: r.error };
    try {
      await engine.command('cancel');
    } catch (e) {
      log.warn(`[task-runner] 引擎取消命令未送达（继续本地清理）：${e?.message || e}`);
    } finally {
      try {
        await downloads.cancel();
      } catch (e) {
        log.warn(`[task-runner] 下载清空失败（忽略）：${e?.message || e}`);
      }
      dropContext(snap.taskId);
    }
    summary(snap.taskId, { state: 'cancelled', runId: currentRunId });
    journal(snap.taskId, { type: 'finished', runId: currentRunId, data: { state: 'cancelled' } });
    currentRunId = null;
    return { ok: true };
  }

  /**
   * 引擎心跳：按 module/phase 写 checkpoint（同阶段去重，避免 2s 一次写盘）。
   */
  function onHeartbeat(data = {}) {
    const snap = machine.getSnapshot();
    const taskId = data.taskId || snap.taskId;
    if (!taskId || !currentRunId) return;
    if (snap.state !== 'running' && snap.state !== 'paused' && snap.state !== 'stalled') return;
    const module = data.module || null;
    const phase = data.phase || null;
    if (!module && !phase) return;
    if (
      lastCheckpoint &&
      lastCheckpoint.module === module &&
      lastCheckpoint.phase === phase
    ) {
      return;
    }
    lastCheckpoint = store.saveCheckpoint(taskId, {
      state: snap.state,
      runId: currentRunId,
      module,
      phase,
    });
    journal(taskId, { type: 'phase-start', runId: currentRunId, data: { module, phase } });
  }

  /**
   * 引擎 state 事实：running/paused/completed/cancelled → 状态机。
   * @returns {{ok:boolean, idempotent?:boolean, snapshot:object, error?:string}}
   */
  function handleEngineState(data = {}) {
    // 终态只落一次：用户取消后引擎仍可能补发 cancelled/completed，避免重复 summary/journal
    const before = machine.getSnapshot().state;
    if (['completed', 'cancelled', 'failed'].includes(before)) {
      return { ok: true, idempotent: true, snapshot: machine.getSnapshot() };
    }
    const ev = {
      running: 'engineRunning',
      paused: 'pause',
      completed: 'complete',
      cancelled: 'cancel',
    }[data?.state];
    if (!ev) return { ok: true, snapshot: machine.getSnapshot() };
    const verdict = machine.dispatch(ev, data);
    const taskId = data.taskId || machine.getSnapshot().taskId;
    if (verdict.ok && taskId) {
      const snap = machine.getSnapshot();
      if (data.state === 'completed') {
        summary(taskId, {
          state: 'completed',
          runId: currentRunId,
          errors: Array.isArray(data.errors) ? data.errors : [],
          results: data.results || {},
          target: data.target || null,
          startedAt: snap.startedAt,
          elapsedSec: snap.startedAt ? Math.round((Date.now() - snap.startedAt) / 1000) : null,
        });
        journal(taskId, {
          type: 'finished',
          runId: currentRunId,
          data: { state: 'completed', errors: (data.errors || []).length },
        });
        currentRunId = null;
      } else if (data.state === 'cancelled') {
        summary(taskId, { state: 'cancelled', runId: currentRunId });
        journal(taskId, { type: 'finished', runId: currentRunId, data: { state: 'cancelled' } });
        currentRunId = null;
      }
    }
    return verdict;
  }

  /** 模块完成：journal 阶段结束（UI 的 module-done 推送仍由 ipc/engine.js 负责） */
  function handleModuleDone(data = {}) {
    const taskId = machine.getSnapshot().taskId;
    if (!taskId || !currentRunId) return;
    journal(taskId, {
      type: 'phase-end',
      runId: currentRunId,
      data: { module: data.module || null },
    });
  }

  function getState() {
    return {
      task: machine.getSnapshot(),
      runId: currentRunId,
      checkpoint: lastCheckpoint,
      recoverable: store.scan().filter((t) => t.recoverable),
    };
  }

  return {
    start,
    pause,
    resume,
    cancel,
    onHeartbeat,
    handleEngineState,
    handleModuleDone,
    getState,
  };
}

/** 生产单例 */
export const taskRunner = createTaskRunner();
