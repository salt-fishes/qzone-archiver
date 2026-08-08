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
API.Shares.exportAllListToFiles = async(items) => {
    // 获取用户配置
    const exportType = QZone_Config.Shares.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Shares.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Shares.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Shares.exportToJson(items);
            break;
        case 'SPA':
            await API.Shares.exportToSpa(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

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
API.Shares.exportToSpa = async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Shares_Export_Other');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Shares');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        const shares = items || [];

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        const index = shares.map(s => {
            const source = s.source || {};
            // 描述：去除 HTML 标签后截断
            const desc = (s.desc || '')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .substring(0, 120);
            return {
                id: s.id || '',
                uin: s.uin || 0,
                nickname: s.nickname || '',
                type: s.type || 0,
                typeLabel: API.Shares.getDisplayType(s.type),
                time: API.Utils.formatDate(s.shareTime),
                shareTime: s.shareTime || 0,
                desc,
                sourceTitle: source.title || '',
                sourceUrl: source.url || '',
                sourceFromName: (source.from && source.from.name) || '',
                sourceCount: source.count || 0,
                sourceImageCount: (source.images && source.images.length) || 0,
                // 来源配图缩略图：最多前 4 张，本地文件优先，回退远程缩略图 URL
                sourceThumbs: (source.images || [])
                    .slice(0, 4)
                    .map(p => p.custom_filepath || p.s_url || p.url3 || p.custom_url || p.url1 || p.b_url || '')
                    .filter(Boolean),
                commentCount: s.commentTotal || (s.comments && s.comments.length) || 0,
                likeCount: s.likeTotal || (s.likes && s.likes.length) || 0,
                visitorCount: (s.custom_visitor && s.custom_visitor.totalNum) || 0
            };
        });
        await API.Common.writeJsonToJs('sharesIndex', index, dataFolder + '/shares-index.js');
        console.info('生成 SPA 分享索引完成', { total: index.length });

        // 2. 按年分片全量数据
        // shareTime 是 unix 秒，groupedByTime 直接处理
        const yearMaps = API.Utils.groupedByTime(shares, "shareTime", 'year');
        for (const [year, yearItems] of yearMaps) {
            await API.Common.writeJsonToJs(
                `shares_${year}`,
                yearItems,
                `${dataFolder}/shares-${year}.js`
            );
            console.info('生成 SPA 分享年份分片完成', { year, count: yearItems.length });
        }

        console.info('导出分享到 SPA 完成', { total: shares.length, years: yearMaps.size });

    } catch (error) {
        console.error('导出分享到 SPA 异常', error, items);
    }

    // 完成
    indicator.complete();
    return items;
}

/**
 * 导出分享到HTML文件
 * @param {Array} shares 数据
 */
API.Shares.exportToHtml = async(shares) => {
    const indicator = new StatusIndicator('Shares_Export_Other');
    await indicator.setIndex('HTML');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Shares');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('shares', shares, moduleFolder + '/json/shares.js');

        // 分享数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(shares, "shareTime", 'year');
        // 基于模板生成年份分享HTML
        for (const [year, yearItems] of yearMaps) {
            // 基于模板生成所有分享HTML
            let _sharesMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "shareTime", 'month');
            _sharesMaps.set(year, monthMaps);
            let params = {
                sharesMaps: _sharesMaps,
                total: yearItems.length
            }
            await API.Common.writeHtmlofTpl('shares', params, moduleFolder + "/" + year + ".html");
        }

        // 基于模板生成汇总分享HTML
        let params = {
            sharesMaps: API.Utils.groupedByTime(shares, "shareTime", 'all'),
            total: shares.length
        }
        await API.Common.writeHtmlofTpl('shares', params, moduleFolder + "/index.html");

    } catch (error) {
        console.error('导出分享到HTML异常', error, shares);
    }

    // 完成
    indicator.complete();
    return shares;
}

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
API.Shares.exportToMarkdown = async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Shares_Export_Other');
    await indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 分享数据根据年份分组
        const year_month_maps = API.Utils.groupedByTime(items, "shareTime");
        for (const [year, month_maps] of year_month_maps) {
            const yearContents = [];
            yearContents.push("# " + year + "年");
            for (const [month, items] of month_maps) {
                yearContents.push("## " + month + "月");
                for (const item of items) {
                    yearContents.push(API.Shares.getMarkdown(item));
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = API.Common.getModuleRoot('Shares') + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份分享列表到Markdown完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份分享列表到Markdown异常，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Shares') + '/Shares.md').then((fileEntry) => {
            console.info('生成汇总分享Markdown文件完成', items, fileEntry);
        }).catch((e) => {
            console.error("生成汇总分享Markdown文件异常", items, e)
        });

    } catch (error) {
        console.error('导出分享到Markdown文件异常', error, items);
    }
    // 完成
    indicator.complete();
    return items;
}

/**
 * 导出分享到JSON文件
 * @param {Array} items 数据
 */
API.Shares.exportToJson = async(items) => {
    // 进度功能性期
    const indicator = new StatusIndicator('Shares_Export_Other');
    await indicator.setIndex('JSON');

    // 生成年份JSON
    // 分享数据根据年份分组
    const yearDataMap = API.Utils.groupedByTime(items, "shareTime", "year");
    for (const [year, yearItems] of yearDataMap) {
        console.info('正在生成年份分享JSON文件', year);
        const yearFilePath = API.Common.getModuleRoot('Shares') + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then((fileEntry) => {
            console.info('生成年份分享JSON文件完成', year, fileEntry);
        }).catch((e) => {
            console.error("生成年份分享JSON文件异常", yearItems, e)
        });
    }

    // 生成汇总JSON
    const json = JSON.stringify(items);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Shares') + '/shares.json').then((fileEntry) => {
        console.info('生成汇总分享JSON文件完成', items, fileEntry);
    }).catch((e) => {
        console.error("生成汇总分享JSON文件异常", items, e)
    });

    // 完成
    indicator.complete();
    return items;
}

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