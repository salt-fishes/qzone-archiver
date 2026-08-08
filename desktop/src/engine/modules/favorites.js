/**
 * QQ空间收藏模块导出API
 * @author https://github.com/ShunCai/
 */

/**
 * 导出收藏板
 */
API.Favorites.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Favorites_Row_Infos');
    indicator.print();

    try {
        // 获取所有的收藏列表
        let dataList = await API.Favorites.getAllList();

        // 添加多媒体下载任务
        dataList = await API.Favorites.addMediaToTasks(dataList);

        // 根据导出类型导出数据
        await API.Favorites.exportAllToFiles(dataList);

    } catch (error) {
        console.error('收藏导出异常', error);
    }

    // 完成
    indicator.complete();
}


/**
 * 获取一页的收藏列表（P2：委托 collectors/Favorites）
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Favorites.getPageList = QZoneCollectors.Favorites.getPageList;

/**
 * 获取所有收藏列表（P2：委托 collectors/Favorites）
 */
API.Favorites.getAllList = QZoneCollectors.Favorites.getAllList;

/**
 * 转换数据（P3：委托 repos/Favorites）
 */
API.Favorites.convert = QZoneRepo.Favorites.convert;

/**
 * 导出收藏
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportAllToFiles = async(favorites) => {
    // 获取用户配置
    let exportType = QZone_Config.Favorites.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Favorites.exportToHtml(favorites);
            break;
        case 'MarkDown':
            await API.Favorites.exportToMarkdown(favorites);
            break;
        case 'JSON':
            await API.Favorites.exportToJson(favorites);
            break;
        case 'SPA':
            await API.Favorites.exportToSpa(favorites);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出收藏到 SPA
 * 生成轻量索引（favorites-index.js）和按年份分片的全量数据（favorites-YYYY.js）
 * 索引字段对齐前端 FavoriteIndex 类型，全量数据保留原始结构以支撑详情展示
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToSpa = QZoneExporters.Favorites.exportToSpa;

/**
 * 导出收藏到HTML文件
 * @param {Array} favorites 数据
 */
API.Favorites.exportToHtml = QZoneExporters.Favorites.exportToHtml;

/**
 * 导出收藏到MD文件
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToMarkdown = QZoneExporters.Favorites.exportToMarkdown;

/**
 * 获取单篇收藏的Markdown内容
 * @param {object} favorite 收藏
 */
API.Favorites.getMarkdown = (favorite) => {
    let contents = [];
    // 获取收藏的类型
    let displayType = API.Favorites.getType(favorite.type);
    const owner = API.Favorites.getFavoriteOwner(favorite);
    switch (displayType) {
        case '日志':
            // 日志模板
            let blog_info = favorite.blog_info;
            let blog_owner_name = API.Common.formatContent(owner.name, "MD", false, false, false, false, true);
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 日志 [{2}]({https://user.qzone.qq.com/{3}/blog/{4}}) 【{5}】'.format(blog_owner_name, blog_info.owner_uin, favorite.title, blog_info.owner_uin, blog_info.id, favorite.custom_create_time));
            contents.push('> {0}'.format(API.Common.formatContent(favorite.custom_abstract, "MD", false, false, false, false, true)));
            break;
        case '说说':
            // 说说模板
            let shuoshuo_info = favorite.shuoshuo_info;
            // 转发标识
            let isRt = shuoshuo_info.forward_flag === 1;
            // 长说说内容
            let content = shuoshuo_info.detail_shuoshuo_info.content || favorite.custom_abstract;
            let shuoshuo_owner_name = API.Common.formatContent(owner.name, "MD", false, false, false, false, true);
            contents.push('[{0}](https://user.qzone.qq.com/{1}) 说说 【{2}】'.format(shuoshuo_owner_name, shuoshuo_info.owner_uin, favorite.custom_create_time));
            if (isRt) {
                //转发说说添加转发理由
                contents.push('> {0}'.format(API.Common.formatContent(shuoshuo_info.reason, "MD", false, false, false, false, true)));
                contents.push('\r\n');
            }
            contents.push('> {0}'.format(API.Common.formatContent(content, "MD", isRt, false, false, false, true)));
            break;
        case '分享':
            // 分享模板（通用），暂时不区分分享的类型
            let share_info = favorite.share_info;
            let share_owner_name = API.Common.formatContent(owner.name, "MD", false, false, false, false, true);
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 分享 【{2}】'.format(share_owner_name, share_info.owner_uin, favorite.custom_create_time));
            // 分享类型
            let share_type = share_info.share_type;
            // 分享原因
            let share_reason = share_info.reason;
            if (share_reason) {
                contents.push('\r\n');
                contents.push('{0}'.format(API.Common.formatContent(share_reason, "MD", false, false, false, false, true)));
            }
            let target_url = share_info.share_url;
            let share_title_content = API.Common.formatContent(favorite.title, "MD", false, false, false, false, true);
            let share_title = API.Utils.getLink(target_url, share_title_content, "MD");
            switch (share_type) {
                case 1:
                    // 日志
                    let blog_info = share_info.blog_info;
                    let blog_owner_uin = blog_info.owner_uin;
                    let _blog_owner_name = API.Common.formatContent(owner.name, "MD", false, false, false, false, true);

                    // 日志发布人链接
                    let blog_owner_url = API.Common.getUserLink(blog_owner_uin, _blog_owner_name, "MD");
                    // 日志链接
                    target_url = 'https://user.qzone.qq.com/{0}/blog/{1}'.format(blog_owner_uin, blog_info.id);

                    let blog_url = API.Utils.getLink(target_url, share_title_content, "MD");
                    share_title = '{0}的 日志 {1}'.format(blog_owner_url, blog_url);

                    break;
                case 2:
                    // 相册
                    let album_info = share_info.album_info;
                    let album_owner_uin = album_info.owner_uin;
                    let album_owner_name = API.Common.formatContent(owner.name, "MD", false, false, false, false, true);

                    // 相册创建人链接
                    let album_owner_url = API.Common.getUserLink(album_owner_uin, album_owner_name, "MD");

                    // 相册链接
                    target_url = 'https://user.qzone.qq.com/{0}/photo/{1}'.format(album_info.owner_uin, album_info.id);

                    let album_url = API.Utils.getLink(target_url, share_title_content, "MD");

                    share_title = '{0}的 相册 {1}'.format(album_owner_url, album_url);
                    break;
                case 4:
                    // 网页
                    target_url = share_info.share_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                case 5:
                    // 视频，目前只有一条数据
                    target_url = favorite.custom_videos[0].play_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                case 18:
                    // 歌曲，目前只有一条数据
                    target_url = favorite.custom_audios[0].play_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                case 24:
                    // 设置背景音乐？类似歌曲，目前只有一条数据
                    target_url = favorite.custom_audios[0].play_url;
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    break;
                default:
                    // 其他类型或未知类型不处理超链接跳转
                    target_url = '#';
                    share_title = API.Utils.getLink(target_url, share_title_content, "MD");
                    console.warn('其他分享类型，暂不处理超链接跳转', favorite);
                    break;
            }
            contents.push('> {0}'.format(share_title));
            if (favorite.custom_abstract && favorite.custom_abstract.trim()) {
                contents.push('\r\n');
                contents.push('> {0}'.format(API.Common.formatContent(favorite.custom_abstract, "MD", false, false, false, false, true)));
            }
            break;
        case '本地图片':
            // 多张本地图片模板
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 照片 【{2}】'.format(favorite.custom_name, favorite.custom_uin, favorite.custom_create_time));
            break;
        case '照片':
            // 照片模板
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 照片 【{2}】'.format(API.Common.formatContent(owner.name, "MD", false, false, false, false, true), owner.uin, favorite.custom_create_time));
            break;
        case '文字':
            // 文字模板，仅适用一般长度的文字，暂不支持获取文字的全文，没有找到全文的查看地址，暂时不处理
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 文字 【{2}】'.format(favorite.custom_name, favorite.custom_uin, favorite.custom_create_time));
            contents.push('> {0}'.format(API.Common.formatContent(favorite.custom_abstract, "MD", false, false, false, false, true)));
            break;
        case '网页':
            // 网页模板
            let url_info = favorite.url_info;
            contents.push('[{0}]({https://user.qzone.qq.com/{1}}) 网页 【{2}】'.format(favorite.custom_name, favorite.custom_uin, favorite.custom_create_time));
            contents.push('\r\n');
            contents.push('{0} {1}'.format(favorite.title, url_info.url));
            contents.push('\r\n');
            contents.push('> {0}'.format(favorite.custom_abstract));
            break;
        default:
            // 未知类型不处理
            console.warn('其他未知收藏类型，暂不处理', favorite);
            break;
    }
    // 添加多媒体内容
    let mediat_content = API.Messages.formatMediaMarkdown(favorite);
    contents.push(mediat_content);
    return contents.join('\r\n');
}

/**
 * 导出收藏到JSON文件
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToJson = QZoneExporters.Favorites.exportToJson;

/**
 * 添加多媒体下载任务
 * @param {Array} dataList
 */
API.Favorites.addMediaToTasks = async(dataList) => {
    // 下载相对目录
    const module_dir = 'Favorites/images';

    for (const item of dataList) {

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 下载配图
        for (const image of item.custom_images) {
            await API.Utils.addDownloadTasks('Favorites', image, image.url, module_dir, item, QZone.Favorites.FILE_URLS);
        }

        // 下载配图
        for (const image of item.custom_origin_images) {
            await API.Utils.addDownloadTasks('Favorites', image, image.url, module_dir, item, QZone.Favorites.FILE_URLS);
        }

        // 下载视频预览图及视频
        API.Videos.addDownloadTasks('Favorites', item.custom_videos, module_dir, item);

        // 下载音乐预览图
        for (const audio of item.custom_audios) {
            await API.Utils.addDownloadTasks('Favorites', audio, audio.preview_img, module_dir, item, QZone.Favorites.FILE_URLS);
        }

        // 下载表情
        API.Favorites.addDownloadEmoticonTasks(item);

    }
    return dataList;
}

/**
 * 添加下载表情任务
 * @param {Message} favorite 收藏 
 */
API.Favorites.addDownloadEmoticonTasks = (favorite) => {
    if (API.Common.isQzoneUrl() || !API.Common.isNewItem(favorite)) {
        // QQ空间外链，跳过
        return;
    }

    // 收藏原作者
    API.Common.formatContent(API.Favorites.getFavoriteOwner(favorite).name, 'HTML', false, false, false, true, false);

    if (favorite.shuoshuo_info && favorite.shuoshuo_info.reason) {
        API.Common.formatContent(favorite.shuoshuo_info.reason, 'HTML', false, true, false, true, false)
    }

    if (favorite.share_info && favorite.share_info.reason) {
        API.Common.formatContent(favorite.share_info.reason, 'HTML', false, true, false, true, false)
    }

    if (favorite.shuoshuo_info && favorite.shuoshuo_info.detail_shuoshuo_info) {
        API.Common.formatContent(favorite.shuoshuo_info.detail_shuoshuo_info.content, 'HTML', false, false, false, true, false);
    }

    API.Common.formatContent(favorite.abstract || favorite.desp, 'HTML', false, true, false, true, false);

}