/**
 * 配置 store（P4.1 真 Pinia 化：defineStore setup 写法）
 * 职责：备份模块勾选（selected）/ 保存位置（targetDir）/ 引擎设置（settings）
 *       + 相册选择状态 + 配置持久化 watch + buildEngineConfig
 * 模块元数据常量与 schema、纯工具函数保留为模块级导出（与 store 实例无关）；
 * 被备份向导、设置模态与旧工作区共用；IPC 契约不变。
 */
import { ref, computed, watch, reactive } from 'vue';
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import modulesData from '../../../shared/modules.json';

/* ============ 模块元数据（P1-4 单一来源：src/shared/modules.json 派生） ============ */

type ModuleDef = { key: string; zh: string; exportable: boolean };
const MODULE_DEFS = modulesData as ModuleDef[];

export const MODULES: string[] = MODULE_DEFS.map((m) => m.key);

/** 模块图标（内联 SVG path，统一 1.5 stroke 几何风格） */
export const MODULE_ICONS: Record<string, string> = {
  Messages: 'M12 3c-4.97 0-9 3.58-9 8 0 1.66.56 3.2 1.5 4.5L3 21l5.4-1.8c1.06.5 2.3.8 3.6.8 4.97 0 9-3.58 9-8s-4.03-8-9-8Z',
  Blogs: 'M7 3h7l4 4v14H7V3Z M14 3v4h4 M10 11h5 M10 15h5',
  Diaries: 'M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z M5 4v16',
  Photos: 'M4 6h16v12H4V6Z M4 13l4-4 4 4 3-3 5 5 M8 9.5a1 1 0 1 0 .01 0',
  Videos: 'M5 6h14v12H5V6Z M10 9l5 3-5 3V9Z',
  Boards: 'M4 5h16v14H4V5Z M4 9h16 M7 12h3 M7 15h5',
  Favorites: 'M12 4l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8L12 4Z',
  Shares: 'M9 12a2 2 0 1 1 0 .01 M15 6a2 2 0 1 1 0 .01 M15 18a2 2 0 1 1 0 .01 M10.5 11l3-4 M10.5 13l3 4',
  Friends: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M3 20c0-3 2.7-5 6-5s6 2 6 5 M16 8a3 3 0 1 0 0-6 M21 20c0-2.4-1.6-4.3-4-4.8',
  Visitors: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M5 20c0-3 3.1-5 7-5s7 2 7 5 M6 3l1.5 2 M18 3l-1.5 2 M3 7h2 M19 7h2',
  Statistics: 'M5 20V12 M10 20V7 M15 20V10 M20 20V4',
};

export const MODULE_META: Record<string, { label: string }> = Object.fromEntries(
  MODULE_DEFS.map((m) => [m.key, { label: m.zh }]),
);

/** 有导出类型设置的模块（设置模型键；Statistics 为收尾统计，exportable:false） */
export const MODULE_KEYS: string[] = MODULE_DEFS.filter((m) => m.exportable).map((m) => m.key);

/* ============ 设置模型（完整 QZone_Config 形状，与引擎 config.js 默认对齐） ============ */

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

export const EXPORT_OPTS = ['SPA', 'HTML', 'MarkDown', 'JSON'];
/** 备份类型中文名（设置页下拉显示） */
export const EXPORT_MAP: Record<string, string> = {
  SPA: '网页版', HTML: '单文件网页', MarkDown: '文本', JSON: '原始数据',
};
/** 增量档位（LastTime 已并入 Last：只备份新增内容；LastTime 仅兼容旧配置显示） */
export const INCREMENT_OPTS = ['Full', 'Last', 'Custom'];
export const INCREMENT_MAP: Record<string, string> = {
  Full: '全量',
  Last: '上次（只备份新增）',
  LastTime: '上次备份（累积）',
  Custom: '自定义（指定时间）',
};
export const DOWNLOAD_MAP: Record<string, string> = {
  Browser: '应用内下载',
  Thunder_Link: '迅雷（链接文件）',
  Thunder_Clipboard: '迅雷（剪贴板）',
  Aria2: 'Aria2 / Motrix',
};

/** 模块通用设置（Messages 单独扩展） */
function moduleSchema(extra: SettingItem[] = []): SettingItem[] {
  return [
    { key: 'exportType', label: '备份类型', type: 'select', options: EXPORT_OPTS, labelMap: EXPORT_MAP },
    {
      key: 'IncrementType',
      label: '增量备份',
      type: 'select',
      options: INCREMENT_OPTS,
      labelMap: INCREMENT_MAP,
      help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份',
    },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
    ...extra,
  ];
}

export const COMMON_SCHEMA: SettingItem[] = [
  { key: 'downloadType', label: '文件下载方式', type: 'select', options: ['Browser', 'Thunder_Link', 'Thunder_Clipboard', 'Aria2'], labelMap: DOWNLOAD_MAP },
  { key: 'downloadThread', label: '下载并发数', type: 'number', min: 1 },
  { key: 'downloadSleep', label: '下载间隔（秒）', type: 'number', min: 0, step: 0.5 },
  { key: 'isAutoFileSuffix', label: '自动识别文件后缀', type: 'checkbox' },
  { key: 'autoFileSuffixTimeOut', label: '后缀识别超时（秒）', type: 'number', min: 10 },
  { key: 'AvatarHost', label: '头像服务器（0 自动）', type: 'number', min: 0, max: 4 },
  { key: 'listRetryCount', label: '列表重试次数', type: 'number', min: 0 },
  { key: 'listRetrySleep', label: '列表重试间隔（秒）', type: 'number', min: 0 },
  { key: 'waitCount', label: '稍候重试次数', type: 'number', min: 0 },
  { key: 'waitTime', label: '稍候重试间隔（秒）', type: 'number', min: 1 },
  { key: 'thunderTaskNum', label: '迅雷任务数', type: 'number', min: 50 },
  { key: 'thunderTaskSleep', label: '迅雷唤起间隔（秒）', type: 'number', min: 1 },
  { key: 'disabledShelf', label: '隐藏浏览器下载栏', type: 'checkbox' },
  { key: 'useImageProxyGateway', label: 'Aria2 图片走代理网关', type: 'checkbox', help: '实验性：仅 Aria2 图片任务生效' },
  { key: 'hasUserLink', label: '生成用户空间链接', type: 'checkbox' },
  { key: 'Aria2.rpc', label: 'Aria2 RPC 地址', type: 'text' },
  { key: 'Aria2.token', label: 'Aria2 密钥', type: 'text' },
  { key: 'refererUrls', label: 'Referer 域名', type: 'textarea', help: '一行一个域名，用于浏览器下载防盗链' },
];

export const MODULE_SCHEMA: Record<string, SettingItem[]> = {
  Messages: moduleSchema([
    { key: 'isFull', label: '获取说说全文', type: 'checkbox' },
    { key: 'isShowMore', label: '默认展开全文', type: 'checkbox' },
    { key: 'hasThatYearToday', label: '生成那年今日', type: 'checkbox' },
    { key: 'RecoverDeleted', label: '恢复已删除说说', type: 'checkbox', help: '实验性：通过互动消息恢复' },
    { key: 'isFilterKeyword', label: '过滤广告关键词', type: 'checkbox' },
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ]),
  Blogs: moduleSchema([
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ]),
  Diaries: moduleSchema([
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ]),
  Photos: moduleSchema([
    { key: 'Comments.isGet', label: '相册评论', type: 'checkbox' },
    { key: 'Images.Comments.isGet', label: '图片评论', type: 'checkbox' },
    { key: 'Images.Info.isGet', label: '获取图片详情', type: 'checkbox' },
    { key: 'Images.isGetVideo', label: '下载图片视频', type: 'checkbox' },
    { key: 'Images.isGetPreview', label: '下载预览图', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ]),
  Videos: moduleSchema([
    { key: 'Comments.isGet', label: '获取视频评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
  ]),
  Boards: moduleSchema(),
  Friends: moduleSchema(),
  Favorites: moduleSchema(),
  Shares: moduleSchema([
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ]),
  Visitors: moduleSchema(),
};

export const DEV_SCHEMA: SettingItem[] = [
  { key: 'Maps.TxKey', label: '腾讯地图 Key', type: 'text', help: '用于微信朋友圈说说坐标转地址；不填则跳过，不影响备份' },
];

/** 设置默认值（对齐引擎 config.js Default_Config） */
export function defaultSettings() {
  return {
    Common: {
      downloadType: 'Browser', downloadThread: 10, downloadSleep: 2,
      isAutoFileSuffix: true, autoFileSuffixTimeOut: 30, AvatarHost: 1,
      listRetryCount: 5, listRetrySleep: 2, waitCount: 2, waitTime: 3600,
      thunderTaskNum: 1500, thunderTaskSleep: 60, disabledShelf: false,
      useImageProxyGateway: false, hasUserLink: true,
      Aria2: { rpc: 'http://localhost:6800/jsonrpc', token: '' },
      refererUrls: ['gtimg.com'],
    },
    Dev: { Maps: { TxKey: '' } },
    Messages: {
      exportType: 'SPA', IncrementType: 'Full', IncrementTime: '2005-06-06 00:00:00', isFull: true, isShowMore: false,
      hasThatYearToday: true, RecoverDeleted: false, isFilterKeyword: false,
      Comments: { isFull: true }, Like: { isGet: true },
      Visitor: { isGet: false, randomSeconds: { min: 1, max: 2 } },
    },
    Blogs: { exportType: 'SPA', IncrementType: 'Full', IncrementTime: '2005-06-06 00:00:00', Comments: { isFull: true }, Like: { isGet: true }, Visitor: { isGet: false, randomSeconds: { min: 1, max: 2 } } },
    Diaries: { exportType: 'SPA', IncrementType: 'Full', IncrementTime: '2005-06-06 00:00:00', Comments: { isFull: true }, Like: { isGet: true }, Visitor: { isGet: false, randomSeconds: { min: 1, max: 2 } } },
    Photos: {
      exportType: 'SPA', IncrementType: 'Full', IncrementTime: '2005-06-06 00:00:00', Comments: { isGet: true },
      Images: { Comments: { isGet: true }, Info: { isGet: true }, isGetVideo: false, isGetPreview: true },
      Like: { isGet: true }, Visitor: { isGet: false, randomSeconds: { min: 1, max: 2 } },
      // 注意：albumSelect 默认不设置（undefined = 未配置 = 备份全部相册；显式空数组 = 不备份相册）
      // 相册列表加载后由 UI 默认全选并写入数组
    },
    Videos: { exportType: 'SPA', IncrementType: 'Full', IncrementTime: '2005-06-06 00:00:00', Comments: { isGet: true }, Like: { isGet: true } },
    Boards: { exportType: 'SPA', IncrementType: 'Full' },
    Friends: { exportType: 'SPA', IncrementType: 'Full' },
    Favorites: { exportType: 'SPA', IncrementType: 'Full' },
    Shares: { exportType: 'SPA', IncrementType: 'Full', IncrementTime: '2005-06-06 00:00:00', Comments: { isFull: true }, Like: { isGet: true }, Visitor: { isGet: false, randomSeconds: { min: 1, max: 2 } } },
    Visitors: { exportType: 'SPA', IncrementType: 'Full' },
  };
}

/* ============ 纯工具 ============ */

/** 深度合并（默认结构 + 已保存覆盖），普通对象 */
export function deepMerge(base: any, over: any): any {
  const out: any = Array.isArray(base) ? [...base] : { ...base };
  if (!over || typeof over !== 'object' || Array.isArray(over)) return out;
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** dot 路径取值 */
export function getPath(obj: any, key: string): any {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
/** dot 路径赋值 */
export function setPath(obj: any, key: string, val: any) {
  const parts = key.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] == null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = val;
}

/** 转纯对象（reactive proxy 跨 IPC 会 DataCloneError，必须深拷贝） */
export function toPlain<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** 引擎时间格式 "yyyy-MM-dd HH:mm:ss" → datetime-local 值 "yyyy-MM-ddTHH:mm" */
export function toLocalTime(s: string) {
  const clean = String(s || '').replace('T', ' ').slice(0, 16);
  return clean ? clean.replace(' ', 'T') : '';
}
/** datetime-local 值 "yyyy-MM-ddTHH:mm" → 引擎格式 "yyyy-MM-dd HH:mm:ss" */
export function toDbTime(s: string) {
  const clean = String(s || '').replace('T', ' ').trim();
  return clean.length === 16 ? `${clean}:00` : clean;
}

/* ============ Store ============ */

/** 相册条目（设置模态 / 备份向导步骤① 共享） */
export type AlbumItem = {
  id: string | number;
  name: string;
  classid?: string | number;
  className?: string;
  total?: number;
  pre?: string;
  desc?: string;
};

export const useConfigStore = defineStore('config', () => {
  const authStore = useAuthStore();

  /** 模块勾选（备份向导步骤①） */
  const selected = reactive<Record<string, boolean>>({ Messages: true });
  /** 备份保存位置（向导步骤②） */
  const targetDir = ref('');
  /** 引擎设置（完整 QZone_Config 形状；宽松索引签名便于按模块/字段访问） */
  const settings = ref<Record<string, any>>(defaultSettings());

  /** 已勾选模块数量 */
  const selectedCount = computed(() => MODULES.filter((m) => selected[m]).length);
  /** 已选模块 */
  const selectedModules = computed(() => MODULES.filter((m) => selected[m]));

  /* -------- 相册选择（设置模态 / 备份向导步骤① 共享） -------- */

  const albums = ref<AlbumItem[]>([]);
  const albumsLoading = ref(false);
  const albumError = ref('');
  /** 勾选的相册 ID（字符串），联动 settings.Photos.albumSelect */
  const albumSel = ref<string[]>([]);

  const albumClassNames = computed(() => {
    const map = new Map<string, AlbumItem[]>();
    for (const a of albums.value) {
      const key = a.className || '其他';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    // 返回 {cls, items} 数组而非 Map：Vue 3.5 的 v-for 迭代 Map 时解构出的是 [key,value] 条目对和索引，
    // 与文档 (value, key) 不符，会导致分组名显示索引、行数据全为 undefined
    return Array.from(map, ([cls, items]) => ({ cls, items }));
  });

  async function loadAlbums() {
    if (albumsLoading.value) return;
    albumsLoading.value = true;
    albumError.value = '';
    try {
      const r = await window.api.backup.listAlbums();
      if (!r?.ok) {
        albumError.value = r?.error || '获取相册列表失败';
        return;
      }
      albums.value = r.albums || [];
      // 保留仍然存在的已选相册
      const ids = new Set((albums.value || []).map((a) => String(a.id)));
      albumSel.value = albumSel.value.filter((id) => ids.has(id));
      // 默认全选：从未配置过相册选择（albumSelect 非数组）时，首次加载自动全选并写入设置
      if (!Array.isArray(getPath(settings.value.Photos, 'albumSelect'))) {
        albumSel.value = [...ids];
      }
    } catch (e: any) {
      albumError.value = e?.message || String(e);
    } finally {
      albumsLoading.value = false;
    }
  }

  function albumSelAll() {
    albumSel.value = albums.value.map((a) => String(a.id));
  }
  function albumSelNone() {
    albumSel.value = [];
  }

  /** 相册勾选 → 写入设置（自动保存 + 备份时经 buildEngineConfig 传递） */
  watch(
    albumSel,
    (v) => {
      setPath(settings.value.Photos, 'albumSelect', [...v]);
    },
    { deep: true }
  );

  /** 勾选「相册」模块时自动加载相册列表（设置模态与备份向导共用） */
  watch(
    () => selected.Photos,
    (on) => {
      if (on && authStore.auth.loggedIn && !albums.value.length && !albumsLoading.value) {
        loadAlbums();
      }
    }
  );

  /** 模块设置摘要（联动：展示勾选模块的关键配置） */
  function moduleSummary(mod: string): string {
    const cfg = settings.value[mod];
    if (!cfg) return '';
    const bits: string[] = [cfg.exportType || 'SPA'];
    if (getPath(cfg, 'Comments.isFull')) bits.push('全评论');
    if (getPath(cfg, 'Comments.isGet')) bits.push('评论');
    if (getPath(cfg, 'Like.isGet')) bits.push('赞');
    if (getPath(cfg, 'Visitor.isGet')) bits.push('访客');
    return bits.join(' · ');
  }

  /**
   * 按 schema 提取设置 → 构造传给引擎的 QZone_Config（仅含 UI 暴露字段，避免覆盖引擎其它配置）
   * 注意：settings 为 Vue reactive proxy，提取值跨 IPC 会 DataCloneError，必须 toPlain 深拷贝
   */
  function buildEngineConfig() {
    const cfg: Record<string, any> = {};
    const groups: [string, SettingItem[]][] = [
      ['Common', COMMON_SCHEMA], ['Dev', DEV_SCHEMA],
      ...MODULE_KEYS.map((m) => [m, MODULE_SCHEMA[m]] as [string, SettingItem[]]),
    ];
    for (const [mod, items] of groups) {
      const modCfg: Record<string, any> = {};
      for (const item of items) {
        const val = getPath(settings.value[mod], item.key);
        if (item.type === 'range') {
          const r = getPath(settings.value[mod], item.key);
          setPath(modCfg, `${item.key}.min`, r?.min);
          setPath(modCfg, `${item.key}.max`, r?.max);
        } else if (item.key === 'IncrementTime' && getPath(settings.value[mod], 'IncrementType') !== 'Custom') {
          // 仅「自定义」模式透传增量时间；否则会覆盖引擎为 Last 自动刷新的增量点
          continue;
        } else {
          setPath(modCfg, item.key, val);
        }
      }
      if (mod === 'Photos') {
        // 相册多选：albumSelect 不在 schema 中，单独透传
        // undefined = 未配置（引擎默认全部相册）；[] = 明确不备份相册；非空 = 按选择备份
        const albumSelVal = getPath(settings.value.Photos, 'albumSelect');
        if (Array.isArray(albumSelVal)) modCfg.albumSelect = albumSelVal;
      }
      cfg[mod] = modCfg;
    }
    return toPlain(cfg);
  }

  function pickDir() {
    return window.api.fs.selectDirectory('选择备份目标文件夹').then((r) => {
      if (!r.canceled && r.path) {
        targetDir.value = r.path;
        window.api.config.set({ targetDir: r.path });
      }
    });
  }

  function openFolder() {
    if (targetDir.value) window.api.fs.showInFolder(targetDir.value);
  }

  /* -------- 持久化（init 时恢复 + watch 自动保存） -------- */

  let configLoaded = false;
  let settingsTimer: number | undefined;

  watch(
    selected,
    (v) => {
      if (!configLoaded) return;
      window.api.config.set({ selectedModules: { ...v } });
    },
    { deep: true }
  );

  watch(
    settings,
    (v) => {
      if (!configLoaded) return;
      window.clearTimeout(settingsTimer);
      settingsTimer = window.setTimeout(() => {
        window.api.config.set({ engineSettings: toPlain(v) }).catch((e) => {
          console.warn('设置自动保存失败', e);
        });
      }, 300);
    },
    { deep: true }
  );

  /** 恢复上次记忆的配置（幂等，App.vue onMounted 调用） */
  async function initConfig() {
    if (configLoaded) return;
    try {
      const c = await window.api.config.get();
      if (c?.targetDir) targetDir.value = c.targetDir;
      if (c?.selectedModules && typeof c.selectedModules === 'object') {
        for (const m of MODULES) selected[m] = !!c.selectedModules[m];
      }
      if (c?.engineSettings) settings.value = deepMerge(defaultSettings(), c.engineSettings);
      // 恢复已保存的相册选择
      albumSel.value = [...((settings.value.Photos as any)?.albumSelect || [])];
    } catch (e) {
      console.warn('读取配置失败', e);
    }
    configLoaded = true;
  }

  return {
    // 状态
    selected, targetDir, settings, selectedCount, selectedModules,
    // 相册
    albums, albumsLoading, albumError, albumSel, albumClassNames,
    loadAlbums, albumSelAll, albumSelNone,
    // 函数
    moduleSummary, buildEngineConfig, pickDir, openFolder, initConfig,
  };
});
