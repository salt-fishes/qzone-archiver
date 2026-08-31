/**
 * QQ空间留言模块导出API
 * @author https://github.com/ShunCai/
 */

/**
 * 导出留言
 */
API.Boards.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Boards_Row_Infos');
    indicator.print();

    try {
        // 获取所有的留言
        let boardInfo = await API.Boards.getAllList();

        // 处理数据
        boardInfo = await API.Boards.handerData(boardInfo);

        // 添加留言的回复表情，留言内容中的表情，当作一般图片下载即可
        API.Boards.addDownloadEmoticonTasks(boardInfo.items);

        // 根据导出类型导出数据
        await API.Boards.exportAllToFiles(boardInfo);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Boards', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}


/**
 * 获取一页的留言列表（P2：委托 collectors/Boards）
 * @param {integer} pageIndex 指定页的索引
 * @param {StatusIndicator} indicator 状态更新器
 */
API.Boards.getPageList = QZoneCollectors.Boards.getPageList;

/**
 * 获取所有留言列表（P2：委托 collectors/Boards）
 */
API.Boards.getAllList = QZoneCollectors.Boards.getAllList;

/**
 * 处理数据（P2-4：委托 collectors/boards）
 * @param {Array} boardInfo 留言信息
 */
API.Boards.handerData = QZoneCollectors.Boards.handerData;


/**
 * 导出留言（P2-4：委托 exporters/boards）
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportAllToFiles = QZoneExporters.Boards.exportAllToFiles;

/**
 * 导出留言到 SPA
 *
 * 数据策略：
 *   1. 轻量索引 boardsIndex（uin/昵称/时间/私密/回复数/摘要）—— SPA 启动时立即加载
 *   2. 按年分片全量数据 boards_<year> —— 用户滚动到某年时按需 <script> 加载
 *   3. 主人寄语 authorInfo 单独写入 boards-author.js，SPA 端在留言页顶部展示
 *
 * 注意：boardInfo 是 { items: [...], authorInfo, total } 对象（与 visitorInfo 一致）。
 *   pubtime 是 unix 秒，需格式化为字符串供 SPA 端展示。
 *   htmlContent 中已将图片下载到 Boards/images/ 并改写为相对路径，SPA 端直接渲染即可。
 */
API.Boards.exportToSpa = QZoneExporters.Boards.exportToSpa;


/**
 * 导出留言到HTML文件
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportToHtml = QZoneExporters.Boards.exportToHtml;

/**
 * 导出留言到MD文件
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportToMarkdown = QZoneExporters.Boards.exportToMarkdown;

/**
 * 生成单个留言的Markdown内容（P2-4：委托 exporters/boards）
 * @param {Object} boards 留言列表
 */
API.Boards.getMarkdown = QZoneExporters.Boards.getMarkdown;

/**
 * 导出留言到JSON文件
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportToJson = QZoneExporters.Boards.exportToJson;

/**
 * 添加下载表情任务（P2-4：委托 collectors/boards）
 * @param {Message} items 相册列表
 */
API.Boards.addDownloadEmoticonTasks = QZoneCollectors.Boards.addDownloadEmoticonTasks;