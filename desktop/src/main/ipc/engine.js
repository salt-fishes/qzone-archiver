/**
 * 引擎窗口 IPC（engine-bridge preload → 主进程）
 * 契约见设计文档 §3.2「引擎窗口桥」：
 *   invoke 类：engine:storage-* / engine:fs-* / engine:cookie-get / engine:download-enqueue / engine:network-*
 *   post 类：engine:ready / engine:notify（progress|log|state）
 */
import { ipcMain, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { resolveEnginePath, sendToUi, getActiveBackup } from '../services/engine-bridge.js';
import { engineStorage } from '../services/config-store.js';
import { backupStats } from '../services/backup-stats.js';
import { downloadManager } from '../services/download-manager.js';
import { ENGINE_DIR } from '../paths.js';

const REFERER = 'https://user.qzone.qq.com/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function registerEngineIpc() {
  // ---------- 引擎就绪 ----------
  ipcMain.on('engine:ready', () => {
    // runner 注入完成后由 preload post 上来（engineBridge.inject 已置 ready）
  });

  // ---------- storage（等价 chrome.storage） ----------
  ipcMain.handle('engine:storage-get', (e, { keys } = {}) => engineStorage.get(keys ?? null));
  ipcMain.handle('engine:storage-set', (e, { items } = {}) => engineStorage.set(items || {}));
  ipcMain.handle('engine:storage-remove', (e, { keys } = {}) => engineStorage.remove(keys || []));

  // ---------- fs（Filer 虚拟路径 → 目标目录） ----------
  ipcMain.handle('engine:fs-write', async (e, { path: p, data, encoding } = {}) => {
    const full = resolveEnginePath(p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    if (encoding === 'binary') {
      fs.writeFileSync(full, Buffer.from(data));
    } else {
      fs.writeFileSync(full, String(data ?? ''), 'utf8');
    }
    return { ok: true, path: full };
  });

  ipcMain.handle('engine:fs-read', async (e, { path: p, encoding = 'utf8' } = {}) => {
    const full = resolveEnginePath(p);
    if (!fs.existsSync(full)) return { ok: false, error: 'ENOENT' };
    if (encoding === 'binary') {
      return { ok: true, encoding: 'binary', data: fs.readFileSync(full).toString('base64') };
    }
    return { ok: true, encoding: 'utf8', data: fs.readFileSync(full, 'utf8') };
  });

  ipcMain.handle('engine:fs-exists', async (e, { path: p } = {}) => {
    try {
      return fs.existsSync(resolveEnginePath(p));
    } catch {
      return false;
    }
  });

  ipcMain.handle('engine:fs-mkdir', async (e, { path: p } = {}) => {
    fs.mkdirSync(resolveEnginePath(p), { recursive: true });
    return { ok: true };
  });

  ipcMain.handle('engine:fs-remove', async (e, { path: p } = {}) => {
    const full = resolveEnginePath(p);
    fs.rmSync(full, { recursive: true, force: true });
    return { ok: true };
  });

  ipcMain.handle('engine:fs-list', async (e, { path: p } = {}) => {
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
  ipcMain.handle('engine:resource-read', async (e, { path: rel, encoding = 'utf8' } = {}) => {
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
  ipcMain.handle('engine:cookie-get', async (e, { name } = {}) => {
    const cookies = await e.sender.session.cookies.get({
      url: 'https://user.qzone.qq.com',
      name,
    });
    return cookies[0]?.value || '';
  });

  // ---------- download（转主进程 DownloadManager） ----------
  ipcMain.handle('engine:download-enqueue', async (e, { task } = {}) => {
    return downloadManager.enqueue(task || {});
  });

  // ---------- network（主进程带 Referer 请求，等价 background 侧） ----------
  ipcMain.handle('engine:network-mimetype', async (e, { url, timeout = 15000 } = {}) => {
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

  ipcMain.handle('engine:network-json', async (e, { url } = {}) => {
    const res = await net.fetch(url, { headers: { Referer: REFERER, 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

  // ---------- notify（引擎 → 主 UI） ----------
  ipcMain.on('engine:notify', (e, payload = {}) => {
    const { type, data } = payload;
    if (!type) return;
    switch (type) {
      case 'progress':
        sendToUi('backup:progress', data);
        break;
      case 'log':
        sendToUi('backup:log', { level: data?.level || 'info', time: Date.now(), message: data?.message || '' });
        break;
      case 'state':
        sendToUi('backup:state-changed', data);
        if (data?.state === 'completed') {
          // 备份完成 → 自动记录历史统计（供概览累计/上次备份展示，不依赖目录扫描）
          const active = getActiveBackup();
          const rec = backupStats.recordBackup({
            taskId: data.taskId || active.taskId,
            targetDir: active.targetDir,
            modules: active.modules,
            results: data.results,
          });
          if (rec) sendToUi('backup:history-changed', backupStats.getHistory());
          sendToUi('backup:completed', data);
        }
        break;
      case 'module-done':
        sendToUi('backup:module-done', data);
        break;
      default:
        break;
    }
  });
}
