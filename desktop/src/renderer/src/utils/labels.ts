/**
 * §C：备份/档案目标的展示名与事实标签（纯函数，供档案列表 / 首页最近任务等共用）
 *
 * 背景（反馈 #5）：手输 QQ 号也会被拼成「好友 12345」并打「好友」标签——
 * 该入口接受任意 QQ 号，「好友」字样只能按事实（是否在登录者的好友列表中）显示。
 */

export type ArchiveTargetInfo = {
  uin?: string | number;
  nickname?: string;
  /** 是否登录者好友（来自 backup:list-friends；未登录/未加载时未知） */
  isFriend?: boolean;
};

/**
 * 展示名（分组标题 / 纯文本兜底）：
 *  - 本人 / 无 uin → 我的空间
 *  - 有昵称 → 昵称
 *  - 无昵称 → QQ 12345（不再拼「好友」）
 */
export function archiveTargetLabel(t: ArchiveTargetInfo): string {
  if (!t?.uin) return '我的空间';
  return t.nickname || `QQ ${t.uin}`;
}

/**
 * 事实标签：
 *  - 本人 / 无 uin → 我的空间
 *  - 真好友 → 好友
 *  - 非好友 / 未知 → 他人空间
 */
export function archiveTargetTag(t: ArchiveTargetInfo): string {
  if (!t?.uin) return '我的空间';
  return t.isFriend ? '好友' : '他人空间';
}
