/**
 * v5.5 M1 补：分页错误不得再被静默吞掉（2026-11-16 实机）
 *
 * 现场：说说第一页被腾讯 WAF 拦成 HTTP 501，collector catch 里只记了
 * indicator.addFailed 就继续“翻页”，最终 0 条数据、模块却报 ok，
 * 任务 summary 全是 ok，属于静默丢数据。
 *
 * 本测试锁定：
 *  ① 首页请求失败 → getAllList 必须 reject（模块层记为 error）
 *  ② 后续页限流（__rateLimited）→ 必须 reject（plan-executor 进入 paused）
 *  ③ 后续页普通失败 → 保留旧行为，继续翻页不抛
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

let sandbox;
let pageImpl;
let nextPageCalls;

function makeCtx() {
  nextPageCalls = [];
  pageImpl = async () => [];
  sandbox = {
    console: { log() {}, info() {}, error() {}, warn() {} },
    QZone_Config: {
      Messages: {
        IncrementType: 'Full',
        IncrementField: 'created_time',
        pageSize: 20,
        randomSeconds: { min: 0, max: 0 },
      },
    },
    QZone: {
      Messages: { Data: [], OLD_Data: [], total: 0 },
    },
    API: {
      Common: {
        isGetNextPage: () => true,
        // 模拟真实 callNextPage：先按 total/items 判断是否还有下一页
        callNextPage: async (pageIndex, config, total, items, call, ...args) => {
          if (!(items.length < total && pageIndex * config.pageSize < total)) return items;
          nextPageCalls.push(pageIndex);
          return await call.apply(undefined, args);
        },
        unionBackedUpItems: (config, oldItems, newItems) => newItems,
        shouldAbortTask: (e) => !!(e && (e.__rateLimited || e.__authLost)),
      },
      Utils: {
        unionItems: (a, b) => a.concat(b),
        sort: (arr) => arr,
      },
      Messages: {
        getList: async (pageIndex, indicator) => {
          const data = await pageImpl(pageIndex, indicator);
          sandbox.QZone.Messages.total = 41;
          return data;
        },
      },
    },
    StatusIndicator: class {
      print() {}
      async setIndex() {}
      setTotal() {}
      addSuccess() {}
      addFailed() {}
      complete() {}
    },
    PageInfo: class {
      constructor(pageIndex, pageSize) {
        this.pageIndex = pageIndex;
        this.pageSize = pageSize;
      }
    },
    checkExportState: async () => false,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ROOT, 'src/engine/collectors/messages.js'), 'utf8'), sandbox, {
    filename: 'collectors/messages.js',
  });
}

beforeEach(() => makeCtx());

describe('Messages 分页错误传播', () => {
  it('首页请求失败 → getAllList 抛错，不再返回 0 条', async () => {
    pageImpl = async () => {
      throw new Error('HTTP 501 error');
    };
    await expect(sandbox.QZoneCollectors.Messages.getAllList()).rejects.toThrow('HTTP 501');
  });

  it('后续页限流 → getAllList 抛错，交给 plan-executor 暂停', async () => {
    pageImpl = async (pageIndex) => {
      if (pageIndex === 0) return [{ tid: 't1', created_time: 100 }];
      const e = new Error('使用人数过多');
      e.__rateLimited = true;
      throw e;
    };
    await expect(sandbox.QZoneCollectors.Messages.getAllList()).rejects.toMatchObject({
      __rateLimited: true,
    });
    expect(nextPageCalls).toEqual([1]);
  });

  it('后续页普通失败 → 记录失败并继续翻页（保留旧行为）', async () => {
    pageImpl = async (pageIndex) => {
      if (pageIndex === 0) return [{ tid: 't1', created_time: 100 }];
      if (pageIndex === 1) throw new Error('偶发网络错误');
      return [{ tid: 't3', created_time: 300 }];
    };
    const data = await sandbox.QZoneCollectors.Messages.getAllList();
    expect(nextPageCalls).toEqual([1, 2]);
    expect(data.map((x) => x.tid)).toEqual(['t1', 't3']);
  });
});
