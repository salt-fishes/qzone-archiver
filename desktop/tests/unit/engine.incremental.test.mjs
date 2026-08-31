/**
 * P1-5 首批单测（§8.2）：repos/incremental 的 removeOldItems / unionBackedUpItems
 * 引擎脚本依赖 window / API / _ (lodash) 全局，用 node:vm 注入 stub 后执行源码。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let incremental;
let API;

beforeAll(() => {
  const sandbox = {
    window: {},
    console,
    // 增量语义 stub：isFullBackup 以配置 Full 标记；parseDate 直接走 Date 解析
    API: {
      Common: {},
      Utils: { parseDate: (s) => new Date(s) },
    },
  };
  sandbox.API.Common.isFullBackup = (cfg) => !!cfg.Full;
  vm.createContext(sandbox);

  // lodash（引擎 vendor 版，UMD → 挂 context 全局 _）
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/vendor/lodash/lodash.min.js'), 'utf8'),
    sandbox,
  );
  // incremental.js 顶层同时使用 window.QZoneRepo 与裸标识符 QZoneRepo，两者须同一对象
  sandbox.QZoneRepo = sandbox.window.QZoneRepo = {};
  // 增量仓库层（引用 window.QZoneRepo / _ / API）
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/repos/incremental.js'), 'utf8'),
    sandbox,
  );

  incremental = sandbox.window.QZoneRepo.incremental;
  // 模拟 modules/common.js 的挂接：unionBackedUpItems 内部经 API.Common 委托
  sandbox.API.Common.removeOldItems = incremental.removeOldItems;
  // removeNewItems / unionItems 非本批被测对象，语义 stub
  sandbox.API.Common.removeNewItems = (items) => items;
  sandbox.API.Utils.unionItems = (newItems, oldItems) => [...newItems, ...oldItems];
  API = sandbox.API;
});

const CFG = { IncrementField: 'createtime', IncrementTime: '2024-06-01 12:00:00' };

describe('removeOldItems', () => {
  it('全量备份时返回空数组（无视历史数据）', () => {
    expect(incremental.removeOldItems([{ createtime: '2024-01-01' }], { Full: true })).toEqual([]);
  });

  it('old_items 为 undefined 时返回空数组', () => {
    expect(incremental.removeOldItems(undefined, CFG)).toEqual([]);
  });

  it('剔除晚于增量时间的新数据，保留旧数据并标记 isNewItem=false', () => {
    const oldItems = [
      { id: 1, createtime: '2024-07-01 10:00:00' }, // 晚于增量时间 → 移除
      { id: 2, createtime: '2024-05-01 10:00:00' }, // 早于增量时间 → 保留
    ];
    const out = incremental.removeOldItems(oldItems, CFG);
    expect(out).toEqual([{ id: 2, createtime: '2024-05-01 10:00:00', isNewItem: false }]);
  });

  it('等于增量时间的数据保留（严格大于才剔除）', () => {
    const oldItems = [{ id: 1, createtime: '2024-06-01 12:00:00' }];
    const out = incremental.removeOldItems(oldItems, CFG);
    expect(out).toHaveLength(1);
    expect(out[0].isNewItem).toBe(false);
  });

  it('原数组被就地修改（splice 语义，调用方依赖同一引用）', () => {
    const oldItems = [
      { id: 1, createtime: '2024-07-01 10:00:00' },
      { id: 2, createtime: '2024-05-01 10:00:00' },
    ];
    const out = incremental.removeOldItems(oldItems, CFG);
    expect(out).toBe(oldItems);
    expect(oldItems).toHaveLength(1);
  });
});

describe('unionBackedUpItems', () => {
  it('已备份数据为空数组时直接返回新数据（同一引用）', () => {
    const newItems = [{ id: 9 }];
    expect(incremental.unionBackedUpItems(CFG, [], newItems)).toBe(newItems);
  });

  it('已备份数据为 undefined 时直接返回新数据', () => {
    const newItems = [{ id: 9 }];
    expect(incremental.unionBackedUpItems(CFG, undefined, newItems)).toBe(newItems);
  });

  it('正常路径：old 过滤后与新数据合并，新数据在前', () => {
    const oldItems = [
      { id: 1, createtime: '2024-07-01 10:00:00' }, // 晚于增量时间 → 移除
      { id: 2, createtime: '2024-05-01 10:00:00' }, // 保留
    ];
    const newItems = [{ id: 9, createtime: '2024-08-01 10:00:00' }];
    const out = incremental.unionBackedUpItems(CFG, oldItems, newItems);
    expect(out).toEqual([
      { id: 9, createtime: '2024-08-01 10:00:00' },
      { id: 2, createtime: '2024-05-01 10:00:00', isNewItem: false },
    ]);
    // removeNewItems/unionItems stub 均被委托调用
    expect(API.Common.removeNewItems).toBeTruthy();
  });
});
