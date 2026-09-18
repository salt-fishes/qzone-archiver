/**
 * 外观 store（v4.6 C 端化）：浅色/深色主题切换，持久化到应用配置（config:set）
 * 独立于 config store：仅存 appearance 键，不参与引擎配置构建
 *
 * v4.9 §D 主题跟随系统：
 *  - ThemeMode 扩展为 'auto' | 'light' | 'dark'，旧值 light/dark 继续有效，新默认 auto
 *  - resolvedTheme 为实际生效主题：auto 时读 matchMedia('(prefers-color-scheme: dark)')
 *    并监听系统切换（监听为应用级，绑定一次常驻；unbind 供单测复位）
 *  - systemDark 在 store 创建时同步读一次，首屏即按系统预判，避免深色用户看到浅色闪屏
 */
import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';

export type ThemeMode = 'auto' | 'light' | 'dark';

/** 同步读系统深色偏好（SSR/无 matchMedia 环境返回 false） */
function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export const useAppearanceStore = defineStore('appearance', () => {
  const theme = ref<ThemeMode>('auto');
  /** 系统当前是否深色（change 事件实时更新） */
  const systemDark = ref(systemPrefersDark());

  /** §D：实际生效主题（消费端一律读这个，避免各处重复判断） */
  const resolvedTheme = computed<'light' | 'dark'>(() => {
    if (theme.value === 'auto') return systemDark.value ? 'dark' : 'light';
    return theme.value;
  });

  let loaded = false;
  let mql: MediaQueryList | null = null;
  let onChange: ((e: { matches: boolean }) => void) | null = null;

  /** 绑定系统主题切换监听（幂等；window 不存在时静默跳过，便于单测） */
  function bindSystemTheme() {
    if (mql) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    mql = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark.value = mql.matches;
    onChange = (e) => {
      systemDark.value = e.matches;
    };
    const anyMql = mql as unknown as {
      addEventListener?: (type: string, listener: (e: { matches: boolean }) => void) => void;
      addListener?: (listener: (e: { matches: boolean }) => void) => void;
    };
    if (typeof anyMql.addEventListener === 'function') {
      anyMql.addEventListener('change', onChange);
    } else if (typeof anyMql.addListener === 'function') {
      anyMql.addListener(onChange); // 旧版 API 兜底
    }
  }

  /** 解绑监听（应用常驻无需调用；单测复位用） */
  function unbindSystemTheme() {
    if (!mql || !onChange) return;
    const anyMql = mql as unknown as {
      removeEventListener?: (type: string, listener: (e: { matches: boolean }) => void) => void;
      removeListener?: (listener: (e: { matches: boolean }) => void) => void;
    };
    if (typeof anyMql.removeEventListener === 'function') {
      anyMql.removeEventListener('change', onChange);
    } else if (typeof anyMql.removeListener === 'function') {
      anyMql.removeListener(onChange);
    }
    mql = null;
    onChange = null;
  }

  /** 恢复已保存的主题（App.vue onMounted 调用） */
  async function initAppearance() {
    if (loaded) return;
    bindSystemTheme();
    try {
      const c = await window.api.config.get();
      if (c?.appearance === 'dark' || c?.appearance === 'light' || c?.appearance === 'auto') {
        theme.value = c.appearance;
      }
    } catch (e) {
      console.warn('读取主题配置失败', e);
    }
    loaded = true;
  }

  /** v4.9 §D：显式设置主题（顶栏下拉 / 设置页共用入口） */
  function setTheme(mode: ThemeMode) {
    theme.value = mode;
  }

  // 主题变化即持久化（init 前的意外变更不会发生：仅 UI 触发 setTheme）
  watch(theme, (v) => {
    window.api.config.set({ appearance: v }).catch((e) => console.warn('保存主题失败', e));
  });

  return {
    theme,
    resolvedTheme,
    initAppearance,
    setTheme,
    bindSystemTheme,
    unbindSystemTheme,
  };
});
