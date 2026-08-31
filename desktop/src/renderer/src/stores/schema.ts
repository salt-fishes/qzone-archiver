/**
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

export const EXPORT_OPTS: string[] = ["SPA","HTML","MarkDown","JSON"];

export const INCREMENT_OPTS: string[] = ["Full","Last","Custom"];

export const EXPORT_MAP: Record<string, string> = {
  "SPA": "网页版",
  "HTML": "单文件网页",
  "MarkDown": "文本",
  "JSON": "原始数据"
};

export const INCREMENT_MAP: Record<string, string> = {
  "Full": "全量",
  "Last": "上次（只备份新增）",
  "LastTime": "上次备份（累积）",
  "Custom": "自定义（指定时间）"
};

export const DOWNLOAD_MAP: Record<string, string> = {
  "Browser": "应用内下载",
  "Thunder_Link": "迅雷（链接文件）",
  "Thunder_Clipboard": "迅雷（剪贴板）",
  "Aria2": "Aria2 / Motrix"
};

export const COMMON_SCHEMA: SettingItem[] = [
    { key: 'downloadType', label: '文件下载方式', type: 'select', options: ["Browser","Thunder_Link","Thunder_Clipboard","Aria2"], labelMap: DOWNLOAD_MAP },
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
  Messages: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
    { key: 'isFull', label: '获取说说全文', type: 'checkbox' },
    { key: 'isShowMore', label: '默认展开全文', type: 'checkbox' },
    { key: 'hasThatYearToday', label: '生成那年今日', type: 'checkbox' },
    { key: 'RecoverDeleted', label: '恢复已删除说说', type: 'checkbox', help: '实验性：通过互动消息恢复' },
    { key: 'isFilterKeyword', label: '过滤广告关键词', type: 'checkbox' },
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ],
  Blogs: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ],
  Diaries: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ],
  Photos: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
    { key: 'Comments.isGet', label: '相册评论', type: 'checkbox' },
    { key: 'Images.Comments.isGet', label: '图片评论', type: 'checkbox' },
    { key: 'Images.Info.isGet', label: '获取图片详情', type: 'checkbox' },
    { key: 'Images.isGetVideo', label: '下载图片视频', type: 'checkbox' },
    { key: 'Images.isGetPreview', label: '下载预览图', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ],
  Videos: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
    { key: 'Comments.isGet', label: '获取视频评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
  ],
  Boards: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
  ],
  Friends: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'isIncrement', label: '增量备份', type: 'checkbox', help: '按上次备份结果只采集新增好友' },
  ],
  Favorites: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
  ],
  Shares: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', min: 1 },
  ],
  Visitors: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「上次」只采集上次之后的新内容并累积全部历史；「自定义」从指定时间起备份' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '仅「自定义」模式生效' },
  ],
};

export const DEV_SCHEMA: SettingItem[] = [
    { key: 'Maps.TxKey', label: '腾讯地图 Key', type: 'text', help: '用于微信朋友圈说说坐标转地址；不填则跳过，不影响备份' },
];

/** 设置默认值（与引擎 config.js Default_Config 对齐，来源 config-spec.json） */
export function defaultSettings() {
  return {
    Messages: {
      "exportType": "SPA",
      "IncrementType": "Full",
      "IncrementTime": "2005-06-06 00:00:00",
      "isFull": true,
      "isShowMore": false,
      "hasThatYearToday": true,
      "RecoverDeleted": false,
      "isFilterKeyword": false,
      "Comments": {
        "isFull": true
      },
      "Like": {
        "isGet": true
      },
      "Visitor": {
        "isGet": false,
        "randomSeconds": {
          "min": 1,
          "max": 2
        }
      }
    },
    Blogs: {
      "exportType": "SPA",
      "IncrementType": "Full",
      "IncrementTime": "2005-06-06 00:00:00",
      "Comments": {
        "isFull": true
      },
      "Like": {
        "isGet": true
      },
      "Visitor": {
        "isGet": false,
        "randomSeconds": {
          "min": 1,
          "max": 2
        }
      }
    },
    Diaries: {
      "exportType": "SPA",
      "IncrementType": "Full",
      "IncrementTime": "2005-06-06 00:00:00",
      "Comments": {
        "isFull": true
      },
      "Like": {
        "isGet": true
      },
      "Visitor": {
        "isGet": false,
        "randomSeconds": {
          "min": 1,
          "max": 2
        }
      }
    },
    Photos: {
      "exportType": "SPA",
      "IncrementType": "Full",
      "IncrementTime": "2005-06-06 00:00:00",
      "Comments": {
        "isGet": true
      },
      "Images": {
        "Comments": {
          "isGet": true
        },
        "Info": {
          "isGet": true
        },
        "isGetVideo": false,
        "isGetPreview": true
      },
      "Like": {
        "isGet": true
      },
      "Visitor": {
        "isGet": false,
        "randomSeconds": {
          "min": 1,
          "max": 2
        }
      }
    },
    Videos: {
      "exportType": "SPA",
      "IncrementType": "Full",
      "IncrementTime": "2005-06-06 00:00:00",
      "Comments": {
        "isGet": true
      },
      "Like": {
        "isGet": true
      }
    },
    Boards: {
      "exportType": "SPA",
      "IncrementType": "Full",
      "IncrementTime": "2005-06-06 00:00:00"
    },
    Friends: {
      "exportType": "SPA",
      "isIncrement": false
    },
    Favorites: {
      "exportType": "SPA",
      "IncrementType": "Full",
      "IncrementTime": "2005-06-06 00:00:00"
    },
    Shares: {
      "exportType": "SPA",
      "IncrementType": "Full",
      "IncrementTime": "2005-06-06 00:00:00",
      "Comments": {
        "isFull": true
      },
      "Like": {
        "isGet": true
      },
      "Visitor": {
        "isGet": false,
        "randomSeconds": {
          "min": 1,
          "max": 2
        }
      }
    },
    Visitors: {
      "exportType": "SPA",
      "IncrementType": "Full",
      "IncrementTime": "2005-06-06 00:00:00"
    },
    Common: {
      "downloadType": "Browser",
      "downloadThread": 10,
      "downloadSleep": 2,
      "isAutoFileSuffix": true,
      "autoFileSuffixTimeOut": 30,
      "AvatarHost": 1,
      "listRetryCount": 5,
      "listRetrySleep": 2,
      "waitCount": 2,
      "waitTime": 3600,
      "thunderTaskNum": 1500,
      "thunderTaskSleep": 60,
      "disabledShelf": false,
      "useImageProxyGateway": false,
      "hasUserLink": true,
      "Aria2": {
        "rpc": "http://localhost:6800/jsonrpc",
        "token": ""
      },
      "refererUrls": [
        "gtimg.com"
      ]
    },
    Dev: {
      "Maps": {
        "TxKey": ""
      }
    },
  };
}
