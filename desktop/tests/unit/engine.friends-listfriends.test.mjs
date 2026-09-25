/**
 * v5.0 F1/F3 选择器数据源单测（engine.friends-listfriends）
 *
 * orchestrator.listFriends 是桌面好友选择器的数据源：
 * 原实现 `nickname: it.nickname || ''`——接口从不返回 nickname（只返回 nick）
 * → 选择器昵称恒空、按昵称搜不到。
 *
 * 断言：
 * ① nickname 取 nick（别名 name/nickname 容错）
 * ② searchField 原样透传（选择器按拼音/缩写整串搜索的数据源）
 * ③ getFriends 失败时回退 getSortFriends，取值口径一致
 * ④ 静态守卫：mapItems 表达式必须含 it.nick
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const engineRoot = join(ROOT, 'src/engine');

/** vm 沙箱：伪造 listFriends 所需最小引擎全局（与 validate-target 测试同构） */
function makeCtx({ getFriends, getSortFriends }) {
  const sandbox = {
    console: { info() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Promise,
    MODULE_NAME_MAPS: {},
    QZonePlatform: { notify: { log() {}, state() {}, progress() {}, moduleDone() {} } },
    QZone: { Common: { Owner: { uin: 10001 }, Target: null } },
    API: {
      Utils: {
        initUin() {},
        initGtk() {},
        toJson: (d) => (typeof d === 'string' ? JSON.parse(d) : d),
      },
      Friends: {
        getFriends: () => Promise.resolve(getFriends),
        getSortFriends: () => Promise.resolve(getSortFriends),
        getQZoneUserInfo: () => Promise.resolve({ code: 0, data: {} }),
      },
    },
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(engineRoot, 'tasks/orchestrator.js'), 'utf8'), ctx, {
    filename: 'tasks/orchestrator.js',
  });
  return ctx;
}

const listFriends = (ctx) => vm.runInContext('window.__engineCommands.listFriends()', ctx);

const SORT_ITEMS = [
  { uin: 333, nick: '排序昵称', remark: '', searchField: '333 排序昵称 pxnc' },
];

describe('F①/F③ listFriends 字段映射', () => {
  it('nickname 取 nick（接口不返回 nickname）+ searchField 透传', async () => {
    const ctx = makeCtx({
      getFriends: {
        code: 0,
        data: {
          items: [
            { uin: 111, nick: '昵称子', remark: '备注意', searchField: '111 备注意 昵称子 yc sx' },
            { uin: 222, name: '旧名丁' },
            { uin: 444, nickname: '别名戊' },
          ],
        },
      },
      getSortFriends: { code: 0, data: { items: [] } },
    });
    const r = await listFriends(ctx);
    expect(r.ok).toBe(true);
    expect(r.friends[0].nickname).toBe('昵称子');
    expect(r.friends[0].remark).toBe('备注意');
    expect(r.friends[0].searchField).toBe('111 备注意 昵称子 yc sx');
    expect(r.friends[1].nickname).toBe('旧名丁'); // name 兜底
    expect(r.friends[2].nickname).toBe('别名戊'); // nickname 兜底
    expect(r.friends[0].avatar).toContain('111'); // 无 avatar → qlogo 兜底
  });

  it('getFriends 异常 → 回退 getSortFriends，取值口径一致', async () => {
    const ctx = makeCtx({
      getFriends: { code: 500, message: 'boom' },
      getSortFriends: { code: 0, data: { items: SORT_ITEMS } },
    });
    const r = await listFriends(ctx);
    expect(r.ok).toBe(true);
    expect(r.friends[0].nickname).toBe('排序昵称');
    expect(r.friends[0].searchField).toBe('333 排序昵称 pxnc');
  });

  it('两个接口都失败 → ok:false 且 error 可见', async () => {
    const ctx = makeCtx({
      getFriends: { code: 500, message: 'boom' },
      getSortFriends: { code: 501, message: 'blocked' },
    });
    const r = await listFriends(ctx);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('获取好友列表失败');
  });

  it('静态守卫：mapItems 必须读 it.nick（回退单读 it.nickname 立刻红）', () => {
    const code = readFileSync(join(engineRoot, 'tasks/orchestrator.js'), 'utf8');
    expect(code).toMatch(/it\.nick \|\| it\.nickname \|\| it\.name/);
    expect(code).not.toContain('nickname: it.nickname || ');
  });
});
