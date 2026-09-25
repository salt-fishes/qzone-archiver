/* v5.0 发版拆包自检（一次性脚本，可随时删）：检查 app.asar 关键内容 */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS 一次性脚本 */
const asarLib = require('@electron/asar');
const asar = 'release/win-unpacked/resources/app.asar';
const ex = (p) => {
  const cands = [p, '/' + p, p.replace(/\//g, '\\'), '\\' + p.replace(/\//g, '\\')];
  for (const c of cands) {
    try {
      return asarLib.extractFile(asar, c).toString();
    } catch (_) { /* try next */ }
  }
  throw new Error(`extract failed: ${p}`);
};
const list = asarLib.listPackage(asar).map((s) => s.replace(/\\/g, '/'));
const results = [];

// 1. EMOTICONS_DIR 三层相对路径（相对 backup.js 所在 src/main/ipc）
const bak = ex('src/main/ipc/backup.js');
results.push(['EMOTICONS_DIR 为三层 ../../../assets/emoticons', bak.includes('../../../assets/emoticons')]);

// 2. 渲染层资源域 + 回落函数在 bundle 内
const jsFiles = list.filter((l) => /src\/renderer\/dist\/assets\/.*\.js$/.test(l));
let cspOk = false;
let rf = false;
for (const j of jsFiles) {
  const c = ex(j.replace(/^\//, ''));
  if (c.includes('qzonestyle.gtimg.cn')) cspOk = true;
  if (c.includes('renderFallback')) rf = true;
}
results.push(['渲染层含 qzonestyle.gtimg.cn', cspOk]);
results.push(['渲染层 bundle 含 renderFallback', rf]);

// 3. assets/emoticons 与 dist/emoticons 条目数一致
const nAssets = list.filter((l) => /assets\/emoticons/.test(l)).length;
const nDist = list.filter((l) => /dist\/emoticons/.test(l)).length;
results.push([`assets/emoticons(${nAssets}) 与 dist/emoticons(${nDist}) 条目一致`, nAssets === nDist && nAssets > 0]);

// 4. asar 内版本号 5.0.0
const pkg = JSON.parse(ex('package.json'));
results.push([`asar 内 package.json 版本 = ${pkg.version}`, pkg.version === '5.0.0']);

// 5. 好友字段修复已进包
const orch = ex('src/engine/tasks/orchestrator.js');
results.push(['引擎 orchestrator 含 it.nick 映射', /it\.nick \|\| it\.nickname/.test(orch)]);
const expf = ex('src/engine/exporters/friends.js');
results.push(['引擎 exporters 含 friendNick', expf.includes('friendNick')]);
const coll = ex('src/engine/collectors/friends.js');
results.push(['引擎 collectors care 崩溃保护已进包', coll.includes('if (friend) friend.care = true')]);

let pass = true;
for (const [name, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) pass = false;
}
process.exit(pass ? 0 : 1);
