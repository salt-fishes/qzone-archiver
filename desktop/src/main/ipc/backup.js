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
import { avatarStore } from '../services/avatar-store.js';
import { logger } from '../services/logger.js';
import { Channels } from '../../shared/ipc-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * 内置表情库目录（assets/emoticons，打包时随 files 白名单分发）
 *
 * ⚠️ v4.7.5 修复：这里少写了一级 `..` —— 本文件位于 src/main/ipc，
 * `../../assets/emoticons` 会解析到 **src/assets/emoticons（不存在）**，
 * 正确目标是仓库根的 assets/emoticons（打包后 = app.asar/assets/emoticons）。
 * 后果曾经是：内置表情一个都没复制进备份产物，
 * 且 emoticons:get 永远返回 null（界面表情兜底链整条失效）。
 */
const EMOTICONS_DIR = path.resolve(__dirname, '../../../assets/emoticons');

/**
 * 将内置表情库复制到备份目录 Common/images/（表情无需网络下载，
 * 备份产物直接引用本地路径即可正常显示）
 *
 * 注意：引擎侧对"内置库命中"的 id 是**跳过下载**的（api/common.js addEmoticonDowanloadTask），
 * 所以这里是备份产物里内置表情的唯一来源，失败会直接表现为档案表情整批不显示。
 * @returns {number} 复制的表情数量
 */
export function copyBuiltinEmoticons(targetDir) {
  const manifestPath = path.join(EMOTICONS_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    // 曾经这里是静默 return 0，导致"表情没复制"这类问题很难查（v4.7.5 改为显式告警）
    logger.warn(`[backup] 内置表情库缺失，跳过复制：${manifestPath}`);
    return 0;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    logger.warn(`[backup] 读取内置表情清单失败：${e?.message || e}`);
    return 0;
  }
  const outDir = path.join(targetDir, 'Common/images');
  fs.mkdirSync(outDir, { recursive: true });
  let count = 0;

  /**
   * v4.7.2：按目录实况复制（经典表情是 .gif，魔法表情多为 .png）。
   * 此前只找 e{id}.gif，导致 224 个 png 表情一个都没复制进备份目录，
   * 而档案里引用的正是这些文件 —— 导出档案的表情全部显示不出来。
   */
  const roster = {};
  for (const file of fs.readdirSync(path.join(EMOTICONS_DIR, 'qq'))) {
    const m = /^e(\d+)\.(gif|png|jpe?g)$/i.exec(file);
    if (m) roster[m[1]] = file;
  }
  for (const [id, fileName] of Object.entries(roster)) {
    const src = path.join(EMOTICONS_DIR, 'qq', fileName);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(outDir, fileName);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      count++;
    }
    /**
     * v4.7.5：档案 SPA 渲染表情时把扩展名写死成 `.gif`
     * （export-resources/spa-dist 内 `${O4}e${id}.gif`），而魔法表情内置文件的真实
     * 扩展名是 `.png` —— 只复制真实文件名，档案里 230 个魔法表情依旧全部取不到图。
     * 图片是按内容识别的（CDN 返回的 e327806"gif" 本身就是 PNG 字节），
     * 所以这里给非 .gif 的表情再补一份 `.gif` 字节拷贝，SPA 与静态模板两边都能取到。
     */
    if (path.extname(fileName).toLowerCase() !== '.gif') {
      const aliasDest = path.join(outDir, `e${id}.gif`);
      if (!fs.existsSync(aliasDest)) {
        fs.copyFileSync(src, aliasDest);
        count++;
      }
    }
  }
  if (count > 0) {
    logger.info(`[backup] 内置表情已复制 ${count} 个（含 png 魔法表情及其 .gif 别名）`);
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

/**
 * v4.7.4：内置表情 → data URL（渲染层按 id 取，避免相对路径加载失败）
 * 表情文件就在 assets/emoticons/qq（打包时随 files 白名单分发），
 * 这里负责找真实文件名（经典 .gif / 魔法 .png）并内联返回。
 */
function emoticonDataUrl(id) {
  const clean = String(id || '').replace(/\D/g, '');
  if (!clean) return null;
  for (const ext of ['gif', 'png', 'jpg', 'jpeg']) {
    const p = path.join(EMOTICONS_DIR, 'qq', `e${clean}.${ext}`);
    if (!fs.existsSync(p)) continue;
    try {
      const buf = fs.readFileSync(p);
      const mime =
        ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch (e) {
      logger.warn(`[emoticons] 读取表情失败 ${p}: ${e?.message || e}`);
      return null;
    }
  }
  return null;
}

const TASK_PREFIX = 'task-';

/** 表情未命中日志去重（避免同 id 反复刷屏） */
const emoticonsLogged = new Set();

export function registerBackupIpc() {
  // targetUin（可选，v4.6 他人模式）：缺省/等于登录号 = 备份本人空间，行为与旧版完全一致
  ipcMain.handle(Channels.backup.start, async (event, { taskId, modules, config, targetDir, targetUin }) => {
    logger.info(
      `[backup] 收到备份启动请求 taskId=${taskId || '（自动生成）'} modules=[${(modules || []).join(',') || '无'}] targetDir=${targetDir || '（未选）'}${targetUin ? ` target=${targetUin}` : ''}`
    );
    if (!engineBridge.ready) {
      logger.warn('[backup] 启动被拒：引擎未就绪');
      return { ok: false, error: '引擎未就绪' };
    }
    if (!targetDir) {
      logger.warn('[backup] 启动被拒：未选择目标目录');
      return { ok: false, error: '请先选择备份目标目录' };
    }
    const id = taskId || `${TASK_PREFIX}${Date.now()}`;
    // §K4：任务日志轨道起点——此后到终态的全流程事件流水写入 backup-<id>.log
    const tl = logger.task(id);
    tl.info(
      `任务开始 modules=[${(modules || []).join(',') || '无'}] targetDir=${targetDir}` +
        (targetUin ? ` target=${targetUin}` : '（本人空间）')
    );
    const ctx = { taskId: id, modules: modules || [], config: config || null, targetDir, targetUin: targetUin ? String(targetUin) : undefined };
    // P3-1：状态机裁决——上一任务未终态时拒绝并发启动
    const pre = taskMachine.dispatch('prepare', ctx);
    if (!pre.ok) {
      tl.warn(`启动被拒：${pre.error}`);
      return { ok: false, error: `已有备份任务${pre.snapshot.state === 'paused' ? '处于暂停' : '进行中'}，请先完成或取消` };
    }
    registerTaskContext(ctx);
    // 内置表情库复制到目标目录（表情无需网络下载）
    try {
      const n = copyBuiltinEmoticons(targetDir);
      tl.info(`内置表情复制完成：${n} 个`);
    } catch (e) {
      tl.warn(`复制内置表情失败（不影响备份）：${e?.message || e}`);
    }
    // P3-1：preparing → running 由状态机统一持久化 checkpoint 并推送 UI（迁移流水由状态机写任务日志）
    taskMachine.dispatch('start', ctx);

    // P3-2：触发一次下载调度（幂等）——恢复上一任务遗留的 pending 队列；
    // 旧暂停位已绑定旧 taskId，新任务启动后由 pump 自动失效（P0-1 根因消除）
    try {
      await downloadManager.resume();
      tl.info('下载调度已恢复（幂等触发）');
    } catch (e) {
      tl.warn(`恢复下载调度失败（不阻塞备份）：${e?.message || e}`);
    }

    try {
      await engineBridge.start(ctx);
      tl.info('引擎 start 调用已返回');
      return { ok: true, taskId: id };
    } catch (e) {
      logger.error(`[backup] 引擎 start 失败：${e?.stack || e}`);
      tl.error(`引擎 start 调用失败：${e.message}`);
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
      logger.task(taskMachine.getSnapshot().taskId).info('暂停已下发：引擎挂起 + 下载中断（.part 保留断点）');
      return { ok: true };
    } catch (e) {
      logger.task(taskMachine.getSnapshot().taskId).error(`暂停下发失败：${e.message}`);
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle(Channels.backup.resume, async () => {
    const r = taskMachine.dispatch('resume');
    if (!r.ok) return { ok: false, error: r.error };
    try {
      await engineBridge.resume();
      await downloadManager.resume();
      logger.task(taskMachine.getSnapshot().taskId).info('恢复已下发：引擎继续 + 下载续传');
      return { ok: true };
    } catch (e) {
      logger.task(taskMachine.getSnapshot().taskId).error(`恢复下发失败：${e.message}`);
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle(Channels.backup.cancel, async () => {
    const r = taskMachine.dispatch('cancel');
    if (!r.ok) return { ok: false, error: r.error };
    try {
      await engineBridge.cancel();
      await downloadManager.cancel();
      logger.task(taskMachine.getSnapshot().taskId).info('取消已下发：引擎中止 + 下载清空 pending');
      dropTaskContext(taskMachine.getSnapshot().taskId); // P5.2：终态清理任务上下文
      return { ok: true };
    } catch (e) {
      logger.task(taskMachine.getSnapshot().taskId).error(`取消下发失败：${e.message}`);
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

  /**
   * v4.7 反馈 ②：备份目标头像（本地缓存 → data URL）
   * 未命中缓存时先尝试下载一次（带引擎 session，减少防盗链失败），失败返回 null 由 UI 兜底。
   */
  ipcMain.handle(Channels.avatars.get, async (event, { uin } = {}) => {
    const clean = String(uin || '').replace(/\D/g, '');
    if (!clean) return { ok: false, dataUrl: null };
    let dataUrl = avatarStore.getDataUrl(clean);
    let source = dataUrl ? '本地缓存' : '';
    if (!dataUrl) {
      // 本地没有（或首次请求）：尝试抓一次再读；失败由 UI 显示昵称首字兜底
      const ok = await avatarStore.ensure(clean).catch((e) => {
        logger.warn(`[avatars] 抓取头像异常 uin=${clean}: ${e?.message || e}`);
        return false;
      });
      dataUrl = avatarStore.getDataUrl(clean);
      source = ok && dataUrl ? '网络抓取' : '失败';
    }
    logger.info(`[avatars] uin=${clean} → ${dataUrl ? `已返回（${source}）` : '无头像（UI 用首字兜底）'}`);
    return { ok: !!dataUrl, dataUrl };
  });

  /** v4.7.4：内置表情图片（data URL）。命中/未命中都打日志，便于排查显示问题。 */
  ipcMain.handle(Channels.emoticons.get, (event, { id } = {}) => {
    const dataUrl = emoticonDataUrl(id);
    if (!dataUrl && !emoticonsLogged.has(String(id))) {
      emoticonsLogged.add(String(id));
      logger.warn(`[emoticons] id=${id} 未在内置库中找到（界面将回落 CDN 或显示原文）`);
    }
    return { ok: !!dataUrl, dataUrl };
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
    logger.info('[backup] 手动重试引擎注入');
    try {
      await engineBridge.inject();
      logger.info('[backup] 手动重试注入完成');
      return { ok: true };
    } catch (e) {
      logger.error(`[backup] 手动重试注入失败：${e.message || e}`);
      return { ok: false, error: e.message || String(e) };
    }
  });

  // v4.6 他人模式：好友列表（登录者视角，供目标选择器远程搜索）
  ipcMain.handle(Channels.backup.listFriends, async () => {
    try {
      const r = await engineBridge.exec(
        'window.__engineCommands && window.__engineCommands.listFriends ? window.__engineCommands.listFriends() : null',
        { returnValue: true }
      );
      if (r && Array.isArray(r.friends)) return { ok: true, friends: r.friends };
      if (r && r.error) return { ok: false, error: r.error };
      return { ok: true, friends: [] };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });

  // v4.6 他人模式：探测目标空间可访问性（返回 isOwner / 昵称 / 头像，供向导第①步确认）
  ipcMain.handle(Channels.backup.validateTarget, async (event, targetUin) => {
    try {
      const r = await engineBridge.exec(
        `window.__engineCommands ? window.__engineCommands.validateTarget(${JSON.stringify(String(targetUin ?? ''))}) : null`,
        { returnValue: true }
      );
      return r || { ok: false, error: '引擎未就绪' };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  });
}
