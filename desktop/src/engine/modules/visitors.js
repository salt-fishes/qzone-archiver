/**
 * QQ空间访客模块的导出API
 * @author https://github.com/ShunCai/
 */

API.Visitors.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Visitors_Row_Infos');
    indicator.print();

    try {

        // 获取所有的访客列表
        const visitorInfo = await API.Visitors.getAllList();
        console.info('访客列表获取完成', visitorInfo);

        // 添加多媒体下载任务
        await API.Visitors.addMediaToTasks(visitorInfo);

        // 根据导出类型导出数据    
        await API.Visitors.exportAllListToFiles(visitorInfo);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Visitors', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有访客列表（P2：委托 collectors/Visitors）
 */
API.Visitors.getAllList = QZoneCollectors.Visitors.getAllList;

/**
 * 添加多媒体下载任务（P2-4：委托 collectors/visitors）
 * @param {Array} item
 */
API.Visitors.addMediaToTasks = QZoneCollectors.Visitors.addMediaToTasks;

/**
 * 所有访客转换成导出文件
 * @param {Array} visitorInfo 访客列表
 */
API.Visitors.exportAllListToFiles = QZoneExporters.Visitors.exportAllListToFiles;

/**
 * 导出访客到 SPA
 * 数据策略：
 *   1. 轻量索引 visitorsIndex（uin/姓名/时间/来源/互动数）—— SPA 启动时立即加载
 *   2. 按年分片全量数据 visitors_<year> —— 用户滚动到某年时按需 <script> 加载
 *
 * 注意：visitorInfo 是 { items: [...], total, totalPage } 对象，
 *   与 messages 数组不同，这里取 items 数组进行分组。
 *   time 字段是 unix 秒，需要格式化为字符串供 SPA 端展示。
 */
API.Visitors.exportToSpa = QZoneExporters.Visitors.exportToSpa;

/**
 * 导出访客到HTML文件
 * @param {Array} visitorInfo 数据
 */
API.Visitors.exportToHtml = QZoneExporters.Visitors.exportToHtml;

/**
 * 获取单篇访客的Markdown内容（P2-4：委托 exporters/visitors）
 * @param {ShareInfo} item 访客
 */
API.Visitors.getMarkdown = QZoneExporters.Visitors.getMarkdown;

/**
 * 导出访客到Markdown文件
 * @param {Array} visitorInfo 数据
 */
API.Visitors.exportToMarkdown = QZoneExporters.Visitors.exportToMarkdown;

/**
 * 导出访客到JSON文件
 * @param {Array} visitorInfo 数据
 */
API.Visitors.exportToJson = QZoneExporters.Visitors.exportToJson;

/**
 * 添加下载配图任务（P2-4：委托 collectors/visitors）
 * @param {Message} item 访客
 */
API.Visitors.addDownloadImagesTasks = QZoneCollectors.Visitors.addDownloadImagesTasks;

/**
 * 添加下载表情任务（P2-4：委托 collectors/visitors）
 * @param {Message} item 访客
 */
API.Visitors.addDownloadEmoticonTasks = QZoneCollectors.Visitors.addDownloadEmoticonTasks;