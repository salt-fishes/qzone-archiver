/**
 * v4.9 §C 单测：档案目标展示名/事实标签 + 静态文案守卫
 *
 * 背景（反馈 #5）：手输 QQ 号也被拼成「好友 12345」并打「好友」标签。
 * 守卫内容：
 *  - archiveTargetLabel 四种组合（本人/昵称/无昵称/未知）
 *  - archiveTargetTag 按事实显示（好友 / 他人空间 / 我的空间）
 *  - ArchivesView / HomeView 源码不再出现 `好友 ${` 拼接
 *  - TargetPicker / TutorialView / HelpModal 不再出现「好友的空间」（入口名改为「访问空间」）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const { archiveTargetLabel, archiveTargetTag } = await import(
  '../../src/renderer/src/utils/labels.ts'
);

describe('§C archiveTargetLabel 展示名', () => {
  it('有昵称 → 昵称；无昵称 → QQ 12345（不再拼「好友」）', () => {
    expect(archiveTargetLabel({ uin: '12345', nickname: '穗稔' })).toBe('穗稔');
    expect(archiveTargetLabel({ uin: '12345' })).toBe('QQ 12345');
    expect(archiveTargetLabel({ uin: '12345', nickname: '' })).toBe('QQ 12345');
  });

  it('本人 / 无 uin → 我的空间', () => {
    expect(archiveTargetLabel({})).toBe('我的空间');
    expect(archiveTargetLabel({ uin: '', nickname: '穗稔' })).toBe('我的空间');
    expect(archiveTargetLabel({ uin: undefined })).toBe('我的空间');
  });
});

describe('§C archiveTargetTag 事实标签', () => {
  it('真好友 → 好友；非好友/未知 → 他人空间', () => {
    expect(archiveTargetTag({ uin: '12345', isFriend: true })).toBe('好友');
    expect(archiveTargetTag({ uin: '12345', isFriend: false })).toBe('他人空间');
    expect(archiveTargetTag({ uin: '12345' })).toBe('他人空间');
  });

  it('本人 / 无 uin → 我的空间', () => {
    expect(archiveTargetTag({})).toBe('我的空间');
    expect(archiveTargetTag({ uin: '' })).toBe('我的空间');
    expect(archiveTargetTag({ uin: undefined })).toBe('我的空间');
  });
});

describe('§C 静态文案守卫', () => {
  const read = (rel) => readFileSync(join(ROOT, 'src/renderer/src', rel), 'utf8');

  it('ArchivesView / HomeView 不再出现「好友 ${」拼接', () => {
    for (const f of ['views/ArchivesView.vue', 'views/HomeView.vue']) {
      const code = read(f);
      expect(code, `${f} 仍在拼接「好友 \${...}」`).not.toMatch(/好友 \$\{/);
      expect(code, `${f} 应使用 archiveTargetTag 事实标签`).toMatch(/archiveTargetTag/);
    }
  });

  it('TargetPicker / TutorialView / HelpModal 不再出现「好友的空间」（已改「访问空间」）', () => {
    for (const f of ['components/task/TargetPicker.vue', 'views/TutorialView.vue', 'components/onboarding/HelpModal.vue']) {
      expect(read(f), `${f} 仍出现「好友的空间」`).not.toContain('好友的空间');
    }
    expect(read('components/task/TargetPicker.vue')).toContain('访问空间');
    expect(read('views/TutorialView.vue')).toContain('访问空间');
    expect(read('components/onboarding/HelpModal.vue')).toContain('访问空间');
  });

  it('界面对「我的档案」的引用已全部改为「档案列表」', () => {
    for (const f of [
      'components/layout/AppSidebar.vue',
      'views/ArchivesView.vue',
      'components/onboarding/TourOverlay.vue',
      'views/TutorialView.vue',
    ]) {
      expect(read(f), `${f} 仍出现「我的档案」`).not.toContain('我的档案');
      expect(read(f)).toContain('档案列表');
    }
  });
});
