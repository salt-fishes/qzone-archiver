/**
 * P1-5 首批单测（§8.2）：mergeDeep 边界（数组、null、嵌套覆盖）
 * 引擎脚本（tasks/state.js）为经典脚本挂 window 全局，用 node:vm 执行源码取 __mergeDeep。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const stateJsPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/engine/tasks/state.js',
);

let mergeDeep;

beforeAll(() => {
  const src = readFileSync(stateJsPath, 'utf8');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  mergeDeep = sandbox.window.__mergeDeep;
});

describe('mergeDeep', () => {
  it('多源浅合并', () => {
    expect(mergeDeep({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('后源覆盖先源标量', () => {
    expect(mergeDeep({ a: 1 }, { a: 2 }, { a: 3 }).a).toBe(3);
  });

  it('嵌套对象深合并且不丢默认子项（部分结构并入默认）', () => {
    const out = mergeDeep(
      { Messages: { exportType: 'HTML', limit: 100 } },
      { Messages: { exportType: 'MarkDown' } },
    );
    expect(out).toEqual({ Messages: { exportType: 'MarkDown', limit: 100 } });
  });

  it('数组整体替换（不做逐项合并）', () => {
    const out = mergeDeep({ list: [1, 2, 3] }, { list: [9] });
    expect(out.list).toEqual([9]);
  });

  it('null 值覆盖（显式置空语义）', () => {
    expect(mergeDeep({ a: 1 }, { a: null }).a).toBeNull();
  });

  it('非对象源被跳过（null/undefined/数组/标量）', () => {
    expect(mergeDeep({ a: 1 }, null, undefined, [1, 2], 'x')).toEqual({ a: 1 });
  });

  it('嵌套结构跨源累积', () => {
    const out = mergeDeep({ m: { x: 1 } }, { n: { y: 2 } });
    expect(out).toEqual({ m: { x: 1 }, n: { y: 2 } });
  });

  it('深层覆盖：对象遇到对象递归，遇到标量直接替换', () => {
    const out = mergeDeep(
      { a: { b: { c: 1 } } },
      { a: { b: 42 } },
    );
    expect(out).toEqual({ a: { b: 42 } });
  });
});
