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
import { resolveEnginePath, sendToUi, getActiveBackup } from '../services/engine-bridge.js';
import { engineStorage } from '../services/config-store.js';
import { taskMachine } from '../services/task-machine.js';
import { backupStats } from '../services/backup-stats.js';
import { downloadManager } from '../services/download-manager.js';
import { windows } from '../windows.js';
import { ENGINE_DIR } from '../paths.js';
import { Channels, PushChannels } from '../../shared/ipc-contract.mjs';

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
  guardInvoke(Channels.engine.resourceRead, async (e, { path: rel, encoding = 'utf8' } = {}) => {
    const safeRel = String(rel || '').replace(/^\/+/, '').replace(/\\/g, '/');
    if (!safeRel || safeRel.includes('..')) {
      return { ok: false, error: 'INVALID_PATH' };
    }
    const full = path.normalize(path.join(ENGINE_DIR, safeRel));
    if (full !== ENGINE_DIR && !full.startsWith(ENGINE_DIR + path.sep)) {
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

  // ---------- network（主进程带 Referer 请求，等价 background 侧） ----------
  guardInvoke(Channels.engine.networkMimetype, async (e, { url, timeout = 15000 } = {}) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
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
      case 'log':
        sendToUi(PushChannels.backupLog, { level: data?.level || 'info', time: Date.now(), message: data?.message || '' });
        break;
      case 'state': {
        // P3-1：引擎状态事件 → 状态机裁决（非法转移拒绝、同态幂等、统一推送 backup:state-changed）
        const ev = {
          running: 'engineRunning',
          paused: 'pause',
          completed: 'complete',
          cancelled: 'cancel',
        }[data?.state];
        if (ev) taskMachine.dispatch(ev, data);
        if (data?.state === 'completed') {
          // 备份完成 → 自动记录历史统计（含模块级失败明细，P0-3 遗留项落库）。
          // P3-4：目录统计已异步化，fire-and-forget 不阻塞 completed 推送
          const active = getActiveBackup();
          backupStats
            .recordBackup({
              taskId: data.taskId || active.taskId,
              targetDir: active.targetDir,
              modules: active.modules,
              results: data.results,
              errors: data.errors,
            })
            .then((rec) => {
              if (rec) sendToUi(PushChannels.backupHistoryChanged, backupStats.getHistory());
            })
            .catch((e) => console.error('[backup-stats] 记录历史失败', e));
          sendToUi(PushChannels.backupCompleted, data);
        }
        break;
      }
      case 'module-done':
        sendToUi(PushChannels.backupModuleDone, data);
        break;
      default:
        break;
    }
  });
}
