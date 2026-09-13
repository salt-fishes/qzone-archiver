/**
 * 外观 store（v4.6 C 端化）：浅色/深色主题切换，持久化到应用配置（config:set）
 * 独立于 config store：仅存 appearance 键，不参与引擎配置构建
 */
import { ref, watch } from 'vue';
import { defineStore } from 'pinia';

export type ThemeMode = 'light' | 'dark';

export const useAppearanceStore = defineStore('appearance', () => {
  const theme = ref<ThemeMode>('light');

  let loaded = false;

  /** 恢复已保存的主题（App.vue onMounted 调用） */
  async function initAppearance() {
    if (loaded) return;
    try {
      const c = await window.api.config.get();
      if (c?.appearance === 'dark' || c?.appearance === 'light') {
        theme.value = c.appearance;
      }
    } catch (e) {
      console.warn('读取主题配置失败', e);
    }
    loaded = true;
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
  }

  // 主题变化即持久化（init 前的意外变更不会发生：仅 UI 触发 toggle）
  watch(theme, (v) => {
    window.api.config.set({ appearance: v }).catch((e) => console.warn('保存主题失败', e));
  });

  return { theme, initAppearance, toggleTheme };
});
