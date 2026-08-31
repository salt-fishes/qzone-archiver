/**
 * 收藏采集（P2）
 * 采集循环逐字迁自 modules/favorites.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Favorites = {
  /**
   * 获取一页的收藏列表（迁移自 modules/favorites.js getPageList）
   * @param {integer} pageIndex 指定页的索引
   * @param {StatusIndicator} indicator 状态更新器
   */
  getPageList: async(pageIndex, indicator) => {

    // 状态更新器当前页
    await indicator.setIndex(pageIndex + 1);

    // 更新获取中提示
    indicator.addDownload(QZone_Config.Favorites.pageSize);

    return await API.Favorites.getFavorites(pageIndex).then(data => {
        // 去掉函数，保留json
        data = API.Utils.toJson(data, /^_Callback\(/);
        if (data.code && data.code != 0) {
            // 获取异常
            console.warn('获取一页的收藏列表异常：', data);
        }
        data = data.data || {};

        // 更新总数
        QZone.Favorites.total = data.total_num || QZone.Favorites.total || 0;
        indicator.setTotal(QZone.Favorites.total);

        // 转换数据
        let dataList = API.Favorites.convert(data.fav_list || []);

        //  更新获取成功数据
        indicator.addSuccess(dataList);

        return dataList;
    })
  },

  /**
   * 获取所有收藏列表（迁移自 modules/favorites.js getAllList）
   */
  getAllList: async() => {

    // 进度更新器
    const indicator = new StatusIndicator('Favorites');
    await indicator.setIndex(1);
    indicator.print();

    const CONFIG = QZone_Config.Favorites;

    const nextPage = async function(pageIndex, indicator) {
        // 下一页索引
        const nextPageIndex = pageIndex + 1;

        return await API.Favorites.getPageList(pageIndex, indicator).then(async(dataList) => {

            // 合并数据
            QZone.Favorites.Data = API.Utils.unionItems(QZone.Favorites.Data, dataList);
            if (!API.Common.isGetNextPage(QZone.Favorites.OLD_Data.items, dataList, CONFIG)) {
                // 不再继续获取下一页
                return QZone.Favorites.Data;
            }
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Favorites.total, QZone.Favorites.Data, arguments.callee, nextPageIndex, indicator);
        }).catch(async(e) => {
            console.error("获取收藏列表异常，当前页：", pageIndex + 1, e);
            indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
            // 当前页失败后，跳过继续请求下一页
            // 递归获取下一页
            return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Favorites.total, QZone.Favorites.Data, arguments.callee, nextPageIndex, indicator);
        });
    }

    await nextPage(0, indicator);

    // 合并、过滤数据
    QZone.Favorites.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Favorites.OLD_Data, QZone.Favorites.Data);

    // 发表时间倒序
    QZone.Favorites.Data = API.Utils.sort(QZone.Favorites.Data, CONFIG.IncrementField, true);

    // 完成
    indicator.complete();

    return QZone.Favorites.Data;
  },

  /**
   * 添加多媒体下载任务（P2-4：迁自 modules/favorites.js addMediaToTasks）
   * @param {Array} dataList
   */
  addMediaToTasks: async(dataList) => {
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
},

  /**
   * 添加下载表情任务（P2-4：迁自 modules/favorites.js addDownloadEmoticonTasks）
   * @param {Message} favorite 收藏
   */
  addDownloadEmoticonTasks: (favorite) => {
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

},
};
