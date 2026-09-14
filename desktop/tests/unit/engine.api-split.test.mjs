/**
 * P2-1 逐字搬迁证明（§4.1 铁律）：拆分前基线（api.js.p2-bak）与拆分产物
 * 在两个隔离 vm 上下文中分别求值，对 API 全部命名空间的每个方法、
 * 3 个 class、REST_URLS、parseEmoji 做 toString()/值 级全等比对。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = path.join(desktopDir, 'src/engine');
const ORIG_API = path.join(desktopDir, 'tests/fixtures/api.js.p2-bak');

/** 拆分产物注入顺序（与 engine-bridge.js ENGINE_SCRIPTS 保持一致） */
const SPLIT_FILES = [
  'api/rest-urls.js',
  'api/network.js',
  'api/fs-utils.js',
  'api/utils.js',
  'api/common.js',
  'api/modules/blogs.js',
  'api/modules/diaries.js',
  'api/modules/friends.js',
  'api/modules/messages.js',
  'api/modules/boards.js',
  'api/modules/photos.js',
  'api/modules/videos.js',
  'api/modules/favorites.js',
  'api/modules/shares.js',
  'api/modules/visitors.js',
  'api/modules/statistics.js',
  'api.js',
];

function evalInSandbox(files) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  for (const rel of files) {
    vm.runInContext(readFileSync(path.join(ENGINE, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox;
}

const origCtx = evalInSandbox([]); // 基线单文件在下方单独加载
vm.runInContext(readFileSync(ORIG_API, 'utf8'), origCtx, { filename: 'api.js.p2-bak' });
const newCtx = evalInSandbox(SPLIT_FILES);

const NAMESPACES = [
  'Utils', 'Common', 'Blogs', 'Diaries', 'Friends', 'Messages', 'Boards',
  'Photos', 'Videos', 'Favorites', 'Shares', 'Visitors', 'Statistics',
];

/** 取上下文全局词法绑定（const/class 不挂 context 对象，须在上下文内求值获取） */
const grab = (ctx, expr) => vm.runInContext(expr, ctx);

/** P2-3 死代码清理：基线中 Shares/Favorites 的 convert 已迁 repos 并从接口层删除（计划内变化） */
const P23_REMOVED = { Shares: ['convert'], Favorites: ['convert'] };

/**
 * v4.7 计划内行为变更（登记在此，逐字比对对这些方法放行源码全等，但仍校验其存在与类型）：
 * - Messages.getFeedsCount：探测全失败时抛错，不再静默返回 0（修「恢复已删除说说」假成功）
 * - Utils.get：加入连续 5xx/无响应熔断（避免风控期间持续重试打接口）
 * 新增方法不适用本表：API.Utils 由多个 METHOD 对象 Object.assign 合并，
 * 基线键集合是拆分产物的子集，故 Utils 只要求「基线键全部保留且源码一致」，允许新增。
 */
const V47_CHANGED = { Messages: ['getFeedsCount'], Utils: ['get'] };

/** 允许新增方法（拆分层合并而来）的命名空间 */
const ADDITIVE_NAMESPACES = new Set(['Utils']);

describe('P2-1 api.js 拆分逐字搬迁证明', () => {
  it('API 骨架命名空间集合一致', () => {
    expect(grab(newCtx, 'Object.keys(API).sort()')).toEqual(grab(origCtx, 'Object.keys(API).sort()'));
  });

  for (const ns of NAMESPACES) {
    it(`API.${ns} 方法名集合与函数源码全等`, () => {
      const a = grab(origCtx, `API.${ns}`);
      const b = grab(newCtx, `API.${ns}`);
      const aKeys = Object.keys(a).filter((k) => !(P23_REMOVED[ns] || []).includes(k)).sort();
      const bKeys = Object.keys(b).sort();
      if (ADDITIVE_NAMESPACES.has(ns)) {
        // 合并式命名空间：允许新增，但基线方法一个都不能少
        const missing = aKeys.filter((k) => !bKeys.includes(k));
        expect(missing, `${ns} 缺失基线方法`).toEqual([]);
      } else {
        expect(bKeys).toEqual(aKeys);
      }
      const changed = V47_CHANGED[ns] || [];
      for (const k of aKeys) {
        expect(typeof b[k], `${ns}.${k} 类型`).toBe(typeof a[k]);
        if (changed.includes(k)) continue; // v4.7 计划内行为变更，详见 V47_CHANGED
        expect(String(b[k]), `${ns}.${k} 源码`).toBe(String(a[k]));
      }
    });
  }

  it('REST_URLS 值全等', () => {
    expect(grab(newCtx, 'JSON.stringify(REST_URLS)')).toBe(grab(origCtx, 'JSON.stringify(REST_URLS)'));
  });

  it('parseEmoji 函数源码全等', () => {
    expect(grab(newCtx, 'parseEmoji.toString()')).toBe(grab(origCtx, 'parseEmoji.toString()'));
  });

  it.each(['ShareSource', 'ShareInfo', 'ShareData'])('class %s 源码全等（归属 shares.js）', (cls) => {
    expect(grab(newCtx, `typeof ${cls} !== 'undefined' ? ${cls}.toString() : null`))
      .toBe(grab(origCtx, `${cls}.toString()`));
  });
});
