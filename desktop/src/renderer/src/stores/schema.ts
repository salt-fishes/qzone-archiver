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
    { key: 'downloadType', label: '文件下载方式', type: 'select', options: ["Browser","Thunder_Link","Thunder_Clipboard","Aria2"], labelMap: DOWNLOAD_MAP, help: '照片、视频用什么工具下载；一般用默认的「应用内下载」即可' },
    { key: 'downloadThread', label: '下载并发数', type: 'number', help: '同时下载几个文件。越大越快，但也更容易被官方限制，建议不超过 10', min: 1 },
    { key: 'downloadSleep', label: '下载间隔（秒）', type: 'number', help: '每批下载之间休息几秒，给服务器喘口气，降低被限制的风险', min: 0, step: 0.5 },
    { key: 'isAutoFileSuffix', label: '自动识别文件后缀', type: 'checkbox', help: '部分文件链接不带 .jpg 等后缀，开启后自动识别补全，否则可能无法直接打开' },
    { key: 'autoFileSuffixTimeOut', label: '后缀识别超时（秒）', type: 'number', help: '识别文件类型最多等这么久，超时就按原样保存', min: 10 },
    { key: 'AvatarHost', label: '头像服务器（0 自动）', type: 'number', help: 'QQ 头像从哪台服务器拉取，0 表示自动选，一般不用改', min: 0, max: 4 },
    { key: 'listRetryCount', label: '列表重试次数', type: 'number', help: '拉取说说/相册等列表失败时，自动重试几次', min: 0 },
    { key: 'listRetrySleep', label: '列表重试间隔（秒）', type: 'number', help: '每次重试之间等几秒', min: 0 },
    { key: 'waitCount', label: '稍候重试次数', type: 'number', help: '提示「操作频繁」时，自动等待再试的次数', min: 0 },
    { key: 'waitTime', label: '稍候重试间隔（秒）', type: 'number', help: '每次等待风控解除的秒数，默认 1 小时，一般不用改', min: 1 },
    { key: 'thunderTaskNum', label: '迅雷任务数', type: 'number', help: '每批交给迅雷的下载任务数量', min: 50 },
    { key: 'thunderTaskSleep', label: '迅雷唤起间隔（秒）', type: 'number', help: '两次唤起迅雷之间间隔几秒，太快会卡电脑', min: 1 },
    { key: 'disabledShelf', label: '隐藏浏览器下载栏', type: 'checkbox', help: '下载时不弹出应用右上角的下载列表，界面更清爽' },
    { key: 'useImageProxyGateway', label: 'Aria2 图片走代理网关', type: 'checkbox', help: '实验性：仅 Aria2 图片任务生效' },
    { key: 'hasUserLink', label: '生成用户空间链接', type: 'checkbox', help: '备份页面里保留一条跳转到原空间的链接，方便对照' },
    { key: 'Aria2.rpc', label: 'Aria2 RPC 地址', type: 'text', help: 'Aria2 / Motrix 的控制地址，装在本机用默认值即可' },
    { key: 'Aria2.token', label: 'Aria2 密钥', type: 'text', help: 'Aria2 设置过密钥就填在这里，没设就留空' },
    { key: 'refererUrls', label: 'Referer 域名', type: 'textarea', help: '一行一个域名，用于浏览器下载防盗链' },
];

export const MODULE_SCHEMA: Record<string, SettingItem[]> = {
  Messages: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「全量」从头备份；「上次」只采集上次之后的新内容，速度快；「自定义」从指定时间开始' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '增量选「自定义」时，从这个时间点开始备份' },
    { key: 'isFull', label: '获取说说全文', type: 'checkbox', help: '长说说默认只显示一部分，开启后抓取完整内容' },
    { key: 'isShowMore', label: '默认展开全文', type: 'checkbox', help: '备份页面里长说说默认展开，不用点「全文」' },
    { key: 'hasThatYearToday', label: '生成那年今日', type: 'checkbox', help: '在备份页面生成「那年今日」回顾，按日期翻老说说' },
    { key: 'RecoverDeleted', label: '恢复已删除说说', type: 'checkbox', help: '实验性：尝试从评论、点赞等互动记录找回已删除的说说' },
    { key: 'isFilterKeyword', label: '过滤广告关键词', type: 'checkbox', help: '遇到带广告的说说自动跳过' },
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox', help: '默认只抓一页评论，开启后抓全部（会多花些时间）' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox', help: '记录每条内容下谁点过赞' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox', help: '记录最近谁来过；会增加请求量，速度略慢' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', help: '每次查询访客之间随机休息几秒，降低被限制的风险', min: 1 },
  ],
  Blogs: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「全量」从头备份；「上次」只采集上次之后的新内容，速度快；「自定义」从指定时间开始' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '增量选「自定义」时，从这个时间点开始备份' },
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox', help: '默认只抓一页评论，开启后抓全部（会多花些时间）' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox', help: '记录每篇日志下谁点过赞' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox', help: '记录最近谁来过；会增加请求量，速度略慢' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', help: '每次查询访客之间随机休息几秒，降低被限制的风险', min: 1 },
  ],
  Diaries: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「全量」从头备份；「上次」只采集上次之后的新内容，速度快；「自定义」从指定时间开始' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '增量选「自定义」时，从这个时间点开始备份' },
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox', help: '默认只抓一页评论，开启后抓全部（会多花些时间）' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox', help: '记录每篇日记下谁点过赞' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox', help: '记录最近谁来过；会增加请求量，速度略慢' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', help: '每次查询访客之间随机休息几秒，降低被限制的风险', min: 1 },
  ],
  Photos: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「全量」从头备份；「上次」只采集上次之后的新内容，速度快；「自定义」从指定时间开始' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '增量选「自定义」时，从这个时间点开始备份' },
    { key: 'Comments.isGet', label: '相册评论', type: 'checkbox', help: '同时备份整个相册下的评论' },
    { key: 'Images.Comments.isGet', label: '图片评论', type: 'checkbox', help: '同时备份单张照片下的评论' },
    { key: 'Images.Info.isGet', label: '获取图片详情', type: 'checkbox', help: '获取每张照片的详情（原图地址、拍摄信息等）；备份他人相册时必须开启，否则下到的是加密图' },
    { key: 'Images.isGetVideo', label: '下载图片视频', type: 'checkbox', help: '照片附带的短视频也一并下载' },
    { key: 'Images.isGetPreview', label: '下载预览图', type: 'checkbox', help: '额外保存一张小尺寸预览图，浏览时加载更快' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox', help: '记录每张照片下谁点过赞' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox', help: '记录最近谁来过相册；会增加请求量，速度略慢' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', help: '每次查询访客之间随机休息几秒，降低被限制的风险', min: 1 },
  ],
  Videos: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「全量」从头备份；「上次」只采集上次之后的新内容，速度快；「自定义」从指定时间开始' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '增量选「自定义」时，从这个时间点开始备份' },
    { key: 'Comments.isGet', label: '获取视频评论', type: 'checkbox', help: '同时备份视频下的评论' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox', help: '记录每个视频下谁点过赞' },
  ],
  Boards: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「全量」从头备份；「上次」只采集上次之后的新内容，速度快；「自定义」从指定时间开始' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '增量选「自定义」时，从这个时间点开始备份' },
  ],
  Friends: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'isIncrement', label: '增量备份', type: 'checkbox', help: '开启后按上次备份结果只采集新增好友' },
  ],
  Favorites: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「全量」从头备份；「上次」只采集上次之后的新内容，速度快；「自定义」从指定时间开始' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '增量选「自定义」时，从这个时间点开始备份' },
  ],
  Shares: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「全量」从头备份；「上次」只采集上次之后的新内容，速度快；「自定义」从指定时间开始' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '增量选「自定义」时，从这个时间点开始备份' },
    { key: 'Comments.isFull', label: '获取全部评论', type: 'checkbox', help: '默认只抓一页评论，开启后抓全部（会多花些时间）' },
    { key: 'Like.isGet', label: '获取赞列表', type: 'checkbox', help: '记录每条分享下谁点过赞' },
    { key: 'Visitor.isGet', label: '获取最近访问', type: 'checkbox', help: '记录最近谁来过；会增加请求量，速度略慢' },
    { key: 'Visitor.randomSeconds', label: '最近访问间隔（秒）', type: 'range', help: '每次查询访客之间随机休息几秒，降低被限制的风险', min: 1 },
  ],
  Visitors: [
    { key: 'exportType', label: '备份类型', type: 'select', options: ["SPA","HTML","MarkDown","JSON"], labelMap: EXPORT_MAP, help: '备份后的格式。「网页版」可直接离线浏览，推荐保持默认' },
    { key: 'IncrementType', label: '增量备份', type: 'select', options: ["Full","Last","Custom"], labelMap: INCREMENT_MAP, help: '「全量」从头备份；「上次」只采集上次之后的新内容，速度快；「自定义」从指定时间开始' },
    { key: 'IncrementTime', label: '自定义备份时间', type: 'datetime', help: '增量选「自定义」时，从这个时间点开始备份' },
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
