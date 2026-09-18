/**
 * 任务状态机（P3-1，架构改造计划 §5.1）：备份任务生命周期唯一事实源（主进程侧）
 *
 * 状态：idle → preparing → running ⇄ paused → completed | cancelled | failed
 * - 引擎 notify 只是输入事件，全部经 dispatch() 裁决：非法转移拒绝并告警，同态事件幂等
 * - 每次成功转移推送 backup:state-changed（渲染层状态全部由此派生，删除乐观置位）
 * - 非终态持久化最小恢复上下文（checkpoint：taskId/目标目录/模块/配置）；终态清除 checkpoint
 * - 失败明细（errors）随 complete 事件入快照，由 backup-stats 落库（P0-3 遗留项收口）
 */
import { stateStore } from './state-store.js';
import { sendToUi } from './engine-bridge.js';
import { logger } from './logger.js';
import { PushChannels } from '../../shared/ipc-contract.mjs';

export const TASK_STATES = [
  'idle',
  'preparing',
  'running',
  'paused',
  'completed',
  'cancelled',
  'failed',
];

/**
 * 事件转移表：event → { from[], to }
 * engineRunning 统一承接引擎 running 事件（start 后首次 / resume 后恢复）；
 * prepare 允许自终态发起：新任务自动覆盖旧终态（复位上下文）
 */
const TRANSITIONS = {
  prepare: { from: ['idle', 'completed', 'cancelled', 'failed'], to: 'preparing' },
  start: { from: ['preparing'], to: 'running' },
  engineRunning: { from: ['preparing', 'paused', 'running'], to: 'running' },
  pause: { from: ['running'], to: 'paused' },
  resume: { from: ['paused'], to: 'running' },
  complete: { from: ['running', 'paused'], to: 'completed' },
  cancel: { from: ['preparing', 'running', 'paused'], to: 'cancelled' },
  fail: { from: ['preparing', 'running', 'paused'], to: 'failed' },
};

/**
 * 创建任务状态机（依赖注入便于单测；生产单例见文末）
 * @param {object} [deps] persist/clear/push 覆盖默认 checkpoint 与 UI 推送
 */
export function createTaskMachine(deps = {}) {
  const persist = deps.persist || ((taskId, data) => stateStore.saveCheckpoint(taskId, data));
  const clear = deps.clear || ((taskId) => stateStore.clearCheckpoint(taskId));
  const push = deps.push || ((payload) => sendToUi(PushChannels.backupStateChanged, payload));
  // §K4：状态机每次迁移写一行任务日志（事件流水，与 checkpoint 快照分工）。
  // 单测可注入 stub（默认实现会写 backup-<taskId>.log 文件）
  const log = deps.log || ((taskId, msg, level = 'info') => {
    try {
      logger.task(taskId).log(level, msg);
    } catch {
      /* 日志失败不影响状态机 */
    }
  });

  let snap = {
    taskId: null,
    state: 'idle',
    targetDir: null,
    modules: [],
    config: null,
    startedAt: null,
    completedAt: null,
    errors: [],
    error: null,
  };

  function getSnapshot() {
    return { ...snap, errors: [...(snap.errors || [])] };
  }

  function emit() {
    push({ taskId: snap.taskId, state: snap.state });
  }

  /** 非终态持久化最小恢复上下文 */
  function persistCheckpoint() {
    persist(snap.taskId, {
      taskId: snap.taskId,
      state: snap.state,
      targetDir: snap.targetDir,
      modules: snap.modules,
      config: snap.config,
      startedAt: snap.startedAt,
    });
  }

  /**
   * 状态转移裁决
   * @param {string} event TRANSITIONS 中的事件名
   * @param {object} [payload] 事件上下文（taskId/targetDir/modules/config/errors/error）
   * @returns {{ok: boolean, idempotent?: boolean, snapshot: object, error?: string}}
   */
  function dispatch(event, payload = {}) {
    const rule = TRANSITIONS[event];
    if (!rule) {
      console.warn(`[task-machine] 未知事件: ${event}`);
      return { ok: false, snapshot: getSnapshot(), error: `未知事件 ${event}` };
    }
    if (rule.to === snap.state) {
      // 同态幂等：如主进程已 pause，引擎 paused 事件随后到达
      return { ok: true, idempotent: true, snapshot: getSnapshot() };
    }
    if (!rule.from.includes(snap.state)) {
      console.warn(`[task-machine] 非法转移被拒绝: ${event}（${snap.state} → ${rule.to}）`);
      return {
        ok: false,
        snapshot: getSnapshot(),
        error: `当前状态 ${snap.state} 不可执行 ${event}`,
      };
    }

    const fromState = snap.state;
    snap = { ...snap, state: rule.to };
    switch (event) {
      case 'prepare':
      case 'start':
        snap.taskId = payload.taskId || snap.taskId;
        snap.targetDir = payload.targetDir ?? snap.targetDir;
        snap.modules = payload.modules ?? snap.modules;
        snap.config = payload.config ?? snap.config;
        // prepare = 新任务起点，startedAt 必须重置（终态复用场景不得残留旧值）
        snap.startedAt = event === 'prepare' ? Date.now() : snap.startedAt || Date.now();
        snap.errors = [];
        snap.error = null;
        snap.completedAt = null;
        persistCheckpoint();
        break;
      case 'engineRunning':
        snap.taskId = payload.taskId || snap.taskId;
        persistCheckpoint();
        break;
      case 'pause':
      case 'resume':
        persistCheckpoint();
        break;
      case 'complete':
        snap.completedAt = Date.now();
        snap.errors = Array.isArray(payload.errors) ? payload.errors : [];
        clear(snap.taskId);
        break;
      case 'cancel':
        snap.completedAt = Date.now();
        clear(snap.taskId);
        break;
      case 'fail':
        snap.completedAt = Date.now();
        snap.error = payload.error || '未知错误';
        clear(snap.taskId);
        break;
      default:
        break;
    }
    emit();
    // §K4：迁移流水 + 终态结论写任务日志（checkpoint 已在上方同步落盘，最后一行日志
    // 总能对应到最近一次 checkpoint——任务中途被杀时日志末行即定位点）
    try {
      if (snap.taskId) {
        if (event === 'complete' || event === 'cancel' || event === 'fail') {
          const durSec = snap.startedAt ? Math.round((snap.completedAt - snap.startedAt) / 1000) : null;
          const dur = durSec !== null ? `，耗时 ${durSec}s` : '';
          if (event === 'fail') log(snap.taskId, `任务结束：失败${dur}（${snap.error}）`, 'error');
          else if (event === 'cancel') log(snap.taskId, `任务结束：已取消${dur}`, 'warn');
          else log(snap.taskId, `任务结束：完成${dur}，失败明细 ${snap.errors.length} 条`);
          logger.disposeTask(snap.taskId);
        } else {
          log(snap.taskId, `状态迁移 ${event}：${fromState} → ${snap.state}（checkpoint 已落盘）`);
        }
      }
    } catch {
      /* 日志失败不影响状态机 */
    }
    return { ok: true, snapshot: getSnapshot() };
  }

  return { dispatch, getSnapshot };
}

/** 生产单例：checkpoint 走 stateStore，推送走 backup:state-changed */
export const taskMachine = createTaskMachine();
