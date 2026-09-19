/**
 * P2-4 modules 瘦身逐字搬迁证明（§4.3 铁律）：
 * 1. 全链证明：按 ENGINE_SCRIPTS 顺序（api 层 → collectors → repos → exporters
 *    → packagers → modules 编排层）在隔离 vm 上下文加载，
 *    11 个模块命名空间的每个 API 方法均为已挂接函数（无悬空委托）。
 * 2. 挂接证明：API.Common 抽样方法与五层注册表为同一引用。
 * 3. 逐字证明：批次 3c（common）35 个迁移实现体抽样与基线
 *    modules/common.js.p2-bak 做"去外壳函数体"级全等比对。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'path';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = path.join(desktopDir, 'src/engine');

/** api 层（与 engine-bridge.js ENGINE_SCRIPTS 一致） */
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

/** 五层 + 编排层（镜像 ENGINE_SCRIPTS L69-114 顺序，排除 tasks/desktop-runner） */
const LAYER_FILES = [
  'collectors/index.js',
  'collectors/base.js',
  'collectors/messages.js',
  'collectors/blogs.js',
  'collectors/diaries.js',
  'collectors/boards.js',
  'collectors/favorites.js',
  'collectors/photos.js',
  'collectors/videos.js',
  'collectors/visitors.js',
  'collectors/friends.js',
  'collectors/shares.js',
  'collectors/common.js',
  'repos/index.js',
  'repos/writer.js',
  'repos/incremental.js',
  'repos/modules/messages.js',
  'repos/modules/favorites.js',
  'repos/modules/shares.js',
  'repos/modules/friends.js',
  'repos/modules/photos.js',
  'exporters/index.js',
  'exporters/common.js',
  'exporters/messages.js',
  'exporters/blogs.js',
  'exporters/diaries.js',
  'exporters/boards.js',
  'exporters/favorites.js',
  'exporters/photos.js',
  'exporters/videos.js',
  'exporters/visitors.js',
  'exporters/friends.js',
  'exporters/shares.js',
  'packagers/links.js',
  'packagers/manifest.js',
  'modules/common.js',
  'modules/messages.js',
  'modules/blogs.js',
  'modules/diaries.js',
  'modules/photos.js',
  'modules/videos.js',
  'modules/boards.js',
  'modules/favorites.js',
  'modules/shares.js',
  'modules/friends.js',
  'modules/visitors.js',
];

const NAMESPACES = ['Common', 'Messages', 'Blogs', 'Diaries', 'Photos', 'Videos', 'Boards', 'Favorites', 'Shares', 'Friends', 'Visitors'];

function evalFiles(files, extra = {}) {
  const sandbox = { console, ...extra };
  sandbox.window = sandbox; // 浏览器语义：window 即全局对象
  vm.createContext(sandbox);
  for (const rel of files) {
    vm.runInContext(readFileSync(path.join(ENGINE, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox;
}

/** 全链上下文：api 层 → 五层 → modules 编排层 */
const fullSandbox = evalFiles([...API_FILES, ...LAYER_FILES]);

/** 基线上下文：P2-4 迁移前的 modules/common.js（其余命名空间不参与比对） */
const origSandbox = evalFiles(['modules/common.js.p2-bak'], {
  QZoneCollectors: new Proxy({}, { get: (t, k) => (t[k] ??= {}) }),
  QZoneExporters: new Proxy({}, { get: (t, k) => (t[k] ??= {}) }),
  QZoneRepo: new Proxy({}, { get: (t, k) => (t[k] ??= {}) }),
  QZonePackagers: new Proxy({}, { get: (t, k) => (t[k] ??= {}) }),
  API: { Common: {} },
});

const grab = (ctx, expr) => vm.runInContext(expr, ctx);

/** 去外壳函数体：箭头函数与对象方法简写的外壳不同，比对 body 文本。
 *  归一化：CRLF、行尾空白、整体缩进差（外壳迁移落点文件缩进风格不同）、空行。 */
function fnBody(fn) {
  const s = String(fn);
  const lines = s
    .slice(s.indexOf('{') + 1, s.lastIndexOf('}'))
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '');
  const base = Math.min(...lines.map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(base)).join('\n');
}

describe('P2-4 modules 编排层全链挂接证明', () => {
  for (const ns of NAMESPACES) {
    it(`API.${ns} 全部方法挂接非空（无悬空委托）`, () => {
      const keys = grab(fullSandbox, `Object.keys(API.${ns})`);
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) {
        expect(typeof grab(fullSandbox, `API.${ns}[${JSON.stringify(k)}]`), `API.${ns}.${k}`).toBe('function');
      }
    });
  }

  it('API.Common 基线方法集零丢失（基线 50 个方法全部存在于全链）', () => {
    const expected = grab(origSandbox, 'Object.keys(API.Common)');
    const actual = grab(fullSandbox, 'Object.keys(API.Common)');
    // 全链 API.Common 额外包含 api/common.js 基础方法，故断言基线 ⊆ 全链
    const missing = expected.filter((k) => !actual.includes(k));
    expect(missing, '基线方法丢失：' + missing.join(', ')).toEqual([]);
  });

  it('API.Common 抽样方法与五层注册表为同一引用', () => {
    const pairs = [
      ['API.Common.initUserInfo', 'QZoneCollectors.Common.initUserInfo'],
      ['API.Common.downloadsByAjax', 'QZoneCollectors.Common.downloadsByAjax'],
      ['API.Common.isGetNextPage', 'QZoneCollectors.Common.isGetNextPage'],
      ['API.Common.exportUserAvatar', 'QZoneCollectors.Common.exportUserAvatar'],
      ['API.Common.exportUser', 'QZoneExporters.Common.exportUser'],
      ['API.Common.exportUserToMd', 'QZoneExporters.Common.exportUserToMd'],
      ['API.Common.exportBackupItemsToJson', 'QZoneExporters.Common.exportBackupItemsToJson'],
      ['API.Common.isFullBackup', 'QZoneRepo.incremental.isFullBackup'],
      ['API.Common.resetQZoneBackupItems', 'QZoneRepo.incremental.resetQZoneBackupItems'],
      ['API.Common.isOnlyFileExport', 'QZoneRepo.incremental.isOnlyFileExport'],
      ['API.Common.writeJsonToJs', 'QZoneRepo.writer.writeJsonToJs'],
      ['API.Common.writeThunderTaskToFile', 'QZonePackagers.Links.writeThunderTaskToFile'],
    ];
    for (const [hook, impl] of pairs) {
      expect(grab(fullSandbox, hook), hook).toBe(grab(fullSandbox, impl));
    }
  });

  it('跨模块抽样：collectors/exporters 委托为同一引用', () => {
    expect(grab(fullSandbox, 'API.Messages.getAllList')).toBe(grab(fullSandbox, 'QZoneCollectors.Messages.getAllList'));
    expect(grab(fullSandbox, 'API.Photos.exportAllListToFiles')).toBe(grab(fullSandbox, 'QZoneExporters.Photos.exportAllListToFiles'));
    expect(grab(fullSandbox, 'API.Photos.getAlbumById')).toBe(grab(fullSandbox, 'QZoneRepo.Photos.getAlbumById'));
  });
});

describe('P2-4 批次 3c（common）逐字搬迁证明', () => {
  // 抽样覆盖三类落点：collectors（下载执行/翻页驱动/点赞访客/头像）、exporters、repos（增量判定/重置）
  const SAMPLES = [
    'initUserInfo', 'downloadsByAjax', 'downloadByAria2', 'getModulesLikeList', 'exportUserAvatar',
    'exportUser', 'exportUserToMd', 'exportConfigToJson',
    'isPreBackupPos', 'removeNewItems', 'isNewExport', 'resetQZoneBackupItems', 'isOnlyFileExport',
  ];

  // v4.9.2 有意偏差：日志瘦身（完整对象不再整包打进任务日志）。
  // 这些函数不再逐字比对，改为校验偏差内容仍在（防止偏差被无意抹掉或扩大）。
  const DEVIATIONS = {
    initUserInfo: [
      'console.info("获取用户信息完成", { uin: userInfo.uin, nickname: userInfo.nickname, spacename: userInfo.spacename })',
      "console.warn('初始化用户信息异常：', { code: userInfo.code, message: userInfo.message })",
    ],
    exportConfigToJson: [
      "console.info('生成助手配置JSON开始')",
      "console.info('生成助手配置JSON结束', jsonFile)",
    ],
  };

  for (const fn of SAMPLES) {
    it(`API.Common.${fn} 函数体与迁移基线逐字一致`, () => {
      const a = grab(origSandbox, `API.Common.${fn}`);
      const b = grab(fullSandbox, `API.Common.${fn}`);
      expect(typeof b).toBe('function');
      if (DEVIATIONS[fn]) {
        for (const marker of DEVIATIONS[fn]) {
          expect(fnBody(b), `${fn} 应含 v4.9.2 日志瘦身偏差：${marker}`).toContain(marker);
        }
        expect(fnBody(b), `${fn} 的偏差未登记，请更新 DEVIATIONS`).not.toBe(fnBody(a));
        return;
      }
      expect(fnBody(b)).toBe(fnBody(a));
    });
  }
});
