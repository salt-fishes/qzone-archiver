/**
 * 检查更新 store（v5.5）：
 * - 手动触发 GitHub Releases 查询，不做自动轮询、不自动下载；
 * - 保存当前版本 / 最近一次检查结果，供「检查更新」页与设置页共用。
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export interface UpdateAsset {
  name: string;
  size: number;
  url: string;
}

export interface UpdateInfo {
  ok: boolean;
  current?: string;
  latest?: string;
  hasUpdate?: boolean;
  url?: string;
  name?: string;
  notes?: string;
  publishedAt?: string | null;
  assets?: UpdateAsset[];
  error?: string;
}

export const useUpdateStore = defineStore('update', () => {
  const currentVersion = ref('');
  const platform = ref('');
  const arch = ref('');
  const checking = ref(false);
  const info = ref<UpdateInfo | null>(null);
  const error = ref('');
  const checkedAt = ref<number | null>(null);

  const setupAsset = computed<UpdateAsset | null>(() => {
    const list = info.value?.assets || [];
    return list.find((a) => a.name.toLowerCase().endsWith('-setup.exe')) || null;
  });

  const portableAsset = computed<UpdateAsset | null>(() => {
    const list = info.value?.assets || [];
    return list.find((a) => a.name.toLowerCase().endsWith('-portable.exe')) || null;
  });

  const displayVersion = computed(() => info.value?.current || currentVersion.value || '—');

  let loadedInfo = false;
  async function loadAppInfo() {
    if (loadedInfo) return;
    loadedInfo = true;
    try {
      const r = await window.api.app.getInfo();
      currentVersion.value = r.version;
      platform.value = r.platform;
      arch.value = r.arch;
    } catch {
      loadedInfo = false;
    }
  }

  async function check() {
    if (checking.value) return;
    checking.value = true;
    error.value = '';
    try {
      const r = await window.api.app.checkUpdate();
      info.value = r;
      checkedAt.value = Date.now();
      if (!r.ok) error.value = r.error || '检查更新失败';
      if (r.current) currentVersion.value = r.current;
    } catch (e: any) {
      info.value = null;
      error.value = e?.message || String(e);
      checkedAt.value = Date.now();
    } finally {
      checking.value = false;
    }
  }

  function open(url?: string) {
    if (url) void window.api.app.openExternal(url);
  }

  return {
    currentVersion,
    platform,
    arch,
    checking,
    info,
    error,
    checkedAt,
    setupAsset,
    portableAsset,
    displayVersion,
    loadAppInfo,
    check,
    open,
  };
});
