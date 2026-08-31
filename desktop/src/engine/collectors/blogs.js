/**
 * 日志采集（P2）
 * 采集循环逐字迁自 modules/blogs.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Blogs = {
  /**
   * 获取单页的日志列表（迁移自 modules/blogs.js getList）
   * @param {integer} pageIndex 指定页的索引
   * @param {StatusIndicator} indicator 状态更新器
   */
  getList: async(pageIndex, indicator) => {
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Blogs.getBlogs(pageIndex).then(async(data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取日志列表异常：', data);
        }
        data = data.data || {};

        // 更新状态-下载中的数量
        indicator.addDownload(QZone_Config.Blogs.pageSize);

        // 更新状态-总数
        QZone.Blogs.total = data.totalNum || QZone.Blogs.total || 0;
        indicator.setTotal(QZone.Blogs.total);

        let dataList = data.list || [];

        // 更新状态-下载成功数
        indicator.addSuccess(dataList);

        return dataList;
    })
  },

  /**
   * 获取所有日志列表（迁移自 modules/blogs.js getAllList）
   */
  getAllList: async() => {

    // 日志状态更新器
    const indicator = new StatusIndicator('Blogs');
    await indicator.setIndex(1);
    indicator.print();

    const CONFIG = QZone_Config.Blogs;

    const nextPage = async function(pageIndex, indicator) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Blogs.getList(pageIndex, indicator).then(async(dataList) => {

            // 设置比较信息
            // dataList = API.Common.setCompareFiledInfo(dataList, 'pubTime', 'pubtime');

            // 合并数据
            QZone.Blogs.Data = API.Utils.unionItems(QZone.Blogs.Data, dataList);
            if (!API.Common.isGetNextPage(QZone.Blogs.OLD_Data, dataList, CONFIG)) {
                // 不再继续获取下一页
                return QZone.Blogs.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Blogs.total, QZone.Blogs.Data, arguments.callee, nextPageIndex, indicator);

        }).catch(async(e) => {
            console.error("获取日志列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Blogs.total, QZone.Blogs.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Blogs.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Blogs.OLD_Data, QZone.Blogs.Data);

    // 排序
    QZone.Blogs.Data = API.Blogs.sort(QZone.Blogs.Data);

    // 完成
    indicator.complete();

    return QZone.Blogs.Data;
  },

  /**
   * 获取所有日志的评论列表（迁移自 modules/blogs.js getItemsAllCommentList）
   * @param {string} item 日志
   */
  getItemsAllCommentList: async(items) => {
    if (!QZone_Config.Blogs.Comments.isFull) {
        // 不获取全部评论时，跳过
        return items;
    }

    // 单条日志状态更新器
    const indicator = new StatusIndicator('Blogs_Comments');
    indicator.setTotal(items.length);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 更新当前位置
        await indicator.setIndex(i + 1);

        if (!API.Common.isNewItem(item)) {
            // 已备份数据跳过不处理
            indicator.addSkip(item);
            continue;
        }

        // 预防日志无评论
        item.comments = item.comments || [];

        // 获取日志的全部评论
        await API.Blogs.getItemAllCommentList(item);

        // 添加成功
        indicator.addSuccess(item);
    }

    // 已完成
    indicator.complete();
    return items;
  },

  /**
   * 获取单条日志的单页评论列表（迁移自 modules/blogs.js getItemCommentList）
   * @param {object} item 日志
   * @param {integer} pageIndex 页数索引
   */
  getItemCommentList: async(item, pageIndex) => {
    return await API.Blogs.getComments(item.blogid, pageIndex).then(async(data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取单条日志的单页评论列表异常：', data);
        }
        data = data.data || {};
        return data.comments || [];
    });
  },

  /**
   * 获取单条日志的全部评论列表（迁移自 modules/blogs.js getItemAllCommentList）
   * @param {object} item 日志
   */
  getItemAllCommentList: async(item) => {
    if (!(item.replynum > item.comments.length)) {
        // 当前列表比评论总数小的时候才需要获取全部评论，否则则跳过
        return item.comments;
    }
    // 清空原有的评论列表
    item.comments = [];

    // 日志评论配置
    const CONFIG = QZone_Config.Blogs.Comments;

    // 更新总数
    const total = item.replynum || 0;

    const nextPage = async function(item, pageIndex) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Blogs.getItemCommentList(item, pageIndex).then(async(dataList) => {

            // 合并评论列表
            item.comments = item.comments.concat(dataList || []);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.comments, arguments.callee, item, nextPageIndex);
        }).catch(async(e) => {
            console.error("获取日志评论列表异常，当前页：", pageIndex + 1, item, e);
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.comments, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.comments;
  },

  /**
   * 获取日志赞记录（迁移自 modules/blogs.js getAllLikeList）
   * @param {Array} items 日志列表
   */
  getAllLikeList: async(items) => {

    if (!API.Common.isGetLike(QZone_Config.Blogs)) {
        // 不获取赞
        return items;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Blogs_Like');
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
            await indicator.setIndex(++count);
            tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Blogs).then((likes) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取日志点赞异常：", item, e);
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
  },

  /**
   * 获取单条日志的全部最近访问（迁移自 modules/blogs.js getItemAllVisitorsList）
   * @param {object} item 说说
   */
  getItemAllVisitorsList: async(item) => {
    // 清空原有的最近访问信息
    item.custom_visitor = {
        viewCount: 0,
        totalNum: 0,
        list: []
    };

    // 说说最近访问配置
    const CONFIG = QZone_Config.Blogs.Visitor;

    const nextPage = async function(item, pageIndex) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Blogs.getVisitors(item.blogid, pageIndex).then(async(data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                // 获取异常
                console.warn('获取单条日志的全部最近访问异常：', data);
            }
            data = data.data || {};

            // 合并
            item.custom_visitor.viewCount = data.viewCount || 0;
            item.custom_visitor.totalNum = data.totalNum || 0;
            item.custom_visitor.list = item.custom_visitor.list.concat(data.list || []);

            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        }).catch(async(e) => {
            console.error("获取日志最近访问列表异常，当前页：", pageIndex + 1, item, e);

            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
        });
    }

    await nextPage(item, 0);

    return item.custom_visitor;
  },

  /**
   * 获取日志最近访问（迁移自 modules/blogs.js getAllVisitorList）
   * @param {Array} items 日志列表
   */
  getAllVisitorList: async(items) => {
    if (!API.Common.isGetVisitor(QZone_Config.Blogs)) {
        // 不获取最近访问
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Blogs_Visitor');
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
            await indicator.setIndex(++count);
            tasks.push(API.Blogs.getItemAllVisitorsList(item).then((visitor) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取日志最近访问异常：", item, e);
                indicator.addFailed(item);
            }));

        }

        await Promise.all(tasks);
        // 每一批次完成后暂停半秒
        await API.Utils.sleep(500);
    }

    // 获取日志阅读数
    await API.Blogs.getAllReadCount(items);

    // 已备份数据跳过不处理
    indicator.setSkip(items.length - count);

    // 完成
    indicator.complete();

    return items;
  },

  /**
   * 获取所有日志的内容（迁移自 modules/blogs.js getAllContents）
   * @param {Array} items 日志列表
   */
  getAllContents: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Blogs_Content');
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

        await API.Blogs.getInfo(item.blogId).then(async(data) => {

            // 添加成功提示
            indicator.addSuccess(data);
            // 加载日志页面
            const blogPage = jQuery(data);

            // 基于DOM获取详细信息
            const detailItem = API.Blogs.readDetailInfo(blogPage);
            item = detailItem && Object.assign(item, detailItem);

            // 获得网页中的日志正文
            const $detailBlog = blogPage.find("#blogDetailDiv:first");

            // 是否为模板日志
            if (API.Blogs.isTemplateBlog(item)) {
                // 模板日志，日志内容在变量中
                let tplContent = API.Blogs.readTemplateContent(blogPage);
                if (tplContent) {
                    $detailBlog.html(tplContent);
                }
            }

            // 添加原始HTML
            item.html = API.Utils.utf8ToBase64($detailBlog.html());

            // 处理图片信息
            await API.Blogs.handerContentImages(item, $detailBlog.find("img"));

            // 处理视频信息
            await API.Blogs.handerMedias(item, $detailBlog.find("embed"));

            // 更改自定义标题
            item.custom_title = item.title;
            // 添加自定义HTML
            item.custom_html = API.Utils.utf8ToBase64($detailBlog.html());
            // 添加点赞Key
            item.uniKey = API.Blogs.getUniKey(item.blogid || item.blogId);

            items[index] = item;
        }).catch((e) => {
            console.error("获取日志内容异常", item, e);
            // 添加失败提示
            indicator.addFailed(item);
        })

        // 等待一下再请求
        let min = QZone_Config.Blogs.Info.randomSeconds.min;
        let max = QZone_Config.Blogs.Info.randomSeconds.max;
        let seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
    }
    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 处理日志列表的图片（迁移自 modules/blogs.js handerListImages）
   * @param {Array} items 日志列表
   */
  handerListImages: async(items) => {
    if (QZone_Config.Blogs.exportType !== 'HTML' || QZone_Config.Blogs.viewType !== '1' || API.Common.isQzoneUrl()) {
        // 非HTMl备份、非摘要模式、QQ空间外链，无需处理列表图片
        return;
    }
    for (const item of items) {
        if (!API.Common.isNewItem(item)) {
            // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
            break;
        }
        const images = item.img || [];
        for (const image of images) {
            // 图片地址
            const url = API.Utils.toHttp(image.url);

            // 添加下载任务
            const uid = API.Utils.newSimpleUid(8, 16);
            const suffix = await API.Utils.autoFileSuffix(url);
            image.custom_url = uid + suffix;

            API.Utils.newDownloadTask('Blogs', url, 'Blogs/images', image.custom_url, item);

            // 备份的显示地址
            image.custom_url = 'images/' + image.custom_url;
        }
    }
  },

  /**
   * 处理日志内容的图片（迁移自 modules/blogs.js handerContentImages）
   * @param {object} item 日志
   * @param {Array} images 图片元素列表
   */
  handerContentImages: async(item, images) => {
    if (!images) {
        // 无图片不处理
        return item;
    }
    // 导出类型
    const exportType = QZone_Config.Blogs.exportType;
    for (let i = 0; i < images.length; i++) {
        const $img = $(images[i]);
        // 处理相对协议
        let url = $img.attr('orgsrc') || $img.attr('src');
        url = API.Utils.toHttp(url);

        // 添加下载任务
        if (!API.Common.isQzoneUrl()) {
            // 非QQ空间外链
            const uid = API.Utils.newSimpleUid(8, 16);
            const suffix = await API.Utils.autoFileSuffix(url);
            const custom_filename = uid + suffix;

            // 添加下载任务
            API.Utils.newDownloadTask('Blogs', url, 'Blogs/images', custom_filename, item);

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
  },

  /**
   * 处理视频信息（简单处理，没仔细研究）（迁移自 modules/blogs.js handerMedias）
   * @param {object} item 日志
   * @param {Array} embeds 图片元素列表
   */
  handerMedias: async(item, embeds) => {
    if (!embeds) {
        // 无图片不处理
        return item;
    }
    // 导出类型
    const exportType = QZone_Config.Blogs.exportType;
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
                    if (!API.Common.isQzoneUrl()) {
                        // 非QQ空间外链
                        const uid = API.Utils.newSimpleUid(8, 16);
                        const suffix = await API.Utils.autoFileSuffix(vurl);
                        const custom_filename = uid + suffix;

                        // 添加下载任务
                        API.Utils.newDownloadTask('Blogs', vurl, 'Blogs/images', custom_filename, item);

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
  },

  /**
   * 日志自定义排序（置顶排前，同是置顶最新发表在前，非置顶最新发表在前）（迁移自 modules/blogs.js sort）
   * @param {Array} items 列表
   */
  sort: (items) => {
    const compare = function(obj1, obj2) {
        const isTop1 = API.Blogs.getBlogLabel(obj1).indexOf('置顶') > -1;
        const isTop2 = API.Blogs.getBlogLabel(obj2).indexOf('置顶') > -1;
        const time1 = obj1.pubTime ? new Date(obj1.pubTime).getTime() : obj1.pubtime;
        const time2 = obj2.pubTime ? new Date(obj2.pubTime).getTime() : obj2.pubtime;
        const res = time1 > time2 ? 1 : -1;
        if (isTop1 !== isTop2) {
            if (isTop1) {
                return -1;
            } else if (isTop2) {
                return 1;
            }
        }
        if (isTop1 && !isTop2) {
            return res;
        } else {
            return -res;
        }
    }
    return items.sort(compare);
  },

  /**
   * 获取日志阅读数（迁移自 modules/blogs.js getAllReadCount）
   * @param {Array} items 日志列表
   */
  getAllReadCount: async(items) => {
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
            let data = await API.Blogs.getReadCount(blogIds);
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                // 获取异常
                console.warn('获取日志阅读数异常：', data);
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
  },
};
