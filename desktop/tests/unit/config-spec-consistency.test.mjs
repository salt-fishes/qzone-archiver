/**
 * P4.2 配置单一来源一致性（§6.2 验收）
 * spec（config-spec.json）↔ 渲染层 schema.ts defaultSettings() ↔ 引擎 config.js Default_Config
 * 三方在 spec 覆盖字段上的字段集合与默认值必须零 diff；任一侧手改漂移即失败。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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
});
