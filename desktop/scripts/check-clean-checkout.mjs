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

/**
 * Windows 上目录 rename 偶发 EPERM（杀毒/索引/编辑器句柄短暂占用）。
 * v4.9.0 发版实踩：rename 失败会卡在还原阶段且产物滞留 temp 目录。
 * 对 EPERM/EACCES/EBUSY 退避重试，其余错误立即上抛。
 */
function renameWithRetry(src, dest, attempts = 5) {
  for (let i = 1; ; i++) {
    try {
      renameSync(src, dest);
      return;
    } catch (e) {
      const retryable = ['EPERM', 'EACCES', 'EBUSY'].includes(e.code);
      if (!retryable || i >= attempts) throw e;
      const waitMs = 500 * i;
      console.warn(`[check-clean-checkout] rename 被占用（${e.code}），${waitMs}ms 后重试 ${i}/${attempts - 1}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
    }
  }
}

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
    renameWithRetry(src, dest);
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
      try {
        if (existsSync(src)) {
          // 门禁期间被重新生成的（build:renderer 的 sync-emoticons 会重建
          // src/renderer/public）→ 目标已存在，Windows rename 必 EPERM。
          // 内容同源生成，保留新副本、丢弃停放副本即可。
          rmSync(dest, { recursive: true, force: true });
          console.log(`[check-clean-checkout] 门禁期间已重新生成 ${path.relative(ROOT, src)}，保留新副本`);
        } else {
          mkdirSync(path.dirname(src), { recursive: true });
          renameWithRetry(dest, src);
          console.log(`[check-clean-checkout] 已恢复 ${path.relative(ROOT, src)}`);
        }
      } catch (e) {
        console.error(`[check-clean-checkout] 还原 ${path.relative(ROOT, src)} 失败：${e.message}（停放副本在 ${dest}）`);
        process.exitCode = 1;
      }
    }
    try {
      rmSync(PARKING, { recursive: true, force: true });
    } catch {
      /* 目录非空（极端情况残留）不阻塞 */
    }
  }
}

main();
