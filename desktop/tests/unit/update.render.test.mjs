/**
 * v5.5 检查更新页 SSR 守卫：已是最新 / 发现新版本 / 检查失败三态
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';

const { default: UpdateView } = await import('../../src/renderer/src/views/UpdateView.vue');

const originalWindow = globalThis.window;

beforeAll(() => {
  globalThis.window = {
    api: {
      app: {
        getInfo: async () => ({ version: '5.5.0', platform: 'win32', arch: 'x64' }),
        checkUpdate: async () => ({ ok: true, current: '5.5.0', latest: '5.5.0', hasUpdate: false }),
        openExternal: async () => {},
      },
    },
  };
});

afterAll(() => {
  globalThis.window = originalWindow;
});

async function renderUpdate(setup) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const { useUpdateStore } = await import('../../src/renderer/src/stores/update');
  const store = useUpdateStore();
  store.currentVersion = '5.5.0';
  setup?.(store);
  const app = createSSRApp({ render: () => h(UpdateView) });
  app.use(pinia);
  return renderToString(app);
}

const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

describe('检查更新页三态', () => {
  it('已是最新版本：显示当前版本与发布页入口', async () => {
    const html = stripComments(
      await renderUpdate((s) => {
        s.info = {
          ok: true,
          current: '5.5.0',
          latest: '5.5.0',
          hasUpdate: false,
          url: 'https://github.com/salt-fishes/qzone-archiver/releases/tag/v5.5.0',
        };
      })
    );
    expect(html).toContain('已是最新版本');
    expect(html).toContain('5.5.0');
    expect(html).toContain('查看发布页');
  });

  it('发现新版本：显示更新说明与安装包下载按钮', async () => {
    const html = stripComments(
      await renderUpdate((s) => {
        s.info = {
          ok: true,
          current: '5.5.0',
          latest: '5.6.0',
          hasUpdate: true,
          url: 'https://github.com/salt-fishes/qzone-archiver/releases/tag/v5.6.0',
          name: 'v5.6.0',
          notes: '本次更新\n- 修复 A',
          assets: [
            { name: 'QZoneArchiver-5.6.0-setup.exe', size: 100, url: 'https://github.com/a/setup.exe' },
            { name: 'QZoneArchiver-5.6.0-portable.exe', size: 90, url: 'https://github.com/a/portable.exe' },
          ],
        };
      })
    );
    expect(html).toContain('发现新版本 v5.6.0');
    expect(html).toContain('下载安装版');
    expect(html).toContain('下载免安装版');
    expect(html).toContain('修复 A');
  });

  it('检查失败：显示错误文案与重新检查', async () => {
    const html = stripComments(
      await renderUpdate((s) => {
        s.info = { ok: false, current: '5.5.0', error: 'GitHub API 查询失败（HTTP 403）' };
        s.error = 'GitHub API 查询失败（HTTP 403）';
      })
    );
    expect(html).toContain('检查失败');
    expect(html).toContain('HTTP 403');
    expect(html).toContain('重新检查');
  });
});
