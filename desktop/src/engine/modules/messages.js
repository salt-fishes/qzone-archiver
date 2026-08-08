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
    // 网络获取委托采集层（P2），模块保留 indicator/convert 编排
    const data = await QZoneCollectors.Messages.getListRaw(pageIndex);

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
}

/**
 * 获取所有说说列表（P2：采集逻辑迁移至 collectors/Messages，此处委托）
 */
API.Messages.getAllList = QZoneCollectors.Messages.getAllList;

/**
 * 获取所有说说的全文内容（P2：委托 collectors/Messages）
 * @param {Array} items 说说列表
 */
API.Messages.getAllFullContent = QZoneCollectors.Messages.getAllFullContent;

/**
 * 获取单条说说的单页评论列表（P2：委托 collectors/Messages）
 * @param {object} item 说说
 * @param {integer} pageIndex 页数索引
 */
API.Messages.getItemCommentList = QZoneCollectors.Messages.getItemCommentList;


/**
 * 获取单条说说的全部评论列表（P2：委托 collectors/Messages）
 * @param {object} item 说说
 */
API.Messages.getItemAllCommentList = QZoneCollectors.Messages.getItemAllCommentList;

/**
 * 获取所有说说的评论列表（P2：委托 collectors/Messages）
 * @param {string} item 说说
 */
API.Messages.getItemsAllCommentList = QZoneCollectors.Messages.getItemsAllCommentList;

/**
 * 所有说说转换成导出文件
 */
API.Messages.exportAllListToFiles = QZoneExporters.Messages.exportAllListToFiles;

/**
 * 导出说说到HTML文件
 * @param {Array} messages 数据
 */
API.Messages.exportToHtml = QZoneExporters.Messages.exportToHtml;

/**
 * 导出说说到Markdown文件
 * @param {Array} items 数据
 */
API.Messages.exportToMarkdown = QZoneExporters.Messages.exportToMarkdown;

/**
 * 导出说说到JSON文件
 * @param {Array} items 数据
 */
API.Messages.exportToJson = QZoneExporters.Messages.exportToJson;

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
API.Messages.exportToSpa = QZoneExporters.Messages.exportToSpa;

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

    // 2. 二分查找获取互动消息总数（进度回调显示到终端面板）
    indicator.setNextTip('探测互动消息总数...');
    const totalCount = await API.Messages.getFeedsCount((msg) => {
        indicator.setNextTip('探测互动消息总数：' + msg);
    });
    console.info('互动消息总数', totalCount);
    if (totalCount === 0) {
        // complete 会把 {nextTip} 替换为 nextTip 内容，并把"正在"→"已"
        indicator.setNextTip('探测结果：0 条（互动消息为空或接口异常）');
        indicator.complete();
        return [];
    }
    indicator.setNextTip(`探测完成：约 ${totalCount} 条互动消息，开始分页拉取...`);
    indicator.setTotal(totalCount);

    // 3. 分页拉取所有 feeds，按 origtid（或文本内容）聚合
    //    聚合结果：Map<key, { tid, abstime, content, imageUrl, comments: [], likes: [] }>
    const aggregated = new Map();
    const totalPages = Math.ceil(totalCount / pageSize);
    let firstFeedLogged = false;
    let wafBlocked = false;
    for (let page = 0; page < totalPages && !wafBlocked; page++) {
        const offset = page * pageSize;
        try {
            const response = await API.Messages.getFeeds(offset, pageSize);
            // WAF 拦截检测
            if (typeof response === 'string' && response.indexOf('waf.tencent.com') > -1) {
                console.error('[getDeletedMessages] 分页拉取被 WAF 拦截，停止拉取', { page, offset });
                indicator.setNextTip(`第 ${page + 1}/${totalPages} 页被 WAF 拦截，已停止`);
                wafBlocked = true;
                break;
            }
            const data = API.Utils.toJson(response, /^_Callback\(/);
            if (!data || data.code !== 0 || !data.data) {
                console.warn('[getDeletedMessages] 拉取互动消息分页异常', { page, data });
                continue;
            }
            // 兼容 data.data.data 和 data.data.feeds 两种结构
            const feeds = data.data.data || data.data.feeds || [];
            if (!feeds.length) continue;
            // 首次成功拉取时记录样本，便于后续调试
            if (!firstFeedLogged) {
                console.info('[getDeletedMessages] 首条 feed 样本', JSON.stringify(feeds[0]).substring(0, 500));
                firstFeedLogged = true;
            }
            for (const feed of feeds) {
                const parsed = API.Messages.parseFeedHtml(feed.html, feed);
                if (!parsed) continue;
                // 聚合 key：优先用 origtid，为空时用文本内容前 80 字符回退
                const aggKey = parsed.origtid || (parsed.content ? parsed.content.substring(0, 80) : '');
                if (!aggKey) continue;
                if (!aggregated.has(aggKey)) {
                    aggregated.set(aggKey, {
                        tid: parsed.origtid || '',
                        abstime: parsed.abstime || 0,
                        content: parsed.content || '',
                        imageUrl: parsed.imageUrl || '',
                        comments: [],
                        likes: []
                    });
                }
                const entry = aggregated.get(aggKey);
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
            await indicator.setIndex(offset + feeds.length);
        } catch (e) {
            console.error('[getDeletedMessages] 拉取互动消息分页异常', { page, error: e });
        }
        // 请求间隔
        await API.Utils.sleep(API.Utils.randomSeconds(minSec, maxSec) * 1000);
    }

    // 4. 与现有说说列表对比，差集 = 已删除候选
    //    对比策略：origtid 存在时按 tid 对比；origtid 为空时按文本内容对比
    const existingContents = new Set(
        existingItems.map(m => (m.content || m.custom_content || '').replace(/\s+/g, ' ').trim().substring(0, 80))
            .filter(s => s.length > 0)
    );
    const deletedCandidates = [];
    for (const [key, entry] of aggregated) {
        if (entry.tid && existingTids.has(entry.tid)) continue;
        // tid 为空时用文本内容对比
        if (!entry.tid && entry.content) {
            const normalized = entry.content.replace(/\s+/g, ' ').trim().substring(0, 80);
            if (existingContents.has(normalized)) continue;
        }
        deletedCandidates.push(entry);
    }
    console.info('[getDeletedMessages] 已删除说说候选数', deletedCandidates.length, '聚合总数', aggregated.size);
    if (deletedCandidates.length === 0) {
        indicator.complete();
        return [];
    }

    // 5. 对每个候选尝试获取完整详情、评论、点赞
    indicator.setNextTip('尝试获取已删除说说详情...');
    indicator.setTotal(deletedCandidates.length);
    await indicator.setIndex(0);
    const result = [];
    for (let i = 0; i < deletedCandidates.length; i++) {
        const entry = deletedCandidates[i];
        await indicator.setIndex(i);
        // tid 为空时生成唯一标识（基于时间+内容），用于 SPA 端 key
        const contentSig = (entry.content || '').replace(/\s+/g, '').substring(0, 20);
        const finalTid = entry.tid || `deleted_${entry.abstime || 0}_${contentSig}`;
        const message = {
            tid: finalTid,
            isDeleted: true,
            created_time: entry.abstime,
            custom_create_time: API.Utils.formatDate(entry.abstime),
            content: entry.content,
            custom_content: entry.content,
            commentlist: [],
            custom_comments: [],
            commenttotal: 0,
            likes: [],
            pic_list: [],
            custom_images: [],
            uniKey: API.Messages.getUniKey(finalTid)
        };

        // 尝试获取完整说说详情（tid 为空时跳过）
        try {
            if (!entry.tid) throw new Error('无 tid，跳过详情获取');
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

        // 尝试获取评论列表（tid 为空时跳过）
        try {
            if (!entry.tid) throw new Error('无 tid，跳过评论获取');
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
                } else if (entry.likes.length > 0) {
                    message.likes = entry.likes;
                }
            } catch (e) {
                if (entry.likes.length > 0) {
                    message.likes = entry.likes;
                }
            }
        } else if (entry.likes.length > 0) {
            message.likes = entry.likes;
        }
        // 统一点赞结构：只保留 likes 数组（likeTotal 为数值，供 HTML 模板显示）
        message.likeTotal = message.likes.length;

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
    indicator.nextTip = '';
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

        // 检查点：每条说说处理完（含视频/表情等同步任务）检查暂停/取消
        if (await checkExportState()) {
            const err = new Error('[ExportState] 导出已取消')
            err.__exportCancelled = true
            throw err
        }
    }

    // 完成
    indicator.complete();
    return dataList;
}

/**
 * 获取所有图片（超9张需单独获取）（P2：委托 collectors/Messages）
 * @param {Array} items 说说列表
 */
API.Messages.getAllImages = QZoneCollectors.Messages.getAllImages;

/**
 * 获取语音说说的实际地址（P2：委托 collectors/Messages）
 * @param {Array} items 说说列表
 */
API.Messages.getAllVoices = QZoneCollectors.Messages.getAllVoices;

/**
 * 处理数据
 * @param items 需要转换的数据
 */
API.Messages.convert = QZoneRepo.Messages.convert;

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
 * 获取说说赞记录（P2：委托 collectors/Messages）
 * @param {Array} items 说说列表
 */
API.Messages.getAllLikeList = QZoneCollectors.Messages.getAllLikeList;

/**
 * 获取单条说说的全部最近访问（P2：委托 collectors/Messages）
 * @param {object} item 说说
 */
API.Messages.getItemAllVisitorsList = QZoneCollectors.Messages.getItemAllVisitorsList;

/**
 * 获取说说最近访问（P2：委托 collectors/Messages）
 * @param {Array} items 说说列表
 */
API.Messages.getAllVisitorList = QZoneCollectors.Messages.getAllVisitorList;

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
        await indicator.setIndex(idx + 1);

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