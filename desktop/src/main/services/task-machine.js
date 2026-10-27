/**
 * 任务状态机（P3-1，架构改造计划 §5.1；v5.5 M1 状态收口）：备份任务生命周期唯一事实源（主进程侧）
 *
 * 状态：idle → preparing → running ⇄ pausing/paused/resuming → finalizing → completed
 *       running ⇄ stalled（心跳看门狗裁决）；任意活跃态 → cancelled | failed
 * - 引擎 notify 只是输入事件，全部经 dispatch() 裁决：非法转移拒绝并告警，同态事件幂等
 * - 每次成功转移推送 backup:state-changed（渲染层状态全部由此派生，删除乐观置位）
 * - 非终态持久化最小恢复上下文（checkpoint：taskId/目标目录/模块/配置）；终态清除 checkpoint
 * - 失败明细（errors）随 complete 事件入快照，由 backup-stats 落库（P0-3 遗留项收口）
 */
import { stateStore } from './state-store.js';
import { sendToUi } from './engine-bridge.js';
import { logger } from './logger.js';
import { PushChannels } from '../../shared/ipc-contract.mjs';
import { PAUSED_REASONS, canResumePaused } from '../../shared/task-protocol.mjs';

export const TASK_STATES = [
  'idle',
  'preparing',
  'running',
  'pausing',
  'paused',
  'resuming',
  'finalizing',
  'stalled',
  'completed',
  'cancelled',
  'failed',
];

/**
 * paused 原因与恢复判定（v5.5 M1 起收敛到 shared/task-protocol.mjs）：
 *  user / engine_lost / auth_lost / rate_limited；engine_lost/auth_lost 不可直接 resume。
 * 这里 re-export 保持 M0 调用方（ipc/backup.js、单测）的 import 路径不变。
 */
export { PAUSED_REASONS, canResumePaused };

/**
 * 事件转移表：event → { from[], to }
 * v5.5 M1 状态收口：
 *  - pauseRequest/resumeRequest 让「暂停中/恢复中」在 ack 期间可见；ack 失败走 pauseFailed/resumeFailed 回滚
 *  - finalize 在引擎完成后先进入收尾态（统计归档/完成页推送），完成后才 commit
 *  - stall/unstall 由 task-runtime 心跳看门狗驱动（stalled 仍是可暂停/可取消的活跃态）
 * engineRunning 承接引擎 running 事件；prepare 允许自终态发起：新任务自动覆盖旧终态
 * v5.5 M0：engineLost / authLost / rateLimited 是引擎生命周期与网络层上报的事实事件，
 * 全部转入 paused(reason)；无活跃任务时被 from 守卫拒绝（静默），不会误伤空闲态
 */
const TRANSITIONS = {
  prepare: { from: ['idle', 'completed', 'cancelled', 'failed'], to: 'preparing' },
  start: { from: ['preparing'], to: 'running' },
  engineRunning: { from: ['preparing', 'paused', 'running', 'resuming', 'stalled'], to: 'running' },
  pauseRequest: { from: ['running', 'stalled'], to: 'pausing' },
  pause: { from: ['running', 'pausing', 'stalled'], to: 'paused' },
  pauseFailed: { from: ['pausing'], to: 'running' },
  resumeRequest: { from: ['paused'], to: 'resuming' },
  resume: { from: ['paused', 'resuming'], to: 'running' },
  resumeFailed: { from: ['resuming'], to: 'paused' },
  finalize: { from: ['running', 'paused', 'stalled'], to: 'finalizing' },
  stall: { from: ['running'], to: 'stalled' },
  unstall: { from: ['stalled'], to: 'running' },
  complete: { from: ['running', 'paused', 'stalled', 'finalizing'], to: 'completed' },
  cancel: {
    from: ['preparing', 'running', 'pausing', 'paused', 'resuming', 'finalizing', 'stalled'],
    to: 'cancelled',
  },
  fail: {
    from: ['preparing', 'running', 'pausing', 'paused', 'resuming', 'finalizing', 'stalled'],
    to: 'failed',
  },
  engineLost: { from: ['preparing', 'running', 'pausing', 'resuming', 'stalled'], to: 'paused' },
  authLost: { from: ['preparing', 'running', 'pausing', 'resuming', 'stalled'], to: 'paused' },
  rateLimited: { from: ['preparing', 'running', 'pausing', 'resuming', 'stalled'], to: 'paused' },
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
    /** v5.5 M0：paused 原因（user/engine_lost/auth_lost/rate_limited），非 paused 态为 null */
    pausedReason: null,
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
    // modules 随每次推送携带：引擎 running 事件会把它覆盖为「过滤后的实际执行清单」，
    // 渲染层模块清单与总进度分母据此对齐（他人模式剔除隐私模块的场景）
    // v5.5 M0：paused 携带 pausedReason（渲染层据此显示原因卡，区分用户暂停与引擎丢失）
    push({
      taskId: snap.taskId,
      state: snap.state,
      modules: [...(snap.modules || [])],
      ...(snap.state === 'paused' ? { pausedReason: snap.pausedReason || 'user' } : {}),
    });
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
      // 同态幂等：如主进程已 pause，引擎 paused 事件随后到达。
      // 例外：引擎 running 事件携带的 modules 是过滤后的实际执行清单——状态虽已
      // running（start 先行），清单仍需同步并推送，否则他人模式的 UI 分母对不上。
      if (event === 'engineRunning' && Array.isArray(payload.modules)) {
        snap.modules = payload.modules;
        emit();
      }
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
        snap.pausedReason = null;
        persistCheckpoint();
        break;
      case 'engineRunning':
        snap.taskId = payload.taskId || snap.taskId;
        persistCheckpoint();
        break;
      case 'pause':
        snap.pausedReason = payload.reason || 'user';
        persistCheckpoint();
        break;
      case 'resume':
        snap.pausedReason = null;
        persistCheckpoint();
        break;
      case 'pauseRequest':
      case 'pauseFailed':
      case 'resumeRequest':
      case 'resumeFailed':
      case 'finalize':
      case 'stall':
      case 'unstall':
        // v5.5 M1：中间态同样落 checkpoint——任务被杀后能看出当时处于暂停中/收尾中
        persistCheckpoint();
        break;
      case 'engineLost':
      case 'authLost':
      case 'rateLimited':
        // v5.5 M0：事实事件统一转 paused(reason)；进入 paused 的迁移保留 checkpoint
        snap.pausedReason =
          event === 'engineLost' ? 'engine_lost' : event === 'authLost' ? 'auth_lost' : 'rate_limited';
        persistCheckpoint();
        break;
      case 'complete':
        snap.completedAt = Date.now();
        snap.errors = Array.isArray(payload.errors) ? payload.errors : [];
        snap.pausedReason = null;
        clear(snap.taskId);
        break;
      case 'cancel':
        snap.completedAt = Date.now();
        snap.pausedReason = null;
        clear(snap.taskId);
        break;
      case 'fail':
        snap.completedAt = Date.now();
        snap.error = payload.error || '未知错误';
        snap.pausedReason = null;
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
