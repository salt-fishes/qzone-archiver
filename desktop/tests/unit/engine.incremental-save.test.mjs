/**
 * v5.5 M0：增量备份落盘单测（plans/v5.5.md §4.6）
 *
 * 背景：saveBackupItems 原 .then 链无 catch——storage.set(backupInfos) 失败（或
 * storage 未返回 Promise）时 Promise 永不结算且零日志，备份收尾永久挂死；
 * storage.set({QZone_Config}) 为 fire-and-forget，失败成未处理拒绝。本文件锁定：
 *  ① 主数据 storage.set 失败必须 reject（挂死回归）
 *  ② 配置项写入失败仅告警不阻断（resolve）
 *  ③ 产物 meta 写失败仅告警不阻断（P3-3 既有语义保持）
 *  ④ 写入顺序：配置项先写（刷上次备份时间）、主数据后写；返回值即主数据结构
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const UIN = 12345;

let incremental;
const storageSets = [];
const metaWrites = [];
/** 可按注入用例切换的行为：key 为 'config' | 'data' */
let storageBehavior = {};

beforeAll(() => {
  const platform = {
    storage: {
      set: async (items) => {
        storageSets.push(items);
        if (items.QZone_Config && storageBehavior.config === 'fail') throw new Error('cfg-broken');
        if (items.Backedup && storageBehavior.data === 'fail') throw new Error('storage-broken');
        return {};
      },
      get: async () => ({}),
    },
    fs: {
      writeFile: async (filepath, data) => {
        if (storageBehavior.meta === 'fail') throw new Error('disk-full');
        metaWrites.push({ path: filepath, data });
        return { ok: true };
      },
    },
  };
  const sandbox = {
    window: { QZonePlatform: platform, Backedup: {} },
    console,
    setTimeout,
    clearTimeout,
    QZone: { Common: { Target: { uin: UIN } } },
    QZone_Config: { Messages: { IncrementType: 'Full' } },
    MODULE_NAME_LIST: ['Messages'],
    StatusIndicator: class {
      print() {}
      complete() {}
    },
    API: {
      Common: {
        getRootFolder: () => '/root',
        isExport: () => true,
        isNewExport: () => true,
        getOldModuleData: () => [],
        getSaveModuleData: (mod) => [{ module: mod, data: [{ id: 1 }] }],
      },
      Utils: {
        formatDate: () => '2026-01-01 00:00:00',
        parseDate: (s) => new Date(s),
      },
    },
  };
  sandbox.QZoneRepo = sandbox.window.QZoneRepo = {};
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(rootDir, 'src/engine/vendor/lodash/lodash.min.js'), 'utf8'), sandbox);
  sandbox.QZoneRepo = sandbox.window.QZoneRepo = {};
  vm.runInContext(readFileSync(path.join(rootDir, 'src/engine/repos/incremental.js'), 'utf8'), sandbox);
  incremental = sandbox.window.QZoneRepo.incremental;
});

describe('saveBackupItems 落盘语义（v5.5 M0）', () => {
  it('主数据 storage.set 失败必须 reject（挂死回归：不再静默永不结算）', async () => {
    storageBehavior = { data: 'fail' };
    storageSets.length = 0;
    await expect(incremental.saveBackupItems()).rejects.toThrow('storage-broken');
  });

  it('配置项（QZone_Config）写入失败仅告警不阻断', async () => {
    storageBehavior = { config: 'fail' };
    storageSets.length = 0;
    metaWrites.length = 0;
    const result = await incremental.saveBackupItems();
    expect(result.Backedup[UIN]).toHaveLength(1);
    expect(result.Backedup[UIN][0].module).toBe('Messages');
    expect(metaWrites).toHaveLength(1); // 产物 meta 仍写入
  });

  it('产物 meta 写失败仅告警不阻断（P3-3 语义保持）', async () => {
    storageBehavior = { meta: 'fail' };
    storageSets.length = 0;
    const result = await incremental.saveBackupItems();
    expect(result.Backedup[UIN]).toHaveLength(1);
    expect(storageSets.filter((s) => s.Backedup)).toHaveLength(1);
  });

  it('写入顺序：配置项先写、主数据后写；返回值与主数据一致', async () => {
    storageBehavior = {};
    storageSets.length = 0;
    metaWrites.length = 0;
    const result = await incremental.saveBackupItems();
    const kinds = storageSets.map((s) => (s.QZone_Config ? 'config' : 'data'));
    expect(kinds).toEqual(['config', 'data']);
    expect(JSON.parse(metaWrites[0].data).Backedup[UIN]).toEqual(result.Backedup[UIN]);
  });
});
