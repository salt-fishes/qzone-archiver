/**
 * auth IPC：登录状态检测 / 显示登录窗口 / 注销
 * 登录态由引擎窗口 session（persist:qzone）持久化
 */
import { ipcMain } from 'electron';
import { engineBridge, sendToUi } from '../services/engine-bridge.js';
import { showEngineWindow, windows } from '../windows.js';

export function registerAuthIpc() {
  ipcMain.handle('auth:get-status', async () => {
    // p_skey 为登录凭证（httpOnly，只能从 session 读）
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
  });

  ipcMain.handle('auth:show-login', () => {
    showEngineWindow();
    return null;
  });

  ipcMain.handle('auth:get-overview', async () => {
    const detail = await engineBridge.getLoginStatus().catch(() => null);
    return detail || { loggedIn: false };
  });

  ipcMain.handle('auth:logout', async () => {
    const wc = windows.engine?.webContents;
    if (wc) {
      await wc.session.clearStorageData();
      await wc.session.clearCache();
      // 清除 qzone 域 cookie
      const cookies = await wc.session.cookies.get({ domain: 'qzone.qq.com' });
      for (const c of cookies) {
        await wc.session.cookies.remove(c.url, c.name);
      }
    }
    sendToUi('auth:status-changed', { loggedIn: false });
    return null;
  });
}

function cleanUin(v) {
  const m = /\d+/.exec(v || '');
  return m ? m[0] : '';
}
