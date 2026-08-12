/**
 * backup IPC：备份任务 start/pause/resume/cancel/get-state
 * 编排由引擎侧 runner（__engineCommands.start）执行；主进程负责检查点持久化
 */
import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineBridge, setActiveBackup, saveCheckpoint, sendToUi } from '../services/engine-bridge.js';
import { stateStore } from '../services/state-store.js';
import { backupStats } from '../services/backup-stats.js';
import { downloadManager } from '../services/download-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 内置表情库目录（assets/emoticons，打包时随应用分发） */
const EMOTICONS_DIR = path.resolve(__dirname, '../../assets/emoticons');

/**
 * 将内置表情库复制到备份目录 Common/images/（表情无需网络下载，
 * 备份产物直接引用本地路径即可正常显示）
 * @returns {number} 复制的表情数量
 */
export function copyBuiltinEmoticons(targetDir) {
  const manifestPath = path.join(EMOTICONS_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return 0;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    console.warn('[backup] 读取内置表情清单失败', e);
    return 0;
  }
  const outDir = path.join(targetDir, 'Common/images');
  fs.mkdirSync(outDir, { recursive: true });
  let count = 0;
  for (const eid of manifest.qq || []) {
    const src = path.join(EMOTICONS_DIR, 'qq', `e${eid}.gif`);
    if (fs.existsSync(src)) {
      const dest = path.join(outDir, `e${eid}.gif`);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        count++;
      }
    }
  }
  for (const name of manifest.wx || []) {
    const src = path.join(EMOTICONS_DIR, 'wx', `${name}.png`);
    if (fs.existsSync(src)) {
      const dest = path.join(outDir, `${name}.png`);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        count++;
      }
    }
  }
  return count;
}

const TASK_PREFIX = 'task-';

export function registerBackupIpc() {
  ipcMain.handle('backup:start', async (event, { taskId, modules, config, targetDir }) => {
    console.log('[backup:start] 进入', { taskId, modules, targetDir });
    if (!engineBridge.ready) {
      console.log('[backup:start] 引擎未就绪');
      return { ok: false, error: '引擎未就绪' };
    }
    if (!targetDir) {
      return { ok: false, error: '请先选择备份目标目录' };
    }
    const id = taskId || `${TASK_PREFIX}${Date.now()}`;
    const ctx = { taskId: id, modules: modules || [], config: config || null, targetDir };
    setActiveBackup(ctx);
    // 内置表情库复制到目标目录（表情无需网络下载）
    try {
      const n = copyBuiltinEmoticons(targetDir);
      console.log(`[backup:start] 已复制内置表情 ${n} 个`);
    } catch (e) {
      console.warn('[backup:start] 复制内置表情失败（不影响备份）', e);
    }
    try {
      saveCheckpoint(id, { ...ctx, state: 'running', startedAt: Date.now() });
      console.log('[backup:start] 检查点已保存');
    } catch (e) {
      console.error('[backup:start] 保存检查点失败', e);
    }
    sendToUi('backup:state-changed', { taskId: id, state: 'running' });
    console.log('[backup:start] running 已推送，调用引擎 start');

    try {
      await engineBridge.start(ctx);
      console.log('[backup:start] 引擎 start 返回');
      return { ok: true, taskId: id };
    } catch (e) {
      console.error('[backup:start] 引擎 start 失败', e);
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('backup:pause', async (event, { taskId }) => {
    try {
      await engineBridge.pause();
      // 联动下载管理器：停止调度 + 中断运行中任务（.part 保留断点）——否则引擎挂起后下载仍继续，CPU/网络持续占用
      await downloadManager.pause();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('backup:resume', async (event, { taskId }) => {
    try {
      await engineBridge.resume();
      await downloadManager.resume();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('backup:cancel', async (event, { taskId }) => {
    try {
      await engineBridge.cancel();
      await downloadManager.cancel();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('backup:get-state', () => {
    const checkpoints = stateStore.listCheckpoints();
    const active = checkpoints.find((c) => c.state === 'running' || c.state === 'paused') || null;
    return { taskId: active?.taskId || null, checkpoints };
  });

  // 备份历史（概览累计统计/上次备份；由 backup-stats 在备份完成时自动记录）
  ipcMain.handle('backup:get-history', () => {
    return { ok: true, history: backupStats.getHistory() };
  });

  ipcMain.handle('backup:list-albums', async () => {
    try {
      const list = await engineBridge.exec(
        'window.__engineCommands && window.__engineCommands.getAlbumList ? window.__engineCommands.getAlbumList() : null',
        { returnValue: true }
      );
      return { ok: true, albums: Array.isArray(list) ? list : [] };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  // 引擎加载失败后的重试入口：重新注入全部引擎脚本（幂等）
  ipcMain.handle('backup:engine-inject', async () => {
    try {
      await engineBridge.inject();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });
}
