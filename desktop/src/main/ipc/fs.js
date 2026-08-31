/**
 * fs IPC：目录选择 / 打开路径 / 资源管理器显示 / 历史备份扫描
 */
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { dirBytes, countFiles } from '../services/backup-stats.js';
import { Channels } from '../../shared/ipc-contract.mjs';

export function registerFsIpc() {
  ipcMain.handle(Channels.fs.selectDirectory, async (event, { title } = {}) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: title || '选择备份目标文件夹',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle(Channels.fs.openPath, async (event, { path }) => {
    if (path) shell.openPath(path);
    return null;
  });

  ipcMain.handle(Channels.fs.showInFolder, async (event, { path }) => {
    if (path) shell.showItemInFolder(path);
    return null;
  });

  // 导出保存对话框（选择保存位置与文件名）
  ipcMain.handle(Channels.fs.saveDialog, async (event, { title, defaultPath, filters } = {}) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win, {
      title: title || '导出',
      defaultPath,
      filters: filters || [{ name: '文本文件', extensions: ['txt'] }],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePath };
  });

  // 写文本文件（导出用）
  ipcMain.handle(Channels.fs.writeText, async (event, { path, content } = {}) => {
    if (!path) return { ok: false, error: '缺少文件路径' };
    fs.mkdirSync(path.dirname(path), { recursive: true });
    fs.writeFileSync(path, String(content ?? ''), 'utf8');
    return { ok: true, path };
  });

  // 扫描历史备份：在根目录（或其子目录）中查找含 index.html 的备份根
  ipcMain.handle(Channels.fs.scanBackups, async (event, { root } = {}) => {
    if (!root || !fs.existsSync(root)) {
      return { ok: false, error: '目录不存在', backups: [] };
    }
    return { ok: true, backups: await findBackupDirs(path.resolve(root), 2) };
  });
}

/** 递归查找含 index.html 的目录（备份根特征：存在 SPA 入口 index.html；P3-4：异步遍历不阻塞主线程） */
async function findBackupDirs(root, depth) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const p = path.join(root, entry.name);
    const indexFile = path.join(p, 'index.html');
    if (fs.existsSync(indexFile)) {
      try {
        const st = await fs.promises.stat(p);
        out.push({
          path: p,
          name: entry.name,
          mtime: st.mtimeMs,
          size: await dirBytes(p),
          files: await countFiles(p, 0, 20000),
        });
      } catch (e) {
        /* 单个目录不可读则跳过 */
      }
    } else if (depth > 0) {
      out.push(...(await findBackupDirs(p, depth - 1)));
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}
