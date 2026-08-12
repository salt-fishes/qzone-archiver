/**
 * 登录态 store（S2 概览：从 App.vue 拆出，供概览视图与顶栏共享）
 * IPC 契约不变：window.api.auth.getStatus() / showLogin() / logout()
 * 引擎登录后经主进程广播 auth:status-changed，统一在此订阅并更新
 */
import { reactive } from 'vue';

export type AuthState = {
  loggedIn: boolean;
  qqNumber?: string;
  nickname?: string;
  avatar?: string;
};

export const auth = reactive<AuthState>({ loggedIn: false });

async function refresh() {
  try {
    const s = await window.api.auth.getStatus();
    Object.assign(auth, s || {});
  } catch (e) {
    console.warn('获取登录态失败', e);
  }
}

async function login() {
  await window.api.auth.showLogin();
}

async function logout() {
  await window.api.auth.logout();
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

export function useAuth() {
  return { auth, refresh, login, logout, initAuth };
}
