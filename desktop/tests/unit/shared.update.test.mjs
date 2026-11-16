import { describe, it, expect } from 'vitest';
import {
  compareVersions,
  normalizeVersion,
  pickUpdateAssets,
  findUpdateAsset,
  htmlToText,
  extractHtmlBlock,
  parseReleaseAssetsHtml,
} from '../../src/shared/update.mjs';

describe('shared/update 版本比较', () => {
  it('normalizeVersion 去空白与 v 前缀', () => {
    expect(normalizeVersion(' v5.5.0 ')).toBe('5.5.0');
    expect(normalizeVersion(null)).toBe('');
  });

  it('compareVersions 比较主/次/补丁版本', () => {
    expect(compareVersions('5.5.0', '5.4.0')).toBe(1);
    expect(compareVersions('v5.5.0', '5.5.0')).toBe(0);
    expect(compareVersions('5.5.0', '5.5.1')).toBe(-1);
    expect(compareVersions('5.5', '5.5.0')).toBe(0);
  });
});

describe('shared/update 资产筛选', () => {
  const assets = [
    { name: 'QZoneArchiver-5.5.0-setup.exe', size: 122221076, browser_download_url: 'https://github.com/a/setup.exe' },
    { name: 'QZoneArchiver-5.5.0-portable.exe', size: 121913843, browser_download_url: 'https://github.com/a/portable.exe' },
    { name: 'source.zip', size: 10, browser_download_url: 'https://github.com/a/source.zip' },
    { name: 'bad.exe', size: 1, browser_download_url: 'http://insecure/bad.exe' },
  ];

  it('只保留 https 的 .exe，并按名称排序', () => {
    const picked = pickUpdateAssets(assets);
    expect(picked.map((a) => a.name)).toEqual([
      'QZoneArchiver-5.5.0-portable.exe',
      'QZoneArchiver-5.5.0-setup.exe',
    ]);
    expect(picked[0].size).toBe(121913843);
  });

  it('按后缀找安装版 / 免安装版', () => {
    const picked = pickUpdateAssets(assets);
    expect(findUpdateAsset(picked, '-setup.exe')?.name).toContain('setup');
    expect(findUpdateAsset(picked, '-portable.exe')?.name).toContain('portable');
    expect(findUpdateAsset(picked, '-missing.exe')).toBeNull();
  });

  it('非数组输入返回空', () => {
    expect(pickUpdateAssets(null)).toEqual([]);
    expect(pickUpdateAssets(undefined)).toEqual([]);
  });
});

describe('shared/update 网页回退解析', () => {
  it('解析 expanded_assets 中的 exe 名称、大小与绝对下载地址', () => {
    const html = `
      <li data-view-component="true" class="Box-row">
        <a href="/salt-fishes/qzone-archiver/releases/download/v5.5.0/QZoneArchiver-5.5.0-portable.exe">
          <span class="text-bold">QZoneArchiver-5.5.0-portable.exe</span>
        </a>
        <span>116 MB</span>
      </li>
      <li data-view-component="true" class="Box-row">
        <a href="/salt-fishes/qzone-archiver/releases/download/v5.5.0/QZoneArchiver-5.5.0-setup.exe">
          <span class="text-bold">QZoneArchiver-5.5.0-setup.exe</span>
        </a>
        <span>117 MB</span>
      </li>`;
    const assets = parseReleaseAssetsHtml(html);
    expect(assets.map((a) => a.name)).toEqual([
      'QZoneArchiver-5.5.0-portable.exe',
      'QZoneArchiver-5.5.0-setup.exe',
    ]);
    expect(assets[0].url).toBe(
      'https://github.com/salt-fishes/qzone-archiver/releases/download/v5.5.0/QZoneArchiver-5.5.0-portable.exe'
    );
    expect(assets[0].size).toBe(116 * 1024 * 1024);
  });

  it('Atom 转义 HTML 转为纯文本', () => {
    const escaped = '&lt;h2&gt;本次更新&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;修复 A&lt;/li&gt;&lt;li&gt;修复 B&lt;/li&gt;&lt;/ul&gt;';
    const text = htmlToText(escaped);
    expect(text).toContain('本次更新');
    expect(text).toContain('修复 A');
    expect(text).toContain('修复 B');
    expect(text).not.toContain('<h2>');
  });

  it('按 class 提取嵌套 div（Release 页 markdown-body）', () => {
    const html = `
      <div class="Box"><div class="markdown-body tmp-my-3">
        <h1>v5.5.0 发布说明</h1>
        <div class="highlight"><pre>code</pre></div>
        <p>正文</p>
      </div><div class="after">忽略</div></div>`;
    const block = extractHtmlBlock(html, 'markdown-body');
    expect(block).toContain('发布说明');
    expect(block).toContain('正文');
    expect(block).toContain('code');
    expect(block).not.toContain('忽略');
  });
});
