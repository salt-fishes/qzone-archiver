/**
 * v5.2 视觉体系守卫（S4/S9/D3）
 *
 * ① tokens.scss 令牌完备性 —— v5.2-design.md §2 全部令牌必须在位
 * ② 动效毫秒守卫 —— 组件禁止写死动画毫秒/缓动，一律引用动效令牌（useMotion）
 *    （豁免清单：AnnualReportView.vue 为既有局部时间线编排，V5 已接入扫版，令牌化迁移待后续）
 * ③ 产物体积预算 —— JS+CSS 未压缩总量 ≤ 1500 KB（V6.2 上修后的上限，含内联字体专项）
 * ④ SpaExportFiles 覆盖 —— 引擎导出清单必须覆盖 spa-dist 全部产物文件（V0.1 内联字体后
 *    不产生独立字体文件；新增产物漏登记会直接丢出归档）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPA = join(ROOT, 'archive-viewer');
const DIST = join(ROOT, 'src', 'engine', 'export-resources', 'spa-dist');

/** ① 令牌完备性 */
describe('archive-viewer tokens.scss 令牌完备性（§2）', () => {
  const css = readFileSync(join(SPA, 'src', 'styles', 'tokens.scss'), 'utf8');

  const required = [
    // 色板
    '--paper:', '--paper-raised:', '--ink:', '--ink-muted:', '--line:', '--vermilion:',
    '--indigo:', '--moss:', '--gold:', '--night:',
    // 字体
    '--font-display:', '--font-body:', '--font-mono:', '--font-serif-cn:',
    // 字阶
    '--fs-display:', '--fs-h1:', '--fs-h2:', '--fs-body:', '--fs-meta:',
    // 间距（8px 基尺四档）
    '--sp-1:', '--sp-2:', '--sp-3:', '--sp-4:',
    // 圆角/描边/阴影
    '--radius:', '--line-1:', '--rule:', '--rule-double:', '--shadow-raise:',
    // 动效
    '--dur-1:', '--dur-2:', '--dur-3:', '--dur-4:', '--stagger-step:',
    '--ease-out:', '--ease-sweep:',
  ];

  it.each(required)('包含令牌 %s', (token) => {
    expect(css).toContain(token);
  });
});

/** ② 动效毫秒守卫 */
describe('组件禁止写死动画毫秒/缓动（§2.4 守卫）', () => {
  const EXEMPT = new Set(['AnnualReportView.vue']); // 既有局部时间线，令牌化迁移待后续
  const DIRS = ['src/components', 'src/views', 'src/composables'];

  function collectVueFiles(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) out.push(...collectVueFiles(p));
      else if (name.endsWith('.vue')) out.push(p);
    }
    return out;
  }

  const offenders = [];
  for (const dir of DIRS) {
    for (const file of collectVueFiles(join(SPA, dir))) {
      if (EXEMPT.has(file.split(/[\\/]/).pop())) continue;
      // 去注释后再匹配，避免把说明文字里的 "250ms" 当违例
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\/[^\n]*/g, '');
      if (/\bduration:\s*\d/.test(src) || /cubic-bezier\(/.test(src) || /\d{3}ms\b/.test(src)) {
        offenders.push(file);
      }
    }
  }

  it('无写死毫秒/缓动（豁免：年报既有编排）', () => {
    expect(offenders).toEqual([]);
  });
});

/** ③ 产物体积预算 */
describe('SPA 产物体积预算（≤ 1500 KB）', () => {
  it('index.js + style.css 未压缩总量在预算内', () => {
    const js = statSync(join(DIST, 'assets', 'index.js')).size;
    const css = statSync(join(DIST, 'assets', 'style.css')).size;
    const total = js + css;
    expect(total).toBeLessThanOrEqual(1500 * 1024);
    // 字体内联专项：style.css 应包含 data URL 字体（file:// 离线可用），且不产生独立 woff2
    const cssText = readFileSync(join(DIST, 'assets', 'style.css'), 'utf8');
    expect(cssText).toContain('data:font/woff2');
  });
});

/** ④ SpaExportFiles 覆盖 */
describe('SpaExportFiles 覆盖 spa-dist 全部产物（S4）', () => {
  it('清单与磁盘产物双向覆盖', () => {
    const config = readFileSync(join(ROOT, 'src', 'engine', 'config.js'), 'utf8');
    const m = config.match(/const SpaExportFiles = (\[[\s\S]*?\])/);
    expect(m).toBeTruthy();
    const listed = eval(m[1]).map((e) => e.original.replace(/^export\/spa-dist\//, ''));

    const actual = [];
    (function walk(dir, rel) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const r = rel ? `${rel}/${name}` : name;
        if (statSync(p).isDirectory()) walk(p, r);
        else actual.push(r);
      }
    })(DIST, '');

    for (const file of actual) {
      expect(listed, `产物 ${file} 未登记进 SpaExportFiles`).toContain(file);
    }
    for (const file of listed) {
      expect(actual, `清单登记了不存在的产物 ${file}`).toContain(file);
    }
  });
});
