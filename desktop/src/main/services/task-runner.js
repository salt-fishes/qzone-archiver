/**
 * TaskRunner（v5.5 M1）：主进程任务编排唯一入口
 *
 * 职责：
 *  - 命令生命周期：start / pause / resume / cancel 的校验、状态机迁移、journal、summary
 *  - 启动确认：委托 EngineClient（等 started，超时失败）
 *  - 阶段检查点：消费引擎心跳里的 module/phase，写 TaskStore checkpoint（同阶段去重）
 *  - 引擎事实：running/paused/failed → 状态机；completed → finalizing 收尾链（统计/完成页/清理）
 *  - 终态唯一收尾口：历史落库、电源锁、任务上下文、旧任务下载恢复都在这里结束
 *
 * 状态（v5.5 M1 收口）：running ⇄ pausing/paused/resuming；running ⇄ stalled；
 * running → finalizing → completed；任意活跃态 → cancelled | failed。
 */
import { taskMachine as defaultMachine, canResumePaused } from './task-machine.js';
import { engineClient as defaultEngine } from './engine-client.js';
import { taskStore as defaultStore } from './task-store.js';
import { downloadManager as defaultDownloads } from './download-manager.js';
import { backupStats as defaultStats } from './backup-stats.js';
import { avatarStore as defaultAvatar } from './avatar-store.js';
import { taskRuntime as defaultRuntime } from './task-runtime.js';
import { dropTaskContext as defaultDropContext, sendToUi as defaultSendToUi } from './engine-bridge.js';
import { logger } from './logger.js';
import { PushChannels } from '../../shared/ipc-contract.mjs';

/** 可取消的活跃态（含暂停中/恢复中/收尾中/停滞） */
const CANCELLABLE_STATES = [
  'preparing',
  'running',
  'pausing',
  'paused',
  'resuming',
  'finalizing',
  'stalled',
];

const TERMINAL_STATES = ['completed', 'cancelled', 'failed'];

/**
 * @param {{
 *   machine?: object, engine?: object, store?: object, downloads?: object,
 *   stats?: object, avatar?: object, runtime?: object,
 *   dropContext?: Function, push?: Function, log?: object, now?: ()=>number
 * }} [deps]
 */
export function createTaskRunner(deps = {}) {
  const machine = deps.machine || defaultMachine;
  const engine = deps.engine || defaultEngine;
  const store = deps.store || defaultStore;
  const downloads = deps.downloads || defaultDownloads;
  const stats = deps.stats || defaultStats;
  const avatar = deps.avatar || defaultAvatar;
  const runtime = deps.runtime || defaultRuntime;
  const dropContext = deps.dropContext || defaultDropContext;
  const push = deps.push || ((channel, payload) => defaultSendToUi(channel, payload));
  const log = deps.log || logger;
  const now = deps.now || (() => Date.now());

  let currentRunId = null;
  /** @type {{module?: string|null, phase?: string|null, state?: string}|null} */
  let lastCheckpoint = null;
  /** 本次运行的计划上下文（targetDir/modules/targetUin），收尾统计不再依赖全局 active context */
  let activeCtx = null;

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

  /** 终止路径的公共清理：下载队列、引擎任务上下文、电源锁、运行上下文 */
  async function cleanupTerminal(taskId, { cancelDownloads = false } = {}) {
    if (cancelDownloads) {
      try {
        if (typeof downloads.cancelTask === 'function') await downloads.cancelTask(taskId);
        else await downloads.cancel();
      } catch (e) {
        log.warn(`[task-runner] 下载清理失败（忽略）：${e?.message || e}`);
      }
    }
    try {
      dropContext(taskId);
    } catch {
      /* 上下文清理失败不阻断终态 */
    }
    runtime.releasePowerSave();
    activeCtx = null;
    currentRunId = null;
  }

  /**
   * 启动任务。
   * @param {{taskId?:string, targetDir?:string, modules?:string[], config?:object, targetUin?:string, runId?:string, resumeFrom?:object}} [ctx]
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
    activeCtx = { ...ctx, runId };
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
      activeCtx = null;
      throw new Error(r.error);
    }
    r = machine.dispatch('start', { ...ctx, runId });
    if (!r.ok) {
      summary(taskId, { state: 'failed', runId, error: r.error });
      currentRunId = null;
      activeCtx = null;
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
      await cleanupTerminal(taskId);
      throw e;
    }
  }

  async function pause() {
    const snap = machine.getSnapshot();
    if (snap.state !== 'running' && snap.state !== 'stalled') {
      return { ok: false, error: `当前状态 ${snap.state} 不可暂停` };
    }
    const taskId = snap.taskId;
    // 先进入 pausing：ack 期间 UI 能显示「暂停中」，而不是按了没反应
    const req = machine.dispatch('pauseRequest');
    if (!req.ok) return { ok: false, error: req.error };
    journal(taskId, { type: 'pause-request', runId: currentRunId });
    try {
      await engine.command('pause');
    } catch (e) {
      machine.dispatch('pauseFailed');
      journal(taskId, {
        type: 'pause-request',
        runId: currentRunId,
        data: { ok: false, error: e?.message || String(e) },
      });
      return { ok: false, error: e?.message || String(e) };
    }
    // 引擎可能先推了 paused 事件（handleEngineState 已完成迁移）——此时只补下载联动
    if (machine.getSnapshot().state === 'pausing') {
      const r = machine.dispatch('pause', { reason: 'user' });
      if (!r.ok) {
        machine.dispatch('pauseFailed');
        return { ok: false, error: r.error };
      }
      journal(taskId, { type: 'paused', runId: currentRunId, data: { reason: 'user' } });
    }
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
    const taskId = snap.taskId;
    const req = machine.dispatch('resumeRequest');
    if (!req.ok) return { ok: false, error: req.error };
    journal(taskId, { type: 'resume-request', runId: currentRunId });
    try {
      await engine.command('resume');
    } catch (e) {
      machine.dispatch('resumeFailed');
      return { ok: false, error: e?.message || String(e) };
    }
    if (machine.getSnapshot().state === 'resuming') {
      const r = machine.dispatch('resume');
      if (!r.ok) {
        machine.dispatch('resumeFailed');
        return { ok: false, error: r.error };
      }
      journal(taskId, { type: 'resumed', runId: currentRunId });
    }
    try {
      await downloads.resume();
    } catch (e) {
      log.warn(`[task-runner] 下载恢复联动失败：${e?.message || e}`);
    }
    return { ok: true };
  }

  async function cancel() {
    const snap = machine.getSnapshot();
    if (!CANCELLABLE_STATES.includes(snap.state)) {
      return { ok: false, error: `当前状态 ${snap.state} 不可取消` };
    }
    const taskId = snap.taskId;
    const runId = currentRunId;
    journal(taskId, { type: 'cancel-request', runId });
    const r = machine.dispatch('cancel');
    if (!r.ok) return { ok: false, error: r.error };
    try {
      await engine.command('cancel');
    } catch (e) {
      log.warn(`[task-runner] 引擎取消命令未送达（继续本地清理）：${e?.message || e}`);
    }
    await cleanupTerminal(taskId, { cancelDownloads: true });
    summary(taskId, { state: 'cancelled', runId });
    journal(taskId, { type: 'finished', runId, data: { state: 'cancelled' } });
    return { ok: true };
  }

  /**
   * 引擎心跳：按 module/phase/state 写 checkpoint（同组合去重，避免 2s 一次写盘）。
   */
  function onHeartbeat(data = {}) {
    const snap = machine.getSnapshot();
    const taskId = data.taskId || snap.taskId;
    if (!taskId || !currentRunId) return;
    if (!['running', 'paused', 'stalled'].includes(snap.state)) return;
    const module = data.module || null;
    const phase = data.phase || null;
    if (!module && !phase) return;
    if (
      lastCheckpoint &&
      lastCheckpoint.module === module &&
      lastCheckpoint.phase === phase &&
      lastCheckpoint.state === snap.state
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
   * 引擎 completed 收尾链：finalizing → 头像缓存 → 历史统计 → completed + 完成页推送 → 清理。
   * 完成与媒体下载解耦（决策 D4）：这里不等待下载队列，立即出完成页。
   */
  async function finalizeCompleted(taskId, data) {
    const fin = machine.dispatch('finalize');
    if (!fin.ok) {
      return fin;
    }
    runtime.holdPowerSave();
    journal(taskId, { type: 'finalize-start', runId: currentRunId });
    push(PushChannels.backupFinalizing, { active: true, phase: 'stats', pending: 0, running: 0, total: 0 });

    const ctx = activeCtx || {};
    const startedAt = machine.getSnapshot().startedAt;
    const downloadsCount =
      taskId && typeof downloads.getTaskCounts === 'function'
        ? downloads.getTaskCounts(taskId)
        : null;
    let record = null;
    try {
      const targetUin = data.target?.uin || ctx.targetUin;
      if (targetUin && typeof avatar.ensure === 'function') {
        await avatar.ensure(targetUin).catch(() => false);
      }
      // 收尾期间被取消：不再写历史记录
      if (machine.getSnapshot().state === 'finalizing') {
        record = await stats.recordBackup({
          taskId,
          targetDir: ctx.targetDir,
          modules: ctx.modules || [],
          results: data.results,
          errors: data.errors,
          target: data.target, // v4.6：采集目标（uin/昵称），历史档案按目标分组
          startedAt, // v5.0：只统计本次任务写入的文件
        });
        if (record) push(PushChannels.backupHistoryChanged, stats.getHistory());
      }
    } catch (e) {
      log.error(`[task-runner] 收尾统计失败（仍推送完成页）：${e?.stack || e}`);
    }

    const verdict = machine.dispatch('complete', data);
    if (verdict.ok) {
      const snap = machine.getSnapshot();
      summary(taskId, {
        state: 'completed',
        runId: currentRunId,
        errors: Array.isArray(data.errors) ? data.errors : [],
        results: data.results || {},
        target: data.target || null,
        startedAt: snap.startedAt,
        elapsedSec: snap.startedAt ? Math.round((Date.now() - snap.startedAt) / 1000) : null,
      });
      journal(taskId, { type: 'finalize-end', runId: currentRunId });
      journal(taskId, {
        type: 'finished',
        runId: currentRunId,
        data: { state: 'completed', errors: (data.errors || []).length },
      });
      push(PushChannels.backupCompleted, { ...data, record, downloads: downloadsCount });
    } else if (record) {
      // 收尾窗口内被取消/失败：回滚刚落库的历史记录
      try {
        stats.deleteHistory?.(taskId);
      } catch {
        /* 回滚失败不阻断取消 */
      }
    }

    push(PushChannels.backupFinalizing, { active: false });
    await cleanupTerminal(taskId);
    try {
      downloads.resumeOthers?.(taskId);
    } catch (e) {
      log.warn(`[task-runner] 恢复旧任务下载失败：${e?.message || e}`);
    }
    return verdict;
  }

  /**
   * 引擎 state 事实；completed 走异步收尾链，其余同步裁决。
   * @returns {Promise<{ok:boolean, idempotent?:boolean, snapshot:object, error?:string}>}
   */
  async function handleEngineState(data = {}) {
    // 终态只落一次：用户取消后引擎仍可能补发 cancelled/completed，避免重复 summary/journal
    const before = machine.getSnapshot().state;
    if (TERMINAL_STATES.includes(before)) {
      return { ok: true, idempotent: true, snapshot: machine.getSnapshot() };
    }
    const ev = {
      running: 'engineRunning',
      paused: 'pause',
      completed: 'complete',
      cancelled: 'cancel',
      failed: 'fail',
    }[data?.state];
    if (!ev) return { ok: true, snapshot: machine.getSnapshot() };
    const taskId = data.taskId || machine.getSnapshot().taskId;
    const runId = currentRunId;

    if (data.state === 'completed') {
      return finalizeCompleted(taskId, data);
    }

    const verdict = machine.dispatch(ev, data);
    if (verdict.ok && taskId && !verdict.idempotent) {
      if (data.state === 'paused') {
        journal(taskId, {
          type: 'paused',
          runId,
          data: { reason: data.reason || 'user' },
        });
      } else if (data.state === 'running' && before === 'resuming') {
        journal(taskId, { type: 'resumed', runId });
      }
    }
    if (!verdict.ok || !taskId) return verdict;
    if (data.state === 'cancelled') {
      await cleanupTerminal(taskId, { cancelDownloads: true });
      summary(taskId, { state: 'cancelled', runId });
      journal(taskId, { type: 'finished', runId, data: { state: 'cancelled' } });
    } else if (data.state === 'failed') {
      await cleanupTerminal(taskId);
      summary(taskId, {
        state: 'failed',
        runId,
        error: data.error || '引擎报告任务失败',
        elapsedSec: verdict.snapshot?.startedAt
          ? Math.round((Date.now() - verdict.snapshot.startedAt) / 1000)
          : null,
      });
      journal(taskId, {
        type: 'finished',
        runId,
        data: { state: 'failed', error: data.error || null },
      });
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
