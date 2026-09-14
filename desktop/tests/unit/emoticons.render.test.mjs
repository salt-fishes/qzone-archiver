/**
 * EmoticonText 渲染验证（v4.7 反馈 ②）
 *
 * 背景：界面昵称里的 `[em]e327806[/em]` 显示不出来，而肉眼排查多次都没定位到。
 * 这里用 Vue SSR 真渲染一遍组件，把输出 HTML 打印出来 —— 用事实替代猜测：
 * 期望输出 <img src="./emoticons/qq/e327806.png">，而不是原始代码文本。
 */
import { describe, it, expect } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import EmoticonText from '../../src/renderer/src/components/common/EmoticonText.vue';

async function render(text, size = 16) {
  const app = createSSRApp({ render: () => h(EmoticonText, { text, size }) });
  return renderToString(app);
}

describe('EmoticonText 渲染', () => {
  it('魔法表情渲染为本地 png（真实文件名）', async () => {
    const html = await render('穗稔[em]e327806[/em]');
    console.log('[EmoticonText] 输出:', html);
    expect(html).toContain('穗稔');
    expect(html).toContain('./emoticons/qq/e327806.png');
    // 表情代码只应出现在 alt/data-alt（加载失败时的兜底文本），不能作为可见文本节点输出
    expect(html).toContain('data-alt="[em]e327806[/em]"');
    expect(html).not.toMatch(/>\[em\]e327806\[\/em\]</);
  });

  it('经典表情渲染为本地 gif', async () => {
    const html = await render('你好[em]e100[/em]');
    console.log('[EmoticonText] 输出:', html);
    expect(html).toContain('./emoticons/qq/e100.gif');
    expect(html).not.toMatch(/>\[em\]e100\[\/em\]</);
  });

  it('未收录的 id 回落 CDN', async () => {
    const html = await render('[em]e999999[/em]');
    expect(html).toContain('qzonestyle.gtimg.cn/qzone/em/e999999.gif');
  });

  it('普通文本不产生 img', async () => {
    const html = await render('普通昵称');
    expect(html).toContain('普通昵称');
    expect(html).not.toContain('<img');
  });
});
