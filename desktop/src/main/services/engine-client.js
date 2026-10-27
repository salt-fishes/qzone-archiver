/**
 * EngineClient（v5.5 M1）：主进程 → 引擎命令的统一客户端
 *
 * 职责：
 *  - start 确认：引擎收到 start 后先发 `started` 事实；主进程在 startMs 内未收到即判启动失败
 *    （旧实现 fire-and-forget，引擎异步异常/未接受任务时主进程已返回 ok）。
 *  - 控制命令：pause/resume/cancel 统一走 bridge.command（含 15s 执行超时与缺失命令抛错）。
 *  - 命令 seq + 日志：为后续协议 ack/诊断提供 correlation id。
 *  - 协议版本：引擎 `__engineCommands.v` 不匹配时拒绝启动（握手在 inject 后写入）。
 *
 * 不含任务状态机；TaskRunner 持有状态，EngineClient 只负责“送到/确认”。
 */
import { engineBridge } from './engine-bridge.js';
import { logger } from './logger.js';
import { TASK_PROTOCOL_VERSION, TASK_TIMEOUTS } from '../../shared/task-protocol.mjs';

/**
 * @param {{bridge?: object, timeouts?: object, log?: object}} [opts]
 */
export function createEngineClient(opts = {}) {
  const bridge = opts.bridge || engineBridge;
  const timeouts = { ...TASK_TIMEOUTS, ...(opts.timeouts || {}) };
  const log = opts.log || logger;

  let seq = 0;
  let protocolVersion = 0;
  let lastFact = null;
  /** taskId → { resolve, reject, timer } */
  const startWaiters = new Map();

  function nextSeq() {
    seq += 1;
    return seq;
  }

  function clearWaiter(taskId) {
    const w = startWaiters.get(taskId);
    if (!w) return null;
    clearTimeout(w.timer);
    startWaiters.delete(taskId);
    return w;
  }

  /** 引擎事实入口（ipc/engine.js notify 分支调用） */
  function onFact(fact = {}) {
    lastFact = { ...fact, at: Date.now() };
    if (fact.type === 'started' && fact.taskId) {
      const w = clearWaiter(fact.taskId);
      if (w) w.resolve(fact);
    }
  }

  /**
   * 等待引擎 started 事实。
   * @param {string} taskId
   * @param {number} [timeoutMs]
   */
  function waitStarted(taskId, timeoutMs = timeouts.startMs) {
    if (startWaiters.has(taskId)) {
      return Promise.reject(new Error(`重复等待引擎启动确认：${taskId}`));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        startWaiters.delete(taskId);
        reject(new Error(`引擎启动确认超时（${Math.round(timeoutMs / 1000)}s 未收到 started）`));
      }, timeoutMs);
      startWaiters.set(taskId, { resolve, reject, timer });
    });
  }

  /**
   * 启动任务：先发 start，再等 started 事实。
   * @param {{taskId?: string}} [ctx]
   * @returns {Promise<object>} started 事实
   */
  async function start(ctx = {}) {
    if (!ctx.taskId) throw new Error('engine-client.start 需要 taskId');
    if (protocolVersion && protocolVersion !== TASK_PROTOCOL_VERSION) {
      throw new Error(
        `引擎协议版本不匹配（engine=${protocolVersion}, main=${TASK_PROTOCOL_VERSION}），请重连引擎`
      );
    }
    const pending = waitStarted(ctx.taskId);
    // 防止 bridge.start 早抛时留下未处理的 rejection
    pending.catch(() => {});
    try {
      await bridge.start(ctx);
      return await pending;
    } catch (e) {
      const w = clearWaiter(ctx.taskId);
      if (w) w.reject(e);
      throw e;
    }
  }

  /**
   * 控制命令（pause/resume/cancel）。
   * @param {string} cmd
   * @param {string} [argJson]
   */
  async function command(cmd, argJson = '') {
    const s = nextSeq();
    log.info(`[engine-client] 下发 ${cmd} seq=${s}`);
    return bridge.command(cmd, argJson);
  }

  /** inject 完成后由 engine-bridge 写入协议版本 */
  function setProtocolVersion(v) {
    const n = Number(v);
    protocolVersion = Number.isFinite(n) ? n : 0;
    return protocolVersion;
  }

  function getSnapshot() {
    return {
      protocolVersion,
      lastFact,
      waitingTasks: [...startWaiters.keys()],
    };
  }

  /** 应用退出/引擎重建时清理等待者 */
  function dispose() {
    for (const [, w] of startWaiters) clearTimeout(w.timer);
    startWaiters.clear();
  }

  return { start, command, onFact, waitStarted, setProtocolVersion, getSnapshot, dispose, nextSeq };
}

/** 生产单例（TaskRunner / ipc 共用） */
export const engineClient = createEngineClient();
