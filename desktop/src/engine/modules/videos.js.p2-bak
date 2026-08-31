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
        console.error('视频导出异常', error);
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
 * 获取视频的所有评论
 * @param {Array} videos 视频列表
 */
API.Videos.getAllComments = async(videos) => {
    // 视频评论配置
    const CONFIG = QZone_Config.Videos.Comments;

    // 是否获取视频评论
    if (!CONFIG.isGet || API.Videos.isFile()) {
        return videos;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Videos_Comments');
    indicator.setTotal(videos.length);

    for (let index = 0; index < videos.length; index++) {

        const video = videos[index];

        // 当前位置
        await indicator.setIndex(index + 1);

        if (!API.Common.isNewItem(video)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 获取评论
        video.cmtTotal = 0;
        video.comments = [];

        if (!video.shuoshuoid) {
            // 说说ID为空时跳过不获取 TODO 待定
            indicator.addSkip(video);
            continue;
        }

        const nextPage = async function(video, pageIndex) {
            // 下一页索引
            const nextPageIndex = pageIndex + 1;

            // TODO，待确认是否存在shuoshuoid为空的情况，相册或视频直接上传？
            return await API.Videos.getComments(video.shuoshuoid, pageIndex).then(async(data) => {

                // 去掉函数，保留json
                data = API.Utils.toJson(data, /^_Callback\(/);
                if (data.code && data.code != 0) {
                    // 获取异常
                    console.warn('获取视频评论异常：', data);
                }
                data = data.data || {};
                data.comments = data.comments || [];

                // 添加评论数到视频
                video.cmtTotal = data.total || video.cmtTotal || 0;

                // 合并数据
                video.comments = API.Utils.unionItems(video.comments, data.comments);

                if (!API.Common.isGetNextPage(QZone.Videos.OLD_Data, data.comments, CONFIG)) {
                    // 不再继续获取下一页
                    return video.comments;
                }

                // 递归获取下一页
                return await API.Common.callNextPage(nextPageIndex, CONFIG, video.cmtTotal, video.comments, arguments.callee, video, nextPageIndex, indicator);

            }).catch(async(e) => {
                console.error("获取视频评论列表异常：", pageIndex + 1, video, e);
                // 当前页失败后，跳过继续请求下一页
                // 递归获取下一页
                return await API.Common.callNextPage(nextPageIndex, CONFIG, video.cmtTotal, video.comments, arguments.callee, video, nextPageIndex, indicator);
            });
        }

        // 获取第一页评论
        await nextPage(video, 0);

        indicator.addSuccess(video);
    }

    // 完成
    indicator.complete();
    return videos;
}


/**
 * 添加视频下载任务
 * @param {string} module 模块
 * @param {Array} videos 视频列表
 * @param {string} module_dir 模块相对目录
 * @param {object} source 来源
 */
API.Videos.addDownloadTasks = (module, videos, module_dir, source) => {
    // 是否为视频
    const isVideo = 'Videos' === module;

    if (!videos || API.Common.isQzoneUrl() || (isVideo && QZone_Config.Videos.exportType == 'Link')) {
        // QQ空间外链、视频备份类型为下载链接、则不添加下载任务
        return;
    }

    // 遍历
    for (let idx = 0; idx < videos.length; idx++) {
        // 视频
        const video = videos[idx];

        // 序号，便于排序
        const orderNumber = API.Utils.prefixNumber(idx + 1, videos.length.toString().length);

        if (isVideo && !API.Common.isNewItem(video)) {
            // 已备份数据跳过不处理
            console.warn("已备份数据跳过不处理", video);
            continue;
        }

        // 添加视频预览图下载任务
        video.custom_pre_url = video.pre || video.url1 || video.preview_img;
        // 预览图直接写死后缀
        video.custom_pre_filename = API.Utils.newSimpleUid(8, 16) + '.jpeg';
        video.custom_pre_filepath = 'images/' + video.custom_pre_filename;
        API.Utils.newDownloadTask(module, video.custom_pre_url, module_dir, video.custom_pre_filename, video);

        // 如果是外部视频，跳过不下载
        if (video.play_url) {
            console.warn("外部视频，跳过", video);
            continue;
        }

        // 添加视频下载任务(视频/相片/收藏/说说)
        video.custom_url = video.url || video.video_url || video.url3;
        if (!video.custom_url || API.Videos.isExternalVideo(video)) {
            // 外部视频跳过不下载
            console.warn("外部视频，跳过", video);
            continue;
        }
        video.custom_filename = API.Videos.getFileName(video.custom_url);
        video.custom_filename = isVideo ? API.Videos.getVideoFileName(video, orderNumber) : video.custom_filename;

        // 添加下载任务
        const categoryPath = API.Videos.getFileStructureFolderPath(video);
        const downloadFolder = categoryPath ? 'Videos/' + categoryPath : 'Videos';

        // 文件路径
        video.custom_filepath = 'images/' + video.custom_filename;
        if (isVideo) {
            video.custom_filepath = categoryPath ? categoryPath + '/' + video.custom_filename : video.custom_filename;
        }

        API.Utils.newDownloadTask(module, video.custom_url, isVideo ? downloadFolder : module_dir, video.custom_filename, source || video);
    }
    return videos;
}

/**
 * 导出视频
 * @param {Array} videos 视频列表
 */
API.Videos.exportAllToFiles = async(videos) => {
    // 获取用户配置
    let exportType = QZone_Config.Videos.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Videos.exportToHtml(videos);
            break;
        case 'JSON':
            await API.Videos.exportToJson(videos);
            break;
        case 'MarkDown':
            await API.Videos.exportToMarkdown(videos);
            break;
        case 'Link':
            await API.Videos.exportToLink(videos);
            break;
        case 'SPA':
            await API.Videos.exportToSpa(videos);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

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
 * 获取视频的Markdown内容
 */
API.Videos.getMarkdowns = (videos) => {
    const contents = [];
    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];

        video.desc = video.desc || video.name || API.Utils.formatDate(video.uploadTime);

        // 视频描述
        contents.push('> ' + API.Common.formatContent(video.desc, 'MD', false, false, false, false, true));
        contents.push('\r\n');

        // 视频
        contents.push('<video height="400" src="{0}" controls="controls" ></video>'.format(video.custom_filepath || video.custom_url || video.url));
        contents.push('\r\n');

        // 视频评论 TODO 私密评论处理
        video.comments = video.comments || [];
        contents.push('> 评论({0})'.format(video.cmtTotal || video.comments.length));
        contents.push('\r\n');

        for (const comment of video.comments) {
            // 评论人
            const poster_name = API.Common.formatContent(comment.poster.name, 'MD', false, false, false, false, true);
            const poster_display = API.Common.getUserLink(comment.poster.id, poster_name, "MD");

            // 评论内容
            let content = API.Common.formatContent(comment.content, 'MD', false, false, false, false, true);
            contents.push("* {0}：{1}".format(poster_display, content));

            // 评论包含图片
            if (comment.pictotal > 0) {
                let comment_images = comment.pic || [];
                for (const image of comment_images) {
                    let custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
                    custom_url = API.Common.isQzoneUrl() ? (image.custom_url || custom_url) : '../' + image.custom_filepath;
                    // 添加评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
            // 评论的回复
            let replies = comment.replies || [];
            for (const repItem of replies) {

                // 回复人
                let repName = API.Common.formatContent(repItem.poster.name, 'MD', false, false, false, false, true);
                const rep_poster_display = API.Common.getUserLink(comment.poster.id, repName, "MD");

                // 回复内容
                let content = API.Common.formatContent(repItem.content, 'MD', false, false, false, false, true);
                contents.push("\t* {0}：{1}".format(rep_poster_display, content));

                const repImgs = repItem.pic || [];
                for (const repImg of repImgs) {
                    // 回复包含图片
                    let custom_url = repImg.o_url || repImg.hd_url || repImg.b_url || repImg.s_url || repImg.url;
                    custom_url = API.Common.isQzoneUrl() ? (repImg.custom_url || custom_url) : '../' + repImg.custom_filepath;
                    // 添加回复评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
        }

        // 分割线
        contents.push('---');
    }
    return contents.join('\r\n');
}

/**
 * 导出视频下载链接到下载链接
 * @param {Array} items 视频列表
 */
API.Videos.exportToLink = async(videos) => {
    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    await indicator.setIndex('下载链接');

    let videoUrls = [];
    for (const video of videos) {
        videoUrls.push(API.Utils.makeDownloadUrl(video.url, true));
    }
    let filepath = API.Common.getModuleRoot('Videos') + '/videos.downlist';
    await API.Utils.writeText(videoUrls.join('\r\n'), filepath).then((file) => {
        console.info('导出视频下载链接成功', file);
    }).catch((e) => {
        console.error('导出视频下载链接异常', e);
    });

    // 完成
    indicator.complete();
    return videos;
}

/**
 * 导出视频到JSON文件
 * @param {Array} videos 视频列表
 */
API.Videos.exportToJson = QZoneExporters.Videos.exportToJson;

/**
 * 获取腾讯视频的播放地址
 * @param {string} vid 视频ID
 */
API.Videos.getTencentVideoUrl = (vid) => {
    let params = {
        "origin": "https://user.qzone.qq.com",
        "vid": vid,
        "autoplay": true,
        "volume": 100,
        "disableplugin": "IframeBottomOpenClientBar",
        "additionplugin": "IframeUiSearch",
        "platId": "qzone_feed",
        "show1080p": true,
        "isDebugIframe": false
    }
    return API.Utils.toUrl('https://v.qq.com/txp/iframe/player.html', params);
}

/**
 * 获取视频连接
 * @param {object} 视频信息
 */
API.Videos.getVideoUrl = (video) => {
    // URL3个人相册视频？
    let url = video.url3 || video.url;
    if (video.source_type == "share") {
        // 分享视频连接？
        url = video.rt_url;
    }
    if (API.Videos.isTencentVideo(video)) {
        // 腾讯视频
        if (!video.video_id) {
            return video.url2;
        }
        url = API.Videos.getTencentVideoUrl(video.video_id);
    }
    // 其他第三方视频
    return url;
}

/**
 * 是否腾讯视频（判断不严谨，先临时判断）
 * @param {object} 视频信息
 */
API.Videos.isTencentVideo = (video) => {
    let url2 = video.url2 || '';
    let url3 = video.url3 || '';
    if (!url2 || url3.indexOf('.mp4') > -1) {
        // 如果URL都没有值，或者地址含有.mp4，肯定是空间视频？
        return false;
    }
    if (url3.indexOf('tencentvideo') > -1) {
        // 该判断不严谨，但是不知道怎么判断的好
        return true;
    }
    return false;
}

/**
 * 是否外部视频（判断不严谨，先临时判断）
 * @param {object} 视频信息
 */
API.Videos.isExternalVideo = (video) => {
    let url3 = video.url3 || '';
    const isTencentTV = API.Videos.isTencentVideo(video);
    if (isTencentTV) {
        return true;
    }
    if (url3.indexOf('.swf') > -1) {
        // Flash地址肯定是外部视频？
        return true;
    }
    return false;
}

/**
 * 导出类型是否文件
 */
API.Videos.isFile = () => {
    return QZone_Config.Videos.exportType == 'File' || QZone_Config.Videos.exportType == 'Link'
}

/**
 * 获取视频赞记录（P2：委托 collectors/Videos）
 * @param {Array} items 日志列表
 */
API.Videos.getAllLikeList = QZoneCollectors.Videos.getAllLikeList;

/**
 * 获取视频名称
 * @param {Object} video 视频
 * @param {String} prefix 前缀
 * @returns 
 */
API.Videos.getVideoFileName = (video, prefix) => {
    // 上传时间
    const dateTime = API.Utils.parseDate(video.uploadtime || video.uploadTime).getTime();
    if (QZone_Config.Videos.RenameType === 'Default') {
        // 文件名称，排序号+空间名称
        video.custom_filename = API.Utils.filenameValidate(prefix + '_' + video.custom_filename);
    } else if (QZone_Config.Videos.RenameType === 'Name') {
        // 文件名称，排序号+视频标题
        video.custom_filename = API.Utils.filenameValidate(prefix + '_' + (video.title || API.Utils.formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss')));
    } else if (QZone_Config.Videos.RenameType === 'Time') {
        // 文件名称，排序号+视频标题+拍摄/上传时间
        if (video.title) {
            video.custom_filename = API.Utils.filenameValidate(prefix + '_' + video.title + '_' + API.Utils.formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss'));
        } else {
            video.custom_filename = API.Utils.filenameValidate(prefix + '_' + API.Utils.formatDate(dateTime / 1000, 'yyyyMMdd_hhmmss'));
        }
    }
    // 追加后缀
    video.custom_filename = video.custom_filename.endsWith('.mp4') ? video.custom_filename : video.custom_filename + '.mp4';
    video.custom_filename = API.Utils.filenameValidate(video.custom_filename);
    return video.custom_filename;
}

/**
 * 添加下载表情任务
 * @param {Videos} item 
 */
API.Videos.addDownloadEmoticonTasks = (items) => {
    if (API.Common.isQzoneUrl()) {
        return;
    }

    for (const item of items) {
        if (!API.Common.isNewItem(item)) {
            // QQ空间外链或已备份项，跳过
            continue;
        }

        // 视频描述
        item.name && API.Common.formatContent(item.name, 'HTML', false, false, false, true, false);

        // 添加评论的表情下载任务
        API.Common.addCommentEmoticonDownloadTasks(item);
    }

}