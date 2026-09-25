/**
 * v5.0 G 访客文案纠正守卫
 *
 * 用户 2026-09-19 实测确认：校验好友空间不会产生访问记录（validateTarget 只调
 * 公开资料接口，不进对方空间页面）。线上旧文案写"无法确认"与实测不符。
 *  ① VALIDATE_HELP_TEXT 为肯定句，不得含"无法确认"
 *  ② BACKUP_ACCESS_NOTICE 保留（校验不留痕 ≠ 备份不留痕，两段式不可合并）
 *  ③ 向导/新建任务页仍从单一来源引用（不许复制粘贴文案）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VALIDATE_HELP_TEXT, BACKUP_ACCESS_NOTICE } from '../../src/renderer/src/utils/access-copy';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('G① 校验说明改为肯定句', () => {
  it('不含"无法确认"，明确写"不会留下访客记录"', () => {
    expect(VALIDATE_HELP_TEXT).not.toContain('无法确认');
    expect(VALIDATE_HELP_TEXT).toContain('不会留下访客记录');
    expect(VALIDATE_HELP_TEXT).toContain('不进入对方空间页面');
  });
});

describe('G② 备份留痕提示保留', () => {
  it('BACKUP_ACCESS_NOTICE 仍含留痕提示与关闭指引（不得被削弱）', () => {
    expect(BACKUP_ACCESS_NOTICE).toContain('访客记录');
    expect(BACKUP_ACCESS_NOTICE).toContain('访问好友空间判断权限');
    expect(BACKUP_ACCESS_NOTICE).toContain('关闭');
  });

  it('两段式不可合并：校验文案不得写成备份也无痕', () => {
    expect(VALIDATE_HELP_TEXT).not.toContain('备份');
  });
});

describe('G③ 单一来源引用', () => {
  it('TargetPicker 与 NewTaskView 都从 access-copy 导入，不本地复制文案', () => {
    for (const rel of [
      'src/renderer/src/components/task/TargetPicker.vue',
      'src/renderer/src/views/NewTaskView.vue',
    ]) {
      const code = readFileSync(join(ROOT, rel), 'utf8');
      expect(code, `${rel} 应从 access-copy 导入`).toMatch(/from ['"].*access-copy['"]/);
      expect(code, `${rel} 不得内联旧文案`).not.toContain('无法确认');
    }
  });
});
