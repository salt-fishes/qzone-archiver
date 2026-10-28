/**
 * v5.5 M1 补：相片详情分页卡死回归（2026-10-28 实机）
 *
 * 现场：Photos_Images 阶段约每秒 2 次重复请求同一 picKey（offset 恒 0）57 分钟；
 * 服务端返回的最后一页锚点没有前进，递归 nextPage 永不结束。
 *
 * 本测试锁定：
 *  ① 返回列表的最后一个 picKey 与请求 picKey 相同 → 立即停止
 *  ② 正常前进 → 继续翻页
 *  ③ 分页硬上限 200 页 → 强制结束
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

let sandbox;
let calls;
let warns;
let infoImpl;

function makeCtx() {
  calls = [];
  warns = [];
  sandbox = {
    console: {
      log() {},
      info() {},
      error() {},
      warn: (...args) => warns.push(args.map(String).join(' ')),
    },
    QZone_Config: {
      Photos: {
        IncrementType: 'Full',
        IncrementField: 'uploadTime',
        Images: {
          pageSize: 40,
          Info: { pageSize: 200, randomSeconds: { min: 0, max: 0 } },
        },
      },
    },
    QZone: {
      Photos: {
        Album: { OLD_Data: [], Select: null },
        Images: {},
      },
    },
    API: {
      Common: {
        setCompareFiledInfo: (list) => list,
        isGetNextPage: () => true,
        unionBackedUpItems: (a, b, c) => c,
      },
      Photos: {
        getPhotosByAlbumId: () => [],
        getAlbumImagePageList: async () => [{ picKey: 'P0', uploadtime: 1 }],
        getImageInfo: async (albumId, picKey) => {
          calls.push(picKey);
          return infoImpl(picKey);
        },
        getImageKey: (p) => p && (p.picKey || p.lloc || p.sloc),
        isNewAlbum: () => true,
      },
      Utils: {
        toJson: (raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw),
        randomSeconds: () => 0,
        sleep: async () => {},
        sort: (arr) => arr,
        unionItems: (a, b) => a.concat(b),
      },
    },
    _: {
      unionBy: (a, b, key) => {
        for (const x of b) if (!a.some((y) => key(y) === key(x))) a.push(x);
        return a;
      },
      last: (arr) => arr[arr.length - 1],
    },
    StatusIndicator: class {
      print() {}
      async setIndex() {}
      addDownload() {}
      setTotal() {}
      addSuccess() {}
      setSuccess() {}
      complete() {}
      addFailed() {}
    },
    PageInfo: class {},
    checkExportState: async () => false,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ROOT, 'src/engine/collectors/photos.js'), 'utf8'), sandbox, {
    filename: 'collectors/photos.js',
  });
}

const album = { id: 'album-1', name: '相册' };

beforeEach(() => {
  makeCtx();
  infoImpl = () => JSON.stringify({ code: 0, data: { picTotal: 100, photos: [], last: 1 } });
});

describe('getAlbumImageAllListByDetail 分页防护', () => {
  it('详情列表游标不前进（返回同一 picKey）→ 只发一发后停止', async () => {
    infoImpl = (picKey) =>
      JSON.stringify({
        code: 0,
        data: { picTotal: 100, photos: [{ picKey, uploadtime: 1 }], last: 0 },
      });

    const data = await sandbox.QZoneCollectors.Photos.getAlbumImageAllListByDetail(album);
    expect(calls).toEqual(['P0']);
    expect(data).toHaveLength(1);
    expect(warns.join('\n')).toContain('相片详情游标未前进');
  });

  it('游标正常前进 → 继续翻页，last=1 时停止', async () => {
    let page = 0;
    infoImpl = () => {
      page += 1;
      const next = `P${page}`;
      return JSON.stringify({
        code: 0,
        data: {
          picTotal: 100,
          photos: [{ picKey: next, uploadtime: page }],
          last: page >= 3 ? 1 : 0,
        },
      });
    };

    const data = await sandbox.QZoneCollectors.Photos.getAlbumImageAllListByDetail(album);
    expect(calls).toEqual(['P0', 'P1', 'P2']);
    expect(data).toHaveLength(3);
    expect(warns.join('\n')).not.toContain('游标未前进');
  });

  it('分页达到 200 页硬上限 → 强制结束并告警', async () => {
    let seq = 0;
    infoImpl = () =>
      JSON.stringify({
        code: 0,
        data: { picTotal: 9999, photos: [{ picKey: `P${++seq}`, uploadtime: seq }], last: 0 },
      });

    const data = await sandbox.QZoneCollectors.Photos.getAlbumImageAllListByDetail(album);
    expect(calls).toHaveLength(200);
    expect(data).toHaveLength(200);
    expect(warns.join('\n')).toContain('相片详情分页达到上限');
  });
});
