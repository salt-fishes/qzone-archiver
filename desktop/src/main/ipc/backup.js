/**
 * backup IPC：备份任务 start/pause/resume/cancel/get-state
 * 编排由引擎侧 runner（__engineCommands.start）执行；主进程负责检查点持久化
 */
import { ipcMain } from 'electron';
import { engineBridge, setActiveBackup, saveCheckpoint, sendToUi } from '../services/engine-bridge.js';
import { stateStore } from '../services/state-store.js';

const TASK_PREFIX = 'task-';

export function registerBackupIpc() {
  ipcMain.handle('backup:start', async (event, { taskId, modules, config, targetDir }) => {
    if (!engineBridge.ready) {
      return { ok: false, error: '引擎未就绪' };
    }
    if (!targetDir) {
      return { ok: false, error: '请先选择备份目标目录' };
    }
    const id = taskId || `${TASK_PREFIX}${Date.now()}`;
    const ctx = { taskId: id, modules: modules || [], config: config || null, targetDir };
    setActiveBackup(ctx);
    saveCheckpoint(id, { ...ctx, state: 'running', startedAt: Date.now() });
    sendToUi('backup:state-changed', { taskId: id, state: 'running' });

    try {
      await engineBridge.start(ctx);
      return { ok: true, taskId: id };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('backup:pause', async (event, { taskId }) => {
    try {
      await engineBridge.pause();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('backup:resume', async (event, { taskId }) => {
    try {
      await engineBridge.resume();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('backup:cancel', async (event, { taskId }) => {
    try {
      await engineBridge.cancel();
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
}
