/**
 * 表情库一致性守卫（v4.7.1 回归）
 *
 * 背景：`[em]e327806[/em]` 这类魔法表情在界面上显示不出来 —— 原因是本地文件是 .png，
 * 而组件统一按 .gif 请求；manifest 只记了 id，没记真实文件名。
 * 现在 sync-emoticons.mjs 会生成 roster（id → 真实文件名），本测试守住三条：
 *   1. 渲染层 roster 与 assets 目录实况一致（防手改/漏跑同步脚本）
 *   2. roster 里每个文件名都真实存在（否则界面会请求到 404）
 *   3. 扩展名在白名单内（gif/png/jpg），避免奇形怪状的文件混入
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC_DIR = join(ROOT, 'assets/emoticons/qq');
const UI_MANIFEST = join(ROOT, 'src/renderer/src/assets/emoticons-manifest.json');

/** 扫描 assets/emoticons/qq，得到 id → 文件名 */
function scanRoster() {
  const roster = {};
  if (!existsSync(SRC_DIR)) return roster;
  for (const e of readdirSync(SRC_DIR, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    const m = /^e(\d+)\.(gif|png|jpe?g)$/i.exec(e.name);
    if (m) roster[m[1]] = e.name;
  }
  return roster;
}

describe('表情库一致性', () => {
  it('渲染层 roster 与 assets 目录实况一致', () => {
    expect(existsSync(UI_MANIFEST), '缺少渲染层表情清单，请运行 npm run gen:emoticons').toBe(true);
    const manifest = JSON.parse(readFileSync(UI_MANIFEST, 'utf8'));
    expect(manifest.roster, 'roster 缺失（组件会按错扩展名请求，表情显示不出来）').toBeTruthy();
    expect(manifest.roster).toEqual(scanRoster());
  });

  it('roster 中每个文件都真实存在且扩展名合法', () => {
    const manifest = JSON.parse(readFileSync(UI_MANIFEST, 'utf8'));
    const roster = manifest.roster || {};
    const missing = [];
    for (const [id, file] of Object.entries(roster)) {
      if (!/\.(gif|png|jpe?g)$/i.test(file)) missing.push(`${id} → ${file}（扩展名非法）`);
      else if (!existsSync(join(SRC_DIR, file))) missing.push(`${id} → ${file}（文件不存在）`);
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('已知魔法表情 id（稀疏区间）包含用户反馈的 327806', () => {
    const manifest = JSON.parse(readFileSync(UI_MANIFEST, 'utf8'));
    const roster = manifest.roster || {};
    // 该 id 是 issue 反馈里出现的样本，确保下载脚本/同步链路没把它丢掉
    expect(roster['327806'], '327806 未在本地表情库中').toBeTruthy();
  });
});
