/**
 * QQ空间说说模块的导出API
 * @author https://github.com/ShunCai/
 */

/**
 * 导出说说数据
 */
API.Messages.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Messages_Row_Infos');
    indicator.print();

    try {

        // 获取所有的说说数据
        let items = await API.Messages.getAllList();

        // 过滤指定屏蔽词说说
        items = API.Messages.filterKeyWords(items);

        // 获取所有说说的全文
        items = await API.Messages.getAllFullContent(items);

        // 获取所有图片（超9张需单独获取）
        items = await API.Messages.getAllImages(items);

        // 获取所有的语音说说信息
        items = await API.Messages.getAllVoices(items);

        // 获取所有的说说评论
        items = await API.Messages.getItemsAllCommentList(items);

        // 获取说说赞记录
        items = await API.Messages.getAllLikeList(items);

        // 获取最近访问
        items = await API.Messages.getAllVisitorList(items);

        // 添加说说多媒体下载任务
        items = await API.Messages.addMediaToTasks(items);

        // 处理特殊坐标数据，避免地图跳转错误
        API.Messages.dealLbs(items);

        // 优化微信同步说说的坐标信息
        await API.Messages.refreshWeChatLbsInfo(items);

        // 根据导出类型导出数据    
        await API.Messages.exportAllListToFiles(items);

    } catch (error) {
        console.error('说说导出异常', error);
    }

    // 完成
    indicator.complete();
}

/**
 * 获取单页的说说列表
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Messages.getList = async(pageIndex, indicator) => {
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Messages.getMessages(pageIndex).then(async(data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_preloadCallback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取单页的说说列表异常：', data);
        }

        // 更新状态-下载中的数量
        indicator.addDownload(QZone_Config.Messages.pageSize);

        // 返回的总数包括无权限的说说的条目数，这里返回为空时表示无权限获取其他的数据
        if (data.msglist == null || data.msglist.length == 0) {
            return [];
        }

        // 更新状态-总数
        QZone.Messages.total = data.total || QZone.Messages.total || 0;
        indicator.setTotal(QZone.Messages.total);

        let items = data.msglist || [];

        // 转换数据
        items = API.Messages.convert(items);

        // 更新状态-下载成功数
        indicator.addSuccess(items);

        return items;
    })
}

/**
 * 获取所有说说列表
 */
API.Messages.getAllList = async() => {

    // 说说状态更新器
    const indicator = new StatusIndicator('Messages');
    indicator.setIndex(1);
    indicator.print();

    // 说说配置项
    const CONFIG = QZone_Config.Messages;

    const nextPage = async function(pageIndex, indicator) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Messages.getList(pageIndex, indicator).then(async(dataList) => {
            // 合并数据
            QZone.Messages.Data = API.Utils.unionItems(QZone.Messages.Data, dataList);
            if (!API.Common.isGetNextPage(QZone.Messages.OLD_Data, dataList, CONFIG)) {
                // 不再继续获取下一页
                return QZone.Messages.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Messages.total, QZone.Messages.Data, arguments.callee, nextPageIndex, indicator);
        }).catch(async(e) => {
            console.error("获取说说列表异常，当前页：", nextPageIndex, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Messages.total, QZone.Messages.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    // 获取第一页
    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Messages.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Messages.OLD_Data, QZone.Messages.Data);

    // 发表时间倒序
    QZone.Messages.Data = API.Utils.sort(QZone.Messages.Data, CONFIG.IncrementField, true);

    // 完成
    indicator.complete();

    return QZone.Messages.Data;
}

/**
 * 获取所有说说的全文内容
 * @param {Array} items 说说列表
 */
API.Messages.getAllFullContent = async(items) => {
    if (!QZone_Config.Messages.isFull) {
        // 不获取全文内容时，跳过不处理
        return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Full_Content');

    // 更新总数
    indicator.setTotal(items.length);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 更新状态-当前位置
        indicator.setIndex(i + 1);

        // 是否有全文
        const hasMoreContent = item.has_more_con === 1 || item.rt_has_more_con === 1;

        if (!hasMoreContent || !API.Common.isNewItem(item)) {
            // 不需要获取全文或者已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        // 更新状态-下载中的数量
        indicator.addDownload(1);

        // 获取自身说说的全文
        await API.Messages.getFullContent(item.tid).then((data) => {
            // 更新状态-下载成功数
            indicator.addSuccess(item);
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                // 获取异常
                console.warn('获取所有说说的全文内容异常：', data);
            }

            // 自身全文
            item.content = data.content;
            item.conlist = data.conlist || [];
            // 转发全文
            if (item.rt_tid) {
                item.rt_con = data.rt_con;
            }
        }).catch((e) => {
            console.error("获取说说自身全文异常", item, e);
            indicator.addFailed(item);
        });
    }

    // 完成
    indicator.complete();

    return items;

}

/**
 * 获取单条说说的单页评论列表
 * @param {object} item 说说
 * @param {integer} pageIndex 页数索引
 */
API.Messages.getItemCommentList = async(item, pageIndex) => {
    return await API.Messages.getComments(item.tid, pageIndex).then(async(data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取单条说说的单页评论列表异常：', data);
            return [];
        }

        // 下载相对目录
        let module_dir = 'Messages/images';

        // 处理说说评论的配图
        let comments = data.commentlist || data.data && data.data.comments || [];

        for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            let images = comment.pic || [];
            for (let j = 0; j < images.length; j++) {
                // 处理说说评论的配图
                const image = images[j];
                await API.Utils.addDownloadTasks('Messages', image, image.hd_url || image.b_url, module_dir, item, QZone.Messages.FILE_URLS);
            }

            // 获取评论回复
            let replies = comment.list_3 || [];
            for (let k = 0; k < replies.length; k++) {
                const repItem = replies[k];
                let images = repItem.pic || [];
                for (let r = 0; r < images.length; r++) {
                    const image = images[r];
                    await API.Utils.addDownloadTasks('Messages', image, image.hd_url || image.b_url, module_dir, item, QZone.Messages.FILE_URLS);
                }
            }
        }
        return comments;
    });
}


/**
 * 获取单条说说的全部评论列表
 * @param {object} item 说说
 */
API.Messages.getItemAllCommentList = async(item) => {
    if (!(item.commenttotal > item.custom_comments.length)) {
        // 当前列表比评论总数小的时候才需要获取全部评论，否则则跳过
        return item.custom_comments;
    }

    // 清空原有的评论列表
    item.custom_comments = [];

    // 说说评论配置
    const CONFIG = QZone_Config.Messages.Comments;

    // 更新总数
    const total = API.Utils.getCommentCount(item);

    const nextPage = async function(item, pageIndex) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Messages.getItemCommentList(item, pageIndex).then(async(dataList) => {
            // 合并评论列表
            item.custom_comments = item.custom_comments.concat(dataList || []);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.custom_comments, arguments.callee, item, nextPageIndex);
        }).catch(async(e) => {
            console.error("获取说说评论列表异常，当前页：", pageIndex + 1, item, e);
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.custom_comments, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.custom_comments
}

/**
 * 获取所有说说的评论列表
 * @param {string} item 说说
 */
API.Messages.getItemsAllCommentList = async(items) => {
    if (!QZone_Config.Messages.Comments.isFull) {
        // 不获取全部评论时，跳过
        return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Comments');
    indicator.setTotal(items.length);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 更新当前位置
        indicator.setIndex(i + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        // 获取说说的全部评论
        await API.Messages.getItemAllCommentList(item);

        // 添加成功
        indicator.addSuccess(item);
    }

    // 完成
    indicator.complete();
    return items;
}

/**
 * 所有说说转换成导出文件
 */
API.Messages.exportAllListToFiles = async(items) => {
    // 获取用户配置
    let exportType = QZone_Config.Messages.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Messages.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Messages.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Messages.exportToJson(items);
            break;
        case 'SPA':
            await API.Messages.exportToSpa(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

/**
 * 导出说说到HTML文件
 * @param {Array} messages 数据
 */
API.Messages.exportToHtml = async(messages) => {
    const indicator = new StatusIndicator('Messages_Export_Other');
    indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Messages');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('messages', messages, moduleFolder + '/json/messages.js');

        // 说说数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(messages, "custom_create_time", 'year');
        // 基于模板生成年份说说HTML
        for (const [year, yearItems] of yearMaps) {
            // 基于模板生成所有说说HTML
            let _messageMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "custom_create_time", 'month');
            _messageMaps.set(year, monthMaps);
            let params = {
                messageMaps: _messageMaps,
                total: yearItems.length,
                config: QZone_Config
            }
            await API.Common.writeHtmlofTpl('messages', params, moduleFolder + "/" + year + ".html");
        }

        // 基于模板生成汇总说说HTML
        let params = {
            messageMaps: API.Utils.groupedByTime(messages, "custom_create_time", 'all'),
            total: messages.length,
            config: QZone_Config
        }
        await API.Common.writeHtmlofTpl('messages', params, moduleFolder + "/index.html");

    } catch (error) {
        console.error('导出说说到HTML异常', error, messages);
    }

    // 完成
    indicator.complete();

    return messages;
}

/**
 * 导出说说到Markdown文件
 * @param {Array} items 数据
 */
API.Messages.exportToMarkdown = async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Export_Other');
    indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 说说数据根据年份分组
        const year_month_maps = API.Utils.groupedByTime(items, "custom_create_time");
        for (const [year, month_maps] of year_month_maps) {
            const yearContents = [];
            yearContents.push("# " + year + "年");
            for (const [month, items] of month_maps) {
                yearContents.push("## " + month + "月");
                for (const item of items) {
                    yearContents.push(API.Messages.getMarkdown(item));
                    yearContents.push('---');
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = API.Common.getModuleRoot('Messages') + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份说说列表到Markdown完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份说说列表到Markdown异常，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Messages') + '/Messages.md').then((fileEntry) => {
            console.info('生成汇总说说Markdown文件完成', items, fileEntry);
        }).catch((e) => {
            console.error("生成汇总说说Markdown文件异常", items, e)
        });

    } catch (error) {
        console.error('导出说说到Markdown文件异常', error, items);
    }
    // 完成
    indicator.complete();
    return items;
}

/**
 * 导出说说到JSON文件
 * @param {Array} items 数据
 */
API.Messages.exportToJson = async(items) => {
    // 进度功能性期
    const indicator = new StatusIndicator('Messages_Export_Other');
    indicator.setIndex('JSON');

    // 生成年份JSON
    // 说说数据根据年份分组
    const yearDataMap = API.Utils.groupedByTime(items, "custom_create_time", "year");
    for (const [year, yearItems] of yearDataMap) {
        console.info('正在生成年份说说JSON文件', year);
        const yearFilePath = API.Common.getModuleRoot('Messages') + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then((fileEntry) => {
            console.info('生成年份说说JSON文件完成', year, fileEntry);
        }).catch((e) => {
            console.error("生成年份说说JSON文件异常", yearItems, e)
        });
    }

    // 生成汇总JSON
    const json = JSON.stringify(items);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Messages') + '/messages.json').then((fileEntry) => {
        console.info('生成汇总说说JSON文件完成', items, fileEntry);
    }).catch((e) => {
        console.error("生成汇总说说JSON文件异常", items, e)
    });

    // 完成
    indicator.complete();
    return items;
}

/**
 * 导出说说到 SPA（单页应用）
 * 数据策略：
 *   1. 轻量索引 messagesIndex（年份/月份/标题/摘要/统计字段，~50KB）
 *      —— SPA 启动时立即 <script> 加载，用于侧边栏目录与搜索
 *   2. 按年分片全量数据 messages_<year>
 *      —— 用户滚动到某年时按需 <script> 加载，避开一次性加载万条数据卡顿
 *   3. 已删除说说 messagesDeleted（实验性）
 *      —— 通过好友互动消息恢复，与主列表分开存放
 *
 * 数据文件格式统一为 window.<key> = [...]，由 SPA 端 data-loader 读取
 * @param {Array} messages 说说列表
 */
API.Messages.exportToSpa = async(messages) => {
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Export_Other');
    indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Messages');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        const index = messages.map(m => ({
            tid: m.tid,
            time: m.custom_create_time,
            title: (m.content || '').substring(0, 50),
            imgCount: (m.pic_list && m.pic_list.length) || 0,
            commentCount: (m.commentlist && m.commentlist.length) || 0,
            likeCount: (m.like && m.like.total) || 0
        }));
        await API.Common.writeJsonToJs('messagesIndex', index, dataFolder + '/messages-index.js');
        console.info('生成 SPA 说说索引完成', { total: index.length });

        // 2. 按年分片全量数据
        const yearMaps = API.Utils.groupedByTime(messages, "custom_create_time", 'year');
        for (const [year, yearItems] of yearMaps) {
            // 变量名形如 messages_2026（与 SPA 端 data-loader 约定一致）
            await API.Common.writeJsonToJs(
                `messages_${year}`,
                yearItems,
                `${dataFolder}/messages-${year}.js`
            );
            console.info('生成 SPA 说说年份分片完成', { year, count: yearItems.length });
        }

        // 3. [实验性] 恢复已删除说说：从好友互动消息列表拉取通知，按 tid 与现有说说去重
        let deletedItems = [];
        if (QZone_Config.Messages.RecoverDeleted) {
            try {
                deletedItems = await API.Messages.getDeletedMessages(messages);
                if (deletedItems.length > 0) {
                    await API.Common.writeJsonToJs(
                        'messagesDeleted',
                        deletedItems,
                        `${dataFolder}/messages-deleted.js`
                    );
                    console.info('生成 SPA 已删除说说完成', { count: deletedItems.length });
                } else {
                    console.info('未发现已删除说说');
                }
            } catch (e) {
                console.error('恢复已删除说说异常', e);
            }
        }

        console.info('导出说说到 SPA 完成', { total: messages.length, years: yearMaps.size, deleted: deletedItems.length });

    } catch (error) {
        console.error('导出说说到 SPA 异常', error, messages);
    }

    // 完成
    indicator.complete();
    return messages;
}

/**
 * [实验性] 恢复已删除说说
 * 策略：
 *   1. 从好友互动消息列表（feeds2_html_pav_all）拉取所有通知
 *   2. 解析每条通知 HTML，提取被操作说说的 tid
 *   3. 与现有说说列表按 tid 对比，差集即为已删除说说候选
 *   4. 对每个候选 tid：
 *      - 尝试调用 getFullContent 获取完整说说（可能服务端也删了）
 *      - 尝试调用 getComments 获取评论
 *      - 尝试获取点赞列表
 *      - 上述任一失败时，回退到从通知 HTML 提取的摘要 + 零散评论/点赞
 *   5. 标记 isDeleted: true，格式化时间字段
 * @param {Array} existingItems 现有说说列表（用于去重）
 * @returns {Promise<Array>} 已删除说说列表
 */
API.Messages.getDeletedMessages = async(existingItems) => {
    existingItems = existingItems || [];
    const feedsConfig = QZone_Config.Messages.Feeds || {};
    const pageSize = feedsConfig.pageSize || 30;
    const minSec = (feedsConfig.randomSeconds && feedsConfig.randomSeconds.min) || 1;
    const maxSec = (feedsConfig.randomSeconds && feedsConfig.randomSeconds.max) || 2;

    // 进度更新器
    const indicator = new StatusIndicator('Messages_Deleted');
    indicator.setNextTip('恢复已删除说说：拉取互动消息列表...');

    // 1. 现有 tid 集合（用于去重）
    const existingTids = new Set(existingItems.map(m => m.tid));

    // 2. 二分查找获取互动消息总数
    indicator.setNextTip('探测互动消息总数...');
    const totalCount = await API.Messages.getFeedsCount();
    console.info('互动消息总数', totalCount);
    if (totalCount === 0) {
        indicator.complete();
        return [];
    }
    indicator.setTotal(totalCount);

    // 3. 分页拉取所有 feeds，按 origtid 聚合
    //    聚合结果：Map<origtid, { abstime, content, imageUrl, comments: [], likes: [] }>
    const aggregated = new Map();
    const totalPages = Math.ceil(totalCount / pageSize);
    for (let page = 0; page < totalPages; page++) {
        const offset = page * pageSize;
        try {
            const response = await API.Messages.getFeeds(offset, pageSize);
            const data = API.Utils.toJson(response, /^_Callback\(/);
            if (!data || data.code !== 0 || !data.data || !data.data.data) {
                console.warn('拉取互动消息分页异常', { page, data });
                continue;
            }
            const feeds = data.data.data;
            for (const feed of feeds) {
                const parsed = API.Messages.parseFeedHtml(feed.html, feed);
                if (!parsed || !parsed.origtid) continue;
                // 跳过自己对自己的操作（不太可能恢复已删除）
                if (parsed.origUin && QZone.Common.Target.uin &&
                    String(parsed.origUin) !== String(QZone.Common.Target.uin)) {
                    continue;
                }
                if (!aggregated.has(parsed.origtid)) {
                    aggregated.set(parsed.origtid, {
                        tid: parsed.origtid,
                        abstime: parsed.abstime || 0,
                        content: parsed.content || '',
                        imageUrl: parsed.imageUrl || '',
                        comments: [],
                        likes: []
                    });
                }
                const entry = aggregated.get(parsed.origtid);
                // 聚合评论/点赞信息（来自通知）
                if (parsed.feedType === 'comment' && parsed.commentContent) {
                    entry.comments.push({
                        content: parsed.commentContent,
                        uin: parsed.operator.uin,
                        name: parsed.operator.nickname,
                        time: parsed.operator.time
                    });
                } else if (parsed.feedType === 'like') {
                    entry.likes.push({
                        fuin: parsed.operator.uin,
                        name: parsed.operator.nickname,
                        time: parsed.operator.time
                    });
                }
                // 取最早的 abstime 作为说说发布时间
                if (parsed.abstime && (entry.abstime === 0 || parsed.abstime < entry.abstime)) {
                    entry.abstime = parsed.abstime;
                }
            }
            indicator.setIndex(offset + feeds.length);
        } catch (e) {
            console.error('拉取互动消息分页异常', { page, error: e });
        }
        // 请求间隔
        await API.Utils.sleep(API.Utils.randomSeconds(minSec, maxSec) * 1000);
    }

    // 4. 与现有说说列表按 tid 对比，差集 = 已删除候选
    const deletedCandidates = [];
    for (const [tid, entry] of aggregated) {
        if (!existingTids.has(tid)) {
            deletedCandidates.push(entry);
        }
    }
    console.info('已删除说说候选数', deletedCandidates.length);
    if (deletedCandidates.length === 0) {
        indicator.complete();
        return [];
    }

    // 5. 对每个候选尝试获取完整详情、评论、点赞
    indicator.setNextTip('尝试获取已删除说说详情...');
    indicator.setTotal(deletedCandidates.length);
    indicator.setIndex(0);
    const result = [];
    for (let i = 0; i < deletedCandidates.length; i++) {
        const entry = deletedCandidates[i];
        indicator.setIndex(i);
        const message = {
            tid: entry.tid,
            isDeleted: true,
            created_time: entry.abstime,
            custom_create_time: API.Utils.formatDate(entry.abstime),
            content: entry.content,
            custom_content: entry.content,
            commentlist: [],
            custom_comments: [],
            commenttotal: 0,
            like: { total: 0, list: [] },
            likes: [],
            pic_list: [],
            custom_images: [],
            uniKey: API.Messages.getUniKey(entry.tid)
        };

        // 尝试获取完整说说详情
        try {
            const detailResp = await API.Messages.getFullContent(entry.tid);
            const detailData = API.Utils.toJson(detailResp, /^_Callback\(/);
            if (detailData && (!detailData.code || detailData.code === 0) && detailData.content) {
                // 详情接口成功，覆盖摘要
                message.content = detailData.content;
                message.custom_content = detailData.content;
                message.conlist = detailData.conlist || [];
                if (detailData.created_time) {
                    message.created_time = detailData.created_time;
                    message.custom_create_time = API.Utils.formatDate(detailData.created_time);
                }
                if (detailData.pic_list) {
                    message.pic_list = detailData.pic_list;
                    message.custom_images = detailData.pic_list;
                }
            }
        } catch (e) {
            // 详情接口失败，保留摘要
            console.debug('获取已删除说说详情失败（已用摘要回退）', entry.tid);
        }

        // 尝试获取评论列表
        try {
            const comments = await API.Messages.getItemCommentList({ tid: entry.tid }, 0);
            if (comments && comments.length > 0) {
                message.commentlist = comments;
                message.custom_comments = comments;
                message.commenttotal = comments.length;
            } else if (entry.comments.length > 0) {
                // 回退到通知里的零散评论
                message.commentlist = entry.comments.map(c => ({
                    content: c.content,
                    uin: c.uin,
                    name: c.name,
                    create_time: c.time,
                    custom_create_time: API.Utils.formatDate(c.time)
                }));
                message.custom_comments = message.commentlist;
                message.commenttotal = message.commentlist.length;
            }
        } catch (e) {
            // 评论接口失败，回退到通知里的零散评论
            if (entry.comments.length > 0) {
                message.commentlist = entry.comments.map(c => ({
                    content: c.content,
                    uin: c.uin,
                    name: c.name,
                    create_time: c.time,
                    custom_create_time: API.Utils.formatDate(c.time)
                }));
                message.custom_comments = message.commentlist;
                message.commenttotal = message.commentlist.length;
            }
        }

        // 尝试获取点赞列表（复用通用逻辑）
        if (API.Common.isGetLike(QZone_Config.Messages)) {
            try {
                const likeItem = { uniKey: message.uniKey, likes: [] };
                await API.Common.getModulesLikeList(likeItem, QZone_Config.Messages);
                if (likeItem.likes && likeItem.likes.length > 0) {
                    message.likes = likeItem.likes;
                    message.like = { total: likeItem.likes.length, list: likeItem.likes };
                } else if (entry.likes.length > 0) {
                    message.likes = entry.likes;
                    message.like = { total: entry.likes.length, list: entry.likes };
                }
            } catch (e) {
                if (entry.likes.length > 0) {
                    message.likes = entry.likes;
                    message.like = { total: entry.likes.length, list: entry.likes };
                }
            }
        } else if (entry.likes.length > 0) {
            message.likes = entry.likes;
            message.like = { total: entry.likes.length, list: entry.likes };
        }

        // 通知中的图片URL（可能已失效）
        if (entry.imageUrl && message.pic_list.length === 0) {
            message.custom_images = [{ custom_url: entry.imageUrl, url1: entry.imageUrl, is_video: false }];
        }

        result.push(message);
        indicator.addSuccess(message);
        // 请求间隔
        await API.Utils.sleep(API.Utils.randomSeconds(minSec, maxSec) * 1000);
    }

    console.info('已删除说说恢复完成', { count: result.length });
    indicator.complete();
    return result;
}


/**
 * 获取说说的MD内容
 */
API.Messages.getMarkdown = (item) => {
    let contents = [];

    // 发布信息
    let message_info = "> " + item.custom_create_time;
    // 发布地址
    if (item.lbs && item.lbs.idname && item.lbs.idname !== '') {
        const ibs_url = API.Messages.getMapUrl(item.lbs);
        message_info += "【" + API.Utils.getLink(ibs_url, item.lbs.idname, 'MD') + "】";
    }
    // 转发标识
    let isRt = item.rt_tid;
    if (isRt) {
        message_info += "【转发】";
    }
    contents.push(message_info);
    contents.push("\r\n");

    // 语音说说 语音说说暂不支持转发，直接将语音说说放置到原创说说前面
    if (item.voicetotal > 0) {
        contents.push(API.Messages.getVoiceHTML(item));
    }

    // 说说内容
    contents.push(API.Common.formatContent(item, "MD", false, false, false, false, true));

    // 转发内容
    if (isRt) {

        // 原文标识
        contents.push("> 原文:");
        contents.push("\r\n");

        // 原作者
        let rt_name = API.Common.formatContent(item.rt_uinname, 'MD', false, false, false, false, true);
        rt_name = API.Common.getUserLink(item.rt_uin, rt_name, 'MD', true);

        // 原内容
        contents.push('{0}：{1}'.format(rt_name, API.Common.formatContent(item, 'MD', true, false, false, false, true)));
    }

    // 说说为转发说说时，对应的图片，视频，歌曲信息属于源说说的
    contents.push(API.Messages.formatMediaMarkdown(item));

    // 评论内容
    const comments = item.custom_comments || [];
    contents.push("> 评论({0})".format(item.commenttotal));
    contents.push('\r\n');
    for (const comment of comments) {

        // 评论人
        let comment_name = API.Common.formatContent(comment.name, 'MD', false, false, false, false, true);
        comment_name = API.Common.getUserLink(comment.uin, comment_name, 'MD', true);

        contents.push("*  {0}：{1}".format(comment_name, API.Common.formatContent(comment.content, 'MD', false, false, false, false, true)));

        // 评论包含图片
        const comment_images = comment.pic || [];
        for (const image of comment_images) {
            // 替换URL
            contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(image.custom_url, image.custom_filepath, true)));
        }

        // 评论的回复
        const replies = comment.list_3 || [];
        for (const repItem of replies) {
            // 回复人
            let repName = API.Common.formatContent(repItem.name, 'MD', false, false, false, false, true);
            repName = API.Common.getUserLink(repItem.uin, repName, 'MD', true);

            // 回复内容
            let content = API.Common.formatContent(repItem.content, 'MD', false, false, false, false, true);

            // 回复内容
            contents.push("\t* {0}：{1}".format(repName, content));

            // 回复包含图片，理论上回复现在不能回复图片，兼容一下
            const repImgs = repItem.pic || [];
            for (const repImg of repImgs) {
                contents.push(API.Utils.getImagesMarkdown(API.Common.getMediaPath(repImg.custom_url, repImg.custom_filepath, true)));
            }
        }
    }
    contents.push('\r\n');
    return contents.join('\r\n');
}

/**
 * 添加说说的多媒体下载任务
 * @param {Array} dataList
 */
API.Messages.addMediaToTasks = async(dataList) => {
    if (!dataList) {
        return dataList;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Images_Mime');

    // 下载相对目录
    let module_dir = 'Messages/images';

    for (const item of dataList) {

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            continue;
        }

        // 下载说说配图
        for (const image of item.custom_images) {
            // 说说同时包含图片与视频，需要单独处理视频
            if (image.is_video && image.video_info) {
                // 视频
                const video = image.video_info;
                if (API.Videos.isExternalVideo(video)) {
                    // 外部视频（腾讯视频、第三方视频）不做处理
                    continue;
                }
                // 添加视频下载任务
                API.Videos.addDownloadTasks('Messages', [video], module_dir, item);
            } else {
                // 普通图片
                let url = image.url2 || image.url1;
                await API.Utils.addDownloadTasks('Messages', image, url, module_dir, item, QZone.Messages.FILE_URLS);
            }
            indicator.addSuccess(image);
        }

        // 下载视频预览图及视频
        API.Videos.addDownloadTasks('Messages', item.custom_videos, module_dir, item);
        indicator.addSuccess(item.custom_videos);

        // 下载音乐预览图
        for (const audio of item.custom_audios) {
            // 音乐预览图不识别后缀，直接使用JEPG
            await API.Utils.addDownloadTasks('Messages', audio, audio.image, module_dir, item, QZone.Messages.FILE_URLS, '.jpeg');
            indicator.addSuccess(1);
        }

        // 下载语音
        for (const voice of item.custom_voices) {
            await API.Utils.addDownloadTasks('Messages', voice, voice.custom_url, module_dir, item, QZone.Messages.FILE_URLS, '.mp3');
            indicator.addSuccess(1);
        }

        // 下载表情
        API.Messages.addDownloadEmoticonTasks(item);

        // 下载趣味表情
        for (const magic of item.custom_magics) {
            await API.Utils.addDownloadTasks('Messages', magic, magic.custom_url, module_dir, item, QZone.Messages.FILE_URLS, '.jpeg');
            indicator.addSuccess(1);
        }

        // 添加评论的配图下载任务
        await API.Common.addCommentImageDownloadTasks(item, 'Messages', indicator)
    }

    // 完成
    indicator.complete();
    return dataList;
}

/**
 * 获取所有图片（超9张需单独获取）
 * @param {Array} items 说说列表
 */
API.Messages.getAllImages = async(items) => {
    if (!items) {
        return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_More_Images');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
        const item = items[index];

        // 当前处理位置
        indicator.setIndex(index + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        const images = item.custom_images;
        // 如果图片总数大于图片实际数，则获取更多图片
        if (item.imagetotal <= images.length) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }
        await API.Messages.getImageInfos(item.tid).then((data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                // 获取异常
                console.warn('获取所有图片异常：', data);
            }

            const imageUrls = data.imageUrls || [];
            for (let index = 0; index < imageUrls.length; index++) {
                // 返回的图片URL
                const url = imageUrls[index];
                // 说说原来的图片对象
                const oldImage = images[index];
                if (oldImage) {
                    // 匹配上，则替换(可不替换？)
                    oldImage.url1 = url;
                    oldImage.url2 = url;
                    oldImage.url3 = url;
                } else {
                    images.push({
                        url1: url,
                        url2: url,
                        url3: url
                    });
                }
            }
            // 已处理
            indicator.addSuccess(item);
        }).catch((error) => {
            // 已失败
            indicator.addFailed(item);
            console.error('获取说说更多图片异常', item, error);
        });
    }

    // 完成
    indicator.complete();
    return items;
}

/**
 * 获取语音说说的实际地址
 * @param {Array} items 说说列表
 */
API.Messages.getAllVoices = async(items) => {
    if (!items || !QZone_Config.Messages.GetVoice) {
        return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Voices');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
        const item = items[index];

        // 当前处理位置
        indicator.setIndex(index + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        const voices = item.custom_voices;
        if (voices.length === 0) {
            // 没有语音信息跳过
            indicator.addSkip(item);
            continue;
        }
        for (const voice of voices) {
            await API.Messages.getVoiceInfo(voice).then((voiceInfo) => {
                voiceInfo = API.Utils.toJson(voiceInfo, /^_Callback\(/);
                if (voiceInfo.code < 0) {
                    // 获取异常
                    console.warn('获取语音说说的实际地址异常：', voiceInfo);
                }
                voiceInfo.data = voiceInfo.data || {};
                voice.custom_url = voiceInfo.data.url;
            }).catch((error) => {
                console.error('获取说说语音失败', item, error);
            });
        }

        // 已处理
        indicator.addSuccess(item);
    }
    // 完成
    indicator.complete();
    return items;
}

/**
 * 处理数据
 * @param items 需要转换的数据
 */
API.Messages.convert = (items) => {
    items = items || [];
    for (const item of items) {
        // 内容
        item.custom_content = item.content;
        item.conlist = item.conlist || [];

        // 评论
        item.commenttotal = API.Utils.getCommentCount(item);
        item.custom_comments = item.commentlist || [];

        // 配图
        item.imagetotal = item.pictotal || 0;
        item.custom_images = item.pic || [];

        // 语音
        item.voicetotal = item.voicetotal || 0;
        item.custom_voices = item.voice || [];

        // 音乐
        item.audiototal = item.audiototal || 0;
        item.custom_audios = item.audio || [];

        // 特殊动漫表情
        item.magictotal = item.magictotal || 0;
        item.custom_magics = item.magic || [];
        // 处理表情
        for (const magic of item.custom_magics) {
            if (magic.url1.match(/{"\$type":"magicEmoticon","id":(\d+)}/)) {
                magic.custom_url = 'http://qzonestyle.gtimg.cn/qzone/em/120/mb{0}.jpg'.format(magic.url1.match(/{"\$type":"magicEmoticon","id":(\d+)}/)[1]);
            }
        }

        // 视频
        item.videototal = item.videototal || 0;
        item.custom_videos = item.video || [];
        for (const video of item.custom_videos) {
            // 处理异常数据的视频URL
            video.video_id = video.video_id || '';
            video.video_id = video.video_id.replace("http://v.qq.com/", "");
        }

        // 投票

        // 位置
        item.lbs = item.lbs || {};

        // 创建时间
        item.custom_create_time = API.Utils.formatDate(item.created_time);

        // 添加点赞Key
        item.uniKey = API.Messages.getUniKey(item.tid);
    }
    return items;
}

/**
 * 说说内容是否包含指定屏蔽词
 * @param {string} content 说说内容
 */
API.Messages.isMatchFilterKey = (content) => {
    let isMatch = false;
    for (const keyWord of QZone_Config.Messages.FilterKeyWords) {
        const keyWords = keyWord.split('&&');
        let matchCount = 0;
        for (const key of keyWords) {
            const regex = new RegExp(key, 'ig');
            if (content.match(regex)) {
                matchCount++;
            }
        }
        if (matchCount === keyWords.length) {
            isMatch = true;
            break;
        }
    }
    return isMatch;
}

/**
 * 过滤含屏蔽词的说说
 * @param {Array} items 说说列表
 */
API.Messages.filterKeyWords = (items) => {
    if (!QZone_Config.Messages.isFilterKeyword || QZone_Config.Messages.FilterKeyWords.length === 0) {
        return items;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Messages_Filter');
    indicator.setTotal(items.length);

    for (let i = items.length - 1; i >= 0; i--) {
        let item = items[i];
        const isMatch = API.Messages.isMatchFilterKey(item.custom_content);
        if (isMatch) {
            // 包含屏蔽词，移除
            items.splice(i, 1);
            indicator.addSuccess(item);
            continue;
        }
        indicator.addSkip(item);
    }
    // 完成
    indicator.complete();
    return items;
}

/**
 * 获取说说赞记录
 * @param {Array} items 说说列表
 */
API.Messages.getAllLikeList = async(items) => {
    if (!API.Common.isGetLike(QZone_Config.Messages)) {
        // 不获取赞
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Like');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, 10);

    // 获取点赞列表
    let count = 0;
    end: for (let i = 0; i < _items.length; i++) {
        const list = _items[i];

        let tasks = [];
        for (let j = 0; j < list.length; j++) {

            const item = list[j];
            item.likes = item.likes || [];

            if (!API.Common.isNewItem(item)) {
                // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                await Promise.all(tasks);
                break end;
            }
            indicator.setIndex(++count);
            tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Messages).then((likes) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取说说点赞异常：", item, e);
                indicator.addFailed(item);
            }));

        }

        await Promise.all(tasks);
        // 每一批次完成后暂停半秒
        await API.Utils.sleep(500);
    }

    // 已备份数据跳过不处理
    indicator.setSkip(items.length - count);

    // 完成
    indicator.complete();

    return items;
}

/**
 * 获取单条说说的全部最近访问
 * @param {object} item 说说
 */
API.Messages.getItemAllVisitorsList = async(item) => {
    // 清空原有的最近访问信息
    item.custom_visitor = {
        viewCount: 0,
        totalNum: 0,
        list: []
    };

    // 说说最近访问配置
    const CONFIG = QZone_Config.Messages.Visitor;

    const nextPage = async function(item, pageIndex) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Messages.getVisitors(item.tid, pageIndex).then(async(data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                // 获取异常
                console.warn('获取单条说说的全部最近访问异常：', data);
            }
            data = data.data || {};

            // 合并
            item.custom_visitor.viewCount = data.viewCount || 0;
            item.custom_visitor.totalNum = data.totalNum || 0;
            item.custom_visitor.list = item.custom_visitor.list.concat(data.list || []);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        }).catch(async(e) => {
            console.error("获取说说最近访问列表异常，当前页：", pageIndex + 1, item, e);

            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.custom_visitor;
}

/**
 * 获取说说最近访问
 * @param {Array} items 说说列表
 */
API.Messages.getAllVisitorList = async(items) => {
    if (!API.Common.isGetVisitor(QZone_Config.Messages)) {
        // 不获取最近访问
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Visitor');
    indicator.setTotal(items.length);

    // 同时请求数
    const _items = _.chunk(items, 10);

    // 获取最近访问
    let count = 0;
    end: for (let i = 0; i < _items.length; i++) {
        const list = _items[i];

        let tasks = [];
        for (let j = 0; j < list.length; j++) {
            const item = list[j];
            if (!API.Common.isNewItem(item)) {
                // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                await Promise.all(tasks);
                break end;
            }
            indicator.setIndex(++count);
            tasks.push(API.Messages.getItemAllVisitorsList(item).then((visitor) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取说说最近访问异常：", item, e);
                indicator.addFailed(item);
            }));

        }

        await Promise.all(tasks);
        // 每一批次完成后暂停半秒
        await API.Utils.sleep(500);
    }

    // 已备份数据跳过不处理
    indicator.setSkip(items.length - count);

    // 完成
    indicator.complete();

    return items;
}

/**
 * 处理特殊坐标
 * @param {Array} items 说说列表
 */
API.Messages.dealLbs = function(items) {
    for (const item of items) {
        const lbs = item.lbs;
        if (!lbs || !lbs.pos_x || !lbs.pos_y) {
            continue;
        }
        // 特殊坐标处理
        if (Number.parseInt(lbs.pos_x) > 1000000) {
            lbs.pos_x = lbs.pos_x / 1000000
        }
        if (Number.parseInt(lbs.pos_y) > 1000000) {
            lbs.pos_y = lbs.pos_y / 1000000
        }
        // 科学计算法处理
        lbs.pos_x = Number.parseFloat(lbs.pos_x).toString() * 1;
        lbs.pos_y = Number.parseFloat(lbs.pos_y).toString() * 1;
    }
}

/**
 * 刷新微信同步说说的坐标信息
 * @param {Array} items 说说
 */
API.Messages.refreshWeChatLbsInfo = async items => {
    if (!QZone_Config.Messages.refreshWeChatLbs) {
        return;
    }
    // 状态更新器
    const indicator = new StatusIndicator('Messages_Lbs_Info');

    // 更新总数
    indicator.setTotal(items.length);

    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        indicator.setIndex(idx + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份的，跳过
            indicator.addSkip(item);
        }

        if (item.custom_lbsInfo) {
            // 已有坐标信息的，跳过
            indicator.addSkip(item);
            continue;
        }
        if (!API.Messages.isWeChat(item)) {
            // 不是微信的，跳过
            indicator.addSkip(item);
            continue;
        }
        if (!item.lbs || !item.lbs.idname) {
            // 没有坐标信息的，跳过
            indicator.addSkip(item);
            continue;
        }
        if (!QZone_Config.Dev.Maps.TxKey) {
            // 没有API Key的，跳过
            indicator.addSkip(item);
            continue;
        }
        await API.Common.toTxLbs(item.lbs.pos_y, item.lbs.pos_x).then(lbsInfo => {
            if (lbsInfo.status === 0) {
                item.lbs.pos_y = lbsInfo.locations[0].lat;
                item.lbs.pos_x = lbsInfo.locations[0].lng;
            }
        }).catch(e => {
            console.error('转换微信GPS坐标到腾讯火星系坐标异常', item, e);
        });

        await API.Common.getLbsInfo(item.lbs.pos_y, item.lbs.pos_x).then(lbsInfo => {
            if (lbsInfo.status === 0) {
                item.custom_lbsInfo = lbsInfo.result;
                item.lbs.idname = item.custom_lbsInfo.formatted_addresses.recommend;
                item.lbs.name = item.custom_lbsInfo.address;
            }
            indicator.addSuccess(item);
        }).catch(e => {
            console.error('请求坐标信息异常', item, e);
            indicator.addFailed(item);
        });

        await API.Utils.sleep(500);
    }

    // 完成
    indicator.complete();
}

/**
 * 添加下载表情任务
 * @param {Message} item 
 */
API.Messages.addDownloadEmoticonTasks = (item) => {
    if (API.Common.isQzoneUrl() || !API.Common.isNewItem(item)) {
        // QQ空间外链或已备份项，跳过
        return;
    }

    // 说说作者
    API.Common.formatContent(item.name, "HTML", false, false, false, true, false);
    // 说说原文
    API.Common.formatContent(item, "HTML", false, false, false, true, false);

    // 转发说说原文
    item.rt_tid && API.Common.formatContent(item, "HTML", true, false, false, true, false);
    // 转发说说原文作者
    item.rt_tid && API.Common.formatContent(item.rt_uinname, "HTML", true, false, false, true, false);

    // 添加评论的表情下载任务
    API.Common.addCommentEmoticonDownloadTasks(item);

}