/**
 * v5.5 检查更新 store：当前版本加载、手动检查成功/失败、安装包筛选
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const getInfo = vi.fn();
const checkUpdate = vi.fn();
const openExternal = vi.fn(async () => {});

const { useUpdateStore } = await import('../../src/renderer/src/stores/update');

const originalWindow = globalThis.window;

beforeAll(() => {
  globalThis.window = {
    api: {
      app: { getInfo, checkUpdate, openExternal },
    },
  };
});

afterAll(() => {
  globalThis.window = originalWindow;
});

beforeEach(() => {
  vi.clearAllMocks();
  getInfo.mockResolvedValue({ version: '5.5.0', platform: 'win32', arch: 'x64' });
});

function makeStore() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return useUpdateStore();
}

describe('检查更新 store', () => {
  it('加载当前版本与平台信息', async () => {
    const s = makeStore();
    await s.loadAppInfo();
    expect(s.currentVersion).toBe('5.5.0');
    expect(s.platform).toBe('win32');
    expect(s.displayVersion).toBe('5.5.0');
  });

  it('检查成功：保存最新版本并挑出安装版/免安装版', async () => {
    checkUpdate.mockResolvedValue({
      ok: true,
      current: '5.5.0',
      latest: '5.6.0',
      hasUpdate: true,
      url: 'https://github.com/x/releases/tag/v5.6.0',
      assets: [
        { name: 'QZoneArchiver-5.6.0-setup.exe', size: 100, url: 'https://github.com/a/setup.exe' },
        { name: 'QZoneArchiver-5.6.0-portable.exe', size: 90, url: 'https://github.com/a/portable.exe' },
      ],
    });
    const s = makeStore();
    await s.check();
    expect(s.info?.hasUpdate).toBe(true);
    expect(s.setupAsset?.name).toContain('setup');
    expect(s.portableAsset?.name).toContain('portable');
    expect(s.checkedAt).toBeTypeOf('number');
    expect(s.error).toBe('');
  });

  it('检查失败：保留错误文案，不抛给页面', async () => {
    checkUpdate.mockResolvedValue({ ok: false, current: '5.5.0', error: 'HTTP 403' });
    const s = makeStore();
    await s.check();
    expect(s.error).toBe('HTTP 403');
    expect(s.checking).toBe(false);
  });

  it('IPC 异常：转为错误文案', async () => {
    checkUpdate.mockRejectedValue(new Error('network down'));
    const s = makeStore();
    await s.check();
    expect(s.error).toBe('network down');
    expect(s.info).toBeNull();
  });
});
