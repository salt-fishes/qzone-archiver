/**
 * v4.9 §D 主题跟随系统单测：auto 解析 / change 切换 / 持久化 / 旧值兼容
 * window.matchMedia 伪造为可受控对象（matches + addEventListener/removeEventListener）。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

let matches = false;
let changeListener = null;

const fakeMql = {
  get matches() {
    return matches;
  },
  addEventListener: (_t, fn) => {
    changeListener = fn;
  },
  removeEventListener: () => {
    changeListener = null;
  },
};

const configSet = vi.fn(async () => ({}));
let savedAppearance;

const { useAppearanceStore } = await import('../../src/renderer/src/stores/appearance');

const originalWindow = globalThis.window;

beforeAll(() => {
  globalThis.window = {
    matchMedia: vi.fn(() => fakeMql),
    api: {
      config: {
        get: async () => ({ appearance: savedAppearance }),
        set: configSet,
      },
    },
  };
});

afterAll(() => {
  globalThis.window = originalWindow;
});

beforeEach(() => {
  vi.clearAllMocks();
  matches = false;
  savedAppearance = undefined;
});

function makeStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return useAppearanceStore();
}

describe('§D 主题三态与 resolvedTheme', () => {
  it('默认 auto：跟随系统（深色系统 → dark）', async () => {
    matches = true;
    const s = makeStore();
    expect(s.theme).toBe('auto');
    expect(s.resolvedTheme).toBe('dark');
  });

  it('auto 下系统切换 change 事件 → resolvedTheme 实时跟随', async () => {
    matches = true;
    const s = makeStore();
    await s.initAppearance();
    expect(changeListener).toBeTypeOf('function');
    changeListener({ matches: false });
    expect(s.resolvedTheme).toBe('light');
    changeListener({ matches: true });
    expect(s.resolvedTheme).toBe('dark');
  });

  it('显式 light/dark 不受系统影响', async () => {
    matches = true;
    const s = makeStore();
    s.setTheme('light');
    expect(s.resolvedTheme).toBe('light');
    s.setTheme('dark');
    expect(s.resolvedTheme).toBe('dark');
  });

  it('旧值 light/dark 继续有效', async () => {
    savedAppearance = 'dark';
    const s = makeStore();
    await s.initAppearance();
    expect(s.theme).toBe('dark');
    expect(s.resolvedTheme).toBe('dark');
  });

  it('主题变化持久化到 config:set', async () => {
    const s = makeStore();
    s.setTheme('dark');
    await new Promise((r) => setTimeout(r, 0));
    expect(configSet).toHaveBeenCalledWith({ appearance: 'dark' });
    s.setTheme('auto');
    await new Promise((r) => setTimeout(r, 0));
    expect(configSet).toHaveBeenCalledWith({ appearance: 'auto' });
  });

  it('无 matchMedia（异常环境）不抛错且不跟随系统', () => {
    const original = globalThis.window;
    globalThis.window = {};
    try {
      const s = makeStore();
      expect(s.resolvedTheme).toBe('light'); // auto 但系统未知 → light
    } finally {
      globalThis.window = original;
    }
  });
});
