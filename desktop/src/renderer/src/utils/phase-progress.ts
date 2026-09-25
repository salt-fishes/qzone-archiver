/**
 * v5.0：总进度加权（纯逻辑，便于单测）
 *
 * 背景：模块内是多个顺序阶段（采集列表 → 获取全文 → 评论 → …），
 * 每个阶段的 StatusIndicator 各自从 0 计百分比。旧总进度把"当前阶段百分比"
 * 直接当"模块整体百分比"用，阶段切换时总进度会从 ~30% 跳回 0% 倒退。
 *
 * 方案：按静态阶段表给阶段在模块内的位置加权——
 *   模块内进度 = (阶段序号 + 阶段百分比/100) / 模块阶段总数 × 100
 * 再与该模块此前进度取 max（单调不回退）；未知模块/阶段退回"阶段百分比 + 单调"。
 * 某阶段被配置跳过时模块进度封顶不到 100，模块完成事件（module-done）会补齐——
 * 宁可低估也不倒退。
 */

/** 各模块的阶段顺序（与 tasks/progress.js PHASE_NAMES 同源整理；§J 已删 Messages_Deleted） */
export const PHASE_ORDER: Record<string, string[]> = {
  Messages: [
    'Messages', 'Messages_Filter', 'Messages_Full_Content', 'Messages_More_Images',
    'Messages_Comments', 'Messages_Images_Mime', 'Messages_Like', 'Messages_Visitor',
    'Messages_Lbs_Info', 'Messages_Export', 'Messages_Export_Other',
  ],
  Blogs: [
    'Blogs', 'Blogs_Content', 'Blogs_Comments', 'Blogs_Like',
    'Blogs_Visitor', 'Blogs_Export', 'Blogs_Export_Other',
  ],
  Diaries: [
    'Diaries', 'Diaries_Content', 'Diaries_Comments', 'Diaries_Like',
    'Diaries_Visitor', 'Diaries_Export', 'Diaries_Export_Other',
  ],
  Boards: ['Boards', 'Boards_Images_Mime', 'Boards_Export', 'Boards_Export_Other'],
  Friends: ['Friends', 'Friends_Time', 'Friends_Access', 'Friends_Care', 'Friends_Export'],
  Photos: [
    'Photos', 'Photos_Albums_Comments', 'Photos_Albums_Like', 'Photos_Albums_Visitor',
    'Photos_Images', 'Photos_Images_Info', 'Photos_Images_Comments', 'Photos_Images_Like',
    'Photos_Images_Mime', 'Photos_Export', 'Photos_Images_Export', 'Photos_Images_Export_Other',
  ],
  Videos: ['Videos', 'Videos_Comments', 'Videos_Like', 'Videos_Export'],
  Favorites: ['Favorites', 'Favorites_Export', 'Favorites_Export_Other'],
  Shares: [
    'Shares', 'Shares_Comments', 'Shares_Like',
    'Shares_Visitor', 'Shares_Export', 'Shares_Export_Other',
  ],
  Visitors: ['Visitors', 'Visitors_Export', 'Visitors_Export_Other'],
};

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/**
 * 计算模块的加权进度（0-100，单调不回退）。
 * @param module 模块 key（如 Messages）
 * @param phase 当前阶段 key（如 Messages_Full_Content）
 * @param percent 当前阶段的原始百分比（0-100）
 * @param prevPercent 该模块此前已报出的加权进度（同一次备份内）
 */
export function weightedModulePercent(
  module: string,
  phase: string | undefined,
  percent: number,
  prevPercent = 0
): number {
  const raw = clamp(percent);
  const list = module ? PHASE_ORDER[module] : undefined;
  const idx = list && phase ? list.indexOf(phase) : -1;
  let weighted: number;
  if (!list || idx < 0) {
    // 未知模块/阶段（Common、Statistics 等）：只能保证不回退
    weighted = raw;
  } else {
    weighted = clamp(((idx + raw / 100) / list.length) * 100);
  }
  return Math.max(prevPercent, weighted);
}
