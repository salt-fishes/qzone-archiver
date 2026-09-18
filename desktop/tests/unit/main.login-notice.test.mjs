/**
 * 登录提示守卫（v4.7 反馈 ④⑤ → v4.9 §E 合并模态）
 *
 * §E 后的口径：
 *  1. 扫码前注意事项（会自动最小化 + 勿切页面/刷新）合并为**一个**原生模态，
 *     由主进程弹在 QQ 空间窗口上 —— 文案单一来源 auth.js 的 BEFORE_LOGIN_NOTICE，
 *     本守卫确保两条关键信息都在（缺一条就回到"事后告知"的老问题）。
 *  2. 登录成功提示改在引擎窗最小化后经 auth:login-notice 推送（主窗 toast 不再被遮挡）。
 *  3. 渲染层不再用主窗口 toast 显示扫码前注意事项（曾被引擎窗整个盖住）。
 *  4. 最小化倒计时秒数：主进程 auth.js 与渲染层 LoginSuccessNotifier.vue 保持一致
 *     （渲染层用同一秒数做倒计时后跳转）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readMainAuth() {
  return readFileSync(join(ROOT, 'src/main/ipc/auth.js'), 'utf8');
}
function readNotifier() {
  return readFileSync(join(ROOT, 'src/renderer/src/components/system/LoginSuccessNotifier.vue'), 'utf8');
}

function readConstant(code, name) {
  const m = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(code);
  return m ? Number(m[1]) : null;
}

describe('§E 扫码前合并模态（主进程单一来源）', () => {
  const code = readMainAuth();

  it('BEFORE_LOGIN_NOTICE 同时包含「会自动最小化」与「勿切页面/刷新」两条信息', () => {
    const m = /message:\s*\n?\s*'([\s\S]*?)',\s*\n\s*buttons/.exec(code);
    expect(m, 'auth.js 未找到 BEFORE_LOGIN_NOTICE.message').toBeTruthy();
    const message = m[1];
    expect(message).toContain('自动最小化');
    expect(message).toContain('切换页面或手动刷新');
  });

  it('模态必须挂到引擎窗口（dialog.showMessageBox 传 engine 窗口）', () => {
    expect(code).toMatch(/showMessageBox\(engine/);
  });

  it('登录成功提示在引擎窗最小化之后经 auth:login-notice 推送', () => {
    // 推送位于 minimize() 之后的同一回调内
    const idxMinimize = code.indexOf('windows.engine.minimize()');
    const idxNotice = code.indexOf('PushChannels.authLoginNotice');
    expect(idxMinimize).toBeGreaterThan(0);
    expect(idxNotice).toBeGreaterThan(idxMinimize);
  });
});

describe('§E 渲染层静态守卫', () => {
  it('LoginSuccessNotifier 不再经主窗口渲染扫码前注意事项', () => {
    const code = readNotifier();
    expect(code).not.toContain('请勿在该窗口切换页面');
    expect(code).not.toContain('即将打开 QQ 空间窗口');
    expect(code).not.toContain('loginPending');
  });

  it('渲染层订阅 auth:login-notice 显示登录成功提示', () => {
    const code = readNotifier();
    expect(code).toContain('auth:login-notice');
  });
});

describe('最小化倒计时秒数一致', () => {
  it('主进程与渲染层的秒数一致且为正整数', () => {
    const main = readConstant(readMainAuth(), 'LOGIN_MINIMIZE_DELAY_SEC');
    const ui = readConstant(readNotifier(), 'LOGIN_MINIMIZE_DELAY_SEC');
    expect(main, 'main/ipc/auth.js 未找到 LOGIN_MINIMIZE_DELAY_SEC').not.toBeNull();
    expect(ui, 'LoginSuccessNotifier.vue 未找到 LOGIN_MINIMIZE_DELAY_SEC').not.toBeNull();
    expect(ui).toBe(main);
    expect(main).toBeGreaterThan(0);
  });
});
