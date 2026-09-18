/**
 * v4.9 §A 渲染层两态守卫（SSR）：有昵称 / 无昵称的首页问候与本人卡片
 *
 * 根因：无昵称时首页只显示孤零零的「你好」、本人卡片上下两行都是 QQ 号。
 * 复用 avatars.render.test.mjs 的 SSR 手法（naive-ui 须在 window 注入前完成 import，
 * 故用静态 import + beforeAll 再注入 window）。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// motion-v 在 node SSR 下不稳定，替身为透传 div（本测试只关心文案结构）
vi.mock('motion-v', async () => {
  const { h: hh } = await import('vue');
  return {
    Motion: (props, { slots }) => hh('div', slots?.default?.()),
  };
});

const { default: HomeView } = await import('../../src/renderer/src/views/HomeView.vue');
const { default: TargetPicker } = await import('../../src/renderer/src/components/task/TargetPicker.vue');

const originalWindow = globalThis.window;

beforeAll(() => {
  globalThis.window = {
    api: {
      backup: { getHistory: async () => ({ history: [] }) },
      avatars: { get: async () => ({ ok: false, dataUrl: null }) },
      on: () => () => {},
    },
  };
});

afterAll(() => {
  globalThis.window = originalWindow;
});

/** 渲染首页（每次新 pinia，可先在 active pinia 上布置 auth 状态） */
async function renderHome(setupAuth) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const { useAuthStore } = await import('../../src/renderer/src/stores/auth');
  if (setupAuth) {
    const s = useAuthStore();
    setupAuth(s.auth);
  }
  const app = createSSRApp({ render: () => h(HomeView) });
  app.use(pinia);
  return renderToString(app);
}

/** 渲染向导第①步（默认 self 模式 → 本人卡片） */
async function renderPicker(setupAuth) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const { useAuthStore } = await import('../../src/renderer/src/stores/auth');
  const { useTargetStore } = await import('../../src/renderer/src/stores/target');
  if (setupAuth) {
    const s = useAuthStore();
    setupAuth(s.auth);
  }
  useTargetStore();
  const app = createSSRApp({ render: () => h(TargetPicker) });
  app.use(pinia);
  return renderToString(app);
}

/** SSR 输出会保留模板注释，断言前先剥掉 */
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

describe('§A 首页问候两态', () => {
  it('有昵称：你好，<昵称>', async () => {
    const html = stripComments(
      await renderHome((a) => {
        a.loggedIn = true;
        a.qqNumber = '12345';
        a.nickname = '穗稔';
      })
    );
    expect(html).toContain('你好');
    expect(html).toContain('穗稔');
  });

  it('无昵称：你好，QQ 12345（不再是孤零零的「你好」）', async () => {
    const html = stripComments(
      await renderHome((a) => {
        a.loggedIn = true;
        a.qqNumber = '12345';
        a.nickname = undefined;
      })
    );
    expect(html).toContain('你好');
    expect(html, `实际输出：${html}`).toMatch(/你好\s*，\s*QQ 12345/);
  });

  it('未登录：显示登录引导而非问候语', async () => {
    const html = stripComments(await renderHome());
    expect(html).toContain('扫码登录');
    expect(html).not.toContain('你好');
  });
});

describe('§A 本人卡片两态（TargetPicker）', () => {
  it('无昵称：主行 QQ 12345、副行只写「已登录」（不再两行 QQ 号）', async () => {
    const html = stripComments(
      await renderPicker((a) => {
        a.loggedIn = true;
        a.qqNumber = '12345';
      })
    );
    expect(html).toContain('QQ 12345');
    expect(html).toContain('已登录');
    // 旧 bug：主行与副行各出现一次 QQ 号（上下两行都是号码）
    expect(html.split('QQ 12345').length - 1).toBe(1);
  });

  it('有昵称：主行昵称、副行 QQ 12345 · 已登录', async () => {
    const html = stripComments(
      await renderPicker((a) => {
        a.loggedIn = true;
        a.qqNumber = '12345';
        a.nickname = '穗稔';
      })
    );
    expect(html).toContain('穗稔');
    expect(html).toContain('QQ 12345 · 已登录');
  });
});
