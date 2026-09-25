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

/** vm 沙箱：伪造 validateTarget 所需的最小引擎全局（v5.0 起第二参可喂 getLoginStatus 响应） */
function makeCtx(userInfoResponse, loginStatusResponse) {
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
      Utils: {
        initUin() {},
        initGtk() {},
        getCookie() {
          return ''; // owner 以 QZone.Common.Owner 为准
        },
        // 与线上同构的最小解析：真实 Utils.get 返回 JSONP/JSON 文本（dataType:'text'），
        // toJson 支持 `_Callback(...)` / `xxx_Callback(...)` 前缀剥离 + 裸 JSON
        toJson(v) {
          if (typeof v !== 'string') return v;
          let s = v.trim();
          const i = s.indexOf('Callback(');
          if (i > -1) {
            s = s.slice(i + 'Callback('.length).replace(/\);?\s*$/, '');
          }
          return JSON.parse(s);
        },
      },
      Friends: {
        getQZoneUserInfo: () => Promise.resolve(userInfoResponse),
      },
      Common: {
        getUserInfos: () => Promise.resolve(loginStatusResponse),
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

  it('access-copy.ts 存在判定口径（v5.0 §G 实测确认：肯定句 + 备份留痕说明）', () => {
    const copy = read('utils/access-copy.ts');
    expect(copy).toContain('不会留下访客记录'); // 校验不留痕（2026-09-19 实测）
    expect(copy).not.toContain('无法确认'); // 旧"不承诺"口径已下线
    expect(copy).toContain('可能留下访客记录'); // 备份留痕提示保留（两段式）
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

/**
 * v5.0（2026-09-22 装机发现）：Utils.get 统一按文本返回（dataType:'text'），
 * getLoginStatus / validateTarget 原来直接对字符串取字段 → 昵称恒空：
 *  - 自己昵称：重试 8 次全空 → UI 永远回退 QQ 号、昵称缓存永远暖不起来
 *  - 校验资料卡：昵称恒空 + "回退 QQ 号" notice 常驻
 * 旧 fixture 都喂已解析对象，测不出这个盲区——本组专喂 JSONP 文本。
 */
describe('v5.0 JSONP 文本解析（自己昵称 / 校验资料卡）', () => {
  it('getLoginStatus：JSONP 文本 → nickname/avatar 正确解析（不再恒空回退 QQ 号）', async () => {
    const ctx = makeCtx(
      null,
      'shine0_Callback({"code":0,"data":{"uin":10001,"nickname":"咸鱼","avatar":"a.png"}});'
    );
    const r = await vm.runInContext('window.__engineCommands.getLoginStatus()', ctx);
    expect(r.loggedIn).toBe(true);
    expect(r.qqNumber).toBe('10001');
    expect(r.nickname).toBe('咸鱼');
    expect(r.avatar).toBe('a.png');
  });

  it('getLoginStatus：裸 JSON 文本同样兼容', async () => {
    const ctx = makeCtx(
      null,
      '{"code":0,"data":{"uin":10001,"nickname":"咸鱼2","avatar":""}}'
    );
    const r = await vm.runInContext('window.__engineCommands.getLoginStatus()', ctx);
    expect(r.nickname).toBe('咸鱼2');
  });

  it('validateTarget：JSONP 文本 → 昵称读到、无"回退 QQ 号" notice', async () => {
    const ctx = makeCtx('_Callback({"code":0,"data":{"uin":20002,"nickname":"乔伊Joe","avatar":""}});');
    const r = await validate(ctx, '20002');
    expect(r.ok).toBe(true);
    expect(r.nickname).toBe('乔伊Joe');
    expect(r.notice).toBeUndefined();
  });

  it('对象响应仍兼容（typeof 类型守卫）', async () => {
    const ctx = makeCtx({ code: 0, data: { userinfo: { nick: '对象兼容' } } });
    const r = await validate(ctx, '20002');
    expect(r.ok).toBe(true);
    expect(r.nickname).toBe('对象兼容');
  });

  it('静态守卫：orchestrator 两处取值前必须判字符串再 toJson（回退直取立刻红）', () => {
    const code = readFileSync(join(engineRoot, 'tasks/orchestrator.js'), 'utf8');
    const needle = "typeof raw === 'string' ? API.Utils.toJson(raw, /^_Callback\\(/) : raw";
    const count = code.split(needle).length - 1;
    expect(count).toBeGreaterThanOrEqual(2); // getLoginStatus + validateTarget
  });
});
