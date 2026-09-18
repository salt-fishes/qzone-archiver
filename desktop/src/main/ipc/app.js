/**
 * app IPC：版本信息 / 打开外链 / 检查更新（v4.6 只增）
 */
import { app, shell, ipcMain, net } from 'electron';
import { logger } from '../services/logger.js';
import { Channels } from '../../shared/ipc-contract.mjs';

/** 更新源：GitHub Releases（仅查询，不自动下载安装） */
const GITHUB_REPO = 'salt-fishes/qzone-archiver';
const GITHUB_LATEST_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;

/** 比较 "v4.5.0" / "4.5.1" 形式的版本号：a > b 返回 1，< 返回 -1，= 返回 0 */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function registerAppIpc() {
  ipcMain.handle(Channels.app.getInfo, () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  }));

  ipcMain.handle(Channels.app.openExternal, (event, { url }) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return null;
  });

  // §K7：打开日志目录（应用日志 main.log + 任务日志 backup-<taskId>.log），便于用户反馈问题时自助取证
  ipcMain.handle(Channels.app.openLogs, async () => {
    await shell.openPath(logger.dir);
    return null;
  });

  ipcMain.handle(Channels.app.checkUpdate, async () => {
    const current = app.getVersion();
    try {
      const res = await net.fetch(GITHUB_LATEST_API, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'qzone-archiver-desktop',
        },
        // 10s 超时：网络不通时快速失败，不让按钮长时间转圈
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        return { ok: false, current, error: `查询失败（HTTP ${res.status}）` };
      }
      const data = await res.json();
      const latest = String(data.tag_name || '').replace(/^v/i, '');
      if (!latest) {
        return { ok: false, current, error: '未获取到最新版本号' };
      }
      const hasUpdate = compareVersions(latest, current) > 0;
      return {
        ok: true,
        current,
        latest,
        hasUpdate,
        url: hasUpdate ? (data.html_url || GITHUB_RELEASES_PAGE) : GITHUB_RELEASES_PAGE,
        notes: typeof data.body === 'string' ? data.body.slice(0, 2000) : '',
        publishedAt: data.published_at || null,
      };
    } catch (e) {
      return { ok: false, current, error: `网络异常：${e?.message || e}（可到 ${GITHUB_RELEASES_PAGE} 手动查看）` };
    }
  });
}
