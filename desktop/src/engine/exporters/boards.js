/**
 * 留言导出（P4，迁移自 modules/boards.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Boards = {
  /**
   * 导出留言到 SPA（迁移自 modules/boards.js exportToSpa）
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
  exportToSpa: async(boardInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Boards_Export_Other');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Boards');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        const items = boardInfo.items || [];

        // 0. 主人寄语单独文件
        await API.Common.writeJsonToJs(
            'boardsAuthor',
            boardInfo.authorInfo || { message: '', sign: '' },
            dataFolder + '/boards-author.js'
        );

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        const index = items.map(b => {
            const htmlContent = b.htmlContent || '';
            // 摘要：去除 HTML 标签与实体后截断（不依赖 DOM）
            const abstract = htmlContent
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .substring(0, 120);
            return {
                uin: b.uin || 0,
                nickname: b.nickname || '',
                time: API.Utils.formatDate(b.pubtime),
                pubtime: b.pubtime || 0,
                secret: b.secret === 1,
                replyCount: (b.replyList && b.replyList.length) || 0,
                abstract
            };
        });
        await API.Common.writeJsonToJs('boardsIndex', index, dataFolder + '/boards-index.js');
        console.info('生成 SPA 留言索引完成', { total: index.length });

        // 2. 按年分片全量数据
        // pubtime 是 unix 秒，groupedByTime 直接处理
        const yearMaps = API.Utils.groupedByTime(items, "pubtime", 'year');
        for (const [year, yearItems] of yearMaps) {
            await API.Common.writeJsonToJs(
                `boards_${year}`,
                yearItems,
                `${dataFolder}/boards-${year}.js`
            );
            console.info('生成 SPA 留言年份分片完成', { year, count: yearItems.length });
        }

        console.info('导出留言到 SPA 完成', { total: items.length, years: yearMaps.size });

    } catch (error) {
        console.error('导出留言到 SPA 异常', error, boardInfo);
    }

    // 完成
    indicator.complete();
    return boardInfo;
  },


  /**
   * 导出留言到HTML文件（迁移自 modules/boards.js exportToHtml）
   * @param {Array} boardInfo 留言信息
   */
  exportToHtml: async(boardInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Boards_Export_Other');
    await indicator.setIndex("HTML");
    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Boards');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('boardInfo', boardInfo, moduleFolder + '/json/boards.js');

        // 留言数据根据年份分组
        const yearMaps = API.Utils.groupedByTime(boardInfo.items, "pubtime", 'year');
        // 基于模板生成年份留言HTML
        for (const [year, yearItems] of yearMaps) {
            // 基于模板生成所有留言HTML
            const _boardMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "pubtime", 'month');
            _boardMaps.set(year, monthMaps);
            const params = {
                boardMaps: _boardMaps,
                total: yearItems.length,
                authorInfo: boardInfo.authorInfo
            }
            const yearFile = await API.Common.writeHtmlofTpl('boards', params, moduleFolder + "/" + year + ".html");
        }

        // 基于模板生成汇总说说HTML
        const params = {
            boardMaps: API.Utils.groupedByTime(boardInfo.items, "pubtime", 'all'),
            total: boardInfo.total,
            authorInfo: boardInfo.authorInfo
        }
        await API.Common.writeHtmlofTpl('boards', params, moduleFolder + "/index.html");

    } catch (error) {
        console.error('导出留言到HTML异常', error, boardInfo);
    }

    // 更新进度
    indicator.complete();
    return boardInfo;
  },

  /**
   * 导出留言到MD文件（迁移自 modules/boards.js exportToMarkdown）
   * @param {Array} boardInfo 留言信息
   */
  exportToMarkdown: async(boardInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Boards_Export_Other');
    await indicator.setIndex('Markdown');

    try {
        // 总数，用于计算楼层
        let total = boardInfo.total;

        // 根据年份分组，每一年生成一个MD文件
        const yearMap = API.Utils.groupedByTime(boardInfo.items, "pubtime");

        // 个人寄语
        const message = QZone.Common.MD.turndown(boardInfo.authorInfo.message);
        const _messsages = [];
        _messsages.push('> 主人寄语  ');
        _messsages.push('\n');
        _messsages.push(message || '说些寄语，欢迎您的空间访客吧');
        _messsages.push('\n');
        _messsages.push('---  ');

        // 汇总内容
        let allYearContents = [];

        for (const [year, monthMaps] of yearMap) {
            // 年份内容
            let year_contents = [];
            year_contents.push("# " + year + "年");

            // 年条目数
            let year_total = 0;
            for (const [month, month_items] of monthMaps) {
                year_contents.push("## " + month + "月 ");
                // 年份内容
                for (const borad of month_items) {
                    // 留言楼层
                    year_contents.push('#### 第' + (total--) + '楼');
                    const board_content = API.Boards.getMarkdown(borad);
                    year_contents.push(board_content);
                    // 楼层分割线
                    year_contents.push('---');
                    year_total++;
                }
            }

            // 汇总年份内容
            allYearContents.push(year_contents.join('\r\n'));

            const yearFilePath = API.Common.getModuleRoot('Boards') + "/" + year + ".md";

            // 合并个人寄语
            _messsages[5] = '> 留言(' + year_total + ')  ';
            year_contents = _messsages.concat(year_contents);

            await API.Utils.writeText(year_contents.join('\r\n'), yearFilePath).then(fileEntry => {
                console.info('备份留言列表完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份留言列表失败，当前年份=', year, error);
            });
        }

        // 合并个人寄语
        _messsages[5] = '> 留言(' + boardInfo.total + ')  ';
        allYearContents = _messsages.concat(allYearContents);

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Boards') + '/Boards.md');
    } catch (error) {
        console.error('导出留言到Markdown文件异常', error, boardInfo);
    }

    indicator.complete();
    return boardInfo;
  },

  /**
   * 导出留言到JSON文件（迁移自 modules/boards.js exportToJson）
   * @param {Array} boardInfo 留言信息
   */
  exportToJson: async(boardInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Boards_Export_Other');
    await indicator.setIndex('JSON');

    // 根据年份分组
    const yearDataMap = API.Utils.groupedByTime(boardInfo.items, "pubtime", 'year');
    for (const [year, yearItems] of yearDataMap) {
        // 每年信息
        const yearInfo = {
            items: yearItems,
            authorInfo: boardInfo.authorInfo,
            total: yearItems.length
        }
        const yearFilePath = API.Common.getModuleRoot('Boards') + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearInfo), yearFilePath).then(fileEntry => {
            console.info('备份留言列表完成，当前年份=', year, yearInfo, fileEntry);
        }).catch(error => {
            console.error('备份留言列表失败，当前年份=', year, yearInfo, error);
        });
    }

    await API.Utils.writeText(JSON.stringify(boardInfo), API.Common.getModuleRoot('Boards') + '/boards.json').then(fileEntry => {
        console.info('备份留言列表完成', boardInfo, fileEntry);
    }).catch(error => {
        console.error('备份留言列表失败', boardInfo, error);
    });

    // 完成
    indicator.complete();
    return boardInfo;
  },

  /**
   * 导出留言（P2-4：迁自 modules/boards.js exportAllToFiles）
   * @param {Array} boardInfo 留言信息
   */
  exportAllToFiles: async(boardInfo) => {
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
},

  /**
   * 生成单个留言的Markdown内容（P2-4：迁自 modules/boards.js getMarkdown）
   * @param {Object} boards 留言列表
   */
  getMarkdown: (board) => {
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
},
};
