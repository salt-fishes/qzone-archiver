/**
 * v4.9 §K 静态守卫：主进程 logger 埋点数量下限
 *
 * 背景：卡死故障时全 `src/main/` 仅 1 处 `logger.*` 调用，main.log 132 行全是引擎透传，
 * 主进程自己 0 行——"无可信日志"就是那次故障无法定位的直接原因。
 *
 * 下限 15 由 §K 明列的埋点推出：会话自检 1 + 任务开始/结束/暂停/恢复/取消 5 +
 * 模块开始/结束 2 + 接口重试与放弃 2 + 窗口生命周期（创建/关闭/崩溃/注入成功/注入失败）5 ≈ 15。
 * 实现超出下限是正常的；若需调低必须在本文件说明理由（计划 §K：不允许悄悄放宽）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MAIN_DIR = join(ROOT, 'src/main');

function collectJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) out.push(...collectJsFiles(full));
    else if (name.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function countLoggerCalls(code) {
  return (code.match(/\blogger\.(log|info|warn|error|debug|task|sessionStart|disposeTask)\b/g) || [])
    .length;
}

describe('§K 主进程日志埋点下限', () => {
  it(`src/main/ 内 logger.* 调用数 ≥ 15（当前实测 ${collectJsFiles(MAIN_DIR).reduce(
    (n, f) => n + countLoggerCalls(readFileSync(f, 'utf8')),
    0
  )}）`, () => {
    let count = 0;
    for (const f of collectJsFiles(MAIN_DIR)) {
      count += countLoggerCalls(readFileSync(f, 'utf8'));
    }
    expect(count).toBeGreaterThanOrEqual(15);
  });

  it('index.js 调用 sessionStart()（会话自检行探针，缺失即应用日志链路断）', () => {
    const code = readFileSync(join(MAIN_DIR, 'index.js'), 'utf8');
    expect(code).toMatch(/logger\.sessionStart\(\)/);
  });

  it('引擎 console 中转支持写入任务日志附录（task(...).engine 路由存在）', () => {
    const code = readFileSync(join(MAIN_DIR, 'index.js'), 'utf8');
    expect(code).toMatch(/logger\.task\(/);
  });
});
