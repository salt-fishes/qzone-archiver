/**
 * 日记采集（P2）
 * 采集循环逐字迁自 modules/diaries.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Diaries = {
  /**
   * 获取单页的日记列表（迁移自 modules/diaries.js getList）
   * @param {integer} pageIndex 指定页的索引
   * @param {StatusIndicator} indicator 状态更新器
   */
  getList: async(pageIndex, indicator) => {
    // 状态更新器当前页
    indicator.index = pageIndex + 1;
    return await API.Diaries.getDiaries(pageIndex).then(async(data) => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取单页的日记列表异常：', data);
        }
        data = data.data || {};

        // 更新状态-下载中的数量
        indicator.addDownload(QZone_Config.Diaries.pageSize);

        // 更新状态-总数
        QZone.Diaries.total = data.total_num || QZone.Diaries.total || 0;
        indicator.setTotal(QZone.Diaries.total);

        let dataList = data.titlelist || [];

        // 更新状态-下载成功数
        indicator.addSuccess(dataList);

        return dataList;
    })
  },

  /**
   * 获取所有日记列表（迁移自 modules/diaries.js getAllList）
   */
  getAllList: async() => {

    // 日记状态更新器
    const indicator = new StatusIndicator('Diaries');
    await indicator.setIndex(1);
    indicator.print();

    // 配置项
    const CONFIG = QZone_Config.Diaries;

    const nextPage = async function(pageIndex, indicator) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Diaries.getList(pageIndex, indicator).then(async(dataList) => {

            // 合并数据
            QZone.Diaries.Data = API.Utils.unionItems(QZone.Diaries.Data, dataList);
            if (!API.Common.isGetNextPage(QZone.Diaries.OLD_Data.items, dataList, CONFIG)) {
                // 不再继续获取下一页
                return QZone.Diaries.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Diaries.total, QZone.Diaries.Data, arguments.callee, nextPageIndex, indicator);

        }).catch(async(e) => {
            console.error("获取日记列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Diaries.total, QZone.Diaries.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Diaries.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Diaries.OLD_Data, QZone.Diaries.Data);

    // 发表时间倒序
    QZone.Diaries.Data = API.Utils.sort(QZone.Diaries.Data, CONFIG.IncrementField, true);

    // 完成
    indicator.complete();

    return QZone.Diaries.Data;
  },

  /**
   * 获取所有日志的评论列表（迁移自 modules/diaries.js getItemsAllCommentList）
   * @param {string} item 日志
   */
  getItemsAllCommentList: async(items) => {
    if (!QZone_Config.Diaries.Comments.isFull) {
        // 不获取全部评论时，跳过
        return items;
    }

    // 单条日志状态更新器
    const indicator = new StatusIndicator('Diaries_Comments');
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
        await API.Diaries.getItemAllCommentList(item);

        // 添加成功
        indicator.addSuccess(item);
    }

    // 已完成
    indicator.complete();
    return items;
  },

  /**
   * 获取单条日志的单页评论列表（迁移自 modules/diaries.js getItemCommentList）
   * @param {object} item 日志
   * @param {integer} pageIndex 页数索引
   */
  getItemCommentList: async(item, pageIndex) => {
    return await API.Diaries.getComments(item.blogid, pageIndex).then(async(data) => {
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
   * 获取单条日志的全部评论列表（迁移自 modules/diaries.js getItemAllCommentList）
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
    const CONFIG = QZone_Config.Diaries.Comments;

    // 更新总数
    const total = item.replynum || 0;

    const nextPage = async function(item, pageIndex) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Diaries.getItemCommentList(item, pageIndex).then(async(dataList) => {

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
   * 获取日志赞记录（迁移自 modules/diaries.js getAllLikeList）
   * @param {Array} items 日志列表
   */
  getAllLikeList: async(items) => {

    if (!API.Common.isGetLike(QZone_Config.Diaries)) {
        // 不获取赞
        return items;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Like');
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
            tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Diaries).then((likes) => {
                // 获取完成
                indicator.addSuccess(item);
            }).catch((e) => {
                console.error("获取日记点赞异常：", item, e);
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
   * 获取单条日记的全部最近访问（迁移自 modules/diaries.js getItemAllVisitorsList）
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
    const CONFIG = QZone_Config.Diaries.Visitor;

    const nextPage = async function(item, pageIndex) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Diaries.getVisitors(item.blogid, pageIndex).then(async(data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                // 获取异常
                console.warn('获取单条日记的全部最近访问异常：', data);
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
   * 获取日志最近访问（迁移自 modules/diaries.js getAllVisitorList）
   * @param {Array} items 日志列表
   */
  getAllVisitorList: async(items) => {
    if (!API.Common.isGetVisitor(QZone_Config.Diaries)) {
        // 不获取最近访问
        return items;
    }
    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Visitor');
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
            tasks.push(API.Diaries.getItemAllVisitorsList(item).then((visitor) => {
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
    await API.Diaries.getAllReadCount(items);

    // 已备份数据跳过不处理
    indicator.setSkip(items.length - count);

    // 完成
    indicator.complete();

    return items;
  },
};
