/**
 * 头像 / 表情渲染守卫（v4.7.5 回归）
 *
 * 1) TargetAvatar：拿到 data URL 后必须真渲染出 <img>。
 *    此前写法是 `<NAvatar :src="src">{{ 首字 }}</NAvatar>` —— naive-ui 的 NAvatar
 *    只要默认插槽非空就**只渲染文字、直接忽略 src**，于是取图链路（缓存/IPC/data URL）
 *    再通也永远只显示文字头像。本用例会真渲染组件，把这行为钉死。
 * 2) 静态守卫：任何 NAvatar 都不允许「同时给 :src 和默认插槽文字」（就是上面的坑）。
 * 3) 静态守卫：CSP 必须放行表情兜底用的腾讯 CDN，否则兜底链最后一级必被拦掉。
 *
 * 注意：naive-ui（vooks）在 node 下按 SSR 初始化，必须在 window 注入**之前**完成 import，
 * 否则 vooks 会以为在浏览器里、去摸 document 而抛错 —— 故这里用静态 import。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import TargetAvatar from '../../src/renderer/src/components/common/TargetAvatar.vue';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RENDERER_SRC = path.join(ROOT, 'src/renderer/src');

const DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJQA/9k=';

const getAvatar = vi.fn(async () => ({ ok: true, dataUrl: DATA_URL }));
const originalWindow = globalThis.window;

beforeAll(() => {
  // 渲染层通过 window.api 取头像（真实环境由 preload 注入）
  globalThis.window = { api: { avatars: { get: getAvatar } } };
});

afterAll(() => {
  globalThis.window = originalWindow;
});

const renderAvatar = (props) => renderToString(createSSRApp({ render: () => h(TargetAvatar, props) }));

/** SSR 输出会保留模板注释，断言前先剥掉（否则注释里的字样会干扰 contains 判断） */
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

/**
 * 找出「同时给了 src 和默认插槽文字」的 NAvatar（naive-ui 会静默忽略 src）。
 * 手写扫描而非正则配对：自闭合标签没有插槽，必须排除，否则会跨标签误配。
 */
function findNavatarOffenders(rawCode) {
  const code = rawCode.replace(/<!--[\s\S]*?-->/g, ''); // 注释里的示例代码不算
  const offenders = [];
  const openRe = /<NAvatar\b/g;
  let m;
  while ((m = openRe.exec(code)) !== null) {
    // 扫描到开始标签的 '>'（跳过属性引号内的字符）
    let i = m.index + m[0].length;
    let quote = null;
    let tagEnd = -1;
    for (; i < code.length; i++) {
      const ch = code[i];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === '>') {
        tagEnd = i;
        break;
      }
    }
    if (tagEnd === -1) break;
    const selfClosing = code[tagEnd - 1] === '/';
    const attrs = code.slice(m.index + m[0].length, selfClosing ? tagEnd - 1 : tagEnd);
    if (selfClosing) continue; // 自闭合 → 没有默认插槽
    const closeIdx = code.indexOf('</NAvatar>', tagEnd);
    if (closeIdx === -1) continue;
    const body = code
      .slice(tagEnd + 1, closeIdx)
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    if (body && /(?::src|:img-props|\bsrc=)/.test(attrs)) {
      offenders.push(`<NAvatar${attrs.trim().replace(/\s+/g, ' ')}>${body.slice(0, 24)}…`);
    }
  }
  return offenders;
}

function walkVue(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkVue(p, acc);
    else if (e.name.endsWith('.vue')) acc.push(p);
  }
  return acc;
}

describe('TargetAvatar 渲染', () => {
  it('IPC 返回 data URL 后渲染 <img>，而不是文字头像', async () => {
    // 首次渲染：还没拿到图 → 首字占位
    const first = stripComments(await renderAvatar({ uin: '1906986796', label: '穗稔', size: 30 }));
    expect(first).toContain('穗');
    expect(first).not.toContain('<img');

    // 等 IPC promise 落定 + 响应式缓存写入
    await new Promise((r) => setTimeout(r, 30));

    const second = stripComments(await renderAvatar({ uin: '1906986796', label: '穗稔', size: 30 }));
    expect(second, `头像应渲染为 <img>，实际输出：${second}`).toContain('<img');
    expect(second).toContain(DATA_URL);
  });

  it('取不到图时回落首字占位，且会剥掉昵称里的表情代码（不再显示 "["）', async () => {
    getAvatar.mockResolvedValueOnce({ ok: false, dataUrl: null });
    const html = stripComments(
      await renderAvatar({ uin: '1234567890', label: '[em]e327806[/em]穗稔', size: 30 })
    );
    expect(html).toContain('穗');
    expect(html).not.toContain('>[');
    expect(html).not.toContain('<img');
  });
});

describe('渲染层静态守卫', () => {
  it('NAvatar 不允许同时带 :src 和默认插槽文字（会静默忽略 src）', () => {
    const offenders = [];
    for (const file of walkVue(RENDERER_SRC)) {
      const code = fs.readFileSync(file, 'utf8');
      for (const o of findNavatarOffenders(code)) {
        offenders.push(`${path.relative(ROOT, file).split(path.sep).join('/')} → ${o}`);
      }
    }
    expect(
      offenders,
      `以下 NAvatar 同时给了 src 和文字插槽 —— 图会被文字顶掉（改用 render-fallback）：\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('CSP 放行表情兜底 CDN（否则兜底链最后一级必被拦掉）', () => {
    const html = fs.readFileSync(path.join(ROOT, 'src/renderer/index.html'), 'utf8');
    const m = /img-src([^;"]*)/.exec(html);
    expect(m, 'index.html 未声明 img-src').toBeTruthy();
    expect(m[1]).toContain("'self'");
    expect(m[1]).toContain('data:');
    expect(m[1], 'img-src 未放行 qzonestyle.gtimg.cn，表情 CDN 兜底会被 CSP 拦掉').toContain(
      'qzonestyle.gtimg.cn'
    );
  });
});
