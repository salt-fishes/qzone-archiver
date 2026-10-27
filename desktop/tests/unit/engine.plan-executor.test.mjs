/**
 * v5.5 M1：PlanExecutor 纯函数单测
 * 覆盖：resumeFrom 跳过已完成模块 / 无效模块回退全量 / 错误分级 / 可恢复原因
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let P;

beforeAll(() => {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(path.join(rootDir, 'src/engine/tasks/plan-executor.js'), 'utf8'),
    sandbox,
    { filename: 'tasks/plan-executor.js' }
  );
  P = vm.runInContext('window.QZoneTasks.PlanExecutor', sandbox);
});

describe('buildPlan', () => {
  it('无 resumeFrom → 全量执行', () => {
    const plan = P.buildPlan({ modules: ['Messages', 'Photos', 'Videos'] });
    expect(plan).toMatchObject({
      modules: ['Messages', 'Photos', 'Videos'],
      skipped: [],
      startIndex: 0,
      invalidResume: false,
    });
  });

  it('resumeFrom Photos → 跳过 Messages，从 Photos 开始', () => {
    const plan = P.buildPlan({
      modules: ['Messages', 'Photos', 'Videos'],
      resumeFrom: { module: 'Photos', phase: 'Photos_Albums_Like' },
    });
    expect(plan.modules).toEqual(['Photos', 'Videos']);
    expect(plan.skipped).toEqual(['Messages']);
    expect(plan.startIndex).toBe(1);
    expect(plan.invalidResume).toBe(false);
  });

  it('resumeFrom 模块不在清单 → 回退全量并标记 invalidResume', () => {
    const plan = P.buildPlan({
      modules: ['Messages', 'Photos'],
      resumeFrom: { module: 'Diaries' },
    });
    expect(plan.modules).toEqual(['Messages', 'Photos']);
    expect(plan.skipped).toEqual([]);
    expect(plan.invalidResume).toBe(true);
  });
});

describe('classifyModuleError', () => {
  it('请求层 __authLost → auth_lost（含 ModuleError 包装）', () => {
    const cause = Object.assign(new Error('401 Unauthorized'), { __authLost: true });
    const wrapped = Object.assign(new Error('模块失败'), { cause });
    expect(P.classifyModuleError(wrapped)).toBe('auth_lost');
  });

  it('请求层 __rateLimited → rate_limited', () => {
    const err = Object.assign(new Error('使用人数过多'), { __rateLimited: true });
    expect(P.classifyModuleError(err)).toBe('rate_limited');
  });

  it('文字特征：登录/限流/磁盘', () => {
    expect(P.classifyModuleError(new Error('请先登录 QQ 空间'))).toBe('auth_lost');
    expect(P.classifyModuleError(new Error('code -10000 系统压力有点大'))).toBe('rate_limited');
    expect(P.classifyModuleError(new Error('磁盘空间不足'))).toBe('fatal');
  });

  it('普通模块异常 → module（继续下一个模块）', () => {
    expect(P.classifyModuleError(new Error('解析失败'))).toBe('module');
    expect(P.classifyModuleError(null)).toBe('module');
  });
});

describe('isResumableReason', () => {
  it('user / rate_limited 可恢复；engine_lost/auth_lost 不可', () => {
    expect(P.isResumableReason('user')).toBe(true);
    expect(P.isResumableReason('rate_limited')).toBe(true);
    expect(P.isResumableReason('engine_lost')).toBe(false);
    expect(P.isResumableReason('auth_lost')).toBe(false);
    expect(P.isResumableReason(null)).toBe(true);
  });
});
