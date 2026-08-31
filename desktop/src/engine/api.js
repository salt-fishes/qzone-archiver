/**
 * API 装配器：P2-1 拆分后在此按序组装（方法体在 api/ 目录，逐字搬迁）
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */

const API = {
    Utils: {}, // 工具类
    Common: {}, // 公共模块
    Blogs: {}, // 日志模块
    Diaries: {}, // 日记模块
    Friends: {}, // 好友模块
    Messages: {}, // 说说模块
    Boards: {}, // 留言模块
    Photos: {}, // 相册模块
    Videos: {}, // 视频模块
    Favorites: {}, // 收藏模块
    Shares: {}, // 分享模块
    Visitors: {}, // 访问模块
    Statistics: {} // 数据统计模块
};

// 网络层、文件工具与通用工具统一合回 API.Utils（保持方法内 this 域不变）
Object.assign(API.Utils, API_UTILS_METHODS, API_NETWORK_METHODS, API_FS_METHODS);

API.Common = API_COMMON;
API.Blogs = API_MODULE_BLOGS;
API.Diaries = API_MODULE_DIARIES;
API.Friends = API_MODULE_FRIENDS;
API.Messages = API_MODULE_MESSAGES;
API.Boards = API_MODULE_BOARDS;
API.Photos = API_MODULE_PHOTOS;
API.Videos = API_MODULE_VIDEOS;
API.Favorites = API_MODULE_FAVORITES;
API.Shares = API_MODULE_SHARES;
API.Visitors = API_MODULE_VISITORS;
API.Statistics = API_MODULE_STATISTICS;
