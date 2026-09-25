/**
 * v5.0 F1/F2/F5 好友昵称字段单测（此前对好友字段零覆盖：不改也全绿）
 *
 * 根因回顾：接口返回 `nick`，而 SPA 索引 / Markdown / Excel / HTML 模板 /
 * 桌面选择器分别按 `name` 或 `nickname` 取值 → 全链路错读（friends-index 的
 * name 恒空即此）。统一走 friendNick（nick || name || nickname）。
 *
 * ① SPA 索引 name 取值 === nick 且**键名仍为 name**（预构建 SPA 按此键读取，改键全空）
 * ② hasAvatar 由 custom_avatar || avatar 派生
 * ③ Markdown / Excel 昵称列取 nick（备注仍优先于昵称展示）
 * ④ 分组投影补 name 别名（只增，nick/remark/searchField 保留）
 * ⑤ 四种 fixture：nick / name / nickname / 全缺
 * ⑥ 静态守卫：五处取值表达式必须含 nick（防回退成单读 name/nickname）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = join(ROOT, 'src/engine');

/** 四种取值 fixture + 头像派生两条 */
const FIXTURES = [
  { uin: 1, nick: '昵称甲', remark: '备注甲', groupName: '分组一', avatar: 'a1' },
  { uin: 2, name: '旧name乙', remark: '', groupName: '分组一' },
  { uin: 3, nickname: '别名丙', remark: '', groupName: '' },
  { uin: 4, remark: '只有备注丁', groupName: '' }, // 昵称字段全缺 → name 为 ''（备注是独立列，不混入 name）
  { uin: 5, nick: '自定义头像戊', custom_avatar: 'c.png', avatar: '', groupName: '' },
  { uin: 6, nick: '无头像己', groupName: '' },
];
const EXPECT_NAME = ['昵称甲', '旧name乙', '别名丙', '', '自定义头像戊', '无头像己'];

/** vm 沙箱：伪造 exporters/friends.js 所需的最小引擎全局，捕获各路导出产物 */
function makeCtx() {
  const captured = { jsonFiles: [], texts: [], excelRows: [] };
  class StatusIndicator {
    async setIndex() { return this; }
    setTotal() {}
    addSuccess() {}
    complete() {}
    print() {}
  }
  const sandbox = {
    console: { info() {}, warn() {}, error() {} },
    captured,
    StatusIndicator,
    QZone_Config: { Friends: { SpecialCare: false, Interactive: false, ZoneAccess: false } },
    API: {
      Common: {
        getModuleRoot: (m) => `/mod/${m}`,
        writeJsonToJs: async (name, data, path) => { captured.jsonFiles.push({ name, data, path }); },
        formatDate: (ts) => String(ts),
        getUserLink: (uin, nickname) => `${uin}:${nickname}`,
        getUserUrl: (uin) => `https://q/${uin}`,
        getMessageUrl: (uin) => `https://m/${uin}`,
        writeHtmlofTpl: async () => {},
      },
      Utils: {
        createFolder: async () => {},
        writeText: async (text) => { captured.texts.push(text); return { name: 'f' }; },
        groupedByField: (arr, field) => {
          const m = new Map();
          for (const it of arr) {
            const k = it[field] || '';
            if (!m.has(k)) m.set(k, []);
            m.get(k).push(it);
          }
          return m;
        },
        toArrayBuffer: (x) => x,
        writeFile: async () => ({ name: 'f' }),
      },
      Friends: {
        getShowCare: () => '',
        getShowFriendTime: () => '',
        getShowAccessType: () => '',
        getShowFriendType: () => '',
        getShowIntimacyScore: () => '',
        getShowCommonFriend: () => '',
        getShowCommonGroup: () => '',
        exportToExcel: async () => {},
        exportToHtml: async () => {},
        exportToMarkDown: async () => {},
        exportToJson: async () => {},
        exportToSpa: async () => {},
      },
    },
    XLSX: {
      utils: {
        book_new: () => ({}),
        aoa_to_sheet: (rows) => { captured.excelRows.push(rows); return {}; },
        book_append_sheet: () => {},
      },
      write: () => 'bin',
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  // MD 模板用 '{0}'.format(...)——原型方法须在 vm 自己的 realm 里定义
  vm.runInContext(
    'String.prototype.format = function (...a) { return this.replace(/\\{(\\d+)\\}/g, (m, i) => (a[i] !== undefined ? String(a[i]) : m)); };',
    sandbox
  );
  vm.runInContext(readFileSync(join(ENGINE, 'exporters/friends.js'), 'utf8'), sandbox, {
    filename: 'exporters/friends.js',
  });
  return sandbox;
}

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('F① SPA 索引：name 取值走 friendNick，键名不变', () => {
  it('四种 fixture（nick/name/nickname/全缺）+ 头像派生', async () => {
    const ctx = makeCtx();
    await ctx.QZoneExporters.Friends.exportToSpa([...FIXTURES]);
    const idxFile = ctx.captured.jsonFiles.find((f) => f.name === 'friendsIndex');
    expect(idxFile).toBeTruthy();
    const index = idxFile.data;
    expect(index).toHaveLength(FIXTURES.length);
    index.forEach((row, i) => expect(row.name).toBe(EXPECT_NAME[i]));
    // 键名仍叫 name（不能改成 nick——预构建 SPA 按 window.friendsIndex[].name 读取）
    expect(Object.keys(index[0])).toContain('name');
    expect(Object.keys(index[0])).not.toContain('nick');
    // ② hasAvatar 由 custom_avatar || avatar 派生
    expect(index[0].hasAvatar).toBe(true); // avatar
    expect(index[4].hasAvatar).toBe(true); // custom_avatar
    expect(index[5].hasAvatar).toBe(false); // 皆无
  });
});

describe('F② 分组投影：补 name 别名且全量字段无损', () => {
  it('friends-group 每项含 name，nick/remark/searchField 保留', async () => {
    const ctx = makeCtx();
    const input = [{ ...FIXTURES[0], searchField: '1 备注甲 昵称甲 bzj' }, FIXTURES[1]];
    await ctx.QZoneExporters.Friends.exportToSpa(input);
    const grpFile = ctx.captured.jsonFiles.find((f) => f.name === 'friendsGroup');
    expect(grpFile).toBeTruthy();
    const items = grpFile.data.flatMap((g) => g.friends);
    expect(items.map((f) => f.name)).toEqual(['昵称甲', '旧name乙']);
    // 只增不改：原始字段仍在（无损）
    expect(items[0].nick).toBe('昵称甲');
    expect(items[0].searchField).toBe('1 备注甲 昵称甲 bzj');
    expect(items[0].remark).toBe('备注甲');
  });
});

describe('F⑤ Markdown 昵称列：备注优先，回退走 friendNick', () => {
  it('有备注用备注，无备注用 nick/name/nickname', async () => {
    const ctx = makeCtx();
    await ctx.QZoneExporters.Friends.exportToMarkDown([...FIXTURES]);
    const md = ctx.captured.texts.join('');
    expect(md).toContain('1:备注甲'); // remark 优先
    expect(md).toContain('2:旧name乙'); // name 兜底
    expect(md).toContain('3:别名丙'); // nickname 兜底
    expect(md).toContain('5:自定义头像戊'); // nick 命中
  });
});

describe('F⑤ Excel「QQ昵称」列：取 friendNick（不取 remark）', () => {
  it('昵称列有值、备注列独立', async () => {
    const ctx = makeCtx();
    await ctx.QZoneExporters.Friends.exportToExcel([...FIXTURES]);
    const rows = ctx.captured.excelRows[0];
    expect(rows[0][1]).toBe('QQ昵称');
    expect(rows[1][1]).toBe('昵称甲'); // 昵称列 ≠ 备注
    expect(rows[1][2]).toBe('备注甲');
    expect(rows[2][1]).toBe('旧name乙'); // 无 nick → name
    expect(rows[3][1]).toBe('别名丙'); // 无 nick/name → nickname
  });
});

describe('F⑥ 静态守卫：昵称取值表达式必须含 nick（防回退单读 name/nickname）', () => {
  it('引擎与导出模板五处取值全部含 nick', () => {
    expect(read('src/engine/exporters/friends.js')).toMatch(/nick \|\|/);
    expect(read('src/engine/exporters/friends.js')).not.toContain("name: f.name || ''");
    expect(read('src/engine/tasks/orchestrator.js')).toMatch(/it\.nick \|\|/);
    expect(read('src/engine/export-resources/js/friends.js')).toContain('row.nick');
    expect(read('src/engine/export-resources/js/common.js')).toContain('friend.nick');
    expect(read('src/renderer/src/components/task/TargetPicker.vue')).toContain('searchField');
  });
});
