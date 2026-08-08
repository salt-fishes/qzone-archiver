/**
 * 引擎桥（主进程）：负责
 *  1. 引擎窗口脚本注入（顺序加载五层 + 适配器 + runner）
 *  2. __engineCommands 命令路由（start/pause/resume/cancel/getLoginStatus）
 *  3. 引擎 IPC 的 FS/存储路径映射（Filer 虚拟路径 → 目标目录真实路径）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { windows } from '../windows.js';
import { ENGINE_DIR } from '../paths.js';
import { stateStore } from './state-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 引擎隔离世界 ID（与 preload engine-bridge.cjs 保持一致） */
export const ENGINE_WORLD_ID = 100;

/** 在引擎窗口隔离世界执行 JS（引擎命名空间 QZonePlatform/API/__engineCommands 均在该世界） */
function execInEngine(wc, code) {
  // 追加 ;void 0; 抑制 executeJavaScript 返回脚本末值（部分脚本末值为不可克隆对象会报错）
  return wc.executeJavaScriptInIsolatedWorld(
    ENGINE_WORLD_ID,
    [{ code: code + '\n;void 0;' }],
    true
  );
}

/** 注入顺序（依赖关系：适配器 → 运行时库 → 基础工具 → 五层 → runner） */
export const ENGINE_SCRIPTS = [
  'desktop-adapters.js',
  'vendor/jquery/jquery.min.js',
  'vendor/lodash/lodash.min.js',
  'vendor/turndown/turndown.js',
  'vendor/template/template.js',
  'vendor/sheetjs/xlsx.full.min.js',
  'utils.js',
  'config.js',
  'templates-compiled.js',
  'api.js',
  'collectors/index.js',
  'collectors/base.js',
  'collectors/messages.js',
  'collectors/blogs.js',
  'collectors/diaries.js',
  'collectors/boards.js',
  'collectors/favorites.js',
  'collectors/photos.js',
  'collectors/videos.js',
  'collectors/visitors.js',
  'collectors/friends.js',
  'collectors/shares.js',
  'modules/common.js',
  'modules/messages.js',
  'modules/blogs.js',
  'modules/diaries.js',
  'modules/photos.js',
  'modules/videos.js',
  'modules/boards.js',
  'modules/favorites.js',
  'modules/shares.js',
  'modules/friends.js',
  'modules/visitors.js',
  'desktop-runner.js',
];

/** 当前激活的备份上下文（fs 映射 / 命令路由依据） */
const activeBackup = {
  taskId: null,
  targetDir: null,
  config: null,
  modules: [],
};

export function setActiveBackup(ctx) {
  Object.assign(activeBackup, ctx);
}

export function getActiveBackup() {
  return { ...activeBackup };
}

export function clearActiveBackup() {
  activeBackup.taskId = null;
  activeBackup.targetDir = null;
  activeBackup.config = null;
  activeBackup.modules = [];
}

/**
 * Filer 虚拟路径 → 目标目录真实路径
 * '/QQ空间备份_uin/xxx' → targetDir/xxx（桌面版一段式：目标文件夹即备份根目录）
 */
export function resolveEnginePath(rawPath) {
  const base = activeBackup.targetDir;
  if (!base) {
    throw new Error('备份目标目录未设置（请先 backup:start）');
  }
  let p = String(rawPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const segs = p.split('/');
  if (segs.length && /^QQ空间备份/.test(segs[0])) {
    segs.shift();
  }
  const rel = segs.join('/');
  const root = path.resolve(base);
  const full = path.resolve(root, rel || '.');
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error(`非法路径: ${rawPath}`);
  }
  return full;
}

export const engineBridge = {
  ready: false,

  /** 注入全部引擎脚本到引擎窗口 */
  async inject() {
    const wc = windows.engine?.webContents;
    if (!wc || wc.isDestroyed()) {
      throw new Error('引擎窗口不存在');
    }
    for (const rel of ENGINE_SCRIPTS) {
      const file = path.join(ENGINE_DIR, rel);
      const code = fs.readFileSync(file, 'utf8');
      try {
        await execInEngine(wc, code);
      } catch (e) {
        console.error(`[engine-bridge] 注入失败: ${rel}`, e);
        throw e;
      }
    }
    this.ready = true;
    sendToUi('backup:state-changed', { state: 'engine-ready', message: '引擎已就绪' });
  },

  /** 执行一段引擎侧 JS（隔离世界，返回序列化结果） */
  async exec(code) {
    const wc = windows.engine?.webContents;
    if (!wc || wc.isDestroyed()) {
      throw new Error('引擎窗口不存在');
    }
    return execInEngine(wc, code);
  },

  /** 启动备份（runner.__engineCommands.start） */
  async start({ taskId, config, modules, targetDir }) {
    setActiveBackup({ taskId, config, modules, targetDir });
    const payload = { taskId, config: config || null, modules: modules || [], targetDir };
    return this.exec(
      `window.__engineCommands && window.__engineCommands.start(${JSON.stringify(payload)})`
    );
  },

  pause() {
    return this.exec('window.__engineCommands && window.__engineCommands.pause()');
  },
  resume() {
    return this.exec('window.__engineCommands && window.__engineCommands.resume()');
  },
  cancel() {
    return this.exec('window.__engineCommands && window.__engineCommands.cancel()');
  },
  getLoginStatus() {
    return this.exec('window.__engineCommands ? window.__engineCommands.getLoginStatus() : null');
  },

  /** 读取引擎窗口 session cookie（httpOnly 也可读） */
  async getCookie(name) {
    const wc = windows.engine?.webContents;
    if (!wc || wc.isDestroyed()) return '';
    const cookies = await wc.session.cookies.get({
      url: 'https://user.qzone.qq.com',
      name,
    });
    return cookies[0]?.value || '';
  },
};

/** 向主 UI 窗口推送事件 */
export function sendToUi(channel, payload) {
  const main = windows.main;
  if (main && !main.isDestroyed()) {
    main.webContents.send(channel, payload);
  }
}

/** 检查点持久化（供 backup IPC 调用） */
export function saveCheckpoint(taskId, data) {
  const file = stateStore.saveCheckpoint(taskId, data);
  return file;
}
