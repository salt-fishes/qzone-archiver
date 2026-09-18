/**
 * v4.9 §G 校验判定说明单测
 *
 * ① 引擎 validateTarget 四分支（vm 沙箱加载 orchestrator.js + 伪造 QZone/API 全局）：
 *    code=-4009 / 其它负码 / code>=0 但资料为空（notice）/ 本人（isOwner）
 * ② 文案单一来源守卫：TargetPicker 与 NewTaskView 的留痕说明取自
 *    utils/access-copy.ts（此前是两处各写各的无出处断言）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const engineRoot = join(here, '..', '..', 'src', 'engine');
const rendererRoot = join(here, '..', '..', 'src', 'renderer', 'src');

/** vm 沙箱：伪造 validateTarget 所需的最小引擎全局 */
function makeCtx(userInfoResponse) {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Promise,
    MODULE_NAME_MAPS: {},
    QZonePlatform: {
      notify: { log() {}, state() {}, progress() {}, moduleDone() {} },
    },
    QZone: {
      Common: {
        Owner: { uin: 10001 },
        Target: null,
      },
    },
    API: {
      Utils: { initUin() {}, initGtk() {} },
      Friends: {
        getQZoneUserInfo: () => Promise.resolve(userInfoResponse),
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

const validate = (ctx, uin) =>
  vm.runInContext(`window.__engineCommands.validateTarget('${uin}')`, ctx);

describe('§G① validateTarget 四分支', () => {
  it('code=-4009 → ok:false，error 指明"不公开或无权限"，code 透传', async () => {
    const r = await validate(makeCtx({ code: -4009 }), '20002');
    expect(r.ok).toBe(false);
    expect(r.code).toBe(-4009);
    expect(r.error).toContain('不公开');
  });

  it('其它负码（如 -3000）→ ok:false，error 含原始 code', async () => {
    const r = await validate(makeCtx({ code: -3000 }), '20002');
    expect(r.ok).toBe(false);
    expect(r.code).toBe(-3000);
    expect(r.error).toContain('-3000');
  });

  it('code>=0 但资料为空 → ok:true + notice 提示昵称回退 QQ 号', async () => {
    const r = await validate(makeCtx({ code: 0, data: {} }), '20002');
    expect(r.ok).toBe(true);
    expect(r.nickname).toBe('');
    expect(r.notice).toContain('昵称');
    expect(r.notice).toContain('QQ');
  });

  it('code>=0 且资料齐全 → ok:true 无 notice，昵称取 nick 别名', async () => {
    const r = await validate(makeCtx({ code: 0, data: { userinfo: { nick: '穗稔', avatar: 'a' } } }), '20002');
    expect(r.ok).toBe(true);
    expect(r.nickname).toBe('穗稔');
    expect(r.notice).toBeUndefined();
  });

  it('目标即登录者 → isOwner 直接通过（不调接口）', async () => {
    const r = await validate(makeCtx(null), '10001');
    expect(r.ok).toBe(true);
    expect(r.isOwner).toBe(true);
  });
});

describe('§G② 文案单一来源守卫', () => {
  const read = (rel) => readFileSync(join(rendererRoot, rel), 'utf8');

  it('access-copy.ts 存在判定口径（不承诺 + 备份留痕说明）', () => {
    const copy = read('utils/access-copy.ts');
    expect(copy).toContain('无法确认');
    expect(copy).toContain('可能留下访客记录');
    expect(copy).toContain('权限');
  });

  it('TargetPicker / NewTaskView 的留痕说明取自共享常量，不再各写各的断言', () => {
    expect(read('components/task/TargetPicker.vue')).toContain('access-copy');
    expect(read('views/NewTaskView.vue')).toContain('access-copy');
    // 旧的无出处断言已下线
    expect(read('components/task/TargetPicker.vue')).not.toContain('会留下访客记录；日记');
    expect(read('views/NewTaskView.vue')).not.toContain('会留下访客记录；私密内容');
  });
});
