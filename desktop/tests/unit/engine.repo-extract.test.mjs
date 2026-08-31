/**
 * P2-3 repo 层补齐逐字搬迁证明（§4.2 铁律）：
 * 1. 迁移基线（modules/{friends,photos}.js.p2-bak，git HEAD 提取）与
 *    repos/modules/{friends,photos}.js 在两个隔离 vm 上下文求值，
 *    对 7 个仓库型函数做"去外壳函数体"级全等比对（原版箭头函数 vs repo 方法简写，
 *    toString 外壳不同，故比对 body 文本）。
 * 2. 挂接证明：按 ENGINE_SCRIPTS 顺序加载 api 层 + repos + 编排层后，
 *    API.Friends/API.Photos 的 7 个方法与 QZoneRepo 为同一引用。
 * 3. 死代码证明：api/modules/{shares,favorites} 的 convert 已清理。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = path.join(desktopDir, 'src/engine');

/** P2-1 拆分产物注入顺序（api 层，与 engine-bridge.js 保持一致） */
const API_FILES = [
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

const REPO_FILES = [
  'repos/modules/messages.js',
  'repos/modules/favorites.js',
  'repos/modules/shares.js',
  'repos/modules/friends.js',
  'repos/modules/photos.js',
];

const HOOK_FILES = ['modules/friends.js', 'modules/photos.js'];

/** collectors/exporters 等分层委托兜底：任意命名空间返回空对象 */
function makeCollectorsStub() {
  const ns = {};
  return new Proxy(ns, {
    get(t, k) {
      if (!(k in t)) t[k] = {};
      return t[k];
    },
  });
}

function evalFiles(files, extra = {}) {
  const sandbox = {
    console,
    QZoneCollectors: makeCollectorsStub(),
    QZoneExporters: makeCollectorsStub(),
    QZonePackagers: makeCollectorsStub(),
    ...extra,
  };
  sandbox.window = sandbox; // 浏览器语义：window 即全局对象（repos 以 window.QZoneRepo 挂载）
  vm.createContext(sandbox);
  for (const rel of files) {
    vm.runInContext(readFileSync(path.join(ENGINE, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox;
}

/** 基线上下文：git HEAD 提取的迁移前 modules/{friends,photos}.js */
const ORIG_FILES = ['modules/friends.js.p2-bak', 'modules/photos.js.p2-bak'];
const origSandbox = evalFiles(
  ORIG_FILES,
  { API: { Friends: {}, Photos: {} } },
);

/** 全链上下文：api 层 → repos → 编排层挂接（与 ENGINE_SCRIPTS 顺序一致） */
const fullSandbox = evalFiles([...API_FILES, ...REPO_FILES, ...HOOK_FILES]);

/** 取上下文全局词法绑定（const/class 不挂 context 对象） */
const grab = (ctx, expr) => vm.runInContext(expr, ctx);

/** 去外壳函数体：箭头函数与对象方法简写的外壳不同，比对 body 文本（行尾/尾缩进属文件格式，归一化） */
function fnBody(fn) {
  const s = String(fn);
  return s.slice(s.indexOf('{') + 1, s.lastIndexOf('}')).replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

const FRIENDS_FNS = ['initGroupName', 'getFriendsTime', 'isNewItem'];
const PHOTOS_FNS = ['getAlbumById', 'getPhotosByAlbumId', 'isNewAlbum', 'isNewItem'];

describe('P2-3 repo 层补齐逐字搬迁证明', () => {
  for (const ns of ['Friends', 'Photos']) {
    const fns = ns === 'Friends' ? FRIENDS_FNS : PHOTOS_FNS;
    for (const fn of fns) {
      it(`QZoneRepo.${ns}.${fn} 函数体与迁移基线逐字一致`, () => {
        const a = grab(origSandbox, `API.${ns}.${fn}`);
        const b = grab(fullSandbox, `QZoneRepo.${ns}.${fn}`);
        expect(typeof b).toBe('function');
        expect(fnBody(b)).toBe(fnBody(a));
      });

      it(`API.${ns}.${fn} 挂接为 QZoneRepo 同一引用`, () => {
        expect(grab(fullSandbox, `API.${ns}.${fn}`)).toBe(grab(fullSandbox, `QZoneRepo.${ns}.${fn}`));
      });
    }
  }

  it('api/modules/shares.js 死代码 convert 已清理（getSourceType 等接口保留）', () => {
    expect(grab(fullSandbox, 'Object.keys(API.Shares)')).not.toContain('convert');
    expect(grab(fullSandbox, 'Object.keys(API.Shares)')).toContain('getSourceType');
  });

  it('api/modules/favorites.js 死代码 convert 已清理', () => {
    expect(grab(fullSandbox, 'Object.keys(API.Favorites)')).not.toContain('convert');
  });

  it('编排层挂接后 collectors 调用 API.Photos.isNewAlbum 走 repo 实现', () => {
    // 挂接后的 API.Photos.isNewAlbum 与 repo 内部经 API.Photos.getAlbumById 的互引一致解析
    expect(
      grab(fullSandbox, 'API.Photos.isNewAlbum === QZoneRepo.Photos.isNewAlbum && API.Photos.getAlbumById === QZoneRepo.Photos.getAlbumById'),
    ).toBe(true);
  });
});
