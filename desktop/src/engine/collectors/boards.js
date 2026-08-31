/**
 * 留言采集（P2）
 * 采集循环逐字迁自 modules/boards.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Boards = {
  /**
   * 获取一页的留言列表（迁移自 modules/boards.js getPageList）
   * @param {integer} pageIndex 指定页的索引
   * @param {StatusIndicator} indicator 状态更新器
   */
  getPageList: async(pageIndex, indicator) => {

    // 状态更新器当前页
    await indicator.setIndex(pageIndex + 1);

    // 更新获取中提示
    indicator.addDownload(QZone_Config.Boards.pageSize);

    return await API.Boards.getBoards(pageIndex).then(data => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取一页的留言列表异常：', data);
        }
        data = data.data || {};

        // 更新总数
        QZone.Boards.Data.total = data.total || QZone.Boards.Data.total || 0;
        if (data.authorInfo) {
            QZone.Boards.Data.authorInfo = {
                message: data.authorInfo.htmlMsg || '',
                sign: data.authorInfo.sign || ''
            }
        }
        indicator.setTotal(QZone.Boards.Data.total);

        let dataList = data.commentList || [];

        //  更新获取成功数据
        indicator.addSuccess(dataList);

        return dataList;
    })
  },

  /**
   * 获取所有留言列表（迁移自 modules/boards.js getAllList）
   */
  getAllList: async() => {

    // 进度更新器
    const indicator = new StatusIndicator('Boards');
    await indicator.setIndex(1);
    indicator.print();

    // 配置项
    const CONFIG = QZone_Config.Boards;

    const nextPage = async function(pageIndex, indicator) {

        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Boards.getPageList(pageIndex, indicator).then(async(dataList) => {

            // 设置比较信息
            dataList = API.Common.setCompareFiledInfo(dataList, 'pubtime', 'pubtime');

            // 合并数据
            QZone.Boards.Data.items = API.Utils.unionItems(QZone.Boards.Data.items, dataList);
            if (!API.Common.isGetNextPage(QZone.Boards.OLD_Data.items, dataList, CONFIG)) {
                // 不再继续获取下一页
                return QZone.Boards.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Boards.Data.total, QZone.Boards.Data.items, arguments.callee, nextPageIndex, indicator);
        }).catch(async(e) => {
            console.error("获取留言列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Boards.Data.total, QZone.Boards.Data.items, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Boards.Data.items = API.Common.unionBackedUpItems(CONFIG, QZone.Boards.OLD_Data.items, QZone.Boards.Data.items);

    // 发表时间倒序
    QZone.Boards.Data.items = API.Utils.sort(QZone.Boards.Data.items, CONFIG.IncrementField, true);

    // 完成
    indicator.complete();

    return QZone.Boards.Data;
  },

  /**
   * 处理数据（P2-4：迁自 modules/boards.js handerData）
   * @param {Array} boardInfo 留言信息
   */
  handerData: async(boardInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Boards_Images_Mime');

    // 处理留言数据
    for (const board of boardInfo.items) {
        if (!API.Common.isNewItem(board)) {
            // 已备份数据跳过不处理
            continue;
        }

        board.uin = board.uin || 0;
        board.nickname = API.Boards.getOwner(board);
        board.htmlContent = board.htmlContent || '';
        // 他人模式兼容私密留言
        if (board.secret == 1 && !board.htmlContent) {
            // 私密留言提示
            board.htmlContent = '主人收到一条私密留言，仅彼此可见';
            continue;
        }

        // 处理留言内容
        const $boardDom = jQuery('<div>{0}</div>'.format(board.htmlContent));
        // 处理图片信息
        const images = $boardDom.find("img") || [];
        for (let i = 0; i < images.length; i++) {
            const $img = $(images[i]);

            // 处理相对协议
            let url = $img.attr('orgsrc') || $img.attr('src');
            if (!url) {
                console.warn('board img url is null', board, $img);
                continue;
            }
            // 处理表情表情相对协议
            url = url.replace(/^\/qzone\/em/g, 'http://qzonestyle.gtimg.cn/qzone/em');
            url = API.Utils.toHttp(url);

            // 添加下载任务
            if (!API.Common.isQzoneUrl()) {
                // 非QQ空间外链
                let custom_filename = API.Utils.newSimpleUid(8, 16);
                let autoSuffix = await API.Utils.autoFileSuffix(url);
                custom_filename = custom_filename + autoSuffix;

                // 添加下载任务
                API.Utils.newDownloadTask('Boards', url, 'Boards/images', custom_filename, board);

                // 图片离线地址
                url = 'images/' + custom_filename;
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

            indicator.addSuccess(1);
        }

        // 替换无协议图片地址
        board.htmlContent = $boardDom.html();
    }

    // 完成
    indicator.complete();
    return boardInfo;
},

  /**
   * 添加下载表情任务（P2-4：迁自 modules/boards.js addDownloadEmoticonTasks）
   * @param {Message} items 相册列表
   */
  addDownloadEmoticonTasks: (items) => {
    if (API.Common.isQzoneUrl()) {
        // QQ空间外链，跳过
        return;
    }

    // 遍历
    for (const item of items) {

        if (API.Common.isQzoneUrl()) {
            // QQ空间外链或已备份项，跳过
            return;
        }

        // 添加任务
        API.Common.addCommentEmoticonDownloadTasks(item);
    }

},
};
