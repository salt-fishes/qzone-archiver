/**
 * QQ空间收藏模块导出API
 * @author https://github.com/ShunCai/
 */

/**
 * 导出收藏板
 */
API.Favorites.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Favorites_Row_Infos');
    indicator.print();

    try {
        // 获取所有的收藏列表
        let dataList = await API.Favorites.getAllList();

        // 添加多媒体下载任务
        dataList = await API.Favorites.addMediaToTasks(dataList);

        // 根据导出类型导出数据
        await API.Favorites.exportAllToFiles(dataList);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Favorites', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}


/**
 * 获取一页的收藏列表（P2：委托 collectors/Favorites）
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Favorites.getPageList = QZoneCollectors.Favorites.getPageList;

/**
 * 获取所有收藏列表（P2：委托 collectors/Favorites）
 */
API.Favorites.getAllList = QZoneCollectors.Favorites.getAllList;

/**
 * 转换数据（P3：委托 repos/Favorites）
 */
API.Favorites.convert = QZoneRepo.Favorites.convert;

/**
 * 导出收藏（P2-4：委托 exporters/favorites）
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportAllToFiles = QZoneExporters.Favorites.exportAllToFiles;

/**
 * 导出收藏到 SPA
 * 生成轻量索引（favorites-index.js）和按年份分片的全量数据（favorites-YYYY.js）
 * 索引字段对齐前端 FavoriteIndex 类型，全量数据保留原始结构以支撑详情展示
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToSpa = QZoneExporters.Favorites.exportToSpa;

/**
 * 导出收藏到HTML文件
 * @param {Array} favorites 数据
 */
API.Favorites.exportToHtml = QZoneExporters.Favorites.exportToHtml;

/**
 * 导出收藏到MD文件
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToMarkdown = QZoneExporters.Favorites.exportToMarkdown;

/**
 * 获取单篇收藏的Markdown内容（P2-4：委托 exporters/favorites）
 * @param {object} favorite 收藏
 */
API.Favorites.getMarkdown = QZoneExporters.Favorites.getMarkdown;

/**
 * 导出收藏到JSON文件
 * @param {Array} favorites 收藏列表
 */
API.Favorites.exportToJson = QZoneExporters.Favorites.exportToJson;

/**
 * 添加多媒体下载任务（P2-4：委托 collectors/favorites）
 * @param {Array} dataList
 */
API.Favorites.addMediaToTasks = QZoneCollectors.Favorites.addMediaToTasks;

/**
 * 添加下载表情任务（P2-4：委托 collectors/favorites）
 * @param {Message} favorite 收藏
 */
API.Favorites.addDownloadEmoticonTasks = QZoneCollectors.Favorites.addDownloadEmoticonTasks;