// P2-5 错误处理协议测试（架构改造计划 §4.4）
// 覆盖：ModuleError 字段派生 / 模块层 catch 上抛 / orchestrator 统一捕获记录 / 注入顺序
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const engineRoot = join(here, '..', '..', 'src', 'engine');
const bridgeSrc = readFileSync(join(here, '..', '..', 'src', 'main', 'services', 'engine-bridge.js'), 'utf8');

/** 在 vm 沙箱中按顺序执行引擎脚本（sandbox.window = sandbox 浏览器语义） */
function evalFiles(files, extra = {}) {
  const sandbox = Object.assign({ console, setTimeout, clearTimeout, window: null }, extra);
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files) {
    vm.runInContext(readFileSync(join(engineRoot, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const grab = (ctx, expr) => vm.runInContext(expr, ctx);

describe('P2-5 ModuleError 协议（module-error.js）', () => {
  const ctx = evalFiles(['module-error.js']);

  it('字段派生：message 取 cause.message、code 取 cause.name、stack 含 cause 链', () => {
    const e = grab(ctx, `new ModuleError({ module: 'Blogs', phase: 'run', cause: new Error('boom') })`);
    expect(e.name).toBe('ModuleError');
    expect(e.message).toBe('boom');
    expect(e.module).toBe('Blogs');
    expect(e.phase).toBe('run');
    expect(e.code).toBe('Error');
    expect(e.cause.message).toBe('boom');
    expect(String(e.stack)).toContain('Caused by:');
  });

  it('无 cause：message 回退 code，phase 默认 run', () => {
    const e = grab(ctx, `new ModuleError({ module: 'X', code: 'CUSTOM_CODE' })`);
    expect(e.message).toBe('CUSTOM_CODE');
    expect(e.code).toBe('CUSTOM_CODE');
    expect(e.phase).toBe('run');
  });

  it('cause 为字符串：message 取字符串', () => {
    const e = grab(ctx, `new ModuleError({ module: 'X', cause: '原始失败' })`);
    expect(e.message).toBe('原始失败');
  });
});

describe('P2-5 模块层 catch 上抛', () => {
  const MODULES = ['blogs', 'boards', 'common', 'diaries', 'favorites', 'friends', 'messages', 'photos', 'shares', 'videos', 'visitors'];

  it('11 个 modules/*.js 的外层 catch 均已改为 indicator.complete + ModuleError 上抛', () => {
    for (const m of MODULES) {
      const src = readFileSync(join(engineRoot, 'modules', `${m}.js`), 'utf8');
      expect(src, `${m}.js 缺少 ModuleError 上抛`).toMatch(/indicator\.complete\(\);\s*\n\s*throw new ModuleError\(\{ module: '\w+', phase: 'run', cause: error \}\);/);
    }
  });

  it('blogs export() 失败 → 上抛 ModuleError 且 indicator 已 complete（进度复位）', async () => {
    const completes = [];
    const ctx = evalFiles(['module-error.js', 'modules/blogs.js'], {
      StatusIndicator: class {
        print() {}
        complete() {
          completes.push(1);
        }
      },
      API: { Blogs: {} },
      // blogs.js 顶层挂接 API.Blogs.getAllList → QZoneCollectors.Blogs.getAllList，mock 须落在 collectors 侧
      QZoneCollectors: {
        Blogs: {
          getAllList: async () => {
            throw new Error('网络断了');
          },
        },
      },
      QZoneExporters: { Blogs: {} },
    });
    const err = await grab(ctx, 'API.Blogs.export().then(() => null, (e) => e)');
    expect(err).not.toBeNull();
    expect(err.name).toBe('ModuleError');
    expect(err.module).toBe('Blogs');
    expect(err.message).toBe('网络断了');
    expect(completes.length).toBe(1);
  });
});

describe('P2-5 orchestrator 统一捕获', () => {
  /** 构造可运行 start() 的最小上下文 */
  function makeCtx() {
    const notifyLog = [];
    const notifyStates = [];
    const sandbox = {
      console,
      setTimeout,
      clearTimeout,
      QZonePlatform: {
        setTargetDir() {},
        storage: { get: async () => ({}), set: async () => {} },
        notify: {
          log: (x) => notifyLog.push(x),
          state: (x) => notifyStates.push(x),
          moduleDone: () => {},
        },
      },
      __mergeDeep: (...objs) => Object.assign({}, ...objs),
      __engineExportState: {
        running: false,
        paused: false,
        cancelled: false,
        pauseToken: null,
        pauseWaiters: [],
        errors: [],
        _suppressProgress: false,
      },
      QZone_Config: { Photos: {} },
      MODULE_NAME_MAPS: {},
      QZone: { Common: { Target: { uin: '10000' } }, Photos: { Album: {} } },
      API: {
        Utils: { initUin() {} },
        Common: {
          resetQZoneBackupItems() {},
          initBackedUpItems: async () => {},
          exportOthers: async () => {},
        },
        Photos: { getAllAlbumList: async () => [] },
        Blogs: { export: async () => {} },
        Boards: { export: async () => {} },
      },
    };
    const ctx = evalFiles(['module-error.js', 'tasks/orchestrator.js'], sandbox);
    return { ctx, notifyStates, notifyLog };
  }

  it('模块抛 ModuleError → completed.errors 含结构化条目，后续模块继续 + Statistics 补跑', async () => {
    const { ctx, notifyStates } = makeCtx();
    const ME = grab(ctx, 'ModuleError');
    ctx.API.Blogs.export = async () => {
      throw new ME({ module: 'Blogs', phase: 'run', cause: new Error('相册接口超时') });
    };
    await grab(ctx, `__engineCommands.start({ taskId: 't1', modules: ['Blogs', 'Boards'] })`);
    const completed = notifyStates.find((s) => s.state === 'completed');
    expect(completed.results.Blogs).toBe('error');
    expect(completed.results.Boards).toBe('ok');
    expect(completed.results.Statistics).toBe('ok');
    expect(completed.errors).toEqual([{ module: 'Blogs', phase: 'run', code: 'Error', message: '相册接口超时' }]);
  });

  it('模块抛普通 Error → 缺省 phase=run、code=MODULE_FAILED', async () => {
    const { ctx, notifyStates } = makeCtx();
    ctx.API.Boards.export = async () => {
      throw new Error('原生失败');
    };
    await grab(ctx, `__engineCommands.start({ taskId: 't2', modules: ['Boards'] })`);
    const completed = notifyStates.find((s) => s.state === 'completed');
    expect(completed.errors).toEqual([{ module: 'Boards', phase: 'run', code: 'MODULE_FAILED', message: '原生失败' }]);
  });

  it('全部成功 → completed.errors 为空数组', async () => {
    const { ctx, notifyStates } = makeCtx();
    await grab(ctx, `__engineCommands.start({ taskId: 't3', modules: ['Blogs'] })`);
    const completed = notifyStates.find((s) => s.state === 'completed');
    expect(completed.results).toEqual({ Blogs: 'ok', Statistics: 'ok' });
    expect(completed.errors).toEqual([]);
  });
});

describe('P2-5 注入顺序', () => {
  it('ENGINE_SCRIPTS 含 module-error.js 且先于全部 modules/*', () => {
    const m = bridgeSrc.match(/const ENGINE_SCRIPTS = \[([\s\S]*?)\];/);
    const scripts = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    const errIdx = scripts.indexOf('module-error.js');
    expect(errIdx).toBeGreaterThan(-1);
    const firstModuleIdx = scripts.findIndex((s) => s.startsWith('modules/'));
    expect(firstModuleIdx).toBeGreaterThan(-1);
    expect(errIdx).toBeLessThan(firstModuleIdx);
  });
});
