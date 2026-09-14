/**
 * 登录态 store（P4.1 真 Pinia 化：defineStore setup 写法）
 * IPC 契约不变：window.api.auth.getStatus() / showLogin() / logout()
 * 引擎登录后经主进程广播 auth:status-changed，统一在此订阅并更新
 */
import { reactive } from 'vue';
import { defineStore } from 'pinia';

export type AuthState = {
  loggedIn: boolean;
  qqNumber?: string;
  nickname?: string;
  avatar?: string;
  /** v4.7 反馈 ④：本次是"刚扫码登录成功"（主进程置位，用于提示 + 倒计时后跳转） */
  loginJustSucceeded?: boolean;
  /** 主进程将在多少秒后最小化引擎窗口 */
  minimizeInSec?: number;
  /** v4.7 反馈 ⑤：正在打开 QQ 空间窗口（用于跳转前预告注意事项） */
  loginPending?: boolean;
};

export const useAuthStore = defineStore('auth', () => {
  const auth = reactive<AuthState>({ loggedIn: false });

  async function refresh() {
    try {
      const s = await window.api.auth.getStatus();
      Object.assign(auth, s || {});
    } catch (e) {
      console.warn('获取登录态失败', e);
    }
  }

  async function login() {
    // 反馈 ⑤：先提示"即将打开 QQ 空间"及注意事项，再真正打开窗口
    auth.loginPending = true;
    try {
      await window.api.auth.showLogin();
    } finally {
      // 短延时后清除，避免同一会话内重复弹提示
      window.setTimeout(() => {
        auth.loginPending = false;
      }, 1000);
    }
  }

  async function logout() {
    await window.api.auth.logout();
  }

  /** 提示已展示完毕：清掉一次性标记，避免刷新又弹一次 */
  function clearLoginJustSucceeded() {
    auth.loginJustSucceeded = false;
  }

  let inited = false;
  /** 订阅登录态变更（应用级单例，调用一次即可） */
  function initAuth() {
    if (inited) return;
    inited = true;
    window.api.on('auth:status-changed', (p) => {
      Object.assign(auth, p || {});
    });
  }

  return { auth, refresh, login, logout, initAuth, clearLoginJustSucceeded };
});
