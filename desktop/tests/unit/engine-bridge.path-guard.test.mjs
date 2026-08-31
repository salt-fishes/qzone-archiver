/**
 * P1-5 首批单测（§8.2）：resolveEnginePath 路径映射与穿越防护
 * engine-bridge.js 间接依赖 electron（windows.js/state-store.js），此处 mock。
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/userData' },
  BrowserWindow: class {},
  shell: { openExternal: async () => {} },
}));

const { resolveEnginePath, setActiveBackup, clearActiveBackup } = await import(
  '../../src/main/services/engine-bridge.js'
);

describe('resolveEnginePath', () => {
  it('未设置 targetDir 时抛错', () => {
    clearActiveBackup();
    expect(() => resolveEnginePath('/QQ空间备份/a.jpg')).toThrow(/备份目标目录未设置/);
  });

  it('基础映射：Filer 虚拟根前缀剥离', () => {
    setActiveBackup({ targetDir: 'D:/backups' });
    expect(resolveEnginePath('/QQ空间备份_uin123/Photos/a.jpg')).toBe(
      'D:\\backups\\Photos\\a.jpg',
    );
  });

  it('无前缀相对路径直接挂到根', () => {
    setActiveBackup({ targetDir: 'D:/backups' });
    expect(resolveEnginePath('Photos/a.jpg')).toBe('D:\\backups\\Photos\\a.jpg');
  });

  it('根路径与空路径映射到根目录', () => {
    setActiveBackup({ targetDir: 'D:/backups' });
    expect(resolveEnginePath('/QQ空间备份')).toBe('D:\\backups');
    expect(resolveEnginePath('')).toBe('D:\\backups');
  });

  it('反斜杠规范化为分隔符', () => {
    setActiveBackup({ targetDir: 'D:/backups' });
    expect(resolveEnginePath('/QQ空间备份\\Blogs\\x.md')).toBe('D:\\backups\\Blogs\\x.md');
  });

  it('穿越攻击被拒绝（../ 越出根目录）', () => {
    setActiveBackup({ targetDir: 'D:/backups' });
    expect(() => resolveEnginePath('/QQ空间备份/../../etc/passwd')).toThrow(/非法路径/);
  });

  it('穿越攻击被拒绝（前缀剥离后 ../）', () => {
    setActiveBackup({ targetDir: 'D:/backups' });
    expect(() => resolveEnginePath('/QQ空间备份/..')).toThrow(/非法路径/);
  });

  it('根目录内的合法子路径不受影响（含 . 分段）', () => {
    setActiveBackup({ targetDir: 'D:/backups' });
    expect(resolveEnginePath('/QQ空间备份/./Diaries/d.md')).toBe(
      'D:\\backups\\Diaries\\d.md',
    );
  });
});
