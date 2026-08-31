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
        console.error('分享导出异常：', error);
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
 * 添加多媒体下载任务
 * @param {Array} dataList
 */
API.Shares.addMediaToTasks = async(dataList) => {
    // 下载相对目录
    const module_dir = 'Shares/images';

    for (const item of dataList) {
        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 来源配图（网页、音乐等）
        const images = item.source && item.source.images || [];
        for (const image of images) {
            await API.Utils.addDownloadTasks('Shares', image, image.url, module_dir, item, QZone.Shares.FILE_URLS);
        }

        // 评论配图
        const comments = item.comments;
        for (const comment of comments) {
            comment.pic = comment.pic || [];
            for (let pic of comment.pic) {
                pic.custom_url = pic.o_url || pic.hd_url || pic.b_url || pic.s_url;
                await API.Utils.addDownloadTasks('Shares', pic, pic.custom_url, module_dir, item, QZone.Shares.FILE_URLS);
            }
            // 回复的图片
            comment.replies = comment.replies || [];
            for (const repItem of comment.replies) {
                repItem.pic = repItem.pic || [];
                for (let pic of repItem.pic) {
                    pic.custom_url = pic.o_url || pic.hd_url || pic.b_url || pic.s_url;
                    await API.Utils.addDownloadTasks('Shares', pic, pic.custom_url, module_dir, item, QZone.Shares.FILE_URLS);
                }
            }
        }

        // 下载视频 TODO 分享是否存在视频，分享存在视频，但是无法分享视频
    }
    return dataList;
}

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
 * 获取单篇分享的Markdown内容
 * @param {ShareInfo} share 分享
 */
API.Shares.getMarkdown = (share) => {
    const contents = [];
    // 分享人
    let share_user_name = API.Common.formatContent(share.nickname, 'MD', false, false, false, false, true);
    share_user_name = API.Common.getUserLink(share.uin, share_user_name, 'MD', true);
    // 分享描述
    contents.push('{0}  分享：{1}  '.format(share_user_name, API.Common.formatContent(share.desc || '', 'MD', false, false, false, false, true)));

    // 分享源
    const shareSource = share.source || {};
    // 分享源标题
    contents.push('> [{0}]({1})  '.format(shareSource.title, shareSource.url));
    // 分享源描述
    if (shareSource.desc) {
        contents.push('{0}  '.format(shareSource.desc));
    }
    // 分享源配图
    shareSource.images = shareSource.images || [];
    for (const images of shareSource.images) {
        contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(images.custom_url, images.custom_filepath)) + '  ');
    }
    // 分享源来源
    if (shareSource.from && shareSource.from.name) {
        contents.push('来自： [{0}]({1}) 共分享 {2} 次'.format(shareSource.from.name, shareSource.from.url, shareSource.count));
    } else {
        contents.push('共分享 {0} 次'.format(shareSource.count));
    }

    // 分享时间
    contents.push('\n> {0}  '.format(API.Utils.formatDate(share.shareTime)));

    // 评论内容
    const comments = share.comments || [];
    contents.push("\n> 评论({0})".format(share.commentTotal));
    for (const comment of comments) {

        // 评论人
        let comment_name = API.Common.formatContent(comment.poster.name, 'MD', false, false, false, false, true);
        comment_name = API.Common.getUserLink(comment.poster.id, comment_name, 'MD', true);

        contents.push("- {0}：{1}".format(comment_name, API.Common.formatContent(comment.content, 'MD', false, false, false, false, true)));

        // 评论包含图片
        const comment_images = comment.pic || [];
        for (const image of comment_images) {
            // 替换URL
            contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(image.custom_url, image.custom_filepath)));
        }

        // 评论的回复
        const replies = comment.replies || [];
        for (const repItem of replies) {
            // 回复人
            let repName = API.Common.formatContent(repItem.poster.name, 'MD', false, false, false, false, true);
            repName = API.Common.getUserLink(repItem.poster.id, repName, 'MD', true);

            // 回复内容
            let content = API.Common.formatContent(repItem.content, 'MD', false, false, false, false, true);

            // 回复内容
            contents.push("\t- {0}：{1}".format(repName, content));

            // 回复包含图片，理论上回复现在不能回复图片，兼容一下
            var repImgs = repItem.pic || [];
            for (const repImg of repImgs) {
                contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(repImg.custom_url, repImg.custom_filepath)));
            }
        }
    }
    contents.push('---');
    return contents.join('\n');
}

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
 * 添加下载表情任务
 * @param {Shares} item 
 */
API.Shares.addDownloadEmoticonTasks = (items) => {
    if (API.Common.isQzoneUrl()) {
        return;
    }

    for (const item of items) {
        if (!API.Common.isNewItem(item)) {
            // QQ空间外链或已备份项，跳过
            continue;
        }

        // 分享描述
        if (item && item.desc) {
            API.Common.formatContent(item.desc, "HTML", false, false, false, true, false);
        }

        // 分享来源标题
        if (item.source && item.source.title) {
            API.Common.formatContent(item.source.title, "HTML", false, false, false, true, false);
        }
        // 分享源描述
        if (item.source && item.source.desc) {
            API.Common.formatContent(item.source.desc, "HTML", false, false, false, true, false);
        }

        // 添加评论的表情下载任务
        API.Common.addCommentEmoticonDownloadTasks(item);
    }

}