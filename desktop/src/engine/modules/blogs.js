/**
 * QQ空间日志模块的导出API
 * @author https://github.com/ShunCai/
 */

/**
 * 导出日志数据
 */
API.Blogs.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Blogs_Row_Infos');
    indicator.print();

    try {
        // 获取所有的日志数据
        let items = await API.Blogs.getAllList();
        console.log('日志列表获取完成，共有日志%i篇', items.length);

        // 添加下载任务
        API.Blogs.handerListImages(items);

        // 获取日志内容
        items = await API.Blogs.getAllContents(items);
        console.log('日志内容获取完成，共有日志%i篇', items.length);

        // 获取所有的日志评论
        items = await API.Blogs.getItemsAllCommentList(items);

        // 添加评论的表情下载任务，日志内容的，统一按普通图片下载即可
        API.Common.addAllCommentEmoticonDownloadTasks(items);

        // 获取日志点赞列表
        await API.Blogs.getAllLikeList(items);

        // 获取日志最近浏览
        await API.Blogs.getAllVisitorList(items);

        // 根据导出类型导出数据    
        await API.Blogs.exportAllListToFiles(items);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Blogs', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有日志的内容（P2：委托 collectors/Blogs）
 * @param {Array} items 日志列表
 */
API.Blogs.getAllContents = QZoneCollectors.Blogs.getAllContents;


/**
 * 获取单页的日志列表（P2：委托 collectors/Blogs）
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Blogs.getList = QZoneCollectors.Blogs.getList;


/**
 * 获取所有日志列表（P2：委托 collectors/Blogs）
 */
API.Blogs.getAllList = QZoneCollectors.Blogs.getAllList;


/**
 * 获取所有日志的评论列表（P2：委托 collectors/Blogs）
 * @param {string} item 日志
 */
API.Blogs.getItemsAllCommentList = QZoneCollectors.Blogs.getItemsAllCommentList;

/**
 * 获取单条日志的单页评论列表（P2：委托 collectors/Blogs）
 * @param {object} item 日志
 * @param {integer} pageIndex 页数索引
 */
API.Blogs.getItemCommentList = QZoneCollectors.Blogs.getItemCommentList;

/**
 * 获取单条日志的全部评论列表（P2：委托 collectors/Blogs）
 * @param {object} item 日志
 */
API.Blogs.getItemAllCommentList = QZoneCollectors.Blogs.getItemAllCommentList;


/**
 * 所有日志转换成导出文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportAllListToFiles = QZoneExporters.Blogs.exportAllListToFiles;

/**
 * 导出日志到 SPA（P2：委托 exporters/Blogs，文件结构说明见 exporters/blogs.js）
 * @param {Array} items 日志列表
 */
API.Blogs.exportToSpa = QZoneExporters.Blogs.exportToSpa;

/**
 * 导出日志到HTML文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportToHtml = QZoneExporters.Blogs.exportToHtml;


/**
 * 导出日志到HTML文件（P2：委托 exporters/Blogs）
 * @param {Array} items 日志列表
 */
API.Blogs.exportToPDF = QZoneExporters.Blogs.exportToPDF;

/**
 * 导出日志到MarkDown文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportToMarkdown = QZoneExporters.Blogs.exportToMarkdown;

/**
 * 获取单篇日志的MD内容（P2：委托 exporters/Blogs）
 * @param {object} item 日志信息
 */
API.Blogs.getMarkdown = QZoneExporters.Blogs.getMarkdown;

/**
 * 处理日志列表的图片（P2：委托 collectors/Blogs）
 * @param {Array} items 日志列表
 */
API.Blogs.handerListImages = QZoneCollectors.Blogs.handerListImages;

/**
 * 处理日志内容的图片（P2：委托 collectors/Blogs）
 * @param {object} item 日志
 * @param {Array} images 图片元素列表
 */
API.Blogs.handerContentImages = QZoneCollectors.Blogs.handerContentImages;

/**
 * 处理视频信息（简单处理，没仔细研究）（P2：委托 collectors/Blogs）
 * @param {object} item 日志
 * @param {Array} embeds 图片元素列表
 */
API.Blogs.handerMedias = QZoneCollectors.Blogs.handerMedias;

/**
 * 导出日志到JSON文件
 * @param {Array} items 日志列表
 */
API.Blogs.exportToJson = QZoneExporters.Blogs.exportToJson;

/**
 * 日志自定义排序（置顶排前，同是置顶最新发表在前，非置顶最新发表在前）（P2：委托 collectors/Blogs）
 * @param {Array} items 列表
 */
API.Blogs.sort = QZoneCollectors.Blogs.sort;

/**
 * 获取日志赞记录（P2：委托 collectors/Blogs）
 * @param {Array} items 日志列表
 */
API.Blogs.getAllLikeList = QZoneCollectors.Blogs.getAllLikeList;


/**
 * 获取单条日志的全部最近访问（P2：委托 collectors/Blogs）
 * @param {object} item 说说
 */
API.Blogs.getItemAllVisitorsList = QZoneCollectors.Blogs.getItemAllVisitorsList;

/**
 * 获取日志最近访问（P2：委托 collectors/Blogs）
 * @param {Array} items 日志列表
 */
API.Blogs.getAllVisitorList = QZoneCollectors.Blogs.getAllVisitorList;

/**
 * 获取日志阅读数（P2：委托 collectors/Blogs）
 * @param {Array} items 日志列表
 */
API.Blogs.getAllReadCount = QZoneCollectors.Blogs.getAllReadCount;