/**
 * 相册清单去重回归（v5.4，2026-10-11 实机数据复核）
 *
 * 根因：initAlbums 里 albumList 直接引用 QZone.Photos.Album.Data，
 * 而"备份全部"路径下 Select 与 Data 是同一个数组 → push(...selects) 变成数组自推，
 * 相册索引每条重复两遍（D:\ic6464：12 条 = 6 相册 ×2），且污染 Data。
 *
 * 断言：同引用 / 防御性重复 / 增量合并三条路径都按 id 去重，且不修改 Data 本体。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function makeCtx({ data = [], old = [], select = null, isFull = true } = {}) {
  const sandbox = {
    console: { info() {}, warn() {}, error() {}, log() {} },
    QZone_Config: { Photos: { IncrementType: isFull ? 'Full' : 'Last' } },
    QZone: {
      Photos: {
        Album: { Data: data, OLD_Data: old, Select: select, total: data.length },
        Class: {},
      },
    },
    _: {
      find: (arr, matcher) =>
        Array.isArray(matcher) ? arr.find((x) => x && x[matcher[0]] === matcher[1]) : arr.find(matcher),
    },
    API: {
      Common: { isFullBackup: () => isFull },
      Photos: {
        getAllAlbumList: async () => data,
        sortAlbums: (albums) => albums.sort((a, b) => (a.order || 0) - (b.order || 0)),
        getUniKey: (id) => `key-${id}`,
      },
      Utils: {},
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ROOT, 'src/engine/collectors/photos.js'), 'utf8'), sandbox, {
    filename: 'collectors/photos.js',
  });
  return sandbox;
}

const A1 = { id: 'a1', name: '春节', order: 1 };
const A2 = { id: 'a2', name: '景物照', order: 2 };

describe('initAlbums 去重（重复导出回归）', () => {
  it('Select 与 Data 同引用（备份全部路径）→ 不再自推重复', async () => {
    const data = [{ ...A1 }, { ...A2 }];
    const ctx = makeCtx({ data, select: data }); // select === data：旧实现自推成 4 条
    const list = await ctx.QZoneCollectors.Photos.initAlbums();
    expect(list.map((a) => a.id)).toEqual(['a1', 'a2']);
    // Data 本体不被污染（旧实现会把它也翻倍）
    expect(data.length).toBe(2);
  });

  it('防御性去重：候选清单含重复 id → 结果唯一', async () => {
    const data = [{ ...A1 }, { ...A1 }, { ...A2 }];
    const ctx = makeCtx({ data, select: data });
    const list = await ctx.QZoneCollectors.Photos.initAlbums();
    expect(list.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('增量合并：同名旧相册沿用旧对象并拷贝新属性，历史相册保留且无重复', async () => {
    const newA1 = { id: 'a1', name: '春节', order: 1, total: 330, desc: '更新' };
    const oldA1 = { id: 'a1', name: '春节', order: 1, total: 329, desc: '旧', photoList: [{ name: 'p' }] };
    const oldA3 = { id: 'a3', name: '已删相册', order: 3 };
    const data = [newA1];
    const ctx = makeCtx({ data, old: [oldA1, oldA3], select: data, isFull: false });
    const list = await ctx.QZoneCollectors.Photos.initAlbums();
    expect(list.map((a) => a.id).sort()).toEqual(['a1', 'a3']);
    const merged = list.find((a) => a.id === 'a1');
    expect(merged).toBe(oldA1); // 沿用旧对象（保留 photoList）
    expect(merged.total).toBe(330); // 新属性已拷贝
    expect(merged.desc).toBe('更新');
  });
});
