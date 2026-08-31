/**
 * P4.2 配置单一来源：spec → 渲染层 schema.ts
 *
 * 读取 src/engine/config-spec.json，生成 src/renderer/src/stores/schema.ts：
 *   - SettingItem 类型 + COMMON_SCHEMA / MODULE_SCHEMA / DEV_SCHEMA 表单模型
 *   - EXPORT_OPTS / EXPORT_MAP / INCREMENT_OPTS / INCREMENT_MAP / DOWNLOAD_MAP
 *   - defaultSettings()（引擎 Default_Config 对齐的默认值）
 *
 * 生成文件带 DO NOT EDIT 头，修改配置请改 config-spec.json 后重跑本脚本。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = join(ROOT, 'src/engine/config-spec.json');
const OUT_PATH = join(ROOT, 'src/renderer/src/stores/schema.ts');

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
const labelMaps = spec.labelMaps;

/** dot 路径默认值 → 嵌套对象 */
function defaultsTree(items) {
  const out = {};
  for (const item of items) {
    const parts = item.key.split('.');
    let o = out;
    for (let i = 0; i < parts.length - 1; i++) {
      o[parts[i]] = o[parts[i]] ?? {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = structuredClone(item.default);
  }
  return out;
}

const tsItem = (item) => {
  const fields = [`key: '${item.key}'`, `label: '${item.label}'`, `type: '${item.type}'`];
  if (item.options) fields.push(`options: ${JSON.stringify(item.options)}`);
  if (item.labelMap) fields.push(`labelMap: ${item.labelMap}`);
  if (item.help) fields.push(`help: '${item.help}'`);
  if (item.min !== undefined) fields.push(`min: ${item.min}`);
  if (item.max !== undefined) fields.push(`max: ${item.max}`);
  if (item.step !== undefined) fields.push(`step: ${item.step}`);
  return `    { ${fields.join(', ')} },`;
};

const groupNames = Object.keys(spec.groups);
const moduleGroups = groupNames.filter((g) => spec.groups[g].ui === 'module');

const schemaItems = (name) =>
  spec.groups[name].items.map(tsItem).join('\n');

const defaultsLiteral = (name) => {
  const tree = defaultsTree(spec.groups[name].items);
  const body = JSON.stringify(tree, null, 2)
    .split('\n')
    .map((l, i) => (i === 0 ? l : '    ' + l))
    .join('\n');
  return body;
};

const labelMapEntries = Object.entries(labelMaps)
  .map(([k, v]) => `export const ${k}: Record<string, string> = ${JSON.stringify(v, null, 2)};`)
  .join('\n\n');

const commonItems = spec.groups.Common.items;
const exportOpts = commonItems.find((i) => i.key === 'exportType')?.options
  ?? spec.groups.Messages.items.find((i) => i.key === 'exportType').options;
const incrementOpts = spec.groups.Messages.items.find((i) => i.key === 'IncrementType').options;

const out = `/**
 * 设置模型（P4.2 自动生成——DO NOT EDIT）
 *
 * 由 scripts/gen-ui-schema.mjs 从 src/engine/config-spec.json 生成，
 * 是 COMMON_SCHEMA / MODULE_SCHEMA / DEV_SCHEMA / defaultSettings 的唯一来源；
 * 修改配置请编辑 config-spec.json 后运行 npm run gen:config。
 */

export type SettingItem = {
  key: string;
  label: string;
  type: 'select' | 'checkbox' | 'number' | 'text' | 'textarea' | 'range' | 'datetime';
  options?: string[];
  /** 下拉选项中文显示（未覆盖的选项显示原值） */
  labelMap?: Record<string, string>;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
};

export const EXPORT_OPTS: string[] = ${JSON.stringify(exportOpts)};

export const INCREMENT_OPTS: string[] = ${JSON.stringify(incrementOpts)};

${labelMapEntries}

export const COMMON_SCHEMA: SettingItem[] = [
${schemaItems('Common')}
];

export const MODULE_SCHEMA: Record<string, SettingItem[]> = {
${moduleGroups.map((m) => `  ${m}: [\n${schemaItems(m)}\n  ],`).join('\n')}
};

export const DEV_SCHEMA: SettingItem[] = [
${schemaItems('Dev')}
];

/** 设置默认值（与引擎 config.js Default_Config 对齐，来源 config-spec.json） */
export function defaultSettings() {
  return {
${groupNames.filter((g) => g !== 'Common' && g !== 'Dev').map((m) => `    ${m}: ${defaultsLiteral(m)},`).join('\n')}
    Common: ${defaultsLiteral('Common')},
    Dev: ${defaultsLiteral('Dev')},
  };
}
`;

writeFileSync(OUT_PATH, out, 'utf8');
console.log(`[gen-ui-schema] 已生成 ${OUT_PATH}`);
