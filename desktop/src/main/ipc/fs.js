/**
 * fs IPC：目录选择 / 打开路径 / 资源管理器显示
 */
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';

export function registerFsIpc() {
  ipcMain.handle('fs:select-directory', async (event, { title } = {}) => {
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

  ipcMain.handle('fs:open-path', async (event, { path }) => {
    if (path) shell.openPath(path);
    return null;
  });

  ipcMain.handle('fs:show-in-folder', async (event, { path }) => {
    if (path) shell.showItemInFolder(path);
    return null;
  });
}
