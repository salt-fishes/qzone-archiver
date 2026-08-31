/**
 * QQ空间日记模块的导出API
 * @author https://github.com/ShunCai/
 */

/**
 * 导出日记数据
 */
API.Diaries.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Diaries_Row_Infos');
    indicator.print();

    try {

        // 获取所有的日记数据
        let items = await API.Diaries.getAllList();
        console.log('日记列表获取完成，共有日志%i篇', items.length);

        // 获取日记内容
        items = await API.Diaries.getAllContents(items);
        console.log('日记内容列表获取完成，共有日志%i篇', items.length);

        // 获取所有的日记评论，由普通日志转日记的，会保留评论
        items = await API.Diaries.getItemsAllCommentList(items);

        // 添加评论的表情下载任务，日记内容的，统一按普通图片下载即可
        API.Common.addAllCommentEmoticonDownloadTasks(items);

        // 获取日志点赞列表
        await API.Diaries.getAllLikeList(items);

        // 获取日志最近浏览
        await API.Diaries.getAllVisitorList(items);

        // 根据导出类型导出数据    
        await API.Diaries.exportAllListToFiles(items);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Diaries', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有日记的内容（P2-4：委托 collectors/Diaries）
 * @param {Array} items 日记列表
 */
API.Diaries.getAllContents = QZoneCollectors.Diaries.getAllContents;


/**
 * 获取单页的日记列表（P2：委托 collectors/Diaries）
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Diaries.getList = QZoneCollectors.Diaries.getList;


/**
 * 获取所有日记列表（P2：委托 collectors/Diaries）
 */
API.Diaries.getAllList = QZoneCollectors.Diaries.getAllList;

/**
 * 获取所有日志的评论列表（P2：委托 collectors/Diaries）
 * @param {string} item 日志
 */
API.Diaries.getItemsAllCommentList = QZoneCollectors.Diaries.getItemsAllCommentList;

/**
 * 获取单条日志的单页评论列表（P2：委托 collectors/Diaries）
 * @param {object} item 日志
 * @param {integer} pageIndex 页数索引
 */
API.Diaries.getItemCommentList = QZoneCollectors.Diaries.getItemCommentList;

/**
 * 获取单条日志的全部评论列表（P2：委托 collectors/Diaries）
 * @param {object} item 日志
 */
API.Diaries.getItemAllCommentList = QZoneCollectors.Diaries.getItemAllCommentList;


/**
 * 获取日志赞记录（P2：委托 collectors/Diaries）
 * @param {Array} items 日志列表
 */
API.Diaries.getAllLikeList = QZoneCollectors.Diaries.getAllLikeList;


/**
 * 获取单条日记的全部最近访问（P2：委托 collectors/Diaries）
 * @param {object} item 说说
 */
API.Diaries.getItemAllVisitorsList = QZoneCollectors.Diaries.getItemAllVisitorsList;

/**
 * 获取日志最近访问（P2：委托 collectors/Diaries）
 * @param {Array} items 日志列表
 */
API.Diaries.getAllVisitorList = QZoneCollectors.Diaries.getAllVisitorList;

/**
 * 获取日记阅读数（P2-4：委托 collectors/Diaries）
 * @param {Array} items 日志列表
 */
API.Diaries.getAllReadCount = QZoneCollectors.Diaries.getAllReadCount;

/**
 * 所有日记转换成导出文件
 * @param {Array} items 日记列表
 */
API.Diaries.exportAllListToFiles = QZoneExporters.Diaries.exportAllListToFiles;

/**
 * 导出日记到 SPA
 *
 * 生成文件结构：
 *   Diaries/data/
 *     - diaries-index.js          → window.diariesIndex   （轻量索引，首屏加载）
 *     - diaries-YYYY.js           → window.diaries_YYYY   （按年份分片全量数据）
 *
 * 索引字段：blogId, title, category, time(格式化), pubTime(unix秒),
 *           commentCount, likeCount, hasContent
 *
 * 全量数据保留扩展端原始结构（含 base64 编码的 html 内容），
 * SPA 端按需加载年份分片后 atob 解码渲染。
 *
 * @param {Array} items 日记列表
 */
API.Diaries.exportToSpa = QZoneExporters.Diaries.exportToSpa;

/**
 * 导出日记到HTML文件
 * @param {Array} items 日志列表
 */
API.Diaries.exportToHtml = QZoneExporters.Diaries.exportToHtml;


/**
 * 导出日记到MarkDown文件
 * @param {Array} items 日记列表
 */
API.Diaries.exportToMarkdown = QZoneExporters.Diaries.exportToMarkdown;

/**
 * 获取单篇日记的MD内容（P2-4：委托 exporters/Diaries）
 * @param {object} item 日记信息
 */
API.Diaries.getMarkdown = QZoneExporters.Diaries.getMarkdown;

/**
 * 处理日志的图片（P2-4：委托 collectors/Diaries）
 * @param {object} item 日志
 * @param {Array} images 图片元素列表
 */
API.Diaries.handerImages = QZoneCollectors.Diaries.handerImages;

/**
 * 处理视频信息（P2-4：委托 collectors/Diaries）
 * @param {object} item 日志
 * @param {Array} embeds 图片元素列表
 */
API.Diaries.handerMedias = QZoneCollectors.Diaries.handerMedias;

/**
 * 导出日记到JSON文件
 * @param {Array} items 日记列表
 */
API.Diaries.exportToJson = QZoneExporters.Diaries.exportToJson;