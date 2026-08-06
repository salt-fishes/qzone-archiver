/**
 * 一次性快照扩展端引擎基线 → desktop/src/engine/
 *
 * 来源（扩展端 v3.3.0 冻结基线，只读）：
 *   src/js              剔除页面脚本 options.js / popup.js / tools.js
 *   src/templates       离线 HTML 模板
 *   src/export          SPA/HTML 导出的静态资源
 *
 * 目标：
 *   desktop/src/engine/  引擎目录（此后 M1 五层重构在此独立演进，不回写扩展端）
 *
 * 用法：
 *   node scripts/sync-baseline.mjs          # 首次快照
 *   node scripts/sync-baseline.mjs --force  # 覆盖已有基线（危险，会冲掉 M1 重构产物）
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const ENGINE_DIR = path.resolve(__dirname, '../src/engine');
const MANIFEST_PATH = path.join(ENGINE_DIR, 'baseline-manifest.json');

const BASELINE_VERSION = '3.3.0';

// 单文件映射：源（相对仓库根） → 目标（相对 engine/）
const FILE_MAP = [
  ['src/js/api.js', 'api.js'],
  ['src/js/config.js', 'config.js'],
  ['src/js/utils.js', 'utils.js'],
  ['src/js/templates-compiled.js', 'templates-compiled.js'],
  ['src/js/background.js', 'background.js'],
  ['src/js/content.js', 'content.js'],
];

// 目录映射：源 → 目标（递归复制）
const DIR_MAP = [
  ['src/js/modules', 'modules'],
  ['src/templates', 'templates'],
  ['src/export', 'export-resources'],
];

// M1 五层目标目录（P0 起在 engine/ 内落地，骨架先建空目录）
const LAYER_DIRS = ['collectors', 'tasks', 'repos', 'exporters', 'packagers'];

// 扩展端页面脚本（引擎不需要，不进入基线）
const EXCLUDED_PAGE_SCRIPTS = ['options.js', 'popup.js', 'tools.js'];

async function sha256File(filePath) {
  const data = await fs.readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function copyDir(src, dest) {
  await fs.cp(src, dest, { recursive: true, force: true });
  // 收集文件清单
  const files = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        files.push(path.relative(dest, full));
      }
    }
  }
  await walk(dest);
  return files.sort();
}

async function main() {
  const force = process.argv.includes('--force');

  if (!force && await fs.access(MANIFEST_PATH).then(() => true).catch(() => false)) {
    console.error(
      `[sync-baseline] ${MANIFEST_PATH} 已存在（引擎基线已初始化）。\n` +
      '若确需覆盖请加 --force（警告：会覆盖 engine/ 内 M1 重构产物）。'
    );
    process.exit(1);
  }

  await fs.mkdir(ENGINE_DIR, { recursive: true });
  const manifest = {
    version: BASELINE_VERSION,
    createdAt: new Date().toISOString(),
    source: 'src/js + src/templates + src/export（扩展端 v3.3.0 冻结基线）',
    files: [],
    dirs: [],
    layers: LAYER_DIRS,
  };

  // 1) 单文件
  for (const [srcRel, destRel] of FILE_MAP) {
    const src = path.join(REPO_ROOT, srcRel);
    const dest = path.join(ENGINE_DIR, destRel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    manifest.files.push({ source: srcRel, target: destRel, sha256: await sha256File(src) });
    console.log(`  ✓ ${srcRel} → engine/${destRel}`);
  }

  // 2) 目录
  for (const [srcRel, destRel] of DIR_MAP) {
    const src = path.join(REPO_ROOT, srcRel);
    const dest = path.join(ENGINE_DIR, destRel);
    await fs.mkdir(dest, { recursive: true });
    const files = await copyDir(src, dest);
    manifest.dirs.push({ source: srcRel, target: destRel, files });
    console.log(`  ✓ ${srcRel}/ → engine/${destRel}/ (${files.length} files)`);
  }

  // 3) 五层空目录骨架
  for (const layer of LAYER_DIRS) {
    await fs.mkdir(path.join(ENGINE_DIR, layer), { recursive: true });
  }

  // 4) 写 baseline-manifest.json
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`  ✓ baseline-manifest.json（version=${BASELINE_VERSION}）`);

  // 5) 一致性校验：目标与源逐文件 sha256 比对
  console.log('\n[verify] 快照一致性校验…');
  let ok = true;
  const verify = [
    ...FILE_MAP.map(([s, d]) => [path.join(REPO_ROOT, s), path.join(ENGINE_DIR, d), d]),
  ];
  for (const [src, dest, label] of verify) {
    const [a, b] = await Promise.all([sha256File(src), sha256File(dest)]);
    const match = a === b;
    if (!match) ok = false;
    console.log(`  ${match ? 'OK ' : 'MISMATCH'} ${label}`);
  }
  // 目录级校验（抽样，取 manifest 记录的清单逐一比对）
  for (const { source, target, files } of manifest.dirs) {
    const srcDir = path.join(REPO_ROOT, source);
    const destDir = path.join(ENGINE_DIR, target);
    for (const rel of files) {
      const [a, b] = await Promise.all([
        sha256File(path.join(srcDir, rel)),
        sha256File(path.join(destDir, rel)),
      ]);
      if (a !== b) {
        ok = false;
        console.log(`  MISMATCH ${target}/${rel}`);
      }
    }
  }

  if (!ok) {
    console.error('[verify] 存在不一致文件，快照未通过校验！');
    process.exit(1);
  }
  console.log('[verify] 全部文件与扩展端 v3.3.0 一致。\n基线快照完成。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
