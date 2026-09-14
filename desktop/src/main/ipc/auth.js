/**
 * auth IPC：登录状态检测 / 显示登录窗口 / 注销 / 自动监听
 * 登录态由引擎窗口 session（persist:qzone）持久化
 */
import { ipcMain } from 'electron';
import { engineBridge, sendToUi } from '../services/engine-bridge.js';
import { showEngineWindow, windows } from '../windows.js';
import { Channels, PushChannels } from '../../shared/ipc-contract.mjs';

/** 登录成功后延迟最小化引擎窗口的秒数（对齐 UI 提示文案，v4.7 反馈 ④） */
const LOGIN_MINIMIZE_DELAY_SEC = 3;

/** 检测当前登录状态（p_skey 为登录凭证，httpOnly 只能从 session 读） */
export async function getAuthStatus() {
  const pSkey = await engineBridge.getCookie('p_skey');
  if (!pSkey) {
    return { loggedIn: false };
  }
  const detail = await engineBridge.getLoginStatus().catch(() => null);
  if (!detail) {
    return { loggedIn: true, qqNumber: await engineBridge.getCookie('uin').then(cleanUin) };
  }
  return {
    loggedIn: true,
    qqNumber: detail.qqNumber || (await engineBridge.getCookie('uin').then(cleanUin)),
    nickname: detail.nickname,
    avatar: detail.avatar,
  };
}

let authTimer = null;
let lastLoggedIn = null;

/**
 * 启动登录态自动监听：扫码登录 / 退出后无需手动刷新，
 * 状态变化时推送 auth:status-changed 到主 UI。
 */
export function watchAuthStatus(intervalMs = 5000) {
  if (authTimer) return;
  // 建立初始基准（不推送，UI 已通过 auth:get-status 初始化）
  getAuthStatus()
    .then((s) => (lastLoggedIn = !!s.loggedIn))
    .catch(() => (lastLoggedIn = false));
  authTimer = setInterval(async () => {
    try {
      const status = await getAuthStatus();
      const loggedIn = !!status.loggedIn;
      if (loggedIn !== lastLoggedIn) {
        lastLoggedIn = loggedIn;
        sendToUi(PushChannels.authStatusChanged, status);
        if (loggedIn) {
          // v4.7 反馈 ④：扫码成功后先给 UI 一个明确的倒计时提示，
          // 再自动最小化引擎窗口（此前是静默 2 秒最小化，用户不知道发生了什么）。
          sendToUi(PushChannels.authStatusChanged, {
            ...status,
            loginJustSucceeded: true,
            minimizeInSec: LOGIN_MINIMIZE_DELAY_SEC,
          });
          setTimeout(() => {
            if (windows.engine && !windows.engine.isDestroyed()) {
              windows.engine.minimize();
              console.info('[auth] 登录成功，已自动最小化 QQ 空间窗口');
            }
          }, LOGIN_MINIMIZE_DELAY_SEC * 1000);
        }
      }
    } catch (e) {
      // 引擎窗口未就绪等瞬时错误忽略，下轮重试
    }
  }, intervalMs);
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
    const wc = windows.engine?.webContents;
    if (wc) {
      await wc.session.clearStorageData();
      await wc.session.clearCache();
      // 清除全部会话 cookie（登录凭证 p_skey/skey 等散落在 .qq.com 各子域，须全量清除）
      try {
        const cookies = await wc.session.cookies.get({});
        for (const c of cookies) {
          await wc.session.cookies.remove(c.url, c.name).catch(() => {});
        }
      } catch (e) {
        console.warn('[auth] 清除 cookie 失败', e);
      }
    }
    // 同步自动监听基准，避免下轮检测 p_skey 残留而重新推回登录态
    lastLoggedIn = false;
    sendToUi(PushChannels.authStatusChanged, { loggedIn: false });
    return null;
  });
}

function cleanUin(v) {
  const m = /\d+/.exec(v || '');
  return m ? m[0] : '';
}
