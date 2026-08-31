/**
 * backup IPC：备份任务 start/pause/resume/cancel/get-state
 * 编排由引擎侧 runner（__engineCommands.start）执行；主进程负责检查点持久化
 */
import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineBridge, registerTaskContext, dropTaskContext } from '../services/engine-bridge.js';
import { stateStore } from '../services/state-store.js';
import { taskMachine } from '../services/task-machine.js';
import { backupStats } from '../services/backup-stats.js';
import { downloadManager } from '../services/download-manager.js';
import { Channels } from '../../shared/ipc-contract.mjs';

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
  ipcMain.handle(Channels.backup.start, async (event, { taskId, modules, config, targetDir }) => {
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
    // P3-1：状态机裁决——上一任务未终态时拒绝并发启动
    const pre = taskMachine.dispatch('prepare', ctx);
    if (!pre.ok) {
      return { ok: false, error: `已有备份任务${pre.snapshot.state === 'paused' ? '处于暂停' : '进行中'}，请先完成或取消` };
    }
    registerTaskContext(ctx);
    // 内置表情库复制到目标目录（表情无需网络下载）
    try {
      const n = copyBuiltinEmoticons(targetDir);
      console.log(`[backup:start] 已复制内置表情 ${n} 个`);
    } catch (e) {
      console.warn('[backup:start] 复制内置表情失败（不影响备份）', e);
    }
    // P3-1：preparing → running 由状态机统一持久化 checkpoint 并推送 UI
    taskMachine.dispatch('start', ctx);
    console.log('[backup:start] running 已推送，调用引擎 start');

    // P3-2：触发一次下载调度（幂等）——恢复上一任务遗留的 pending 队列；
    // 旧暂停位已绑定旧 taskId，新任务启动后由 pump 自动失效（P0-1 根因消除）
    try {
      await downloadManager.resume();
    } catch (e) {
      console.warn('[backup:start] 恢复下载调度失败（不阻塞备份）', e);
    }

    try {
      await engineBridge.start(ctx);
      console.log('[backup:start] 引擎 start 返回');
      return { ok: true, taskId: id };
    } catch (e) {
      console.error('[backup:start] 引擎 start 失败', e);
      taskMachine.dispatch('fail', { taskId: id, error: e.message });
      dropTaskContext(id); // P5.2：终态清理任务上下文
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle(Channels.backup.pause, async () => {
    // P3-1：命令由状态机 guard——非 running 状态拒绝（引擎/下载管理器不被误触发）
    const r = taskMachine.dispatch('pause');
    if (!r.ok) return { ok: false, error: r.error };
    try {
      await engineBridge.pause();
      // 联动下载管理器：停止调度 + 中断运行中任务（.part 保留断点）——否则引擎挂起后下载仍继续，CPU/网络持续占用
      await downloadManager.pause();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle(Channels.backup.resume, async () => {
    const r = taskMachine.dispatch('resume');
    if (!r.ok) return { ok: false, error: r.error };
    try {
      await engineBridge.resume();
      await downloadManager.resume();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle(Channels.backup.cancel, async () => {
    const r = taskMachine.dispatch('cancel');
    if (!r.ok) return { ok: false, error: r.error };
    try {
      await engineBridge.cancel();
      await downloadManager.cancel();
      dropTaskContext(taskMachine.getSnapshot().taskId); // P5.2：终态清理任务上下文
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle(Channels.backup.getState, () => {
    const checkpoints = stateStore.listCheckpoints();
    const active = checkpoints.find((c) => c.state === 'running' || c.state === 'paused') || null;
    // P3-1：状态机快照为唯一事实源（taskId 字段保留兼容旧消费）
    return { taskId: taskMachine.getSnapshot().taskId || active?.taskId || null, task: taskMachine.getSnapshot(), checkpoints };
  });

  // 备份历史（概览累计统计/上次备份；由 backup-stats 在备份完成时自动记录）
  ipcMain.handle(Channels.backup.getHistory, () => {
    return { ok: true, history: backupStats.getHistory() };
  });

  ipcMain.handle(Channels.backup.listAlbums, async () => {
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
  ipcMain.handle(Channels.backup.engineInject, async () => {
    try {
      await engineBridge.inject();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });
}
