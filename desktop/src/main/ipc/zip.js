/**
 * zip IPC：打包（M2b 实现 archiver；当前返回占位错误）
 */
import { ipcMain } from 'electron';
import { packager } from '../services/packager.js';
import { Channels } from '../../shared/ipc-contract.mjs';

export function registerZipIpc() {
  ipcMain.handle(Channels.zip.create, async (event, { srcDir, destPath }) => {
    try {
      const result = await packager.createZip({ srcDir, destPath });
      return { ok: true, ...result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}
