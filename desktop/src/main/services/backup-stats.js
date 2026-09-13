/**
 * 备份历史统计（S2 概览）：备份完成时由主进程自动记录，渲染器直接读取，不依赖目录扫描
 * 存储：userData/state/backup-history.json（每条 = 一次完成的备份）
 * 字段：完成时间 / 目标目录 / 模块 / 条目数（manifest）/ 目录大小 / 文件数
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function historyFile() {
  return path.join(app.getPath('userData'), 'state', 'backup-history.json');
}

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error('[backup-stats] 读取失败', file, e);
  }
  return fallback;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/** 统计目录字节数（限制遍历量，避免大目录卡 UI；P3-4：fs.promises 逐目录 await 让出主线程） */
export async function dirBytes(dir, budget = 5000) {
  let total = 0;
  let visited = 0;
  const walk = async (d) => {
    if (visited > budget) return;
    let list = [];
    try {
      list = await fs.promises.readdir(d, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const e of list) {
      if (visited > budget) return;
      visited += 1;
      const p = path.join(d, e.name);
      try {
        if (e.isDirectory()) await walk(p);
        else if (e.isFile()) total += (await fs.promises.stat(p)).size;
      } catch (err) {
        /* ignore */
      }
    }
  };
  await walk(dir);
  return total;
}

/** 统计文件数（截断到上限，防止慢；P3-4：异步遍历不再阻塞主线程） */
export async function countFiles(dir, count = 0, limit = 20000) {
  let list = [];
  try {
    list = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (e) {
    return count;
  }
  for (const e of list) {
    if (count >= limit) break;
    if (e.isDirectory()) count = await countFiles(path.join(dir, e.name), count, limit);
    else if (e.isFile()) count += 1;
  }
  return count;
}

export const backupStats = {
  /** 全部历史记录（最新在前） */
  loadHistory() {
    const list = readJson(historyFile(), []);
    return Array.isArray(list) ? list : [];
  },

  getHistory() {
    return this.loadHistory();
  },

  /**
   * 备份完成时自动记录（引擎此时已生成 manifest.json / report.json）
   * 幂等：同 taskId 不重复追加
   * P3-4：目录统计异步化，本函数为 async，调用方 fire-and-forget 即可
   * @param {object} p.errors 模块级失败明细（P3-1：P0-3 遗留项落库，重启后历史不再显示假成功）
   */
  async recordBackup({ taskId, targetDir, modules, results, errors, target }) {
    const dir = String(targetDir || '');
    if (!dir) return null;

    const entry = {
      taskId: taskId || null,
      completedAt: Date.now(),
      targetDir: dir,
      name: path.basename(dir),
      modules: Array.isArray(modules) ? modules : [],
      results: results || {},
      // 部分模块失败时记录明细（module/phase/code/message），全成功不落字段
      errors: Array.isArray(errors) && errors.length ? errors : undefined,
      // v4.6：采集目标（uin/昵称），他人模式档案按目标分组展示（旧记录无此字段，回退为本人）
      target: target && target.uin ? { uin: String(target.uin), nickname: target.nickname || '' } : undefined,
      total: 0,
      moduleCounts: {},
      size: 0,
      files: 0,
    };

    // 读取引擎生成的备份清单（各模块条目数），可选
    const manifest = readJson(path.join(dir, 'manifest.json'), null);
    if (manifest && manifest.modules) {
      const moduleCounts = {};
      for (const [name, m] of Object.entries(manifest.modules)) {
        moduleCounts[name] = (m && m.count) || 0;
      }
      entry.moduleCounts = moduleCounts;
      entry.total = Object.values(moduleCounts).reduce((s, n) => s + (n || 0), 0);
      if (manifest.createdAt) entry.createdAt = manifest.createdAt;
    }

    // 目录大小 / 文件数（与 scanBackups 同一统计口径，截断避免卡顿；P3-4：异步遍历）
    try {
      entry.size = await dirBytes(dir);
      entry.files = await countFiles(dir, 0, 20000);
    } catch (e) {
      console.warn('[backup-stats] 统计目录失败', e);
    }

    // 同 taskId 去重后最新记录置顶
    const list = this.loadHistory().filter((x) => x.taskId !== entry.taskId);
    list.unshift(entry);
    writeJson(historyFile(), list);
    return entry;
  },
};
