/**
 * v5.5 M0 补：非用户暂停不提供“恢复”入口
 *
 * 背景：engine_lost / auth_lost 时引擎会话已失效（窗口重建或页面离开 qzone），
 * 新引擎里没有运行中的任务。此前 UI 对任何 paused 都显示「恢复」，
 * 用户重连引擎后再点恢复，主进程会把状态误置回 running，30s 后再次 stalled。
 *
 * 双重守卫：
 *  ① 渲染层 RunningPanel 仅在 user/rate_limited 时显示恢复按钮；
 *  ② 主进程 backup:resume 对 engine_lost/auth_lost 明确拒绝。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const panelSrc = readFileSync(
  path.join(rootDir, 'src/renderer/src/components/task/RunningPanel.vue'),
  'utf8'
);
const backupIpcSrc = readFileSync(path.join(rootDir, 'src/main/ipc/backup.js'), 'utf8');

describe('非用户暂停的恢复守卫（v5.5 M0 补）', () => {
  it('RunningPanel：只有 user/rate_limited 允许显示恢复按钮', () => {
    expect(panelSrc).toContain('const canResume = computed');
    expect(panelSrc).toMatch(/r === 'user' \|\| r === 'rate_limited'/);
    expect(panelSrc).toContain('v-else-if="canResume"');
  });

  it('主进程 resume：engine_lost/auth_lost 必须被拒绝', () => {
    expect(backupIpcSrc).toContain('canResumePaused(snap.pausedReason)');
    expect(backupIpcSrc).toContain('引擎会话已丢失，请取消本任务后重新发起备份');
  });
});
