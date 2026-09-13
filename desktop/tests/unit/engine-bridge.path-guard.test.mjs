/**
 * P1-5 首批单测（§8.2）+ P5.1/P5.2 更新：resolveEnginePath 路径映射与穿越防护、
 * 任务上下文注册表（Map<taskId, Ctx>）。
 * engine-bridge.js 间接依赖 electron（windows.js/state-store.js），此处 mock。
 */
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/userData' },
  BrowserWindow: class {},
  shell: { openExternal: async () => {} },
}));

const { resolveEnginePath, registerTaskContext, getTaskContext, getActiveTaskContext, dropTaskContext } =
  await import('../../src/main/services/engine-bridge.js');
const { resolveWithin, assertWithin } = await import('../../src/main/services/path-guard.js');

describe('resolveEnginePath', () => {
  it('未设置 targetDir 时抛错', () => {
    dropTaskContext();
    expect(() => resolveEnginePath('/QQ空间备份/a.jpg')).toThrow(/备份目标目录未设置/);
  });

  it('基础映射：Filer 虚拟根前缀剥离', () => {
    registerTaskContext({ taskId: 't1', targetDir: 'D:/backups' });
    expect(resolveEnginePath('/QQ空间备份_uin123/Photos/a.jpg')).toBe(
      path.resolve('D:/backups', 'Photos/a.jpg'),
    );
  });

  it('无前缀相对路径直接挂到根', () => {
    registerTaskContext({ taskId: 't1', targetDir: 'D:/backups' });
    expect(resolveEnginePath('Photos/a.jpg')).toBe(path.resolve('D:/backups', 'Photos/a.jpg'));
  });

  it('根路径与空路径映射到根目录', () => {
    registerTaskContext({ taskId: 't1', targetDir: 'D:/backups' });
    expect(resolveEnginePath('/QQ空间备份')).toBe(path.resolve('D:/backups'));
    expect(resolveEnginePath('')).toBe(path.resolve('D:/backups'));
  });

  it('反斜杠规范化为分隔符', () => {
    registerTaskContext({ taskId: 't1', targetDir: 'D:/backups' });
    expect(resolveEnginePath('/QQ空间备份\\Blogs\\x.md')).toBe(path.resolve('D:/backups', 'Blogs/x.md'));
  });

  it('穿越攻击被拒绝（../ 越出根目录）', () => {
    registerTaskContext({ taskId: 't1', targetDir: 'D:/backups' });
    expect(() => resolveEnginePath('/QQ空间备份/../../etc/passwd')).toThrow(/非法路径/);
  });

  it('穿越攻击被拒绝（前缀剥离后 ../）', () => {
    registerTaskContext({ taskId: 't1', targetDir: 'D:/backups' });
    expect(() => resolveEnginePath('/QQ空间备份/..')).toThrow(/非法路径/);
  });

  it('根目录内的合法子路径不受影响（含 . 分段）', () => {
    registerTaskContext({ taskId: 't1', targetDir: 'D:/backups' });
    expect(resolveEnginePath('/QQ空间备份/./Diaries/d.md')).toBe(
      path.resolve('D:/backups', 'Diaries/d.md'),
    );
  });
});

describe('path-guard.resolveWithin（P5.1 收敛点：resource-read 语义）', () => {
  const base = 'D:/app-resources';

  it('基目录内相对路径正常解析', () => {
    expect(resolveWithin(base, 'vendor/jquery/jquery.min.js')).toBe(
      path.resolve(base, 'vendor/jquery/jquery.min.js'),
    );
  });

  it('越界 ../ 返回 null（不抛错，resource-read 转换为 INVALID_PATH）', () => {
    expect(resolveWithin(base, '../package.json')).toBeNull();
    expect(resolveWithin(base, 'a/../../x')).toBeNull();
    expect(resolveWithin(base, '..\\x')).toBeNull();
  });

  it('隐藏穿越（子目录中段 ../）返回 null', () => {
    expect(resolveWithin(base, 'vendor/../../../../etc/passwd')).toBeNull();
  });

  it('空路径解析到基目录本身', () => {
    expect(resolveWithin(base, '')).toBe(path.resolve(base));
  });

  it('assertWithin 对越界抛错（fs 映射语义）', () => {
    expect(() => assertWithin(base, '../escape')).toThrow(/非法路径/);
    expect(assertWithin(base, 'css/common.css')).toBe(path.resolve(base, 'css/common.css'));
  });
});

describe('任务上下文注册表（P5.2 §7.2）', () => {
  it('register → get → drop 生命周期', () => {
    registerTaskContext({ taskId: 'task-a', targetDir: 'D:/a', modules: ['Messages'] });
    expect(getActiveTaskContext()).toMatchObject({ taskId: 'task-a', targetDir: 'D:/a' });
    expect(getTaskContext('task-a')).toMatchObject({ taskId: 'task-a' });
    expect(getTaskContext('nope')).toBeNull();
    dropTaskContext('task-a');
    expect(getTaskContext('task-a')).toBeNull();
    expect(getActiveTaskContext()).toBeNull();
  });

  it('多任务共存：注册表按 taskId 键控，activeTaskId 指向最近注册', () => {
    registerTaskContext({ taskId: 'task-1', targetDir: 'D:/one' });
    registerTaskContext({ taskId: 'task-2', targetDir: 'D:/two' });
    expect(getTaskContext('task-1')).toMatchObject({ targetDir: 'D:/one' });
    expect(getActiveTaskContext()).toMatchObject({ taskId: 'task-2' });
    dropTaskContext('task-2');
    // 活跃任务被清理后 activeTaskId 复位，但 task-1 上下文仍可按 id 取回
    expect(getActiveTaskContext()).toBeNull();
    expect(getTaskContext('task-1')).toMatchObject({ taskId: 'task-1' });
    dropTaskContext('task-1');
    expect(getTaskContext('task-1')).toBeNull();
  });
});
