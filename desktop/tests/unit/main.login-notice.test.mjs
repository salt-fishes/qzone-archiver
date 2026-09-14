/**
 * 登录成功提示的一致性守卫（v4.7 反馈 ④）
 *
 * 登录成功后主进程倒计时 N 秒再最小化引擎窗口，渲染层提示文案里的秒数必须与之相同，
 * 否则会出现「提示 3 秒、实际 2 秒」这类对不上的体验问题。
 * 两处常量：main/ipc/auth.js 的 LOGIN_MINIMIZE_DELAY_SEC 与
 * renderer/components/system/LoginSuccessNotifier.vue 的 LOGIN_MINIMIZE_DELAY_SEC。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readConstant(relPath, name) {
  const code = readFileSync(join(ROOT, relPath), 'utf8');
  const m = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(code);
  return m ? Number(m[1]) : null;
}

describe('登录提示与最小化倒计时一致', () => {
  it('主进程与渲染层的秒数一致且为正整数', () => {
    const main = readConstant('src/main/ipc/auth.js', 'LOGIN_MINIMIZE_DELAY_SEC');
    const ui = readConstant(
      'src/renderer/src/components/system/LoginSuccessNotifier.vue',
      'LOGIN_MINIMIZE_DELAY_SEC'
    );
    expect(main, 'main/ipc/auth.js 未找到 LOGIN_MINIMIZE_DELAY_SEC').not.toBeNull();
    expect(ui, 'LoginSuccessNotifier.vue 未找到 LOGIN_MINIMIZE_DELAY_SEC').not.toBeNull();
    expect(ui).toBe(main);
    expect(main).toBeGreaterThan(0);
  });
});
