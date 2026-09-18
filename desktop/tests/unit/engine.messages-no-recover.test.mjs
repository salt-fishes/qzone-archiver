/**
 * v4.9 §J 「已删除说说恢复」功能下线守卫（issue #5：owner 结论"实验性功能后续删除"）
 *
 * 验收口径：设置项 / 采集实现 / API 挂接 / FEEDS_LIST_URL（feeds2_html_pav_all，
 * issue #2 的 501 报错 URL）全部移除，且不回潮；旧归档展示侧不动（isDeleted 只删采集侧）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = join(ROOT, 'src/engine');

function evalFile(rel, extra = {}) {
  const sandbox = Object.assign({ window: {}, console, QZONE_MODULES: [] }, extra);
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ENGINE, rel), 'utf8'), sandbox, { filename: rel });
  return sandbox;
}

/** 取上下文内词法绑定（const 不挂 context 对象，须在上下文内求值） */
const grab = (ctx, expr) => vm.runInContext(expr, ctx);

describe('§J 设置项已删干净', () => {
  it('config-spec.json 无 RecoverDeleted（v5.1 C7 设置项三方守卫落地后自动覆盖）', () => {
    const spec = JSON.parse(readFileSync(join(ENGINE, 'config-spec.json'), 'utf8'));
    const keys = JSON.stringify(spec);
    expect(keys).not.toContain('RecoverDeleted');
  });

  it('引擎 Default_Config（config.js）无 RecoverDeleted / Feeds 配置块', () => {
    const ctx = evalFile('config.js');
    const Messages = ctx.QZone_Config.Messages;
    expect(Messages.RecoverDeleted).toBeUndefined();
    expect(Messages.Feeds).toBeUndefined();
  });

  it('渲染层 schema.ts 无 RecoverDeleted（UI 设置项 + 默认值）', () => {
    const code = readFileSync(join(ROOT, 'src/renderer/src/stores/schema.ts'), 'utf8');
    expect(code).not.toContain('RecoverDeleted');
  });
});

describe('§J 接口与实现已删干净', () => {
  it('REST_URLS 无 FEEDS_LIST_URL，整个 URL 表不含 feeds2_html_pav_all（issue #2 的 501 报错 URL）', () => {
    const ctx = evalFile('api/rest-urls.js');
    expect(grab(ctx, 'typeof FEEDS_LIST_URL === "undefined"')).toBe(true);
    expect(grab(ctx, 'JSON.stringify(REST_URLS)')).not.toContain('feeds2_html_pav_all');
  });

  it('API.Messages 不再挂 getDeletedMessages（modules 挂接已删）', () => {
    const code = readFileSync(join(ENGINE, 'modules/messages.js'), 'utf8');
    expect(code).not.toContain('getDeletedMessages');
  });

  it('collectors/messages.js 无 getDeletedMessages 实现', () => {
    const code = readFileSync(join(ENGINE, 'collectors/messages.js'), 'utf8');
    expect(code).not.toContain('getDeletedMessages');
  });

  it('api/modules/messages.js 无 getFeeds / getFeedsCount / parseFeedHtml（仅服务于该功能）', () => {
    const code = readFileSync(join(ENGINE, 'api/modules/messages.js'), 'utf8');
    expect(code).not.toContain('getFeedsCount');
    expect(code).not.toContain('parseFeedHtml');
    expect(code).not.toMatch(/\bgetFeeds\s*\(/); // getMoreItems 等其它方法不受影响
  });
});

describe('§J 全仓回归（防回潮）', () => {
  it('desktop/src 内不再出现任何相关标识（除本测试与迁移说明）', () => {
    const files = [
      'src/engine/config-spec.json',
      'src/engine/config.js',
      'src/engine/api/rest-urls.js',
      'src/engine/api/modules/messages.js',
      'src/engine/collectors/messages.js',
      'src/engine/exporters/messages.js',
      'src/engine/modules/messages.js',
      'src/renderer/src/stores/schema.ts',
      'src/renderer/src/views/TutorialView.vue',
    ];
    for (const rel of files) {
      const code = readFileSync(join(ROOT, rel), 'utf8');
      expect(code, `${rel} 仍含已删除说说恢复相关标识`).not.toMatch(
        /RecoverDeleted|getDeletedMessages|FEEDS_LIST_URL|feeds2_html_pav_all|getFeedsCount|parseFeedHtml/
      );
    }
    // 教程文案不再提"可恢复已删除说说"
    expect(readFileSync(join(ROOT, 'src/renderer/src/views/TutorialView.vue'), 'utf8')).not.toContain(
      '可恢复部分已删除说说'
    );
  });
});
