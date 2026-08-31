/**
 * QQ空间分享模块的导出API
 * @author https://github.com/ShunCai/
 */

API.Shares.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Shares_Row_Infos');
    indicator.print();

    try {
        // 获取所有的分享列表
        let items = await API.Shares.getAllList();
        console.log('分享列表获取完成，共有分享%i条', items.length);

        // 获取所有的分享评论
        items = await API.Shares.getItemsAllCommentList(items);
        console.log('分享列表评论获取完成');

        // 添加表情下载任务
        API.Videos.addDownloadEmoticonTasks(items);

        // 添加多媒体下载任务
        items = await API.Shares.addMediaToTasks(items);

        // 获取分享点赞列表
        await API.Shares.getAllLikeList(items);

        // 获取分享最近浏览
        await API.Shares.getAllVisitorList(items);

        // 根据导出类型导出数据    
        await API.Shares.exportAllListToFiles(items);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Shares', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有分享列表（P2：委托 collectors/Shares）
 */
API.Shares.getAllList = QZoneCollectors.Shares.getAllList;

/**
 * 转换分享网页到数据（P3：委托 repos/Shares）
 * @param {String} html 分享页面内容
 */
API.Shares.convert = QZoneRepo.Shares.convert;

/**
 * 获取单条分享的全部评论列表（P2：委托 collectors/Shares）
 * @param {object} item 分享
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Shares.getItemAllCommentList = QZoneCollectors.Shares.getItemAllCommentList;

/**
 * 获取所有分享的评论列表（P2：委托 collectors/Shares）
 * @param {Array} items 分享
 */
API.Shares.getItemsAllCommentList = QZoneCollectors.Shares.getItemsAllCommentList;

/**
 * 获取分享赞记录（P2：委托 collectors/Shares）
 * @param {Array} items 分享列表
 */
API.Shares.getAllLikeList = QZoneCollectors.Shares.getAllLikeList;

/**
 * 获取单条分享的全部最近访问（P2：委托 collectors/Shares）
 * @param {object} item 分享
 */
API.Shares.getItemAllVisitorsList = QZoneCollectors.Shares.getItemAllVisitorsList;

/**
 * 获取分享最近访问（P2：委托 collectors/Shares）
 * @param {Array} items 分享列表
 */
API.Shares.getAllVisitorList = QZoneCollectors.Shares.getAllVisitorList;

/**
 * 添加多媒体下载任务（P2-4：委托 collectors/shares）
 * @param {Array} dataList
 */
API.Shares.addMediaToTasks = QZoneCollectors.Shares.addMediaToTasks;

/**
 * 所有分享转换成导出文件
 * @param {Array} items 分享列表
 */
API.Shares.exportAllListToFiles = QZoneExporters.Shares.exportAllListToFiles;

/**
 * 导出分享到 SPA
 *
 * 数据策略：
 *   1. 轻量索引 sharesIndex（uin/昵称/类型/时间/描述/来源/评论数/点赞数）—— SPA 启动时立即加载
 *   2. 按年分片全量数据 shares_<year> —— 用户滚动到某年时按需 <script> 加载
 *
 * 注意：items 是纯数组（ShareInfo[]），与 favorites.js 一致。
 *   shareTime 是 unix 秒，需格式化为字符串供 SPA 端展示。
 *   source.images 已下载并含 custom_url/custom_filepath，全量数据保留供详情页渲染。
 *   Shares 不支持视频/音乐下载（仅图片），无需考虑 video_list/music_list。
 */
API.Shares.exportToSpa = QZoneExporters.Shares.exportToSpa;

/**
 * 导出分享到HTML文件
 * @param {Array} shares 数据
 */
API.Shares.exportToHtml = QZoneExporters.Shares.exportToHtml;

/**
 * 获取单篇分享的Markdown内容（P2-4：委托 exporters/shares）
 * @param {ShareInfo} share 分享
 */
API.Shares.getMarkdown = QZoneExporters.Shares.getMarkdown;

/**
 * 导出分享到Markdown文件
 * @param {Array} items 数据
 */
API.Shares.exportToMarkdown = QZoneExporters.Shares.exportToMarkdown;

/**
 * 导出分享到JSON文件
 * @param {Array} items 数据
 */
API.Shares.exportToJson = QZoneExporters.Shares.exportToJson;

/**
 * 添加下载表情任务（P2-4：委托 collectors/shares）
 * @param {Shares} item
 */
API.Shares.addDownloadEmoticonTasks = QZoneCollectors.Shares.addDownloadEmoticonTasks;