/**
 * 任务协议 v2（v5.5 M1 单一来源）
 *
 * 消费方：
 *   - main：TaskRunner / EngineClient / TaskStore
 *   - preload：命令封装与通道白名单
 *   - 引擎脚本不能 import（注入执行），命令/事实字符串以本文件为准，
 *     引擎侧通过 `__engineCommands.v` 上报版本，主进程握手校验。
 *
 * 约束：零依赖，不 import electron / node 内置模块。
 */

export const TASK_PROTOCOL_VERSION = 2;

/**
 * 任务生命周期（v2 完整态）。
 * M0 的 task-machine 仍是子集（idle/preparing/running/paused/终态）；
 * TaskRunner 在 M1 逐步接管 pausing/resuming/finalizing/stalled。
 */
export const TASK_LIFECYCLE_STATES = Object.freeze([
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
]);

export const TERMINAL_TASK_STATES = Object.freeze(['completed', 'cancelled', 'failed']);

/** 非终态且需要恢复/展示的状态 */
export const ACTIVE_TASK_STATES = Object.freeze([
  'preparing',
  'running',
  'pausing',
  'paused',
  'resuming',
  'finalizing',
  'stalled',
]);

/** paused 原因（与 M0 task-machine 保持一致） */
export const PAUSED_REASONS = Object.freeze(['user', 'engine_lost', 'auth_lost', 'rate_limited']);

/**
 * 可直接 resume 的暂停原因：
 * engine_lost / auth_lost 时引擎会话已失效，新引擎里没有运行中的任务，
 * 直接 resume 只会把状态误置回 running。
 */
export const RESUMABLE_PAUSED_REASONS = Object.freeze(['user', 'rate_limited']);

export function canResumePaused(reason) {
  return reason == null || RESUMABLE_PAUSED_REASONS.includes(reason);
}

export function isTerminalTaskState(state) {
  return TERMINAL_TASK_STATES.includes(state);
}

export function isActiveTaskState(state) {
  return ACTIVE_TASK_STATES.includes(state);
}

/** 命令（main → engine） */
export const TASK_COMMANDS = Object.freeze({
  prepare: 'prepare',
  start: 'start',
  pause: 'pause',
  resume: 'resume',
  cancel: 'cancel',
});

/** 事实（engine → main） */
export const TASK_FACTS = Object.freeze({
  started: 'started',
  heartbeat: 'heartbeat',
  phase: 'phase',
  step: 'step',
  finished: 'finished',
  aborted: 'aborted',
});

/** 超时/节奏（RFC D1–D24 的默认值） */
export const TASK_TIMEOUTS = Object.freeze({
  /** prepare 命令 ack 上限 */
  prepareMs: 15_000,
  /** start 后必须收到 started 的上限 */
  startMs: 10_000,
  /** 暂停：立即 abort 在途请求，ack 上限 */
  pauseMs: 2_000,
  /** 恢复 ack 上限 */
  resumeMs: 2_000,
  /** 取消 ack 上限；超时强制销毁引擎窗 */
  cancelMs: 3_000,
  /** 引擎心跳间隔 */
  heartbeatMs: 2_000,
  /** 无心跳判 stalled */
  stallMs: 30_000,
  /** stalled 硬阈值（UI 强提示，不自动取消） */
  stallHardMs: 600_000,
});

/** journal 事件类型（TaskStore appendJournal 的 type） */
export const TASK_EVENT_TYPES = Object.freeze([
  'task-created',
  'run-started',
  'prepare-start',
  'prepare-ok',
  'engine-started',
  'phase-start',
  'phase-end',
  'step-start',
  'step-end',
  'heartbeat',
  'retry',
  'pause-request',
  'paused',
  'resume-request',
  'resumed',
  'cancel-request',
  'cancelled',
  'stall',
  'engine-lost',
  'finished',
  'interrupted',
  'abandoned',
]);

/** 命令信封（便于以后主进程/引擎统一序列化） */
export function commandEnvelope({ taskId, cmd, seq, args }) {
  return { v: TASK_PROTOCOL_VERSION, taskId, cmd, seq, args: args || {} };
}

/** 事实信封 */
export function factEnvelope({ taskId, type, seq, data }) {
  return { v: TASK_PROTOCOL_VERSION, taskId, type, seq, data: data || {} };
}
