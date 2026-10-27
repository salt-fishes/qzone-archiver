/**
 * 任务运行时（v5.5 M0 止血层 / M1 状态收口）
 *
 * 职责（对应 plans/v5.5.md §4.4）：
 *  1. 心跳看门狗：引擎 orchestrator 每 2s 发一次心跳；running 态 30s 无心跳 →
 *     状态机 running → stalled，并推 backup:stalled（UI 显示最后阶段与停滞时长）；
 *     心跳恢复 → stalled → running 并解除横幅。
 *  2. powerSaveBlocker：preparing/running/pausing/paused/resuming/finalizing/stalled 期间
 *     prevent-app-suspension，结束释放；收尾期经 holdPowerSave/releasePowerSave 显式续期。
 *  3. getSnapshot：供 task:get-state 通道在渲染层初始化/重载后恢复 stalled 与任务态。
 */
import { powerSaveBlocker } from 'electron';
import { taskMachine } from './task-machine.js';
import { sendToUi } from './engine-bridge.js';
import { logger } from './logger.js';
import { PushChannels } from '../../shared/ipc-contract.mjs';

/** running 态无心跳多久判停滞（RFC D 决策：30s） */
const HEARTBEAT_STALL_MS = 30_000;
/** 看门狗巡检间隔 */
const WATCHDOG_INTERVAL_MS = 5_000;
/** 持有电源锁的活跃态（v5.5 M1：含暂停中/恢复中/收尾中/停滞） */
const POWER_ACTIVE_STATES = [
  'preparing',
  'running',
  'pausing',
  'paused',
  'resuming',
  'finalizing',
  'stalled',
];

export function createTaskRuntime(deps = {}) {
  const machine = deps.machine || taskMachine;
  const push = deps.push || ((channel, payload) => sendToUi(channel, payload));
  const power = deps.powerSaveBlocker || powerSaveBlocker;
  const now = deps.now || (() => Date.now());

  let lastHeartbeatAt = null;
  let lastHeartbeat = null;
  let stalled = false;
  let watchdogTimer = null;
  let blockerId = null;

  function getSnapshot() {
    const last = lastHeartbeatAt;
    return {
      lastHeartbeatAt: last,
      lastHeartbeat: lastHeartbeat,
      stalled,
      msSinceHeartbeat: last ? now() - last : null,
    };
  }

  /** 引擎心跳入口（ipc/engine.js 的 notify heartbeat 分支调用） */
  function recordHeartbeat(data) {
    const wasStalled = stalled;
    lastHeartbeatAt = now();
    lastHeartbeat = data || null;
    if (!wasStalled) return;
    stalled = false;
    const snap = machine.getSnapshot();
    // v5.5 M1：停滞是状态机正式状态——心跳恢复必须走 unstall 迁移（checkpoint/推送同步）
    if (snap.state === 'stalled') {
      machine.dispatch('unstall');
    }
    const after = machine.getSnapshot();
    if (after.state === 'running') {
      // 状态机可能已自行推送；重复推送幂等，用于确保渲染层停滞横幅一定解除
      push(PushChannels.backupStateChanged, {
        taskId: after.taskId,
        state: 'running',
        modules: [...(after.modules || [])],
      });
    }
    logger.info(`[task-runtime] 心跳恢复（${(data && data.module) || '?'}），停滞解除`);
  }

  /** 电源锁：busy（preparing/running/paused）期间阻止系统挂起 */
  function ensurePowerSave(on) {
    if (on && blockerId === null) {
      try {
        blockerId = power.start('prevent-app-suspension');
        logger.info('[task-runtime] powerSaveBlocker 已启动（任务进行中，阻止系统挂起）');
      } catch (e) {
        logger.warn(`[task-runtime] powerSaveBlocker 启动失败：${e && e.message}`);
      }
    } else if (!on && blockerId !== null) {
      try {
        power.stop(blockerId);
      } catch {
        /* ignore */
      }
      blockerId = null;
      logger.info('[task-runtime] powerSaveBlocker 已释放');
    }
  }

  /** 备份收尾（引擎 completed 后等下载落盘/统计）显式持有电源锁；结束后 releasePowerSave() */
  function holdPowerSave() {
    ensurePowerSave(true);
  }
  function releasePowerSave() {
    ensurePowerSave(false);
  }

  /** 巡检：停滞判定 + 电源锁与状态机对齐 */
  function tick() {
    const snap = machine.getSnapshot();
    ensurePowerSave(POWER_ACTIVE_STATES.includes(snap.state));

    // 状态机已标记停滞：保持标志，等心跳恢复（pause/cancel 仍可用）
    if (snap.state === 'stalled') {
      stalled = true;
      return;
    }
    if (snap.state !== 'running') {
      stalled = false; // 任务离开 running（暂停/收尾/终态）即解除停滞标记
      return;
    }
    if (stalled) {
      // 防御：运行时标记与状态机不一致（如状态被外部回置 running）→ 复位，重新计时
      stalled = false;
    }
    // 尚无心跳基线（引擎还没来得及跳第一下）：以状态机进入 running 的时间兜底不误报
    const baseline = lastHeartbeatAt || snap.startedAt;
    if (!baseline) return;
    const silentMs = now() - baseline;
    if (silentMs < HEARTBEAT_STALL_MS) return;

    stalled = true;
    // v5.5 M1：停滞进入正式状态（running → stalled），UI 顶栏/面板由同一状态机驱动
    const moved = machine.dispatch('stall');
    if (!moved.ok) {
      stalled = false;
      return;
    }
    const payload = {
      taskId: snap.taskId,
      lastHeartbeatAt: baseline,
      silentMs,
      lastModule: (lastHeartbeat && lastHeartbeat.module) || '',
      lastPhase: (lastHeartbeat && lastHeartbeat.phase) || '',
    };
    logger.warn(
      `[task-runtime] 任务停滞：${Math.round(silentMs / 1000)}s 无心跳（module=${payload.lastModule || '?'} phase=${payload.lastPhase || '?'}），已推 backup:stalled`
    );
    logger.task(snap.taskId).warn(
      `任务停滞：${Math.round(silentMs / 1000)}s 无引擎心跳（最后阶段：${payload.lastModule || '?'}），界面操作仍可暂停/取消`
    );
    push(PushChannels.backupStalled, payload);
  }

  function start() {
    if (watchdogTimer) return;
    watchdogTimer = setInterval(tick, WATCHDOG_INTERVAL_MS);
    logger.info(`[task-runtime] 看门狗已启动（停滞阈值 ${HEARTBEAT_STALL_MS / 1000}s，巡检 ${WATCHDOG_INTERVAL_MS / 1000}s）`);
  }

  function stop() {
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    ensurePowerSave(false);
    stalled = false;
  }

  return { recordHeartbeat, getSnapshot, holdPowerSave, releasePowerSave, start, stop, tick };
}

/** 生产单例（deps 缺省走 electron/taskMachine/sendToUi） */
export const taskRuntime = createTaskRuntime();
