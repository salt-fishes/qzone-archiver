/**
 * QQ空间访客模块的导出API
 * @author https://github.com/ShunCai/
 */

API.Visitors.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Visitors_Row_Infos');
    indicator.print();

    try {

        // 获取所有的访客列表
        const visitorInfo = await API.Visitors.getAllList();
        console.info('访客列表获取完成', visitorInfo);

        // 添加多媒体下载任务
        await API.Visitors.addMediaToTasks(visitorInfo);

        // 根据导出类型导出数据    
        await API.Visitors.exportAllListToFiles(visitorInfo);

    } catch (error) {
        console.error('访客导出异常：', error);
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有访客列表（P2：委托 collectors/Visitors）
 */
API.Visitors.getAllList = QZoneCollectors.Visitors.getAllList;

/**
 * 添加多媒体下载任务
 * @param {Array} item
 */
API.Visitors.addMediaToTasks = async(visitorInfo) => {

    const items = visitorInfo.items || [];

    for (const item of items) {

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 下载配图
        await API.Visitors.addDownloadImagesTasks(item);

        // 下载表情
        API.Visitors.addDownloadEmoticonTasks(item);
    }
    return visitorInfo;
}

/**
 * 所有访客转换成导出文件
 * @param {Array} visitorInfo 访客列表
 */
API.Visitors.exportAllListToFiles = QZoneExporters.Visitors.exportAllListToFiles;

/**
 * 导出访客到 SPA
 * 数据策略：
 *   1. 轻量索引 visitorsIndex（uin/姓名/时间/来源/互动数）—— SPA 启动时立即加载
 *   2. 按年分片全量数据 visitors_<year> —— 用户滚动到某年时按需 <script> 加载
 *
 * 注意：visitorInfo 是 { items: [...], total, totalPage } 对象，
 *   与 messages 数组不同，这里取 items 数组进行分组。
 *   time 字段是 unix 秒，需要格式化为字符串供 SPA 端展示。
 */
API.Visitors.exportToSpa = QZoneExporters.Visitors.exportToSpa;

/**
 * 导出访客到HTML文件
 * @param {Array} visitorInfo 数据
 */
API.Visitors.exportToHtml = QZoneExporters.Visitors.exportToHtml;

/**
 * 获取单篇访客的Markdown内容
 * @param {ShareInfo} item 访客
 */
API.Visitors.getMarkdown = (item) => {
    const contents = [];
    // 访问时间
    contents.push('###### {0}  \n'.format(API.Utils.formatDate(item.time)));

    // 访客
    let user_name = API.Common.formatContent(item.name, 'MD', false, false, false, false, true);
    user_name = API.Common.getUserLink(item.uin, user_name, 'MD', true);

    // 访问内容
    if (API.Visitors.isHome(item)) {
        // 主页
        contents.push('{0} 访问了主页  \n'.format(user_name));
        contents.push('---');
        return contents.join('\n');
    }
    // 说说
    if (item.shuoshuoes.length > 0) {
        contents.push('{0} 查看了说说  '.format(user_name));
        for (const message of item.shuoshuoes) {
            contents.push('- {0}   '.format(API.Common.formatContent(message.name, 'MD', false, false, false, false, true)));
            if (message.imgsrc) {
                contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(message.custom_url, message.custom_filepath)) + '  ');
            }
        }
        contents.push('\n  ');
    }
    // 日志
    if (item.blogs.length > 0) {
        contents.push('{0} 查看了日志  '.format(user_name));
        for (const blog of item.blogs) {
            contents.push('- {0}  '.format(API.Common.formatContent(blog.name, 'MD', false, false, false, false, true)));
        }
        contents.push('\n  ');
    }
    // 相册
    if (item.photoes.length > 0) {
        contents.push('{0} 查看了相册  '.format(user_name));
        for (const photo of item.photoes) {
            contents.push('> {0}  '.format(API.Common.formatContent(photo.name, 'MD', false, false, false, false, true)));
            contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(photo.custom_url, photo.custom_filepath)) + '  ');
            contents.push('\n  ');
        }
        contents.push('\n  ');
    }
    // 分享
    if (item.shares.length > 0) {
        contents.push('{0} 查看了分享  '.format(user_name));
        for (const share of item.shares) {
            contents.push('- {0}   '.format(API.Common.formatContent(share.name, 'MD', false, false, false, false, true)));
            if (share.imgsrc) {
                contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(share.custom_url, share.custom_filepath)) + '  ');
            }
        }
        contents.push('\n  ');
    }
    // 其它访客
    if (item.uins && item.uins.length > 0) {
        contents.push('以下这些访客当天也访问了这些内容： ');
        for (const uinItem of item.uins) {
            contents.push('- {0} *{1}*   '.format(API.Common.formatContent(uinItem.name, 'MD'), API.Utils.formatDate(uinItem.time)));
        }
    }
    contents.push('---');
    return contents.join('\n');
}

/**
 * 导出访客到Markdown文件
 * @param {Array} visitorInfo 数据
 */
API.Visitors.exportToMarkdown = QZoneExporters.Visitors.exportToMarkdown;

/**
 * 导出访客到JSON文件
 * @param {Array} visitorInfo 数据
 */
API.Visitors.exportToJson = QZoneExporters.Visitors.exportToJson;

/**
 * 添加下载配图任务
 * @param {Message} item 访客 
 */
API.Visitors.addDownloadImagesTasks = async(item) => {
    if (!API.Common.isNewItem(item)) {
        // QQ空间外链，跳过
        return item;
    }

    // 下载相对目录
    const module_dir = 'Visitors/images';

    // 说说配图
    item.shuoshuoes = item.shuoshuoes || []
    for (const message of item.shuoshuoes) {
        if (!message.imgsrc) {
            continue;
        }
        await API.Utils.addDownloadTasks('Visitors', message, message.imgsrc, module_dir, item, QZone.Visitors.FILE_URLS);
    }

    // 日志配图 暂无
    item.blogs = item.blogs || [];

    // 相册配图
    item.photoes = item.photoes || [];
    for (const photo of item.photoes) {
        if (!photo.imgsrc) {
            continue;
        }
        await API.Utils.addDownloadTasks('Visitors', photo, photo.imgsrc, module_dir, item, QZone.Visitors.FILE_URLS);
    }

    // 分享配图
    item.shares = item.shares || [];
    for (const share of item.shares) {
        if (!share.imgsrc) {
            continue;
        }
        await API.Utils.addDownloadTasks('Visitors', share, share.imgsrc, module_dir, item, QZone.Visitors.FILE_URLS);
    }

    return item;

}

/**
 * 添加下载表情任务
 * @param {Message} item 访客 
 */
API.Visitors.addDownloadEmoticonTasks = (item) => {
    if (API.Common.isQzoneUrl() || !API.Common.isNewItem(item)) {
        // QQ空间外链，跳过
        return item;
    }

    // 访客名称
    API.Common.formatContent(item.name, 'HTML', false, false, false, true, false);

    // 说说访问记录
    if (item.shuoshuoes && item.shuoshuoes.length > 0) {
        for (const shuoshuo of item.shuoshuoes) {
            API.Common.formatContent(shuoshuo.name, 'HTML', false, false, false, true, false);
        }
    }

    // 日志访问记录
    if (item.blogs && item.blogs.length > 0) {
        for (const blog of item.blogs) {
            API.Common.formatContent(blog.name, 'HTML', false, false, false, true, false);
        }
    }

    // 相片访问记录
    if (item.photoes && item.photoes.length > 0) {
        for (const photo of item.photoes) {
            API.Common.formatContent(photo.name, 'HTML', false, false, false, true, false);
        }
    }

    // 分享访问记录
    if (item.shares && item.shares.length > 0) {
        for (const share of item.shares) {
            API.Common.formatContent(share.name, 'HTML', false, false, false, true, false);
        }
    }

    // 其它相同访客
    if (item.uins && item.uins.length > 0) {
        for (const uniItem of item.uins) {
            API.Common.formatContent(uniItem.name, 'HTML', false, false, false, true, false);
        }
    }

    return item;
}