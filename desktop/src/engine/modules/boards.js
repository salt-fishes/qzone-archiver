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
        console.error('留言导出异常', error);
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
 * 处理数据
 * @param {Array} boardInfo 留言信息
 */
API.Boards.handerData = async(boardInfo) => {
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
}


/**
 * 导出留言
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportAllToFiles = async(boardInfo) => {
    // 获取用户配置
    let exportType = QZone_Config.Boards.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Boards.exportToHtml(boardInfo);
            break;
        case 'MarkDown':
            await API.Boards.exportToMarkdown(boardInfo);
            break;
        case 'JSON':
            await API.Boards.exportToJson(boardInfo);
            break;
        case 'SPA':
            await API.Boards.exportToSpa(boardInfo);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

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
 * 生成单个留言的Markdown内容
 * @param {Object} boards 留言列表
 */
API.Boards.getMarkdown = (board) => {
    const year_contents = [];

    let nickname = API.Common.formatContent(API.Boards.getOwner(board), "MD", false, false, false, false, true);
    nickname = API.Common.getUserLink(board.uin, nickname, 'MD', true);

    year_contents.push('> {0} *{1}*'.format(nickname, API.Utils.formatDate(board.pubtime)));
    year_contents.push("\r\n");
    year_contents.push('> 正文：');
    year_contents.push("\r\n");

    // 留言内容
    const html_content = board.htmlContent.replace(/\n/g, "\r\n");
    let markdown_content = QZone.Common.MD.turndown(html_content);
    markdown_content = API.Common.formatContent(markdown_content, "MD", false, false, false, false, true);

    // 添加留言内容
    year_contents.push('- {0}：{1}'.format(nickname, markdown_content));
    year_contents.push("\r\n");

    // 处理留言回复
    year_contents.push('> 回复：');
    year_contents.push("\r\n");
    let replyList = board.replyList || [];
    for (const reply of replyList) {
        // 回复人
        let replyName = API.Common.formatContent(API.Boards.getOwner(reply), "MD", false, false, false, false, true);
        replyName = API.Common.getUserLink(reply.uin, replyName, 'MD', true);

        // 回复内容
        const replyContent = API.Common.formatContent(reply.content, "MD", false, false, false, false, true);
        const replyTime = API.Utils.formatDate(reply.time);

        const replyMd = '- {0}：{1} *{2}*'.format(replyName, replyContent, replyTime);
        year_contents.push(replyMd);
    }
    return year_contents.join('\r\n');
}

/**
 * 导出留言到JSON文件
 * @param {Array} boardInfo 留言信息
 */
API.Boards.exportToJson = QZoneExporters.Boards.exportToJson;

/**
 * 添加下载表情任务
 * @param {Message} items 相册列表 
 */
API.Boards.addDownloadEmoticonTasks = (items) => {
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

}