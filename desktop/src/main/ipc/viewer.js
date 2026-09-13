/**
 * viewer IPC：内置 SPA 浏览（file:// 打开备份产物 index.html）
 */
import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { createViewerWindow } from '../windows.js';
import { Channels } from '../../shared/ipc-contract.mjs';

export function registerViewerIpc() {
  ipcMain.handle(Channels.viewer.open, async (event, { backupPath }) => {
    if (!backupPath) {
      return { ok: false, error: '缺少备份入口路径' };
    }
    // 兼容传入目录或入口文件两种形态：目录 → 定位其中的 index.html
    let entry = String(backupPath);
    try {
      if (fs.existsSync(entry) && fs.statSync(entry).isDirectory()) {
        entry = path.join(entry, 'index.html');
      }
      if (!fs.existsSync(entry)) {
        return { ok: false, error: `未找到档案入口文件：${entry}（请确认该目录已完成备份）` };
      }
      await createViewerWindow(entry);
      return { ok: true };
    } catch (e) {
      console.error('[viewer] 打开档案失败', e);
      return { ok: false, error: e.message || String(e) };
    }
  });
}
