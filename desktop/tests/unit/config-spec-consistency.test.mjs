/**
 * P4.2 配置单一来源一致性（§6.2 验收）
 * spec（config-spec.json）↔ 渲染层 schema.ts defaultSettings() ↔ 引擎 config.js Default_Config
 * 三方在 spec 覆盖字段上的字段集合与默认值必须零 diff；任一侧手改漂移即失败。
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { defaultSettings } from '../../src/renderer/src/stores/schema.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const spec = JSON.parse(readFileSync(join(ROOT, 'src/engine/config-spec.json'), 'utf8'));

const engineCode = readFileSync(join(ROOT, 'src/engine/config.js'), 'utf8');
const sb = { console };
sb.window = sb;
sb.QZONE_MODULES = [{ key: 'Messages', zh: '说说', exportable: true }];
vm.runInContext(engineCode, vm.createContext(sb), { filename: 'config.js' });
const engineConfig = vm.runInContext('Default_Config', sb);

const getPath = (obj, key) =>
  key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const specGroups = Object.entries(spec.groups);

describe('config-spec 单一来源一致性', () => {
  it('defaultSettings() 与 spec 字段集合与默认值零 diff', () => {
    const ui = defaultSettings();
    const problems = [];
    for (const [mod, group] of specGroups) {
      if (!ui[mod]) problems.push(`defaultSettings 缺少模块 ${mod}`);
      for (const item of group.items) {
        if (!same(getPath(ui[mod], item.key), item.default)) {
          problems.push(`${mod}.${item.key}: UI=${JSON.stringify(getPath(ui[mod], item.key))} spec=${JSON.stringify(item.default)}`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('引擎 Default_Config 与 spec 字段集合与默认值零 diff', () => {
    const problems = [];
    for (const [mod, group] of specGroups) {
      if (!engineConfig[mod]) problems.push(`引擎缺少模块 ${mod}`);
      for (const item of group.items) {
        if (!same(getPath(engineConfig[mod], item.key), item.default)) {
          problems.push(`${mod}.${item.key}: 引擎=${JSON.stringify(getPath(engineConfig[mod], item.key))} spec=${JSON.stringify(item.default)}`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('defaultSettings 顶层模块集合与 spec 一致（无手抄漂移的幽灵模块）', () => {
    const ui = defaultSettings();
    expect(Object.keys(ui).sort()).toEqual(specGroups.map(([m]) => m).sort());
  });

  /**
   * v4.7 P4：设置项必须真有读取点 —— 防止再出现「哑巴设置」。
   * 背景：v4.6 时 downloadThread / downloadSleep / disabledShelf / refererUrls /
   * Aria2.rpc / Aria2.token 六项在 UI 上可改但没有任何生效路径（人工比对才发现）。
   * 口径：在 engine / main / renderer 源码与模板中，叶子键名必须作为属性访问出现
   *      （形如 `xxx.key`、`xxx?.key` 或 `xxx['key']`），字符串字面量不算读取点。
   */
  const READ_SCAN_DIRS = [
    'src/engine/api', 'src/engine/collectors', 'src/engine/exporters', 'src/engine/modules',
    'src/engine/repos', 'src/engine/tasks', 'src/engine/packagers', 'src/engine/templates',
    'src/main', 'src/preload', 'src/shared', 'src/renderer/src',
  ];

  /** 仅由模板渲染消费的设置（模板渲染时才读，故显式白名单并注明消费方） */
  const TEMPLATE_CONSUMED = new Set([
    // desktop/src/engine/templates/messages.html（经 config.Messages.* 读取）
    'Messages.isShowMore',
    // desktop/src/engine/templates/messages.html 与 export-resources 的独立脚本
    'Messages.hasThatYearToday',
    // config-spec.json 的 labelMaps（DOWNLOAD_MAP 等）由 schema 生成器消费
  ]);

  function collectSourceFiles(dir, acc = []) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) return acc;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const p = join(abs, e.name);
      if (e.isDirectory()) {
        if (['node_modules', 'dist', 'spa-dist', 'export-resources', 'vendor'].includes(e.name)) continue;
        collectSourceFiles(join(dir, e.name), acc);
      } else if (/\.(js|mjs|ts|vue|html)$/.test(e.name)) {
        acc.push(p);
      }
    }
    return acc;
  }

  /** 去掉注释，避免“只在注释里出现过”被误判为读取点 */
  function stripComments(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  }

  it('spec 中每个设置项都有真实读取点（哑巴设置守卫）', () => {
    const sources = READ_SCAN_DIRS.flatMap((d) => collectSourceFiles(d))
      .map((f) => stripComments(readFileSync(f, 'utf8')))
      .join('\n');

    /** 构造「属性访问」正则：xxx.leaf / xxx?.leaf / xxx['leaf'] */
    const propRe = (leaf) =>
      new RegExp(
        `(?:[A-Za-z_$][\\w$]*\\s*\\??\\.)*[A-Za-z_$][\\w$]*\\s*\\??\\.\\s*${leaf}\\b` +
        `|\\[\\s*['"]${leaf}['"]\\s*\\]`
      );

    const missing = [];
    for (const [mod, group] of specGroups) {
      for (const item of group.items) {
        const path = `${mod}.${item.key}`;
        if (TEMPLATE_CONSUMED.has(path)) continue;
        const leaf = item.key.split('.').pop();
        if (!propRe(leaf).test(sources)) missing.push(`${path}（${item.label}）`);
      }
    }
    expect(
      missing,
      `以下设置项在 UI 可改但没有任何读取点（改了不起作用）：\n${missing.join('\n')}\n` +
      `若确有生效路径（如仅由模板消费），请加入 TEMPLATE_CONSUMED 白名单并注明消费方。`
    ).toEqual([]);
  });
});
