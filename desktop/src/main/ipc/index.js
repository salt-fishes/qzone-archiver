/**
 * IPC 注册入口（主 UI 侧契约，见设计文档 §3.2）
 */
import { registerAppIpc } from './app.js';
import { registerAuthIpc } from './auth.js';
import { registerConfigIpc } from './config.js';
import { registerBackupIpc } from './backup.js';
import { registerDownloadIpc } from './download.js';
import { registerFsIpc } from './fs.js';
import { registerZipIpc } from './zip.js';
import { registerViewerIpc } from './viewer.js';

export function registerIpc() {
  registerAppIpc();
  registerAuthIpc();
  registerConfigIpc();
  registerBackupIpc();
  registerDownloadIpc();
  registerFsIpc();
  registerZipIpc();
  registerViewerIpc();
}
