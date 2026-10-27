/**
 * 引擎窗口 IPC（engine-bridge preload → 主进程）
 * 契约见设计文档 §3.2「引擎窗口桥」：
 *   invoke 类：engine:storage-* / engine:fs-* / engine:cookie-get / engine:download-enqueue / engine:network-*
 *   post 类：engine:notify（progress|log|state）
 * 全部通道经 guardInvoke/guardPost 统一来源校验（P0-2，见 assertEngineSender）。
 */
import { ipcMain, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { resolveEnginePath, sendToUi, getActiveTaskContext } from '../services/engine-bridge.js';
import { resolveWithin } from '../services/path-guard.js';
import { engineStorage } from '../services/config-store.js';
import { taskRuntime } from '../services/task-runtime.js';
import { taskRunner } from '../services/task-runner.js';
import { engineClient } from '../services/engine-client.js';
import { backupStats } from '../services/backup-stats.js';
import { downloadManager } from '../services/download-manager.js';
import { logger } from '../services/logger.js';
import { windows } from '../windows.js';
import { ENGINE_DIR } from '../paths.js';
import { Channels, PushChannels } from '../../shared/ipc-contract.mjs';
import { capLog } from '../../shared/log-cap.mjs';

const REFERER = 'https://user.qzone.qq.com/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const QZONE_ORIGIN_PREFIX = 'https://user.qzone.qq.com';

/**
 * 引擎通道统一来源守卫（P0-2 纵深防御第二层）：
 * 仅允许「引擎窗口 + 主框架 + qzone 页面 URL」的调用。
 * 引擎脚本注入于隔离世界（与主框架同层级），正常运行天然满足；主世界 engineBridge
 * 已移除（engine-bridge preload），此守卫兜底任何残余/伪造入口。
 */
function assertEngineSender(event) {
  try {
    const engineWc =
      windows.engine && !windows.engine.isDestroyed() ? windows.engine.webContents : null;
    if (!engineWc || event.sender !== engineWc) return false;
    const frame = event.senderFrame;
    // 必须存在且为主框架（子框架 parent 非空）
    if (!frame || frame.parent) return false;
    // 与 index.js did-navigate 判定一致：仅允许 qzone 页面
    return String(frame.url || '').startsWith(QZONE_ORIGIN_PREFIX);
  } catch {
    return false;
  }
}

/**
 * invoke 类通道包装：来源非法 → 返回 FORBIDDEN + 告警
 * @param {string} channel
 * @param {(event: Electron.IpcMainInvokeEvent, payload: any) => any} handler
 */
function guardInvoke(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    if (!assertEngineSender(event)) {
      console.warn(`[engine:ipc] 已拒绝非法来源的 ${channel} 调用`);
      return { ok: false, error: 'FORBIDDEN' };
    }
    return handler(event, payload);
  });
}

/** post 类通道包装：来源非法 → 丢弃 + 告警（post 无返回值语义） */
function guardPost(channel, handler) {
  ipcMain.on(channel, (event, payload) => {
    if (!assertEngineSender(event)) {
      console.warn(`[engine:ipc] 已拒绝非法来源的 ${channel} 推送`);
      return;
    }
    handler(event, payload);
  });
}

export function registerEngineIpc() {
  // ---------- storage（等价 chrome.storage） ----------
  guardInvoke(Channels.engine.storageGet, (e, { keys } = {}) => engineStorage.get(keys ?? null));
  guardInvoke(Channels.engine.storageSet, (e, { items } = {}) => engineStorage.set(items || {}));
  guardInvoke(Channels.engine.storageRemove, (e, { keys } = {}) => engineStorage.remove(keys || []));

  // ---------- fs（Filer 虚拟路径 → 目标目录） ----------
  guardInvoke(Channels.engine.fsWrite, async (e, { path: p, data, encoding } = {}) => {
    const full = resolveEnginePath(p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (encoding === 'binary') {
      fs.writeFileSync(full, Buffer.from(data));
    } else {
      fs.writeFileSync(full, String(data ?? ''), 'utf8');
    }
    return { ok: true, path: full };
  });

  guardInvoke(Channels.engine.fsRead, async (e, { path: p, encoding = 'utf8' } = {}) => {
    const full = resolveEnginePath(p);
    if (!fs.existsSync(full)) return { ok: false, error: 'ENOENT' };
    if (encoding === 'binary') {
      return { ok: true, encoding: 'binary', data: fs.readFileSync(full).toString('base64') };
    }
    return { ok: true, encoding: 'utf8', data: fs.readFileSync(full, 'utf8') };
  });

  guardInvoke(Channels.engine.fsExists, async (e, { path: p } = {}) => {
    try {
      return fs.existsSync(resolveEnginePath(p));
    } catch {
      return false;
    }
  });

  guardInvoke(Channels.engine.fsMkdir, async (e, { path: p } = {}) => {
    fs.mkdirSync(resolveEnginePath(p), { recursive: true });
    return { ok: true };
  });

  guardInvoke(Channels.engine.fsRemove, async (e, { path: p } = {}) => {
    const full = resolveEnginePath(p);
    fs.rmSync(full, { recursive: true, force: true });
    return { ok: true };
  });

  guardInvoke(Channels.engine.fsList, async (e, { path: p } = {}) => {
    const full = resolveEnginePath(p);
    if (!fs.existsSync(full)) return { ok: false, error: 'ENOENT' };
    const entries = fs.readdirSync(full, { withFileTypes: true }).map((d) => ({
      name: d.name,
      isDirectory: d.isDirectory(),
      fullPath: '/' + path.relative(full, path.join(full, d.name)).split(path.sep).join('/'),
    }));
    return { ok: true, entries };
  });

  // ---------- 引擎本地资源读取（等价扩展 chrome.runtime.getURL + fetch） ----------
  // P5.1：路径校验收敛到 path-guard（与 resolveEnginePath 同一实现）
  guardInvoke(Channels.engine.resourceRead, async (e, { path: rel, encoding = 'utf8' } = {}) => {
    const full = resolveWithin(ENGINE_DIR, rel);
    if (!full) {
      return { ok: false, error: 'INVALID_PATH' };
    }
    if (!fs.existsSync(full)) {
      return { ok: false, error: 'ENOENT' };
    }
    if (encoding === 'binary') {
      return { ok: true, encoding: 'binary', data: fs.readFileSync(full).toString('base64') };
    }
    return { ok: true, encoding: 'utf8', data: fs.readFileSync(full, 'utf8') };
  });

  // ---------- cookie（httpOnly） ----------
  guardInvoke(Channels.engine.cookieGet, async (e, { name } = {}) => {
    const cookies = await e.sender.session.cookies.get({
      url: 'https://user.qzone.qq.com',
      name,
    });
    return cookies[0]?.value || '';
  });

  // ---------- download（转主进程 DownloadManager） ----------
  guardInvoke(Channels.engine.downloadEnqueue, async (e, { task } = {}) => {
    return downloadManager.enqueue(task || {});
  });

  // v5.5 M1：某次备份的媒体全部落盘（done/failed）后重算历史记录的文件数/体积。
  // 完成页不再等待下载（决策 D4），recordBackup 记录的是完成瞬间的快照；
  // 尾部媒体稍后落盘，这里按同一 startedAt 重算并推送历史变更。
  downloadManager.setDrainListener(async (taskId) => {
    try {
      const rec = await backupStats.updateStats(taskId);
      if (rec) sendToUi(PushChannels.backupHistoryChanged, backupStats.getHistory());
    } catch (e) {
      logger.warn(`[engine] 下载排空后重算历史统计失败 taskId=${taskId}: ${e?.message || e}`);
    }
  });

  // ---------- network（主进程带 Referer 请求，等价 background 侧） ----------
  guardInvoke(Channels.engine.networkMimetype, async (e, { url, timeout = 15000 } = {}) => {
    try {
      // v5.5 M0 补：调用方统一传毫秒；这里再夹紧 1s–120s，防止单位误传导致 30ms 级 abort
      const ms = Number.isFinite(Number(timeout))
        ? Math.min(120_000, Math.max(1_000, Number(timeout)))
        : 15_000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      const res = await net.fetch(url, { signal: controller.signal, headers: { Referer: REFERER, 'User-Agent': UA } });
      clearTimeout(timer);
      return res.headers.get('content-type') || '';
    } catch (e2) {
      return '';
    }
  });

  guardInvoke(Channels.engine.networkJson, async (e, { url } = {}) => {
    const res = await net.fetch(url, { headers: { Referer: REFERER, 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

  // ---------- notify（引擎 → 主 UI） ----------
  guardPost(Channels.engine.notify, (e, payload = {}) => {
    const { type, data } = payload;
    if (!type) return;
    switch (type) {
      case 'progress':
        sendToUi(PushChannels.backupProgress, data);
        break;
      case 'log': {
        const level = data?.level || 'info';
        // v4.9.2：兜底截断（与 windows.js console 透传同阈值）——
        // 引擎整包 dump 大对象时不能灌爆 UI 日志流与任务日志
        const message = capLog(data?.message);
        sendToUi(PushChannels.backupLog, { level, time: Date.now(), message });
        // §K4：引擎结构化日志 → 任务日志主轨道（不依赖 console 透传、不依赖窗口生命周期）。
        // 模块开始/结束、任务启动等引擎流水在此落盘 backup-<taskId>.log
        const logTaskId = getActiveTaskContext()?.taskId;
        if (logTaskId && message) {
          logger.task(logTaskId).log(level, message);
        }
        break;
      }
      case 'state': {
        // v5.5 M1：引擎状态事实 → TaskRunner（completed 的 finalizing 收尾链也在 Runner 内完成）
        const isState = ['running', 'paused', 'completed', 'cancelled', 'failed'].includes(data?.state);
        if (!isState) break;
        Promise.resolve(taskRunner.handleEngineState(data || {}))
          .then((verdict) => {
            if (verdict && !verdict.ok) {
              logger.warn(
                `[engine] 引擎 ${data?.state} 事件被状态机拒绝（当前 ${verdict.snapshot?.state}）`
              );
            }
          })
          .catch((e) => {
            logger.error(`[engine] 处理引擎 ${data?.state} 事件失败：${e?.stack || e}`);
          });
        break;
      }
      case 'module-done': {
        // v5.5 M1：模块完成写 phase-end（TaskRunner journal）
        taskRunner.handleModuleDone(data || {});
        sendToUi(PushChannels.backupModuleDone, data);
        // §K4：模块结束 → 任务日志（模块粒度的时间点；与"模块完成"日志行共同给出模块耗时）
        // 用词与 UI 日志一致（渲染层同事件也显示「模块完成」）
        const doneTaskId = getActiveTaskContext()?.taskId;
        if (doneTaskId) {
          logger.task(doneTaskId).info(`模块完成：${data?.module ?? '?'}`);
        }
        break;
      }
      case 'heartbeat': {
        // v5.5 M0：引擎存活心跳（orchestrator 每 2s）→ task-runtime 记录；30s 无心跳由看门狗推 backup:stalled
        // v5.5 M1：心跳携带协议版本 + module/phase，TaskRunner 据此写阶段检查点
        if (data?.v) engineClient.setProtocolVersion(data.v);
        // 先让看门狗解除 stalled（stalled → running），再写 checkpoint，
        // 保证恢复瞬间的 checkpoint 状态是 running 而不是 stalled
        taskRuntime.recordHeartbeat(data || {});
        taskRunner.onHeartbeat(data || {});
        break;
      }
      case 'started': {
        // v5.5 M1：引擎已接受 start（早于预取）→ 解除 engineClient 的启动确认等待
        if (data?.v) engineClient.setProtocolVersion(data.v);
        const startedTaskId = data?.taskId || getActiveTaskContext()?.taskId;
        if (startedTaskId) {
          engineClient.onFact({ ...(data || {}), type: 'started', taskId: startedTaskId });
        }
        break;
      }
      default:
        break;
    }
  });
}
