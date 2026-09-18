/**
 * 纯净 checkout 门禁（v4.9 R1）
 *
 * 背景：v4.8.0 发版踩坑——图标/表情生成脚本从未接入构建，本地因残留 build/ 产物而
 * 门禁全绿，纯净环境一拉就红。本脚本把「移走生成产物 → 跑全套门禁 → 恢复」固化下来，
 * 发版前执行一次，等价于在全新 clone 上验收。
 *
 * 移动目录（仅移出工作区，跑完原样移回）：
 *   desktop/build/                    图标/splash 等生成产物
 *   desktop/src/renderer/public/      渲染层生成资产（表情清单等）
 *   desktop/src/renderer/dist/        渲染层构建产物
 *
 * 门禁序列（与 docs/RELEASE_CHECKLIST.md 第 2 步一致）：
 *   gen-engine-config --check → typecheck → lint → test → build:renderer
 *
 * 用法：node scripts/check-clean-checkout.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// 停车位放系统临时目录：放 desktop/ 内会被 eslint . 扫到 minified 产物导致门禁误红
const PARKING = mkdtempSync(path.join(os.tmpdir(), 'clean-checkout-'));

const GENERATED = ['build', path.join('src', 'renderer', 'public'), path.join('src', 'renderer', 'dist')];

const STEPS = [
  ['引擎配置一致性', 'node', ['scripts/gen-engine-config.mjs', '--check']],
  ['类型检查', 'npm', ['run', 'typecheck']],
  ['Lint', 'npm', ['run', 'lint']],
  ['单测', 'npm', ['run', 'test']],
  ['渲染层构建', 'npm', ['run', 'build:renderer']],
];

function runStep(name, cmd, args) {
  console.log(`\n===== [${name}] ${cmd} ${args.join(' ')} =====`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n[check-clean-checkout] 门禁失败：${name}（exit ${r.status}）`);
    return false;
  }
  return true;
}

function main() {
  // ---- 1. 移走生成产物 ----
  const moved = [];
  mkdirSync(PARKING, { recursive: true });
  for (const rel of GENERATED) {
    const src = path.join(ROOT, rel);
    if (!existsSync(src)) continue;
    const dest = path.join(PARKING, rel.replace(/[\\/]/g, '_'));
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    renameSync(src, dest);
    moved.push([src, dest]);
    console.log(`[check-clean-checkout] 已移出 ${rel}`);
  }
  if (!moved.length) {
    console.log('[check-clean-checkout] 无生成产物残留，本已是纯净状态');
  }

  try {
    // ---- 2. 依次跑门禁 ----
    for (const [name, cmd, args] of STEPS) {
      if (!runStep(name, cmd, args)) {
        process.exitCode = 1;
        return;
      }
    }
    console.log('\n[check-clean-checkout] ✅ 纯净 checkout 门禁全部通过');
  } finally {
    // ---- 3. 恢复产物（无论门禁成败） ----
    for (const [src, dest] of moved) {
      mkdirSync(path.dirname(src), { recursive: true });
      renameSync(dest, src);
      console.log(`[check-clean-checkout] 已恢复 ${path.relative(ROOT, src)}`);
    }
    try {
      rmSync(PARKING, { recursive: true, force: true });
    } catch {
      /* 目录非空（极端情况残留）不阻塞 */
    }
  }
}

main();
