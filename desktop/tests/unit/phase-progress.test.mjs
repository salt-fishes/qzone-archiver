/**
 * v5.0 总进度加权单测（utils/phase-progress.ts）
 * 修复场景：列表采集完（阶段 100%）进入"获取全文"阶段，原始百分比回 0，
 * 旧总进度跟着从 ~30% 倒退。新逻辑按静态阶段表加权 + 同模块单调钳制。
 */
import { describe, it, expect } from 'vitest';
import { weightedModulePercent, PHASE_ORDER } from '../../src/renderer/src/utils/phase-progress';

describe('§phase-progress 阶段加权', () => {
  it('阶段推进抬升加权进度；阶段内百分比单调', () => {
    const list = PHASE_ORDER.Messages;
    // 第一阶段（采集列表）走到 100%
    const p1 = weightedModulePercent('Messages', 'Messages', 100, 0);
    expect(p1).toBe(Math.round((1 / list.length) * 100));
    // 切到全文阶段、百分比回 0 → 加权值仍 ≥ 第一阶段完成值（不倒退）
    const p2 = weightedModulePercent('Messages', 'Messages_Full_Content', 0, p1);
    expect(p2).toBeGreaterThanOrEqual(p1);
    // 全文阶段过半
    const p3 = weightedModulePercent('Messages', 'Messages_Full_Content', 50, p1);
    expect(p3).toBeGreaterThan(p2);
  });

  it('同阶段内百分比回跳被单调钳制（进度条不倒退）', () => {
    const a = weightedModulePercent('Messages', 'Messages_Comments', 60, 0);
    const b = weightedModulePercent('Messages', 'Messages_Comments', 10, a);
    expect(b).toBe(a);
  });

  it('未知阶段（如 Custom phase）退回原始百分比但仍单调', () => {
    const a = weightedModulePercent('Messages', 'Messages_Custom', 80, 0);
    expect(a).toBe(80);
    const b = weightedModulePercent('Messages', 'Messages_Custom', 10, a);
    expect(b).toBe(80);
  });

  it('未知模块（Common/Statistics 等）退回原始百分比 + 单调', () => {
    expect(weightedModulePercent('Common', undefined, 40, 0)).toBe(40);
    expect(weightedModulePercent('Statistics', 'Statistics', 90, 30)).toBe(90);
    expect(weightedModulePercent('Common', 'X', 10, 40)).toBe(40);
  });

  it('边界：负值/超百钳制到 0-100', () => {
    expect(weightedModulePercent('Messages', 'Messages', -5, 0)).toBe(0);
    expect(weightedModulePercent('Messages', 'Messages_Export', 150, 0)).toBeLessThanOrEqual(100);
  });

  it('完整链路模拟：列表→全文→评论→导出 无任何回退', () => {
    let prev = 0;
    const seq = [
      ['Messages', 30], ['Messages', 80], ['Messages', 100],
      ['Messages_Full_Content', 0], ['Messages_Full_Content', 60], ['Messages_Full_Content', 100],
      ['Messages_Comments', 0], ['Messages_Comments', 100],
      ['Messages_Export', 0], ['Messages_Export', 100],
    ];
    const values = [];
    for (const [phase, pct] of seq) {
      prev = weightedModulePercent('Messages', phase, pct, prev);
      values.push(prev);
    }
    for (let i = 1; i < values.length; i++) {
      expect(values[i], `第 ${i} 步回退：${values[i - 1]} → ${values[i]}`).toBeGreaterThanOrEqual(values[i - 1]);
    }
    expect(values[values.length - 1]).toBeLessThanOrEqual(100);
  });
});
