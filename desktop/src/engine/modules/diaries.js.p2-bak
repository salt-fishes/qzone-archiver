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
        console.error('日记导出异常', error);
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有日记的内容
 * @param {Array} items 日记列表
 */
API.Diaries.getAllContents = async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Content');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
        let item = items[index];

        // 更新状态-当前位置
        await indicator.setIndex(index + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        await API.Diaries.getInfo(item.blogid).then(async(data) => {
            // 添加成功提示
            indicator.addSuccess(data);

            // 加载日志页面
            const blogPage = jQuery(data);

            // 基于DOM获取详细信息
            item = API.Blogs.readDetailInfo(blogPage) || item;

            // 获得网页中的日志正文
            const $detailBlog = blogPage.find("#blogDetailDiv:first");

            // 添加原始HTML
            item.html = API.Utils.utf8ToBase64($detailBlog.html());

            // 处理图片信息
            await API.Diaries.handerImages(item, $detailBlog.find("img"));

            // 处理视频信息
            await API.Diaries.handerMedias(item, $detailBlog.find("embed"));

            // 更改自定义标题
            item.custom_title = item.title;
            // 添加自定义HTML
            item.custom_html = API.Utils.utf8ToBase64($detailBlog.html());
            // 添加点赞Key
            item.uniKey = API.Blogs.getUniKey(item.blogid || item.blogId);

            items[index] = item;
        }).catch((e) => {
            console.error("获取日记内容异常", item, e);
            // 添加失败提示
            indicator.addFailed(item);
        })

        // 等待一下再请求
        let min = QZone_Config.Diaries.Info.randomSeconds.min;
        let max = QZone_Config.Diaries.Info.randomSeconds.max;
        let seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
    }

    // 完成
    indicator.complete();
    return items;
}


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
 * 获取日记阅读数
 * @param {Array} items 日志列表
 */
API.Diaries.getAllReadCount = async(items) => {
    try {
        // 同时请求数
        const _items = _.chunk(items, 10);

        // 获取最近访问
        end: for (let i = 0; i < _items.length; i++) {
            const list = _items[i];

            // 日志ID数组
            const blogIds = [];
            for (let j = 0; j < list.length; j++) {
                const item = list[j];
                if (!API.Common.isNewItem(item)) {
                    // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                    break end;
                }
                blogIds.push(item.blogid);
            }
            // 单独获取日志的阅读数
            let data = await API.Diaries.getReadCount(blogIds);
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                // 获取异常
                console.warn('获取日记阅读数异常：', data);
            }
            data = data.data || {};

            const readList = data.itemList || [];
            const idMaps = API.Utils.groupedByField(readList, "id");
            for (const item of list) {
                if (idMaps.has(item.blogid)) {
                    item.custom_visitor.viewCount = idMaps.get(item.blogid)[0].read || item.custom_visitor.viewCount;
                }
            }
        }
    } catch (error) {
        console.error("获取日志阅读数异常：", error);
    }
    return items;
}

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
 * 获取单篇日记的MD内容
 * @param {object} item 日记信息
 */
API.Diaries.getMarkdown = async(item) => {
    const contents = [];
    // 拼接标题，日期，内容
    contents.push("# " + item.title);
    contents.push("> " + API.Utils.formatDate(item.pubtime));
    contents.push("\r\n");

    // 根据HTML获取MD内容
    let markdown = QZone.Common.MD.turndown(API.Utils.base64ToUtf8(item.custom_html));
    markdown = markdown.replace(/\n/g, "\r\n");
    contents.push(markdown);
    contents.push("\r\n");

    // 拼接评论
    contents.push("> 评论({0})".format(item.replynum));

    let comments = item.comments || [];
    for (const comment of comments) {
        // 评论人
        let poster = comment.poster.name || QZone.Common.Target.nickname || '';
        poster = API.Common.formatContent(poster, 'MD', false, false, false, false, true);
        poster = API.Common.getUserLink(comment.poster.id, poster, 'MD', true);

        // 评论内容
        let content = API.Common.formatContent(comment.content, 'MD', false, false, false, false, true);
        // 替换换行符
        content = content.replace(/\n/g, "");

        // 添加评论内容
        contents.push('* {0}：{1}'.format(poster, content));

        // 评论的回复
        const replies = comment.replies || [];
        for (const rep of replies) {
            // 回复人
            let repPoster = rep.poster.name || QZone.Common.Target.nickname || '';
            repPoster = API.Common.formatContent(repPoster, 'MD', false, false, false, false, true);
            repPoster = API.Common.getUserLink(rep.poster.id, repPoster, 'MD', true);

            // 回复内容
            let repContent = API.Common.formatContent(rep.content, 'MD', false, false, false, false, true);
            // 替换换行符
            repContent = repContent.replace(/\n/g, "");

            // 添加评论内容
            contents.push('\t* {0}：{1}'.format(repPoster, repContent));
        }
    }
    return contents.join('\r\n');
}

/**
 * 处理日志的图片
 * @param {object} item 日志
 * @param {Array} images 图片元素列表
 */
API.Diaries.handerImages = async(item, images) => {
    if (!images) {
        return item;
    }

    // 导出类型
    const exportType = QZone_Config.Diaries.exportType;
    for (let i = 0; i < images.length; i++) {
        const $img = $(images[i]);
        // 处理相对协议
        let url = $img.attr('orgsrc') || $img.attr('src');
        url = API.Utils.toHttp(url);

        // 添加下载任务
        if (!API.Common.isQzoneUrl()) {
            // 非QQ空间外链
            let uid = API.Utils.newSimpleUid(8, 16);
            let suffix = await API.Utils.autoFileSuffix(url);
            const custom_filename = uid + suffix;
            // 添加下载任务
            API.Utils.newDownloadTask('Diaries', url, 'Diaries/images', custom_filename, item);

            // 新的图片离线地址
            url = 'MarkDown' === exportType ? '../images/' + custom_filename : 'images/' + custom_filename;
        }

        // 修改日志中的图片链接
        $img.attr('src', url);
        // 更改图片索引
        $img.attr('data-idx', i);

        // 图片上层的超链接
        const $imageLink = $img.parent('a');

        // 修改图片点击事件
        if ($imageLink && $imageLink.length > 0) {
            // 更改图片地址
            $imageLink.attr('href', url);
            // 画廊查看大图
            $imageLink.addClass('lightgallery');
        } else {
            // 没有超链接的，需要添加超链接，用于生成画廊
            $img.wrap('<a class="lightgallery" href="' + url + '"></a>');
        }
    }
    return item;
}

/**
 * 处理视频信息
 * @param {object} item 日志
 * @param {Array} embeds 图片元素列表
 */
API.Diaries.handerMedias = async(item, embeds) => {
    if (!embeds) {
        // 无图片不处理
        return item;
    }
    // 导出类型
    const exportType = QZone_Config.Diaries.exportType;
    for (let i = 0; i < embeds.length; i++) {
        const $embed = $(embeds[i]);
        const data_type = $embed.attr('data-type');
        let vid = $embed.attr('data-vid');
        const height = $embed.attr('height') || 'auto';
        const width = $embed.attr('width') || '100%';
        let iframe_url = $embed.attr('src');
        const srcInfo = API.Utils.toParams(iframe_url);
        switch (data_type) {
            case '1':
                // 相册视频
                // MP4地址 
                const mp4_url = $embed.attr('data-mp4');
                if (srcInfo.hasOwnProperty('vurl') || mp4_url) {
                    // 视频下载地址
                    let vurl = mp4_url || decodeURIComponent(API.Utils.toParams(iframe_url).vurl);

                    // 添加下载任务

                    // 非QQ空间外链
                    if (!API.Common.isQzoneUrl()) {
                        const uid = API.Utils.newSimpleUid(8, 16);
                        const suffix = await API.Utils.autoFileSuffix(vurl);
                        const custom_filename = uid + suffix;

                        // 添加下载任务
                        API.Utils.newDownloadTask('Diaries', vurl, 'Diaries/images', custom_filename, item);

                        // 新的图片离线地址
                        vurl = 'MarkDown' === exportType ? '../images/' + custom_filename : 'images/' + custom_filename;
                    }
                    $embed.replaceWith('<video src="{0}" height="auto" width="100%" controls="controls" ></video>'.format(vurl));
                } else {
                    if (!vid) {
                        // 未知数据，不处理
                        console.warn('未知数据，不处理', $embed);
                        return;
                    }
                    // iframe 播放地址
                    iframe_url = 'https://h5.qzone.qq.com/video/index?vid=' + vid;
                    $embed.replaceWith('<iframe src="{0}" height="auto" width="100%" allowfullscreen="true"></iframe>'.format(iframe_url));
                }
                break;
            case '51':
                // 外部视频
                if (!vid) {
                    // 历史数据或特殊数据跳过不处理
                    console.warn('未知数据，不处理', $embed);
                    return;
                }
                iframe_url = API.Videos.getTencentVideoUrl(vid);
                $embed.replaceWith('<iframe src="{0}" height="auto" width="100%" allowfullscreen="true"></iframe>'.format(iframe_url));
                break;
            default:
                // 其他的
                // 默认取src值
                vid = API.Utils.toParams(iframe_url)['vid'];
                if (vid) {
                    // 取到VID，默认当外部视频处理
                    iframe_url = API.Videos.getTencentVideoUrl(vid);
                }
                $embed.replaceWith('<iframe src="{0}" height="auto" width="100%" allowfullscreen="true"></iframe>'.format(iframe_url));
                break;
        }
    }
    return item;
}

/**
 * 导出日记到JSON文件
 * @param {Array} items 日记列表
 */
API.Diaries.exportToJson = QZoneExporters.Diaries.exportToJson;