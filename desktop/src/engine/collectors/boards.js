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
};
