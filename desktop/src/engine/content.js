// PDF组件兼容大小写
//window.jsPDF = window.jspdf.jsPDF;

/**
 * Ajax下载任务
 */
class DownloadTask {

    /**
     * @param {string} module 模块
     * @param {string} dir 下载目录
     * @param {string} name 文件名，包含后缀
     * @param {string} url 文件地址
     * @param {object} source 文件来源
     */
    constructor(module, dir, name, url, source) {
        this.module = module
        this.dir = dir
        this.name = name
        this.url = url
        this.downloadState = 'in_progress'
        this.source = source
    }

    /**
     * 设置下载状态
     * @param {string} downloadState 下载状态
     */
    setState(downloadState) {
        this.downloadState = downloadState;
    }
}

/**
 * 迅雷任务
 */
class ThunderTask {

    /**
     * 
     * @param {string} module 模块
     * @param {string} dir 下载目录
     * @param {string} name 文件名，包含后缀
     * @param {string} url 文件地址
     * @param {object} source 文件来源
     */
    constructor(module, dir, name, url, source) {
        this.module = module
        this.dir = dir
        this.name = name
        this.url = url
        this.downloadState = 'in_progress'
        this.source = source
    }

    /**
     * 设置下载状态
     * @param {string} downloadState 下载状态
     */
    setState(downloadState) {
        this.downloadState = downloadState;
    }
}

/**
 * 迅雷任务信息
 */
class ThunderInfo {

    /**
     * 
     * @param {string} dir 下载目录
     * @param {integer} threadCount 下载
     * @param {ThunderTask} tasks 任务
     */
    constructor(taskGroupName, threadCount, tasks) {
        this.taskGroupName = taskGroupName
        this.tasks = tasks || []
        this.threadCount = threadCount
        this.hideYunPan = '1'
        this.referer = 'https://user.qzone.qq.com/'
    }

    /**
     * 添加下载任务
     * @param {ThunderTask} task 任务
     */
    addTask(task) {
        this.tasks.push(task);
    }

    /**
     * 删除指定索引任务
     * @param {integer} index 数组索引
     */
    delTask(index) {
        this.tasks.splice(index, 1);
    }

    /**
     * 根据下载链接删除任务
     * @param {string} url 下载链接
     */
    removeTask(url) {
        this.tasks.remove(url, 'url')
    }
}

/**
 * 浏览器下载任务
 */
class BrowserTask {

    /**
     * 
     * @param {string} module 模块
     * @param {string} url 下载地址
     * @param {string} root 下载根目录名称
     * @param {string} folder 根目录相对名称
     * @param {string} name 文件名称
     * @param {object} source 文件来源
     */
    constructor(module, url, root, folder, name, source) {
        this.module = module;
        this.id = 0;
        this.url = url;
        this.dir = folder;
        this.name = name;
        this.filename = root + '/' + folder + '/' + name;
        this.downloadState = 'in_progress'
        this.source = source
    }

    /**
     * 设置下载管理器ID
     * @param {integer} id 下载管理器ID
     */
    setId(id) {
        this.id = id
    }

    /**
     * 设置下载状态
     * @param {string} downloadState 下载状态
     */
    setState(downloadState) {
        this.downloadState = downloadState;
    }
}



/**
 * 分页信息
 */
class PageInfo {

    /**
     * 
     * @param {integer} index 页索引
     * @param {integer} size 页条目大小
     */
    constructor(index, size) {
        this.index = 0;
        this.size = 0;
    }
}

/**
 * 提示信息
 */
const MAX_MSG = {
    InitIncrement: [
        '存在增量备份模块',
        '正在获取已备份的数据',
        '请稍候..'
    ],
    Messages: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的说说列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_Filter: [
        '正在根据屏蔽词过滤说说列表',
        '已屏蔽 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_Full_Content: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的全文',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_More_Images: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的更多图片',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_Voices: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的语音信息',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_Images_Mime: [
        '正在识别说说的图片类型',
        '已识别 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '请稍候..'
    ],
    Messages_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_Visitor: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条说说的最近访问',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_Lbs_Info: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条微信说说坐标信息',
        '已刷新 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_Export: [
        '正在导出说说',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Messages_Deleted: [
        '正在恢复已删除说说',
        '已恢复 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '{nextTip}'
    ],
    Messages_Export_Other: [
        '正在导出说说到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Blogs: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的日志列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已失败 <span style="color: red;">{downloadFailed}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Blogs_Content: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇的日志内容',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '已失败 <span style="color: red;">{downloadFailed}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Blogs_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日志的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Blogs_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日志的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Blogs_Visitor: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日志的最近访问',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Blogs_Export: [
        '正在导出日志',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Blogs_Export_Other: [
        '正在导出日志到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Diaries: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的日记列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已失败 <span style="color: red;">{downloadFailed}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Diaries_Content: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇的日记内容',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '已失败 <span style="color: red;">{downloadFailed}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Diaries_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日记的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Diaries_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日记的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Diaries_Visitor: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 篇日记的最近访问',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 篇',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 篇',
        '总共 <span style="color: #1ca5fc;">{total}</span> 篇',
        '请稍候..'
    ],
    Diaries_Export: [
        '正在导出日记',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Diaries_Export_Other: [
        '正在导出日记到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Boards: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的留言列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Boards_Images_Mime: [
        '正在识别留言的图片类型',
        '已识别 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已失败 <span style="color: red;">{downloadFailed}</span> 张',
        '请稍候..'
    ],
    Boards_Export: [
        '正在导出 <span style="color: #1ca5fc;">{index}</span> 年的留言',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Boards_Export_Other: [
        '正在导出留言到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Friends: [
        '正在获取QQ好友列表',
        '已获取好友 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Friends_Time: [
        '正在获取好友互动信息',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Friends_Access: [
        '正在获取好友空间权限',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已失败 <span style="color: red;">{downloadFailed}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Friends_Care: [
        '正在获取特别关心好友',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Friends_Export: [
        '正在导出QQ好友到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Photos: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的相册列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已失败 <span style="color: red;">{downloadFailed}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Photos_Albums_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个相册的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Photos_Albums_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个相册的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Photos_Albums_Visitor: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个相册的最近访问',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Photos_Images: [
        '正在获取 <span style="color: #1ca5fc;">{index}</span> 的相片列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已失败 <span style="color: red;">{downloadFailed}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍候..'
    ],
    Photos_Images_Info: [
        '正在获取 <span style="color: #1ca5fc;">{index}</span> 的相片详情',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍候..'
    ],
    Photos_Images_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 张相片的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍候..'
    ],
    Photos_Images_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 张相片的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍候..'
    ],
    Photos_Images_Mime: [
        '正在获取 <span style="color: #1ca5fc;">{index}</span> 的相片类型',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 张',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 张',
        '总共 <span style="color: #1ca5fc;">{total}</span> 张',
        '请稍候..'
    ],
    Photos_Export: [
        '正在导出相册到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Photos_Images_Export: [
        '正在导出 <span style="color: #1ca5fc;">{index}</span> 的相片',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Photos_Images_Export_Other: [
        '正在导出相片到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Videos: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的视频列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已失败 <span style="color: red;">{downloadFailed}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Videos_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个视频的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Videos_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 个视频的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Videos_Export: [
        '正在导出视频到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Favorites: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的收藏列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 个',
        '已失败 <span style="color: red;">{downloadFailed}</span> 个',
        '总共 <span style="color: #1ca5fc;">{total}</span> 个',
        '请稍候..'
    ],
    Favorites_Export: [
        '正在导出 <span style="color: #1ca5fc;">{index}</span> 年的收藏',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Favorites_Export_Other: [
        '正在导出收藏到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Shares: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的分享列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Shares_Comments: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条分享的评论列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Shares_Like: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条分享的点赞列表',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Shares_Visitor: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 条分享的最近访问',
        '已获取 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已跳过 <span style="color: #1ca5fc;">{skip}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Shares_Export: [
        '正在导出分享',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Shares_Export_Other: [
        '正在导出分享到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Visitors: [
        '正在获取第 <span style="color: #1ca5fc;">{index}</span> 页的访客列表',
        '总共 <span style="color: #1ca5fc;">{totalPage}</span> 页',
        '<span style="color: #1ca5fc;">{total}</span> 访问量',
        '请稍候..'
    ],
    Visitors_Export: [
        '正在导出访客',
        '已导出 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '已失败 <span style="color: red;">{downloadFailed}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Visitors_Export_Other: [
        '正在导出访客到 <span style="color: #1ca5fc;">{index}</span> 文件',
        '请稍候..'
    ],
    Common_File: [
        '正在下载文件',
        '已下载 <span style="color: #1ca5fc;">{downloaded}</span> ',
        '已失败 <span style="color: red;">{downloadFailed}</span> ',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Common_Thunder: [
        '正在第 <span style="color: #1ca5fc;">{index}</span> 次唤起迅雷下载文件',
        '将在 <span style="color: #1ca5fc;">{nextTip}</span> 秒后再次唤起迅雷',
        '已添加 <span style="color: #1ca5fc;">{downloaded}</span> ',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Common_Thunder_Clipboard: [
        '正在第 <span style="color: #1ca5fc;">{index}</span> 次复制迅雷下载链接',
        '将在 <span style="color: #1ca5fc;">{nextTip}</span> 秒后再次复制',
        '已复制 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Common_Thunder_Link: [
        '正在生成迅雷下载链接',
        '打包下载后，打开迅雷复制根目录下的【迅雷下载链接.txt】',
        '请稍候..'
    ],
    Common_Browser: [
        '正在添加多媒体文件下载任务到浏览器',
        '已添加 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '添加超时或失败 <span style="color: red;">{downloadFailed}</span> ',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    Common_Aria2: [
        '正在添加多媒体文件下载任务到Aria2',
        '已添加 <span style="color: #1ca5fc;">{downloaded}</span> 条',
        '添加超时或失败 <span style="color: red;">{downloadFailed}</span> ',
        '总共 <span style="color: #1ca5fc;">{total}</span> 条',
        '请稍候..'
    ],
    User_Avatar_Export: [
        '正在收集互动用户头像',
        '请稍候..'
    ],
    Init_User_Info_Export: [
        '正在采集用户基本信息',
        '请稍候..'
    ],
    Init_User_Info_Export_Other: [
        '正在生成个人首页',
        '请稍候..'
    ],
    User_Config_Infos: [
        '正在导出助手配置信息',
        '请稍候..'
    ],
    Backup_Save: [
        '正在保存当前备份数据',
        '请稍候..'
    ],
    Backup_Export: [
        '正在导出当前备份数据',
        '请稍候..'
    ]
}

/**
 * 备份进度
 */
class StatusIndicator {

    /**
     * 
     * @param {string} type 导出类型
     */
    constructor(type) {
        this.id = type + '_Tips'
        this.type = type
        this.tip = MAX_MSG[type] || []
        this.total = 0
        this.index = 0
        this.pageSize = 0
        this.totalPage = 0
        this.nextTip = 0
        this.downloaded = 0
        this.downloading = 0
        this.downloadFailed = 0
        this.skip = 0;
        // 更详细的进度信息：当前处理项、阶段开始时间（用于耗时统计）
        this.item = ''
        this.startTime = Date.now()
        // 渲染节流时间戳（避免高频循环逐条重绘 DOM）
        this._lastRenderAt = 0
        // 每个实例拥有独立的日志行，追加到目标槽位而不是整体替换
        // 修复：相册等模块多个阶段/多个相册复用同一槽位，整体替换会导致上一步日志消失
        this._slot = $("#" + this.id)
        this._line = $('<span class="tip-line"></span>')
        if (this._slot.length && !this._slot.is('details')) {
            this._line.appendTo(this._slot)
        }
    }

    /**
     * 设置当前处理项（显示在提示信息末尾，如当前相片/文件/好友名）
     * @param {string} name 当前项名称
     */
    setItem(name) {
        // 转义用户内容：jQuery .html() 会执行字符串中的 <script>，被页面 CSP 拦截，
        // 说说内容/昵称等可能含 HTML，必须先转义再注入日志
        this.item = _.escape(String(name == null ? '' : name))
        this.print()
    }

    /**
     * 组装提示内容：模板 + 附加的耗时/百分比/当前项
     * @returns {string} 完整提示 HTML
     */
    _formatTip() {
        // 动态字段：百分比与耗时
        this.percent = this.total > 0 ? Math.min(100, Math.round((this.downloaded / this.total) * 100)) : 0;
        const seconds = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.elapsed = (minutes > 0 ? minutes + '分' : '') + secs + '秒';

        const extras = [];
        if (this.total > 0) {
            extras.push('已完成 <span style="color: #4ec9b0;">' + this.percent + '%</span>');
        }
        extras.push('已用 <span style="color: #d7ba7d;">' + this.elapsed + '</span>');
        if (this.item) {
            extras.push('当前：<span style="color: #eab535;">' + this.item + '</span>');
        }
        const suffix = extras.length ? '　·　' + extras.join('　·　') : '';
        return this.tip.join('，').format(this) + suffix;
    }

    /**
     * 获取数据
     */
    getData(dataType) {
        return this.data[dataType] || []
    }


    /**
     * 输出提示信息
     */
    print() {
        // 渲染节流：高频循环（逐条/逐相片）时最多每 150ms 刷新一次 DOM，
        // 计数/耗时字段仍实时累加，渲染稍后合并，避免逐条重绘 + 强制滚底拖慢采集
        const now = Date.now();
        if (this._lastRenderAt && now - this._lastRenderAt < 150) {
            return;
        }
        this._lastRenderAt = now;

        const $tip_dom = this._slot;
        if (!$tip_dom.length) return;
        $tip_dom.show();
        if (this.tip && this.tip.length > 0) {
            // 只更新当前实例的日志行，避免覆盖同槽位中上一步的日志
            this._line.html(this._formatTip());
        }

        if ($tip_dom.is('details')) {
            // 展开
            $tip_dom.find('summary').click();
        }
    }

    /**
     * 完成
     * @param {object} params 格式化参数
     */
    complete() {
        const $tip_dom = this._slot;
        if (!$tip_dom.length) return;
        $tip_dom.show()
        if (this.tip && this.tip.length > 0) {
            // 仅更新当前实例日志行并冻结，不再整体重写槽位（防止清空 details 内上一步日志）
            let showTip = this._formatTip();
            this._line.html(showTip.replace('正在', '已').replace('请稍候', '已完成').replace('...', ''));
            this._line.addClass('tip-done');
        }

        if ($tip_dom.is('details') && this.id !== 'Common_Row_Infos_Tips') {
            // 收起
            $tip_dom.find('summary').click();
        }
    }

    /**
     * 下载
     */
    addDownload(pageSize) {
        this.downloading = this.downloaded + pageSize
        this.print()
    }

    /**
     * 下载失败
     * @param {Object} item 
     */
    addFailed(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length
        } else if (item instanceof PageInfo) {
            count = item['size']
        }
        this.downloadFailed = this.downloadFailed + (count * 1)
        this.downloading = this.downloading - (count * 1)
        this.print()
    }

    /**
     * 下载失败
     */
    setFailed(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length
        } else if (item instanceof PageInfo) {
            count = item['size']
        }
        this.downloadFailed = count;
        this.downloading = 0
        this.print()
    }

    /**
     * 下载成功
     */
    addSuccess(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length;
        }
        if (typeof item === 'number') {
            count = item;
        }
        this.downloaded = this.downloaded + (count * 1)
        this.downloading = this.downloading - (count * 1)
        this.print()
    }


    /**
     * 下载成功
     */
    setSuccess(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length;
        }
        if (typeof item === 'number') {
            count = item;
        }
        this.downloaded = count
        this.downloading = 0
        this.print()
    }

    /**
     * 设置当前位置
     * 注入暂停/取消检查点：每条记录处理前先等待状态
     * @param {object} index 当前位置
     */
    async setIndex(index) {
        // 数字原样保留；字符串（如相册名）转义后再插入模板，避免 HTML/脚本注入
        this.index = typeof index === 'number' ? index : _.escape(String(index))
        this.print()
        // 检查点：暂停时等待唤醒；取消时抛出异常中止循环
        if (await checkExportState()) {
            const err = new Error('[ExportState] 导出已取消')
            err.__exportCancelled = true
            throw err
        }
    }

    /**
     * 设置总数
     * @param {integer} total
     */
    setTotal(total) {
        this.total = total
        this.print()
    }

    /**
     * 设置下一步提示
     * @param {string} tip
     */
    setNextTip(tip) {
        // 转义后注入模板，避免含 HTML 的提示被当作脚本执行
        this.nextTip = _.escape(String(tip == null ? '' : tip))
        this.print()
    }

    /**
     * 添加跳过条目数
     * @param {Object} item 
     */
    addSkip(item) {
        let count = 1
        if (Array.isArray(item)) {
            count = item.length
        }
        this.skip = this.skip + count
        this.print()
    }

    /**
     * 设置跳过条目数
     */
    setSkip(count) {
        if (Array.isArray(count)) {
            count = item.length
        }
        this.skip = count
        this.print()
    }

    /**
     * 设置总数
     * @param {integer} totalPage
     */
    setTotalPage(totalPage) {
        this.totalPage = totalPage
        this.print()
    }
}


/**
 * 操作类型
 */
const OperatorType = {

    /**
     * 初始化
     */
    INIT: 'INIT',
    /**
     * 显示弹窗
     */
    SHOW: 'SHOW',

    /**
     * 初始化用户信息
     */
    INIT_USER_INFO: 'INIT_USER_INFO',

    /**
     * 导出用户信息
     */
    OTHERS_INFO: 'OTHERS_INFO',

    /**
     * 获取所有说说列表
     */
    Messages: 'Messages',

    /**
     * 获取日志所有列表
     */
    Blogs: 'Blogs',

    /**
     * 获取日记所有列表
     */
    Diaries: 'Diaries',

    /**
     * 获取相册照片
     */
    Photos: 'Photos',

    /**
     * 获取视频列表
     */
    Videos: 'Videos',

    /**
     * 获取留言列表
     */
    Boards: 'Boards',

    /**
     * 获取QQ好友列表
     */
    Friends: 'Friends',

    /**
     * 获取收藏列表
     */
    Favorites: 'Favorites',

    /**
     * 获取分享列表
     */
    Shares: 'Shares',

    /**
     * 获取访客列表
     */
    Visitors: 'Visitors',

    /**
     * 压缩
     */
    ZIP: 'ZIP',

    /**
     * 压缩
     */
    COMPLETE: 'COMPLETE'
}

/**
 * 导出操作
 */
class QZoneOperator {

    /**
     * 下一步操作
     */
    async next(moduleType) {
        // 取消短路：导出已取消时不再推进任何后续阶段
        if (exportState.cancelled) {
            // 确认取消 UI（阶段边界可能不再经过检查点）
            finalizeCancelUi();
            console.warn('[Operator] 导出已取消，跳过阶段:', moduleType);
            return;
        }
        switch (moduleType) {
            case OperatorType.INIT:
                this.init();
                break;
            case OperatorType.SHOW:
                // 显示模态对话框
                await this.showProcess();
                // 模态框已渲染，显示暂停 / 取消 按钮
                updateExportButtons();
                // 初始化FS文件夹
                await this.initModelFolder();
                this.next(OperatorType.INIT_USER_INFO);
                break;
            case OperatorType.INIT_USER_INFO:
                // 重置QQ空间备份数据
                API.Common.resetQZoneBackupItems();
                // 初始化上次备份信息
                await API.Common.initBackedUpItems();
                this.next(OperatorType.Messages);
                break;
            case OperatorType.Messages:
                // 获取说说列表
                if (API.Common.isExport(moduleType)) {
                    await API.Messages.export();
                }
                this.next(OperatorType.Blogs);
                break;
            case OperatorType.Blogs:
                // 获取日志列表
                if (API.Common.isExport(moduleType)) {
                    await API.Blogs.export();
                }
                this.next(OperatorType.Diaries);
                break;
            case OperatorType.Diaries:
                // 获取日记列表
                if (API.Common.isExport(moduleType)) {
                    await API.Diaries.export();
                }
                this.next(OperatorType.Boards);
                break;
            case OperatorType.Boards:
                // 获取留言列表
                if (API.Common.isExport(moduleType)) {
                    await API.Boards.export();
                }
                this.next(OperatorType.Friends);
                break;
            case OperatorType.Friends:
                // 获取QQ好友列表
                if (API.Common.isExport(moduleType)) {
                    await API.Friends.export();
                }
                this.next(OperatorType.Favorites);
                break;
            case OperatorType.Favorites:
                // 获取收藏列表
                if (API.Common.isExport(moduleType)) {
                    await API.Favorites.export();
                }
                this.next(OperatorType.Shares);
                break;
            case OperatorType.Shares:
                // 获取分享列表
                if (API.Common.isExport(moduleType)) {
                    await API.Shares.export();
                }
                this.next(OperatorType.Visitors);
                break;
            case OperatorType.Visitors:
                // 获取访客
                if (API.Common.isExport(moduleType)) {
                    await API.Visitors.export();
                }
                this.next(OperatorType.Photos);
                break;
            case OperatorType.Photos:
                // 获取相册列表
                if (API.Common.isExport(moduleType)) {
                    await API.Photos.export();
                }
                this.next(OperatorType.Videos);
                break;
            case OperatorType.Videos:
                // 获取视频列表
                if (API.Common.isExport(moduleType)) {
                    await API.Videos.export();
                }
                this.next(OperatorType.OTHERS_INFO);
                break;
            case OperatorType.OTHERS_INFO:
                // 其它信息导出
                await API.Common.exportOthers();
                this.next(OperatorType.ZIP);
                break;
            case OperatorType.ZIP:
                if (API.Common.isOnlyFileExport()) {
                    // 仅文件导出，无需压缩文件
                    console.log('仅文件导出，无需压缩文件');
                    $("#fileList").show();
                } else {
                    // 压缩文件
                    await API.Utils.sleep(1000);
                    await API.Utils.Zip(API.Common.getRootFolder());
                    operator.next(OperatorType.COMPLETE);
                }
                break;
            case OperatorType.COMPLETE:
                // 延迟3秒，确保压缩完
                await API.Utils.sleep(1000);
                $("#fileList").show();
                // 流程完成，隐藏暂停/取消按钮
                hideExportButtons();
                if (API.Common.isOnlyFileExport()) {
                    API.Utils.notification("qzone-archiver通知", "不涉及文案内容备份，多媒体文件下载任务已添加完成！");
                } else {
                    $("#downloadBtn").show();
                    $("#backupStatus").html("数据采集完成，请点击下方<span style='color:red'>打包下载</span>按钮下载备份压缩包。");
                    API.Utils.notification("qzone-archiver通知", "数据采集完成，请打包下载文案内容！");
                }
                break;
            default:
                break;
        }
    }

    /**
     * 初始化
     */
    init() {
        if (location.href.indexOf("qzone.qq.com") == -1 || location.protocol == 'filesystem:') {
            return;
        }

        // 获取gtk
        API.Utils.initGtk();
        // 获取Token
        API.Utils.getQZoneToken();
        // 获取QQ号
        API.Utils.initUin();
        // 获取相册路由
        API.Photos.getRoute();

        // 读取配置项
        chrome.storage.sync.get(Default_Config, function(item) {
            QZone_Config = item;
        })

        // 初始化文件夹（持久化存储，跨会话保留以支持文件复用）
        QZone.Common.Filer.init({ persistent: true, size: 10 * 1024 * 1024 * 1024 }, function(fs) {
            // 列出当前备份目录内容（用于调试，不再清空）
            QZone.Common.Filer.ls(API.Common.getRootFolder(), function(entries) {
                console.info('当前备份目录子项：', entries.length, '个');
            }, function() {
                // 目录不存在是正常情况（首次备份）
                console.info('备份目录尚未创建，将在导出时自动创建');
            });

            // 移除历史不带QQ号的文件夹（兼容旧版本清理）
            QZone.Common.Filer.ls(FOLDER_ROOT, function(entries) {
                QZone.Common.Filer.rm(FOLDER_ROOT, function() {
                    console.info('清除历史不带QQ号文件夹成功！');
                });
            }, function() {
                // 不存在则无需处理
            });
        })
    }

    /**
     * 初始化各个备份模块的文件夹
     */
    async initModelFolder() {
        console.info('初始化模块文件夹开始', QZone);

        // 切换根目录
        await API.Utils.switchToRoot();

        // 创建模块文件夹
        let createModuleFolder = async function() {
            // 创建所有模块的目录
            for (let x in QZone) {
                let obj = QZone[x];
                if (typeof(obj) !== "object") {
                    continue;
                }
                let moduleRoot = obj['IMAGES_ROOT'] || obj['ROOT'];
                if (!moduleRoot) {
                    continue;
                }
                let entry = await API.Utils.createFolder(API.Common.getRootFolder() + '/' + moduleRoot);
            }
        }

        // 创建模块文件夹
        await createModuleFolder();

        console.info('初始化模块文件夹结束', QZone);
    }

    /**
     * 显示备份进度窗口
     */
    async showProcess() {
        // MV3 改造：chrome.extension.getURL 在 MV3 中已移除，改用 chrome.runtime.getURL
        const html = await API.Utils.get(chrome.runtime.getURL('html/indicator.html'));

        $('body').append(html);

        $('#progressModal').modal({
            backdrop: "static",
            keyboard: false
        });

        const $progressbar = $("#progressbar");
        const $downloadBtn = $('#downloadBtn');
        const $fileListBtn = $('#fileList');
        // 浏览器下载
        const $browserDownloadBtn = $("#browserDownload");
        // 迅雷下载
        const $thunderDownloadBtn = $("#thunderDownload");
        // Aria2下载
        const $aria2rDownloadBtn = $("#aria2rDownload");
        // 继续重试
        const $againDownloadBtn = $("#againDownload");

        // 下载方式
        const downloadType = QZone_Config.Common.downloadType;
        if (downloadType === 'Thunder_Link') {
            // 隐藏重试按钮
            $againDownloadBtn.hide();
        }

        // 【打包下载】按钮点击事件
        $downloadBtn.click(() => {

            $('#progress').show();
            $progressbar.css("width", "0%");
            $progressbar.attr("aria-valuenow", "0");
            $progressbar.text('已下载0%');

            $fileListBtn.attr('disabled', true);
            $downloadBtn.attr('disabled', true);
            $downloadBtn.text('正在下载');

            QZone.Common.Zip.generateAsync({ type: "blob" }, (metadata) => {
                $progressbar.css("width", metadata.percent.toFixed(2) + "%");
                $progressbar.attr("aria-valuenow", metadata.percent.toFixed(2));
                $progressbar.text('已下载' + metadata.percent.toFixed(2) + '%');
            }).then(function(content) {
                saveAs(content, API.Common.getRootFolderName() + '.zip');
                $progressbar.css("width", "100%");
                $progressbar.attr("aria-valuenow", 100);
                $progressbar.text('已下载' + '100%');
                $downloadBtn.text('已下载');
                $downloadBtn.attr('disabled', false);
                $fileListBtn.attr('disabled', false);
                $("#showFolder").show();
                API.Utils.notification("qzone-archiver通知", "文案内容压缩包下载完成！");
            });

        });

        // 【查看备份】按钮点击事件
        let $showFolder = $('#showFolder');
        $showFolder.click(() => {
            chrome.runtime.sendMessage({
                from: 'content',
                type: 'show_export_zip'
            });
        })

        //进度模式窗口隐藏后
        $('#progressModal').on('hidden.bs.modal', function() {
            $("#progressModal").remove();
            $("#modalTable").remove();
        })

        // 链接调整
        $('.skipLink').on('click', function() {
            const link = $(this).attr('data-link');
            chrome.runtime.sendMessage({
                from: 'content',
                type: 'skipLink',
                url: link
            });
        })

        /**
         * 筛选数据
         * @param {string} module 模块
         * @param {string} status 状态
         */
        const filterData = async function(module, status) {
            switch (downloadType) {
                case 'Browser':
                    // 下载方式为浏览器下载时
                    // 查询全部下载列表
                    let downlist = await API.Utils.getDownloadList(undefined);
                    for (const task of browserTasks) {
                        // 更新下载状态到表格
                        let index = downlist.getIndex(task.id, 'id');
                        if (index == -1) {
                            // 根据ID找下载项没找到表示没成功添加到浏览器中
                            task.downloadState = 'interrupted';
                            continue;
                        }
                        let downloadItem = downlist[index];
                        task.downloadState = downloadItem.state;
                    }
                    break;
                default:
                    break;
            }
            $("#table").bootstrapTable('filterBy', {
                module: module === 'all' ? undefined : module,
                downloadState: status === 'all' ? undefined : status,
            }, {
                filterAlgorithm: function(row, filters) {
                    let hanRow = true;
                    for (const key in filters) {
                        if (filters[key] && row[key] !== filters[key]) {
                            hanRow = false;
                        }
                    }
                    return hanRow;
                }
            })
        }

        // 查看指定状态的数据
        $('#moduleFilter').change(function() {
            $('#statusFilter').val('interrupted').change();
        })

        // 查看指定状态的数据
        $('#statusFilter').change(function() {
            const status = $(this).val();
            if ('interrupted' === status || (['Thunder', 'Thunder_Clipboard'].indexOf(downloadType) > -1 && 'all' === status)) {
                // 失败列表与迅雷下载全部列表时才展示【继续重试】按钮
                $againDownloadBtn.show();
            } else {
                $againDownloadBtn.hide();
            }
            const module = $('#moduleFilter').val();
            filterData(module, status);
        })

        // 【重试】按钮点击事件
        $againDownloadBtn.click(async function() {
            const tasks = $('#table').bootstrapTable('getSelections');
            switch (downloadType) {
                case 'File':
                    // 下载方式为助手下载时
                    await API.Common.downloadsByAjax(tasks);
                    // 重新压缩
                    operator.next(OperatorType.ZIP);
                    break;
                case 'Browser':
                    // 下载方式为浏览器下载时
                    for (const task of tasks) {
                        if (!task.id || task.id === 0) {
                            // 无ID时表示添加到下载器失败，需要重新添加
                            await API.Utils.downloadByBrowser(task);
                            return;
                        }
                        await API.Utils.resumeDownload(task.id);
                    }
                    break;
                case 'Aria2':
                    // 下载方式为Aria2时
                    await API.Common.downloadByAria2(tasks);
                    break;
                case 'Thunder':
                    // 下载方式为迅雷（助手唤醒）
                    const newThunderInfo = new ThunderInfo(API.Common.getRootFolderName(), QZone_Config.Common.downloadThread, tasks);
                    await API.Common.invokeThunder(newThunderInfo);
                    break;
                case 'Thunder_Clipboard':
                    // 下载方式为迅雷（剪切板唤醒）
                    const copyNewThunderInfo = new ThunderInfo(API.Common.getRootFolderName(), QZone_Config.Common.downloadThread, tasks);
                    await API.Common.copyThunderTasksToClipboard(copyNewThunderInfo);
                    break;
                default:
                    break;
            }
        })

        // 【迅雷下载】点击事件
        $thunderDownloadBtn.click(async function() {
            const tasks = $('#table').bootstrapTable('getSelections');
            const newThunderInfo = new ThunderInfo(API.Common.getRootFolderName(), QZone_Config.Common.downloadThread);
            for (const task of tasks) {
                newThunderInfo.tasks.push(new ThunderTask(task.module, task.dir, task.name, API.Utils.toHttp(task.url)));
                task.setState('complete');
            }
            await API.Common.invokeThunder(newThunderInfo)
        })

        // 【Aria2下载】点击事件
        $aria2rDownloadBtn.click(async function() {
            const tasks = $('#table').bootstrapTable('getSelections');
            // 下载方式为Aria2时
            await API.Common.downloadByAria2(tasks);
        })

        // 【浏览器下载】点击事件
        $browserDownloadBtn.click(function() {
            const tasks = $('#table').bootstrapTable('getSelections');
            const newBrowserTasks = [];
            for (const task of tasks) {
                newBrowserTasks.push(new BrowserTask(task.module, API.Utils.toHttp(task.url), thunderInfo.taskGroupName, task.dir, task.name));
                task.setState('in_progress');
            }
            API.Common.downloadsByBrowser(newBrowserTasks);
        })

        //显示下载任务列表
        $('#modalTable').on('shown.bs.modal', function() {

            // 重置筛选条件
            $('#statusFilter').val('interrupted');

            $("#table").bootstrapTable('destroy').bootstrapTable({
                undefinedText: '-',
                toggle: 'table',
                locale: 'zh-CN',
                search: true,
                searchAlign: 'right',
                height: "450",
                pagination: true,
                pageList: "[10, 20, 50, 100, 200, 500, 1000, 2000, 5000, All]",
                paginationHAlign: 'left',
                clickToSelect: true,
                paginationDetailHAlign: 'right',
                toolbar: '#toolbar',
                columns: [{
                    field: 'state',
                    checkbox: true,
                    align: 'left'
                }, {
                    field: 'name',
                    title: '名称',
                    titleTooltip: '名称',
                    align: 'left',
                    visible: true
                }, {
                    field: 'dir',
                    title: '路径',
                    titleTooltip: '路径',
                    align: 'left',
                    visible: true,
                    sortable: true
                }, {
                    field: 'url',
                    title: '地址（建议点击预览）',
                    titleTooltip: '地址（建议点击预览）',
                    align: 'left',
                    visible: true,
                    formatter: (value) => {
                        return '<a target="_brank" href="{0}" >预览</a> '.format(API.Utils.makeViewUrl(value));
                    }
                }, {
                    field: 'source',
                    title: '来源',
                    titleTooltip: '文件的来源，如说说的配置，点击时将跳转到说说',
                    align: 'left',
                    visible: true,
                    formatter: (value, row, index, field) => {
                        let type = API.Common.getSourceType(value);
                        switch (type) {
                            case 'Messages':
                                // 说说
                                return API.Utils.getLink(API.Messages.getUniKey(value.tid), '查看说说');
                            case 'Blogs':
                                // 日志
                                return API.Utils.getLink(API.Blogs.getUniKey(value.blogid), '查看日志');
                            case 'Diaries':
                                // 日记
                                return API.Utils.getLink('https://rc.qzone.qq.com/blog?catalog=private', '日记');
                            case 'Photos':
                                // 相册（暂无相册逻辑，直接查看照片即可）
                                return API.Utils.getLink('#', '无');
                            case 'Images':
                                // 相片
                                return API.Utils.getLink(API.Photos.getImageViewLink(value), '查看相片');
                            case 'Videos':
                                // 视频
                                return API.Utils.getLink(value.url, '查看视频');
                            case 'Boards':
                                // 留言
                                return API.Utils.getLink('https://user.qzone.qq.com/{0}/334'.format(QZone.Common.Target.uin), '查看留言');
                            case 'Favorites':
                                // 收藏
                                return API.Utils.getLink('https://user.qzone.qq.com/{0}/favorite'.format(QZone.Common.Target.uin), '查看收藏');
                            default:
                                return API.Utils.getLink('#', '无');
                        }
                    }
                }],
                data: API.Utils.getDownloadTasks()
            })
            $('#table').bootstrapTable('resetView')

            // 默认加载失败的数据
            filterData("all", "interrupted");
        })
    }
}

// 操作器
const operator = new QZoneOperator();
// Ajax下载任务
const downloadTasks = new Array();
// 迅雷下载信息
const thunderInfo = new ThunderInfo();
// 浏览器下载信息
const browserTasks = new Array();

/**
 * 导出流程状态控制（暂停 / 取消）
 * - paused: 暂停标志，循环检查点会等待 resume 唤醒
 * - cancelled: 取消标志，循环检查点收到后立即返回并中止后续步骤
 * - pauseToken: 暂停时创建的 Promise resolver，resume 时调用以唤醒
 * - pausing: 已收到暂停请求、尚未被检查点确认生效（用于「暂停中…」反馈）
 * - cancelling: 已收到取消请求、尚未被检查点确认生效（用于「取消中…」反馈）
 */
const exportState = {
    paused: false,
    cancelled: false,
    pauseToken: null,
    pausing: false,
    cancelling: false
};

/** 默认顶部状态文案（与 indicator.html 一致） */
const DEFAULT_BACKUP_STATUS = '正在采集QQ空间数据中，请勿<span style="color:red">关闭、刷新、或打开新的</span>QQ空间页面。';

/** 更新顶部状态提示（弹窗未渲染时忽略） */
function setBackupStatus(html) {
    const $el = $('#backupStatus');
    if ($el.length) $el.html(html);
}

/** 暂停导出 */
function pauseExport() {
    if (exportState.cancelled || exportState.paused || exportState.pausing) return;
    // 立即置暂停标志：下一次检查点生效；pausing 表示「已请求、未确认」
    exportState.paused = true;
    exportState.pausing = true;
    console.info('[ExportState] 已收到暂停请求，等待当前操作完成…');
    updateExportButtons();
    setBackupStatus('正在暂停…等待当前步骤完成后生效');
}

/** 继续导出 */
function resumeExport() {
    if (!exportState.paused) return;
    exportState.paused = false;
    exportState.pausing = false;
    if (exportState.pauseToken) {
        exportState.pauseToken.resolve();
        exportState.pauseToken = null;
    }
    console.info('[ExportState] 已继续导出');
    updateExportButtons();
    setBackupStatus(DEFAULT_BACKUP_STATUS);
}

/** 取消导出 */
function cancelExport() {
    if (exportState.cancelled || exportState.cancelling) return;
    // 立即置取消标志；cancelling 表示「已请求、未被检查点确认」
    exportState.cancelling = true;
    exportState.cancelled = true;
    // 若处于暂停状态，先唤醒以让等待中的检查点退出
    if (exportState.pauseToken) {
        exportState.pauseToken.resolve();
        exportState.pauseToken = null;
    }
    console.warn('[ExportState] 已收到取消请求，正在中止后续步骤…');
    updateExportButtons();
    setBackupStatus('正在取消…等待当前操作结束后立即中止');
}

/** 取消确认：检查点或阶段入口确认取消生效后，刷新最终 UI */
function finalizeCancelUi() {
    if (!exportState.cancelling) return;
    exportState.cancelling = false;
    updateExportButtons();
    setBackupStatus('已取消导出。已完成的部分仍可点击下方<span style="color:red">打包下载</span>按钮保存。');
}

/**
 * 检查点：在分页循环 / 批次循环中调用
 * - 若已取消返回 true（调用方应中止循环），并确认取消 UI
 * - 若已暂停则等待 resume 唤醒，并确认暂停 UI
 * @returns {Promise<boolean>} 是否应中止
 */
async function checkExportState() {
    if (exportState.cancelled) {
        finalizeCancelUi();
        return true;
    }
    if (exportState.paused) {
        // 检查点确认：暂停生效，切换「暂停中…」→「已暂停」
        exportState.pausing = false;
        updateExportButtons();
        setBackupStatus('已暂停，可点击「继续」恢复导出');
        await new Promise((resolve) => {
            exportState.pauseToken = { resolve };
        });
        exportState.pauseToken = null;
    }
    return exportState.cancelled;
}

/** 重置状态（开始新一次备份时调用） */
function resetExportState() {
    exportState.paused = false;
    exportState.cancelled = false;
    exportState.pausing = false;
    exportState.cancelling = false;
    if (exportState.pauseToken) {
        exportState.pauseToken.resolve();
        exportState.pauseToken = null;
    }
    updateExportButtons();
}

/** 隐藏所有导出控制按钮（流程完成时调用） */
function hideExportButtons() {
    $('#btnPauseExport').hide();
    $('#btnResumeExport').hide();
    $('#btnCancelExport').hide();
}

/** 根据当前状态刷新按钮显示 */
function updateExportButtons() {
    const $pause = $('#btnPauseExport');
    const $resume = $('#btnResumeExport');
    const $cancel = $('#btnCancelExport');
    if (exportState.cancelling && !exportState.paused) {
        // 取消请求已发出，尚未被检查点确认
        $pause.hide(); $resume.hide();
        $cancel.show().prop('disabled', true).text('取消中…');
        return;
    }
    if (exportState.cancelled) {
        // 取消已确认，隐藏全部控制按钮
        $pause.hide(); $resume.hide(); $cancel.hide();
        return;
    }
    if (exportState.paused) {
        $pause.hide(); $resume.show(); $cancel.show();
        return;
    }
    if (exportState.pausing) {
        // 暂停请求已发出，尚未被检查点确认
        $pause.show().prop('disabled', true).text('暂停中…');
        $resume.hide();
        $cancel.show();
        return;
    }
    // 正常运行状态
    $pause.show().prop('disabled', false).text('暂停');
    $resume.hide();
    $cancel.show();
}

/**
 * 初始化监听
 */
(function() {

    // 消息监听
    chrome.runtime.onConnect.addListener(function(port) {
        console.info("消息发送者：", port);
        switch (port.name) {
            case 'popup':
                port.onMessage.addListener(function(request) {
                    switch (request.subject) {
                        case 'startBackup':
                            // 重置导出状态（取消 / 暂停）
                            resetExportState();
                            QZone.Common.ExportTypes = request.exportType;
                            // 清空之前选择的相册
                            QZone.Photos.Album.Select = [];
                            QZone.Photos.Album.Select = request.albums || [];
                            // 显示进度窗口
                            operator.next(OperatorType.SHOW);
                            port.postMessage(QZone.Common.ExportTypes);
                            break;
                        case 'initUin':
                            // 获取QQ号
                            let res = API.Utils.initUin();
                            port.postMessage(res);
                            break;
                        case 'initDiaries':
                            // 获取私密日志
                            API.Diaries.getDiaries(0).then((data) => {
                                port.postMessage(API.Utils.toJson(data, /^_Callback\(/));
                            });
                            break;
                        case 'getAlbumList':
                            // 获取相册列表
                            if (_.isEmpty(QZone.Photos.Album.Data)) {
                                API.Photos.getAllAlbumList().then((data) => {
                                    port.postMessage(data);
                                });
                            } else {
                                port.postMessage(QZone.Photos.Album.Data);
                            }
                            break;
                        case 'initConfig':
                            // 初始化配置
                            chrome.storage.sync.get(Default_Config, function(item) {
                                port.postMessage(item);
                            })
                            break;
                        default:
                            break;
                    }
                });
                break;
            default:
                break;
        }
    });
    // 暂停 / 继续 / 取消 按钮事件绑定（事件委托，避免按钮还未渲染时绑定失败）
    $(document).on('click', '#btnPauseExport', pauseExport);
    $(document).on('click', '#btnResumeExport', resumeExport);
    $(document).on('click', '#btnCancelExport', cancelExport);

    operator.next(OperatorType.INIT);

})()


/**
 * 添加下载任务
 * @param {String} module 模块
 * @param {string} item 对象
 * @param {string} url URL
 * @param {string} module_dir 模块下载目录
 * @param {object} source 来源
 * @param {string} FILE_URLS 文件下载链接
 * @param {string} suffix 文件后缀
 */
API.Utils.addDownloadTasks = async(module, item, url, module_dir, source, FILE_URLS, suffix) => {
    // 检查点：每个下载任务（含「识别文件类型」网络请求）前检查暂停/取消
    // 修复：采集阶段 addMediaToTasks / addCommentImageDownloadTasks 等循环
    // 原本无检查点，媒体文件逐个网络识别时暂停/取消长时间无法生效
    if (await checkExportState()) {
        const err = new Error('[ExportState] 导出已取消')
        err.__exportCancelled = true
        throw err
    }
    url = API.Utils.toHttp(url);
    item.custom_url = url;
    if (API.Common.isQzoneUrl()) {
        return;
    }
    let filename = FILE_URLS.get(url);
    if (!filename) {
        // 使用 URL 的确定性哈希作为文件名，使同一 URL 在不同备份会话中生成相同文件名
        // 这样第二次备份时可以检测到文件已存在并跳过下载
        filename = API.Utils.hashUrl(url);
        if (suffix) {
            filename = filename + suffix;
            item.custom_mimeType = suffix;
        } else {
            let autoSuffix = await API.Utils.autoFileSuffix(url);
            filename = filename + autoSuffix;
            item.custom_mimeType = autoSuffix;
        }
    }
    item.custom_filename = filename;
    item.custom_filepath = 'images/' + filename;
    if (!FILE_URLS.has(url)) {
        // 添加下载任务
        API.Utils.newDownloadTask(module, url, module_dir, filename, source, suffix);
        FILE_URLS.set(url, filename);
    }
}

/**
 * 添加下载任务
 * @param {String} module 模块
 * @param {String} url 下载地址
 * @param {String} folder 下载相对目录
 * @param {String} name 文件名称
 * @param {object} source 文件来源
 */
API.Utils.newDownloadTask = (module, url, folder, name, source, makeOrg) => {
    if (!url) {
        return;
    }
    url = makeOrg ? url : API.Utils.makeDownloadUrl(url, true);

    // 添加Ajax请求下载任务
    const ajax_down = new DownloadTask(module, folder, name, API.Common.isFile() ? API.Utils.toHttps(url) : url, source);
    // 添加浏览器下载任务
    const browser_down = new BrowserTask(module, url, API.Common.getRootFolderName(), folder, name, source);
    // 添加迅雷下载任务
    thunderInfo.taskGroupName = API.Common.getRootFolderName();
    const thunder_down = new ThunderTask(module, folder, name, url, source);

    // 因为视频存在有效期，所以尽量将MP4文件前置，尽早下载
    if (name && name.indexOf('mp4') > -1) {
        downloadTasks.unshift();
        downloadTasks.unshift(ajax_down);
        browserTasks.unshift(browser_down);
        thunderInfo.addTask(thunder_down);
        return;
    }
    downloadTasks.push(ajax_down);
    browserTasks.push(browser_down);
    thunderInfo.addTask(thunder_down);
}

/**
 * 下载文件
 */
API.Utils.downloadAllFiles = async() => {
    let downloadType = QZone_Config.Common.downloadType;
    if (downloadType === 'QZone') {
        // 使用QQ空间外链时，不需要下载文件
        return;
    }
    if (downloadTasks.length === 0 || thunderInfo.tasks.length === 0 || browserTasks.length === 0) {
        // 没有下载任务的时候，不调用下载逻辑
        return;
    }
    switch (downloadType) {
        case 'File':
            await API.Common.downloadsByAjax(downloadTasks);
            break;
        case 'Aria2':
            await API.Common.downloadByAria2(downloadTasks);
            break;
        case 'Thunder':
            await API.Common.invokeThunder(thunderInfo);
            break;
        case 'Thunder_Clipboard':
            // 复制迅雷下载任务到Clipboard
            await API.Common.copyThunderTasksToClipboard(thunderInfo);
            break;
        case 'Thunder_Link':
            // 写入迅雷任务到文件
            await API.Common.writeThunderTaskToFile(thunderInfo);
            break;
        case 'Browser':
            await API.Common.downloadsByBrowser(browserTasks);
            break;
        default:
            console.warn('未识别类型', downloadType);
            break;
    }
}

/**
 * 获取下载任务
 */
API.Utils.getDownloadTasks = () => {
    // 下载方式
    let downloadType = QZone_Config.Common.downloadType;
    let tasks = [];
    switch (downloadType) {
        case 'File':
            tasks = downloadTasks;
            break;
        case 'Browser':
            tasks = browserTasks;
            break;
        case 'Aria2':
            tasks = downloadTasks;
            break;
        case 'Thunder':
            tasks = thunderInfo.tasks;
            break;
        case 'Thunder_Link':
            tasks = thunderInfo.tasks;
            break;
        default:
            break;
    }
    return tasks;
}

/**
 * 获取下载失败的下载任务
 */
API.Utils.getFailedTasks = () => {
    // 下载方式
    let downloadType = QZone_Config.Common.downloadType;
    let tasks = [];
    switch (downloadType) {
        case 'File':
            for (const downloadTask of downloadTasks) {
                if (downloadTask.success) {
                    continue;
                }
                tasks.push(downloadTask);
            }
            break;
        case 'Browser':
            tasks = browserTasks;
            break;
        case 'Thunder':
            tasks = thunderInfo.tasks;
            break;
        default:
            break;
    }
    return tasks;
}