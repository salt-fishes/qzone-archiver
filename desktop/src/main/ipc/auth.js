/**
 * auth IPC：登录状态检测 / 显示登录窗口 / 注销 / 自动监听
 * 登录态由引擎窗口 session（persist:qzone）持久化
 *
 * v4.9 §A 昵称三层兜底：
 *  ① getAuthStatus 拿到昵称后落 configStore.lastProfile 缓存；引擎未注入完成时用缓存兜底
 *  ② watchAuthStatus 按「状态签名」（loggedIn|qqNumber|nickname|avatar）比较——
 *     昵称补齐后签名变化会再推一次（旧实现只看 loggedIn 布尔值，昵称永远补不上）
 *  ③ 登录成功且昵称仍为空时短间隔重试拉取（1.5s × 8），拿到即推送一次
 */
import { ipcMain, session } from 'electron';
import { engineBridge, sendToUi } from '../services/engine-bridge.js';
import { showEngineWindow, windows, createEngineWindow, isEngineDismissed } from '../windows.js';
import { configStore } from '../services/config-store.js';
import { logger } from '../services/logger.js';
import { taskMachine } from '../services/task-machine.js';
import { Channels, PushChannels } from '../../shared/ipc-contract.mjs';

/** 登录成功后延迟最小化引擎窗口的秒数（对齐 UI 提示文案，v4.7 反馈 ④） */
const LOGIN_MINIMIZE_DELAY_SEC = 3;
/** §A③：昵称补齐重试参数（扫码后引擎窗跳回 qzone 并完成注入才有昵称，1.5s × 8 ≈ 12s） */
const NICK_RETRY_INTERVAL_MS = 1500;
const NICK_RETRY_MAX = 8;

/** 去掉值为 undefined 的键（IPC 结构化克隆会保留 undefined 属性，防旧值被空值覆盖） */
function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** §A①：读取昵称缓存（换账号不用旧昵称） */
function readCachedProfile(uin) {
  try {
    const last = configStore.get()?.lastProfile;
    if (!last?.nickname) return null;
    if (uin && last.qqNumber && String(last.qqNumber) !== String(uin)) return null;
    return last;
  } catch {
    return null;
  }
}

/** §A①：昵称缓存落盘（仅在与缓存不同时写，避免轮询期反复写盘） */
function saveCachedProfile(profile) {
  if (!profile?.qqNumber || !profile.nickname) return;
  try {
    const last = configStore.get()?.lastProfile;
    if (
      last &&
      String(last.qqNumber || '') === String(profile.qqNumber) &&
      last.nickname === profile.nickname &&
      (last.avatar || '') === (profile.avatar || '')
    ) {
      return;
    }
    configStore.set({
      lastProfile: {
        qqNumber: String(profile.qqNumber),
        nickname: profile.nickname,
        avatar: profile.avatar || '',
        savedAt: Date.now(),
      },
    });
  } catch (e) {
    logger.warn(`[auth] 写昵称缓存失败：${e?.message || e}`);
  }
}

/** 检测当前登录状态（p_skey 为登录凭证，httpOnly 只能从 session 读） */
export async function getAuthStatus() {
  const pSkey = await engineBridge.getCookie('p_skey');
  if (!pSkey) {
    return { loggedIn: false };
  }
  const detail = await engineBridge.getLoginStatus().catch(() => null);
  const qqNumber = detail?.qqNumber || (await engineBridge.getCookie('uin').then(cleanUin));
  const status = {
    loggedIn: true,
    qqNumber,
    nickname: detail?.nickname,
    avatar: detail?.avatar,
  };
  if (!status.nickname) {
    // §A①：引擎注入完成前拿不到昵称——用 lastProfile 缓存兜底，UI 三处不留空、不重复
    const cached = readCachedProfile(qqNumber);
    if (cached) {
      status.nickname = cached.nickname;
      status.avatar = status.avatar || cached.avatar;
      status.fromCache = true;
    }
  } else {
    saveCachedProfile(status);
  }
  return stripUndefined(status);
}

let authTimer = null;
/** §A②：状态签名基准（不再只比较 loggedIn 布尔值） */
let lastSignature = '';
let nickRetryTimer = null;
let nickRetryCount = 0;

/** §A②：状态签名——任一字段（含昵称/头像）变化都视为一次新状态 */
function statusSignature(s) {
  return [s?.loggedIn ? '1' : '0', s?.qqNumber || '', s?.nickname || '', s?.avatar || ''].join('|');
}

function stopNicknameRetry() {
  if (nickRetryTimer) {
    clearInterval(nickRetryTimer);
    nickRetryTimer = null;
  }
}

/**
 * §A③：登录成功但昵称仍为空 → 短间隔重试拉取，拿到即推送一次（不等下一轮 5s 轮询）。
 * 引擎窗跳回 qzone 并完成注入后 getLoginStatus 才可用，这段时间昵称只能靠缓存/重试补齐。
 */
function scheduleNicknameRetry() {
  stopNicknameRetry();
  nickRetryCount = 0;
  nickRetryTimer = setInterval(async () => {
    nickRetryCount += 1;
    if (nickRetryCount > NICK_RETRY_MAX) {
      logger.info('[auth] 昵称重试已达上限（UI 显示 QQ 号兜底），停止重试');
      stopNicknameRetry();
      return;
    }
    try {
      const detail = await engineBridge.getLoginStatus();
      if (!detail?.nickname) return;
      saveCachedProfile(detail);
      stopNicknameRetry();
      logger.info(`[auth] 昵称已补齐（第 ${nickRetryCount} 次重试）`);
      // 立即取一次完整状态并按签名推送（签名没变说明轮询已推过，不重复）
      const fresh = await getAuthStatus();
      const sig = statusSignature(fresh);
      if (fresh.loggedIn && sig !== lastSignature) {
        lastSignature = sig;
        sendToUi(PushChannels.authStatusChanged, fresh);
      }
    } catch {
      /* 引擎未就绪等瞬时错误，下轮重试 */
    }
  }, NICK_RETRY_INTERVAL_MS);
}

/**
 * 启动登录态自动监听：扫码登录 / 退出后无需手动刷新，
 * 状态变化时推送 auth:status-changed 到主 UI。
 */
export function watchAuthStatus(intervalMs = 5000) {
  if (authTimer) return;  // 建立初始基准（不推送，UI 已通过 auth:get-status 初始化）
  getAuthStatus()
    .then((s) => (lastSignature = statusSignature(s)))
    .catch(() => (lastSignature = '0|'));
  authTimer = setInterval(async () => {
    try {
      const status = await getAuthStatus();
      const sig = statusSignature(status);
      if (sig === lastSignature) return; // §A②：签名不变不重复推
      const wasLoggedIn = lastSignature.startsWith('1|');
      const loggedIn = !!status.loggedIn;
      lastSignature = sig;
      sendToUi(PushChannels.authStatusChanged, stripUndefined(status));
      if (loggedIn && !wasLoggedIn) {
        // v4.7 反馈 ④：扫码成功后先给 UI 一个明确的倒计时提示，
        // 再自动最小化引擎窗口（此前是静默 2 秒最小化，用户不知道发生了什么）。
        sendToUi(PushChannels.authStatusChanged, {
          ...stripUndefined(status),
          loginJustSucceeded: true,
          minimizeInSec: LOGIN_MINIMIZE_DELAY_SEC,
        });
        setTimeout(() => {
          if (windows.engine && !windows.engine.isDestroyed()) {
            windows.engine.minimize();
            logger.info('[auth] 登录成功，已自动最小化 QQ 空间窗口');
          }
        }, LOGIN_MINIMIZE_DELAY_SEC * 1000);
        // §A③：昵称仍为空 → 启动补齐重试
        if (!status.nickname) scheduleNicknameRetry();
      }
      // §B/R2 按需创建：检测到登录态（含持久化 session 的冷启动场景）但引擎窗不存在
      // → 自动拉起并注入。用户手动关窗（isEngineDismissed）时不自动重开，尊重操作。
      if (loggedIn && !isEngineDismissed() && (!windows.engine || windows.engine.isDestroyed())) {
        logger.info('[auth] 检测到登录态且引擎窗不存在，按需创建引擎窗口');
        createEngineWindow();
      }
    } catch {
      // 引擎窗口未就绪等瞬时错误忽略，下轮重试
    }
  }, intervalMs);
}

/** 停止监听并复位基准（应用退出/单测复位用） */
export function stopWatchAuthStatus() {
  if (authTimer) {
    clearInterval(authTimer);
    authTimer = null;
  }
  stopNicknameRetry();
  lastSignature = '';
}

export function registerAuthIpc() {
  ipcMain.handle(Channels.auth.getStatus, () => getAuthStatus());

  ipcMain.handle(Channels.auth.showLogin, () => {
    showEngineWindow();
    return null;
  });

  ipcMain.handle(Channels.auth.getOverview, async () => {
    const detail = await engineBridge.getLoginStatus().catch(() => null);
    return detail || { loggedIn: false };
  });

  ipcMain.handle(Channels.auth.logout, async () => {
    // §B⑤：备份进行中先拒绝退出——关引擎窗会打断采集
    const st = taskMachine.getSnapshot().state;
    if (st === 'preparing' || st === 'running' || st === 'paused') {
      logger.warn(`[auth] 退出登录被拒：任务状态 ${st}`);
      return { error: '当前有备份任务进行中，请先取消备份再退出登录' };
    }
    stopNicknameRetry();
    // cookie 清理不依赖引擎窗存在（session 持久化于 partition，窗已关也能清干净）
    const sess =
      windows.engine && !windows.engine.isDestroyed()
        ? windows.engine.webContents.session
        : session.fromPartition('persist:qzone');
    try {
      await sess.clearStorageData();
      await sess.clearCache();
      // 清除全部会话 cookie（登录凭证 p_skey/skey 等散落在 .qq.com 各子域，须全量清除）
      const cookies = await sess.cookies.get({});
      for (const c of cookies) {
        await sess.cookies.remove(c.url, c.name).catch(() => {});
      }
    } catch (e) {
      logger.warn(`[auth] 清除 cookie 失败：${e?.message || e}`);
    }
    // §B⑤：关闭引擎窗（closed 事件统一广播 engine:status-changed{closed} 并归位 ready）
    if (windows.engine && !windows.engine.isDestroyed()) {
      windows.engine.close();
    }
    // 同步自动监听基准，避免下轮检测 p_skey 残留而重新推回登录态
    lastSignature = '0|';
    sendToUi(PushChannels.authStatusChanged, { loggedIn: false });
    return null;
  });
}

function cleanUin(v) {
  const m = /\d+/.exec(v || '');
  return m ? m[0] : '';
}
