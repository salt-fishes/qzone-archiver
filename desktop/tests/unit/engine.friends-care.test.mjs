/**
 * v5.0 F4 特别关心崩溃回归（engine.friends-care）
 *
 * 根因：`_.find` 可能返回 undefined（特别关心列表含非好友/认证空间），
 * 原实现 `friend.care = friend !== undefined` 对 undefined 赋值直接抛错
 * → 循环中断，其余好友全部丢失「特别关心」标记。
 *
 * 断言：列表含"不在好友里的 uin"时不抛错，其余好友仍被正确标记。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** careItems：特别关心列表（含 1 个不在好友列表里的 uin） */
function makeCtx(careItems) {
  class StatusIndicator {
    setTotal() {}
    addSuccess() {}
    complete() {}
    setIndex() { return this; }
    print() {}
  }
  const sandbox = {
    console: { info() {}, warn() {}, error() {} },
    StatusIndicator,
    QZone_Config: { Friends: { SpecialCare: true } },
    QZone: { Friends: { Data: [] } },
    _: { find: (arr, fn) => arr.find(fn) },
    API: {
      Utils: { toJson: (d) => (typeof d === 'string' ? JSON.parse(d) : d) },
      Friends: {
        getSpecialCare: () => Promise.resolve({ code: 0, data: { items_special: careItems } }),
      },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ROOT, 'src/engine/collectors/friends.js'), 'utf8'), sandbox, {
    filename: 'collectors/friends.js',
  });
  return sandbox;
}

describe('F4 getCareFriendList：特别关心含非好友不崩溃', () => {
  it('列表含不在好友里的 uin → 不抛错，已知好友仍被标记', async () => {
    const ctx = makeCtx([{ uin: 999 }, { uin: 10001 }, { uin: 777 }]);
    const friends = [{ uin: 10001 }, { uin: 20002 }];
    await expect(ctx.QZoneCollectors.Friends.getCareFriendList(friends)).resolves.not.toThrow();
    expect(friends[0].care).toBe(true); // 10001 在特别关心列表里 → 标记成功
    expect(friends[1].care).toBeUndefined(); // 20002 不在 → 不误标
  });

  it('全部都是非好友（极端情况）→ 不抛错、循环安静结束', async () => {
    const ctx = makeCtx([{ uin: 999 }, { uin: 888 }]);
    const friends = [{ uin: 10001 }];
    await expect(ctx.QZoneCollectors.Friends.getCareFriendList(friends)).resolves.not.toThrow();
    expect(friends[0].care).toBeUndefined();
  });

  it('静态守卫：实现必须有 undefined 保护（回退旧写法立刻红）', () => {
    const code = readFileSync(join(ROOT, 'src/engine/collectors/friends.js'), 'utf8');
    expect(code).toMatch(/if\s*\(\s*friend\s*\)\s*friend\.care\s*=\s*true/);
    expect(code).not.toContain('friend.care = friend !== undefined');
  });
});
