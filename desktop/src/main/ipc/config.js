/**
 * config IPC：读写/重置/导入导出配置（userData/state/config.json）
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import { configStore } from '../services/config-store.js';

const DEFAULTS = {};

export function registerConfigIpc() {
  ipcMain.handle('config:get', () => configStore.get());

  ipcMain.handle('config:set', (event, partial) => configStore.set(partial || {}));

  ipcMain.handle('config:reset', () => configStore.reset(DEFAULTS));

  ipcMain.handle('config:import', async (event, { path } = {}) => {
    const filePath = path || (await pickJsonFile('导入配置文件'));
    if (!filePath) return { canceled: true };
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    configStore.set(data);
    return { canceled: false, data };
  });

  ipcMain.handle('config:export', async (event, { path } = {}) => {
    const filePath = path || (await pickJsonFile('导出配置文件', true));
    if (!filePath) return { canceled: true };
    fs.writeFileSync(filePath, JSON.stringify(configStore.get(), null, 2), 'utf8');
    return { canceled: false, path: filePath };
  });
}

async function pickJsonFile(title, save = false) {
  const win = BrowserWindow.getFocusedWindow();
  const options = {
    title,
    defaultPath: save ? 'qzone-archiver-config.json' : undefined,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  };
  const result = save
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showOpenDialog(win, { ...options, properties: ['openFile'] });
  if (result.canceled || result.filePaths?.length === 0) {
    return null;
  }
  return save ? result.filePath : result.filePaths[0];
}
