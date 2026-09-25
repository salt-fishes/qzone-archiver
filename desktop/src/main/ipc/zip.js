/**
 * zip IPC：打包（M2b 实现 archiver）
 * v5.0 Z：失败/成功必须留痕（§K 原则：关键用户操作不得零日志）
 */
import { ipcMain } from 'electron';
import { packager } from '../services/packager.js';
import { logger } from '../services/logger.js';
import { Channels } from '../../shared/ipc-contract.mjs';

export function registerZipIpc() {
  ipcMain.handle(Channels.zip.create, async (event, { srcDir, destPath }) => {
    try {
      const result = await packager.createZip({ srcDir, destPath });
      logger.info(`[zip] 完成: ${result.path}（${result.bytes} 字节 / ${result.files} 文件）`);
      return { ok: true, ...result };
    } catch (e) {
      logger.error(`[zip] 失败: src=${srcDir} dest=${destPath} error=${e.message}`);
      return { ok: false, error: e.message };
    }
  });
}
