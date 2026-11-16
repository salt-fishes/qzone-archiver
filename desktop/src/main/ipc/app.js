/**
 * app IPC：版本信息 / 打开外链 / 检查更新（v4.6 只增）
 */
import { app, shell, ipcMain, net } from 'electron';
import { logger } from '../services/logger.js';
import { Channels } from '../../shared/ipc-contract.mjs';
import { compareVersions, pickUpdateAssets, htmlToText, parseReleaseAssetsHtml, extractHtmlBlock } from '../../shared/update.mjs';

/** 更新源：GitHub Releases（仅查询，不自动下载安装） */
const GITHUB_REPO = 'salt-fishes/qzone-archiver';
const GITHUB_LATEST_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;
const UPDATE_UA = 'qzone-archiver-desktop';

/**
 * GitHub API 被限流 / 403 时的回退：
 * 1) releases/latest 页面（跟随重定向）解析版本号与更新说明；
 * 2) releases/expanded_assets/<tag> 取 .exe 资产与大小。
 * 不依赖 API，因此不受未登录 60 次/小时限制。
 */
async function fetchLatestFromHtml(current) {
  const latestPage = await net.fetch(`https://github.com/${GITHUB_REPO}/releases/latest`, {
    headers: { 'User-Agent': UPDATE_UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  if (!latestPage.ok) throw new Error(`HTTP ${latestPage.status}`);
  const html = await latestPage.text();

  // Electron net.fetch 的 Response.url 可能为空，从页面链接 / <title> 解析实际 tag
  const linkMatch = /\/releases\/tag\/(v[\w.-]+)/i.exec(html);
  const titleMatch = /<title>[^<]*Release\s+(v?[\d.]+)[^<]*<\/title>/i.exec(html);
  const tag = linkMatch ? decodeURIComponent(linkMatch[1]) : (titleMatch ? titleMatch[1] : '');
  const latest = tag.replace(/^v/i, '');
  if (!latest) throw new Error('未解析到最新版本号');

  const notes = htmlToText(extractHtmlBlock(html, 'markdown-body')).slice(0, 12000);
  const publishedAt = /<relative-time[^>]+datetime="([^"]+)"/i.exec(html)?.[1] || null;

  let assets = [];
  try {
    const expanded = await net.fetch(
      `https://github.com/${GITHUB_REPO}/releases/expanded_assets/${encodeURIComponent(tag)}`,
      { headers: { 'User-Agent': UPDATE_UA }, signal: AbortSignal.timeout(10000) }
    );
    if (expanded.ok) assets = parseReleaseAssetsHtml(await expanded.text());
  } catch {
    /* 资产解析失败时仍可打开 Release 页面 */
  }

  return {
    ok: true,
    current,
    latest,
    hasUpdate: compareVersions(latest, current) > 0,
    url: tag ? `https://github.com/${GITHUB_REPO}/releases/tag/${tag}` : GITHUB_RELEASES_PAGE,
    name: tag || `v${latest}`,
    notes,
    publishedAt,
    assets,
    source: 'html',
  };
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
    let apiError = '';
    try {
      const res = await net.fetch(GITHUB_LATEST_API, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': UPDATE_UA,
        },
        // 10s 超时：网络不通时快速失败，不让按钮长时间转圈
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const latest = String(data.tag_name || '').replace(/^v/i, '');
        if (!latest) {
          return { ok: false, current, error: '未获取到最新版本号' };
        }
        return {
          ok: true,
          current,
          latest,
          hasUpdate: compareVersions(latest, current) > 0,
          url: data.html_url || GITHUB_RELEASES_PAGE,
          name: typeof data.name === 'string' ? data.name : '',
          notes: typeof data.body === 'string' ? data.body.slice(0, 12000) : '',
          publishedAt: data.published_at || null,
          assets: pickUpdateAssets(data.assets),
          source: 'api',
        };
      }
      apiError = `GitHub API 查询失败（HTTP ${res.status}）`;
    } catch (e) {
      apiError = `GitHub API 网络异常：${e?.message || e}`;
    }

    // API 限流 / 403 / 网络异常时走网页回退，保证手动检查更新仍可用
    try {
      const fallback = await fetchLatestFromHtml(current);
      logger.info(`[app] ${apiError}，已通过 GitHub 网页回退检查更新：v${fallback.latest}`);
      return fallback;
    } catch (e2) {
      return {
        ok: false,
        current,
        error: `${apiError}；备用检查失败：${e2?.message || e2}（可到 ${GITHUB_RELEASES_PAGE} 手动查看）`,
      };
    }
  });
}
