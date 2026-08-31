/**
 * P3-3 单测（§5.3）：增量元数据落产物
 * - saveBackupItems 双写（产物 backup-meta.json + engine-storage 过渡保留）
 * - getBackupItems 双读（产物本 uin 命中优先，缺失/他 uin 回退 storage）
 * - manifest.generate 收尾同步 backup-meta（"这次" vs "截至这次"）
 * 引擎脚本依赖 window / API / _ 全局，用 node:vm 注入 stub 后执行源码。
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const UIN = '123456';
const ROOT = '/backup/QQ空间备份_123456';
const META_PATH = ROOT + '/Common/backup-meta.json';

let sandbox;
let incremental;
let Manifest;
let calls;
let metaFile; // 产物 backup-meta.json 内容（模拟文件系统）
let metaMissing; // 模拟产物缺失/损坏
let storageBackedup; // engine-storage 里的 Backedup（结构 { [uin]: rows }）

beforeAll(() => {
  sandbox = {
    window: {},
    console,
    // saveBackupItems 只在 IncrementType === 'Last' 时刷时间；用 'Custom' 避开 formatDate 分支
    QZone_Config: { Messages: { IncrementType: 'Custom' } },
    QZone: { Common: { Target: { uin: UIN } } },
    MODULE_NAME_LIST: ['Messages'],
    StatusIndicator: class {
      print() {}
      complete() {}
    },
    API: {
      Common: {},
      Utils: { formatDate: () => '2026-08-28 00:00:00' },
    },
  };
  sandbox.API.Common.getRootFolder = () => ROOT;
  sandbox.API.Common.isExport = (m) => m === 'Messages';
  sandbox.API.Common.isFullBackup = () => false;
  sandbox.API.Common.getOldModuleData = () => [];
  sandbox.API.Common.isNewExport = () => true;
  sandbox.API.Common.getSaveModuleData = () => [{ id: 1 }];
  vm.createContext(sandbox);

  // lodash（引擎 vendor 版，UMD → 挂 context 全局 _）
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/vendor/lodash/lodash.min.js'), 'utf8'),
    sandbox,
  );
  // 顶层同时使用 window.QZoneRepo 与裸标识符 QZoneRepo，两者须同一对象
  sandbox.QZoneRepo = sandbox.window.QZoneRepo = {};
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/repos/incremental.js'), 'utf8'),
    sandbox,
  );
  incremental = sandbox.window.QZoneRepo.incremental;

  // manifest.js：顶层 window.QZonePackagers + 裸 QZonePackagers，同一对象
  sandbox.QZonePackagers = sandbox.window.QZonePackagers = {};
  sandbox.QZone.Common.Target.nickname = '测试号';
  sandbox.QZone.Common.Owner = { uin: UIN };
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/packagers/manifest.js'), 'utf8'),
    sandbox,
  );
  Manifest = sandbox.window.QZonePackagers.Manifest;
});

beforeEach(() => {
  calls = { fsWrite: [], fsRead: [], storageSet: [], storageGet: [], writeText: [] };
  metaFile = null;
  metaMissing = false;
  storageBackedup = null;
  sandbox.window.Backedup = {};

  sandbox.window.QZonePlatform = {
    storage: {
      get(keys) {
        calls.storageGet.push(keys);
        // 主进程 engineStorage.get 单键也包对象返回：{ Backedup: { [uin]: rows } }
        return Promise.resolve({ Backedup: storageBackedup });
      },
      set(items) {
        calls.storageSet.push(items);
        return Promise.resolve();
      },
      remove() {
        return Promise.resolve();
      },
    },
    fs: {
      async writeFile(filepath, data) {
        calls.fsWrite.push({ path: filepath, data });
        if (metaMissing) throw new Error('mock-write-fail');
        if (String(filepath).endsWith('backup-meta.json')) {
          metaFile = JSON.parse(data);
        }
        return { ok: true };
      },
      async readFile(filepath) {
        calls.fsRead.push(filepath);
        if (metaMissing || !metaFile || !String(filepath).endsWith('backup-meta.json')) {
          throw new Error('mock-missing');
        }
        return JSON.stringify(metaFile);
      },
      async list() {
        throw new Error('mock-missing');
      },
      exists() {
        return Promise.resolve(false);
      },
      mkdir() {
        return Promise.resolve({ ok: true });
      },
      remove() {
        return Promise.resolve({ ok: true });
      },
    },
  };

  sandbox.API.Utils.writeText = async (content, filepath) => {
    calls.writeText.push({ path: filepath, content });
    return filepath;
  };
});

describe('saveBackupItems 双写（P3-3 §5.3）', () => {
  it('增量元数据写入产物 Common/backup-meta.json，结构同 storage：{ Backedup: { [uin]: rows } }', async () => {
    const result = await incremental.saveBackupItems();

    const metaWrites = calls.fsWrite.filter((w) => w.path === META_PATH);
    expect(metaWrites).toHaveLength(1);
    const written = JSON.parse(metaWrites[0].data);
    expect(written.Backedup[UIN]).toHaveLength(1);
    expect(written.Backedup[UIN][0].module).toBe('Messages');
    // 返回值与 storage 写入内容一致（调用方 exportBackupItemsToJson 依赖）
    expect(result.Backedup[UIN]).toEqual(written.Backedup[UIN]);
  });

  it('过渡期 storage.set 仍保留（双写，一个版本后清理）', async () => {
    await incremental.saveBackupItems();

    const dataWrites = calls.storageSet.filter((items) => items && items.Backedup);
    expect(dataWrites).toHaveLength(1);
    expect(dataWrites[0].Backedup[UIN][0].module).toBe('Messages');
    // 配置项先写（上次备份时间）
    expect(calls.storageSet[0]).toHaveProperty('QZone_Config');
  });

  it('产物写失败不阻断保存流程（告警后 resolve）', async () => {
    metaMissing = true;
    const result = await incremental.saveBackupItems();
    expect(result.Backedup[UIN]).toHaveLength(1);
    expect(calls.storageSet.filter((items) => items && items.Backedup)).toHaveLength(1);
  });
});

describe('getBackupItems 双读（P3-3 §5.3）', () => {
  it('产物本 uin 命中时优先读产物，不走 storage', async () => {
    metaFile = { Backedup: { [UIN]: [{ module: 'Messages', data: [], time: 1 }] } };

    const result = await incremental.getBackupItems();

    expect(calls.fsRead).toEqual([META_PATH]);
    expect(calls.storageGet).toHaveLength(0);
    // readFile 经 JSON 序列化往返，断言内容一致（引用必为新对象）
    expect(result).toEqual(metaFile);
    expect(sandbox.window.Backedup).toEqual(metaFile);
    expect(sandbox.window.Backedup).not.toBe(metaFile);
  });

  it('产物缺失时回退 engine-storage（旧版本升级场景）', async () => {
    metaMissing = true;
    storageBackedup = { [UIN]: [{ module: 'Boards', data: [], time: 2 }] };

    const result = await incremental.getBackupItems();

    expect(calls.storageGet).toHaveLength(1);
    expect(result).toEqual({ Backedup: storageBackedup });
    expect(sandbox.window.Backedup).toEqual({ Backedup: storageBackedup });
  });

  it('产物仅含其他 uin 数据时不命中，回退 storage（产物目录按 uin 隔离）', async () => {
    metaFile = { Backedup: { '999999': [{ module: 'Messages', data: [], time: 3 }] } };
    storageBackedup = { [UIN]: [{ module: 'Messages', data: [], time: 4 }] };

    const result = await incremental.getBackupItems();

    expect(calls.storageGet).toHaveLength(1);
    expect(result).toEqual({ Backedup: storageBackedup });
  });
});

describe('manifest.generate 收尾同步 backup-meta（P3-3 §5.3）', () => {
  it('生成清单后以最新 window.Backedup 重写产物 backup-meta.json', async () => {
    sandbox.window.Backedup = { [UIN]: [{ module: 'Messages', data: [], time: 9 }] };

    const manifest = await Manifest.generate();

    expect(manifest.target.uin).toBe(UIN);
    // manifest.json + report.json
    expect(calls.writeText.map((w) => w.path)).toEqual([ROOT + '/manifest.json', ROOT + '/report.json']);
    // 收尾 backup-meta 为最后一次 fs 写
    const lastWrite = calls.fsWrite[calls.fsWrite.length - 1];
    expect(lastWrite.path).toBe(META_PATH);
    expect(JSON.parse(lastWrite.data)).toEqual({
      Backedup: { [UIN]: [{ module: 'Messages', data: [], time: 9 }] },
    });
  });
});
