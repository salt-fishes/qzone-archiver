/**
 * v4.9 §H 未登录首页打字机单测
 * ① 状态机（utils/typewriter.ts）：打字→停留→删字→下一条的完整周期、延迟序列、循环
 * ② SSR 守卫：未登录首页渲染打字机（aria-label=第一条）、已登录不渲染
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';
import { createTypewriter } from '../../src/renderer/src/utils/typewriter';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('motion-v', async () => {
  const { h: hh } = await import('vue');
  return { Motion: (props, { slots }) => hh('div', slots?.default?.()) };
});

const { default: HomeView } = await import('../../src/renderer/src/views/HomeView.vue');

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

const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

describe('§H① 打字机状态机', () => {
  it('完整周期：打字（typeMs×n）→ 停留 holdMs → 删字（deleteMs×n）→ 切下一条 startDelay，并循环', () => {
    const tw = createTypewriter(['AB', 'C'], { typeMs: 10, holdMs: 50, deleteMs: 5, startDelay: 20 });
    const trace = [];
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const delay = tw.step();
      trace.push({ text: tw.text, delay, phase: tw.phase, index: tw.index });
    }
    const texts = trace.map((t) => t.text);
    const delays = trace.map((t) => t.delay);

    // 第一条打字 A→AB
    expect(texts.slice(0, 2)).toEqual(['A', 'AB']);
    expect(delays.slice(0, 2)).toEqual([10, 10]);
    // 停留（text 保持完整）
    expect(trace[2].phase).toBe('holding');
    expect(delays[2]).toBe(50);
    expect(texts[2]).toBe('AB');
    // holding → deleting 切相位（text 未变），随后逐字删
    expect(trace[3].phase).toBe('deleting');
    expect(delays[3]).toBe(5);
    expect(texts[4]).toBe('A');
    expect(texts[5]).toBe('');
    // 删空后切第二条（index=1），延迟 startDelay
    expect(trace[6].index).toBe(1);
    expect(delays[6]).toBe(20);
    // 第二条打字
    expect(texts[7]).toBe('C');
    expect(delays[7]).toBe(10);
  });

  it('循环：最后一条删空后回到第一条', () => {
    const tw = createTypewriter(['X', 'Y'], { typeMs: 1, holdMs: 1, deleteMs: 1, startDelay: 2 });
    // X: typing 1 步 + holding 1 + deleting 切相 1 + 删 1 + 切条 1 = 5 步；Y 同 5 步
    for (let i = 0; i < 10; i++) tw.step();
    expect(tw.index).toBe(0); // 回到第一条
    expect(tw.text).toBe('');
    const d = tw.step();
    expect(d).toBe(1); // typing X 第一步
    expect(tw.text).toBe('X');
  });

  it('单条短语也循环（删空后重新打同一条）', () => {
    const tw = createTypewriter(['AB'], { typeMs: 1, holdMs: 1, deleteMs: 1, startDelay: 3 });
    for (let i = 0; i < 6; i++) tw.step(); // 打 2 + 停 1 + 删相 1 + 删 2 = 6
    expect(tw.index).toBe(0);
    expect(tw.text).toBe('');
    expect(tw.step()).toBe(3); // startDelay
  });
});

describe('§H② SSR 守卫', () => {
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

  it('未登录：渲染打字机（aria-label=第一条文案）', async () => {
    const html = stripComments(await renderHome());
    expect(html).toContain('typewriter');
    expect(html).toContain('把 QQ 空间的青春搬回自己硬盘');
  });

  it('已登录：不渲染打字机，显示问候语', async () => {
    const html = stripComments(
      await renderHome((a) => {
        a.loggedIn = true;
        a.qqNumber = '12345';
        a.nickname = '穗稔';
      })
    );
    expect(html).not.toContain('typewriter');
    expect(html).toContain('你好');
    expect(html).toContain('穗稔');
  });
});
