/**
 * QQ空间视频模块导出API
 * @author https://github.com/ShunCai/
 */

/**
 * 导出视频数据
 */
API.Videos.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Videos_Row_Infos');
    indicator.print();

    try {

        // 获取所有的视频列表
        let videos = await API.Videos.getAllList();

        // 获取所有视频的详情，TODO，待确认，
        // 理论上不需要获取，如若涉及权限、点赞是否需要获取？

        // 获取所有视频的评论列表
        videos = await API.Videos.getAllComments(videos);

        // 获取视频赞记录
        await API.Videos.getAllLikeList(videos);

        // 添加评论的表情下载任务
        API.Videos.addDownloadEmoticonTasks(videos);

        // 添加视频下载任务
        API.Videos.addDownloadTasks('Videos', videos, 'Videos/images');

        // 根据导出类型导出数据
        await API.Videos.exportAllToFiles(videos);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Videos', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}


/**
 * 获取一页的视频列表（P2：委托 collectors/Videos）
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Videos.getPageList = QZoneCollectors.Videos.getPageList;


/**
 * 获取所有视频列表（P2：委托 collectors/Videos）
 */
API.Videos.getAllList = QZoneCollectors.Videos.getAllList;

/**
 * 获取视频的所有评论（P2：委托 collectors/Videos）
 * @param {Array} videos 视频列表
 */
API.Videos.getAllComments = QZoneCollectors.Videos.getAllComments;


/**
 * 添加视频下载任务（P2：委托 collectors/Videos）
 * @param {string} module 模块
 * @param {Array} videos 视频列表
 * @param {string} module_dir 模块相对目录
 * @param {object} source 来源
 */
API.Videos.addDownloadTasks = QZoneCollectors.Videos.addDownloadTasks;

/**
 * 导出视频（P2：委托 exporters/Videos）
 * @param {Array} videos 视频列表
 */
API.Videos.exportAllToFiles = QZoneExporters.Videos.exportAllToFiles;

/**
 * 导出视频到 SPA
 *
 * 生成文件结构：
 *   Videos/data/
 *     - videos-index.js          → window.videosIndex   （轻量索引，首屏加载）
 *     - videos-YYYY.js           → window.videos_YYYY   （按年份分片全量数据）
 *
 * 索引字段：vid, title, desc(摘要), time(格式化时间), uploadTime(unix秒),
 *           commentCount, likeCount, hasLocalVideo, hasCover, coverUrl, videoSrc
 *
 * 全量数据保留扩展端原始结构，SPA 端按需加载年份分片后渲染详情。
 *
 * @param {Array} videos 视频列表
 */
API.Videos.exportToSpa = QZoneExporters.Videos.exportToSpa;

/**
 * 导出视频到HTML文件
 * @param {Array} videos 视频列表
 */
API.Videos.exportToHtml = QZoneExporters.Videos.exportToHtml;

/**
 * 导出视频到MD文件
 * @param {Array} videos 视频列表
 */
API.Videos.exportToMarkdown = QZoneExporters.Videos.exportToMarkdown;

/**
 * 获取视频的Markdown内容（P2：委托 exporters/Videos）
 */
API.Videos.getMarkdowns = QZoneExporters.Videos.getMarkdowns;

/**
 * 导出视频下载链接到下载链接（P2：委托 exporters/Videos）
 * @param {Array} items 视频列表
 */
API.Videos.exportToLink = QZoneExporters.Videos.exportToLink;

/**
 * 导出视频到JSON文件
 * @param {Array} videos 视频列表
 */
API.Videos.exportToJson = QZoneExporters.Videos.exportToJson;

/**
 * 获取腾讯视频的播放地址（P2：委托 collectors/Videos）
 * @param {string} vid 视频ID
 */
API.Videos.getTencentVideoUrl = QZoneCollectors.Videos.getTencentVideoUrl;

/**
 * 获取视频连接（P2：委托 collectors/Videos）
 * @param {object} 视频信息
 */
API.Videos.getVideoUrl = QZoneCollectors.Videos.getVideoUrl;

/**
 * 是否腾讯视频（判断不严谨，先临时判断）（P2：委托 collectors/Videos）
 * @param {object} 视频信息
 */
API.Videos.isTencentVideo = QZoneCollectors.Videos.isTencentVideo;

/**
 * 是否外部视频（判断不严谨，先临时判断）（P2：委托 collectors/Videos）
 * @param {object} 视频信息
 */
API.Videos.isExternalVideo = QZoneCollectors.Videos.isExternalVideo;

/**
 * 导出类型是否文件（P2：委托 collectors/Videos）
 */
API.Videos.isFile = QZoneCollectors.Videos.isFile;

/**
 * 获取视频赞记录（P2：委托 collectors/Videos）
 * @param {Array} items 日志列表
 */
API.Videos.getAllLikeList = QZoneCollectors.Videos.getAllLikeList;

/**
 * 获取视频名称（P2：委托 collectors/Videos）
 * @param {Object} video 视频
 * @param {String} prefix 前缀
 * @returns
 */
API.Videos.getVideoFileName = QZoneCollectors.Videos.getVideoFileName;

/**
 * 添加下载表情任务（P2：委托 collectors/Videos）
 * @param {Videos} item
 */
API.Videos.addDownloadEmoticonTasks = QZoneCollectors.Videos.addDownloadEmoticonTasks;