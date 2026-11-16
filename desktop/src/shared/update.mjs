/**
 * 更新检查的纯函数（主进程与单测共用，不依赖 Electron）
 *
 * 版本号只处理 x.y.z / x.y 数字段；GitHub tag 可能带 v 前缀。
 * 资产只保留下载用的 .exe，避免把源码包/校验文件塞进 UI。
 */

export function normalizeVersion(value) {
  return String(value ?? '').trim().replace(/^v/i, '');
}

/** a > b 返回 1，a < b 返回 -1，相等返回 0 */
export function compareVersions(a, b) {
  const pa = normalizeVersion(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = normalizeVersion(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * 从 GitHub Release assets 中挑出 Windows 安装包
 * @param {Array} assets
 * @returns {{ name: string, size: number, url: string }[]}
 */
export function pickUpdateAssets(assets) {
  if (!Array.isArray(assets)) return [];
  return assets
    .filter((a) => a && typeof a.name === 'string' && /\.exe$/i.test(a.name))
    .map((a) => ({
      name: a.name,
      size: Number(a.size) || 0,
      url: typeof a.browser_download_url === 'string' ? a.browser_download_url : '',
    }))
    .filter((a) => /^https:\/\//i.test(a.url))
    .sort((x, y) => x.name.localeCompare(y.name));
}

/** 按文件名后缀找资产（如 -setup.exe / -portable.exe），找不到返回 null */
export function findUpdateAsset(assets, suffix) {
  if (!Array.isArray(assets)) return null;
  const lower = String(suffix || '').toLowerCase();
  return assets.find((a) => String(a && a.name).toLowerCase().endsWith(lower)) || null;
}

const HTML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
};

/** 轻量 HTML 实体解码（GitHub Atom content 是转义后的 HTML） */
export function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|nbsp);|&#39;|&#x27;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m);
}

/** 把 GitHub Release 的 HTML 说明转成可读纯文本（用于无 API 时的回退） */
export function htmlToText(html) {
  return decodeHtmlEntities(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 按 class 提取一个 div 的内部 HTML（支持嵌套 div，用于 Release 页的 markdown-body）。
 * @param {string} html
 * @param {string} className
 * @returns {string}
 */
export function extractHtmlBlock(html, className) {
  const text = String(html ?? '');
  const start = new RegExp(`<div[^>]+class="[^"]*${className}[^"]*"[^>]*>`, 'i').exec(text);
  if (!start) return '';
  let depth = 1;
  let i = start.index + start[0].length;
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = i;
  let m;
  while ((m = tag.exec(text))) {
    if (m[0][1] === '/') depth--;
    else depth++;
    if (depth === 0) return text.slice(i, m.index);
  }
  return text.slice(i);
}

const SIZE_UNITS = { bytes: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

/**
 * 解析 GitHub `releases/expanded_assets/<tag>` 片段中的 .exe 资产。
 * 用于 GitHub API 限流 / 403 时的回退路径。
 * @param {string} html
 * @returns {{ name: string, size: number, url: string }[]}
 */
export function parseReleaseAssetsHtml(html) {
  const text = String(html ?? '');
  const out = [];
  for (const block of text.split(/<li\b/i)) {
    const href = /href="([^"]+\/releases\/download\/[^"]+\.exe)"/i.exec(block)?.[1];
    const name =
      /<span[^>]*class="[^"]*text-bold[^"]*"[^>]*>([^<]+)<\/span>/i.exec(block)?.[1] ||
      href?.split('/').pop();
    if (!href || !name) continue;
    const plain = block.replace(/<[^>]+>/g, ' ');
    const sizeMatch = /([\d.]+)\s*(Bytes|KB|MB|GB)/i.exec(plain);
    const size = sizeMatch
      ? Math.round(Number(sizeMatch[1]) * (SIZE_UNITS[sizeMatch[2].toLowerCase()] || 1))
      : 0;
    const url = href.startsWith('http') ? href : `https://github.com${href}`;
    if (!/^https:\/\//i.test(url)) continue;
    out.push({ name: decodeHtmlEntities(name).trim(), size, url });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

