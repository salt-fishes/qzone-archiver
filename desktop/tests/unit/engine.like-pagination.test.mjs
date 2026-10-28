/**
 * v5.5 M1 补：点赞分页防护（2026-10-28 实机卡死回归）
 *
 * 现场：备份停在「相册 · 获取相册赞列表」15 分钟，引擎心跳正常但无日志/无网络 IO。
 * 原实现只依赖「返回空列表」结束分页；当服务端忽略 begin_uin、重复返回同一页时，
 * 循环永不结束（命中缓存时甚至没有网络活动，界面表现为静默卡死）。
 *
 * 本测试锁定：
 *  ① 游标不前进（next === prev）→ 立即停止，不再发下一发
 *  ② 正常前进 → 继续翻页
 *  ③ 空列表 → 结束
 *  ④ 分页硬上限（200 页）→ 强制结束
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let sandbox;
let Common;
let calls;
let warns;
let pageImpl;

beforeAll(() => {
  sandbox = {
    console: {
      log() {},
      info() {},
      error() {},
      warn: (...args) => warns.push(args.map(String).join(' ')),
    },
    API: {
      Common: {
        getLikeList: async (uniKey, beginUin) => {
          calls.push(beginUin);
          return JSON.stringify({ code: 0, data: { like_uin_info: pageImpl(beginUin) } });
        },
      },
      Utils: {
        toJson: (raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw),
        randomSeconds: () => 0,
        sleep: async () => {},
      },
    },
    _: {
      isEmpty: (arr) => !arr || arr.length === 0,
      concat: (a, b) => a.concat(b),
      last: (arr) => arr[arr.length - 1],
    },
    checkExportState: async () => false,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/collectors/common.js'), 'utf8'),
    sandbox,
    { filename: 'collectors/common.js' }
  );
  Common = vm.runInContext('QZoneCollectors.Common', sandbox);
});

beforeEach(() => {
  calls = [];
  warns = [];
  pageImpl = () => [];
});

const config = { Like: { isGet: true, randomSeconds: { min: 0, max: 0 } } };

describe('getModulesLikeList 分页防护', () => {
  it('游标不前进（服务端重复返回同一页）→ 2 发后停止', async () => {
    pageImpl = () => [{ fuin: 42, uin: 1 }];
    const item = { uniKey: 'album-repeat' };
    const likes = await Common.getModulesLikeList(item, config);

    expect(calls).toEqual([0, 42]); // 第二页 begin=42，返回仍以 42 结尾 → 停止
    expect(likes).toHaveLength(2);
    expect(item.likeTotal).toBe(2);
    expect(warns.join('\n')).toContain('游标未前进');
  });

  it('游标正常前进 → 连续翻页直到空页', async () => {
    pageImpl = (begin) => (begin < 3 ? [{ fuin: begin + 1, uin: begin + 1 }] : []);
    const item = { uniKey: 'album-ok' };
    const likes = await Common.getModulesLikeList(item, config);

    expect(calls).toEqual([0, 1, 2, 3]);
    expect(likes.map((x) => x.fuin)).toEqual([1, 2, 3]);
    expect(item.likeTotal).toBe(3);
    expect(warns).toHaveLength(0);
  });

  it('首页为空 → 只发一发', async () => {
    pageImpl = () => [];
    const item = { uniKey: 'album-empty' };
    const likes = await Common.getModulesLikeList(item, config);
    expect(calls).toEqual([0]);
    expect(likes).toEqual([]);
  });

  it('分页达到 200 页硬上限 → 强制结束并告警', async () => {
    pageImpl = (begin) => [{ fuin: begin + 1, uin: 1 }];
    const item = { uniKey: 'album-cap' };
    const likes = await Common.getModulesLikeList(item, config);

    expect(calls).toHaveLength(200);
    expect(likes).toHaveLength(200);
    expect(warns.join('\n')).toContain('分页达到上限');
  });
});
