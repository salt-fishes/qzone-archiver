/**
 * 说说导出（P4，迁移自 modules/messages.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Messages = {
  /**
   * 所有说说转换成导出文件（迁移自 modules/messages.js exportAllListToFiles）
   */
  exportAllListToFiles: async(items) => {
    // 获取用户配置
    let exportType = QZone_Config.Messages.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Messages.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Messages.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Messages.exportToJson(items);
            break;
        case 'SPA':
            await API.Messages.exportToSpa(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
  },

  /**
   * 导出说说到HTML文件（迁移自 modules/messages.js exportToHtml）
   * @param {Array} messages 数据
   */
  exportToHtml: async(messages) => {
    const indicator = new StatusIndicator('Messages_Export_Other');
    await indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Messages');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('messages', messages, moduleFolder + '/json/messages.js');

        // 说说数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(messages, "custom_create_time", 'year');
        // 基于模板生成年份说说HTML
        for (const [year, yearItems] of yearMaps) {
            // 基于模板生成所有说说HTML
            let _messageMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "custom_create_time", 'month');
            _messageMaps.set(year, monthMaps);
            let params = {
                messageMaps: _messageMaps,
                total: yearItems.length,
                config: QZone_Config
            }
            await API.Common.writeHtmlofTpl('messages', params, moduleFolder + "/" + year + ".html");
        }

        // 基于模板生成汇总说说HTML
        let params = {
            messageMaps: API.Utils.groupedByTime(messages, "custom_create_time", 'all'),
            total: messages.length,
            config: QZone_Config
        }
        await API.Common.writeHtmlofTpl('messages', params, moduleFolder + "/index.html");

    } catch (error) {
        console.error('导出说说到HTML异常', error, messages);
    }

    // 完成
    indicator.complete();

    return messages;
  },

  /**
   * 导出说说到Markdown文件（迁移自 modules/messages.js exportToMarkdown）
   * @param {Array} items 数据
   */
  exportToMarkdown: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Export_Other');
    await indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 说说数据根据年份分组
        const year_month_maps = API.Utils.groupedByTime(items, "custom_create_time");
        for (const [year, month_maps] of year_month_maps) {
            const yearContents = [];
            yearContents.push("# " + year + "年");
            for (const [month, items] of month_maps) {
                yearContents.push("## " + month + "月");
                for (const item of items) {
                    yearContents.push(API.Messages.getMarkdown(item));
                    yearContents.push('---');
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = API.Common.getModuleRoot('Messages') + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份说说列表到Markdown完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份说说列表到Markdown异常，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Messages') + '/Messages.md').then((fileEntry) => {
            console.info('生成汇总说说Markdown文件完成', items, fileEntry);
        }).catch((e) => {
            console.error("生成汇总说说Markdown文件异常", items, e)
        });

    } catch (error) {
        console.error('导出说说到Markdown文件异常', error, items);
    }
    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 导出说说到JSON文件（迁移自 modules/messages.js exportToJson）
   * @param {Array} items 数据
   */
  exportToJson: async(items) => {
    // 进度功能性期
    const indicator = new StatusIndicator('Messages_Export_Other');
    await indicator.setIndex('JSON');

    // 生成年份JSON
    // 说说数据根据年份分组
    const yearDataMap = API.Utils.groupedByTime(items, "custom_create_time", "year");
    for (const [year, yearItems] of yearDataMap) {
        console.info('正在生成年份说说JSON文件', year);
        const yearFilePath = API.Common.getModuleRoot('Messages') + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then((fileEntry) => {
            console.info('生成年份说说JSON文件完成', year, fileEntry);
        }).catch((e) => {
            console.error("生成年份说说JSON文件异常", yearItems, e)
        });
    }

    // 生成汇总JSON
    const json = JSON.stringify(items);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Messages') + '/messages.json').then((fileEntry) => {
        console.info('生成汇总说说JSON文件完成', items, fileEntry);
    }).catch((e) => {
        console.error("生成汇总说说JSON文件异常", items, e)
    });

    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 导出说说到 SPA（单页应用）（迁移自 modules/messages.js exportToSpa）
   * 数据策略：
   *   1. 轻量索引 messagesIndex（年份/月份/标题/摘要/统计字段，~50KB）
   *      —— SPA 启动时立即 <script> 加载，用于侧边栏目录与搜索
   *   2. 按年分片全量数据 messages_<year>
   *      —— 用户滚动到某年时按需 <script> 加载，避开一次性加载万条数据卡顿
   *   3. 已删除说说 messagesDeleted（实验性）
   *      —— 通过好友互动消息恢复，与主列表分开存放
   *
   * 数据文件格式统一为 window.<key> = [...]，由 SPA 端 data-loader 读取
   * @param {Array} messages 说说列表
   */
  exportToSpa: async(messages) => {
    // 进度更新器
    const indicator = new StatusIndicator('Messages_Export_Other');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Messages');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        // 导出进度：索引 + 各年分片作为 total（概要型 indicator 无 total 时 running 态不发事件，
        // 会导致导出阶段数秒无反馈，界面像卡在点赞阶段）
        const yearMaps = API.Utils.groupedByTime(messages, "custom_create_time", 'year');
        indicator.setTotal(yearMaps.size + 1);
        let step = 0;

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        await indicator.setIndex(++step);
        const index = messages.map(m => {
            // 配图：扩展端转换后 custom_images 与 pic 等价，pic_list 为旧字段（可能为空）
            const pics = m.custom_images || m.pic || m.pic_list || [];
            return {
                tid: m.tid,
                time: m.custom_create_time,
                title: (m.content || '').substring(0, 50),
                imgCount: pics.length,
                // 列表缩略图：最多前 4 张，本地文件优先，回退远程缩略图 URL
                thumbs: pics.slice(0, 4)
                    .map(p => p.custom_filepath || p.s_url || p.url3 || p.custom_url || p.url1 || p.b_url || '')
                    .filter(Boolean),
                // 评论数：优先取接口返回的真实总数（commenttotal），
                // 其次取全量评论列表长度（commentlist_v6 拉全后 custom_comments 为全量），
                // 最后回退到内嵌列表长度（列表接口内嵌评论可能被截断，如仅前 10 条）
                commentCount: (m.commenttotal && m.commenttotal > 0)
                    ? m.commenttotal
                    : (m.custom_comments && m.custom_comments.length) || (m.commentlist && m.commentlist.length) || 0,
                // 点赞数：统一取 likes 数组长度（旧结构 like: {total, list} 仅作兼容回退）
                likeCount: (m.likes && m.likes.length) || (m.like && m.like.total) || 0
            };
        });
        await API.Common.writeJsonToJs('messagesIndex', index, dataFolder + '/messages-index.js');
        console.info('生成 SPA 说说索引完成', { total: index.length });

        // 2. 按年分片全量数据
        for (const [year, yearItems] of yearMaps) {
            await indicator.setIndex(++step);
            // 变量名形如 messages_2026（与 SPA 端 data-loader 约定一致）
            await API.Common.writeJsonToJs(
                `messages_${year}`,
                yearItems,
                `${dataFolder}/messages-${year}.js`
            );
            console.info('生成 SPA 说说年份分片完成', { year, count: yearItems.length });
        }

        // 3. [实验性] 恢复已删除说说：从好友互动消息列表拉取通知，按 tid 与现有说说去重
        let deletedItems = [];
        if (QZone_Config.Messages.RecoverDeleted) {
            try {
                deletedItems = await API.Messages.getDeletedMessages(messages);
                if (deletedItems.length > 0) {
                    await API.Common.writeJsonToJs(
                        'messagesDeleted',
                        deletedItems,
                        `${dataFolder}/messages-deleted.js`
                    );
                    console.info('生成 SPA 已删除说说完成', { count: deletedItems.length });
                } else {
                    console.info('未发现已删除说说');
                }
            } catch (e) {
                // 取消：向上传播中止整个备份流程
                if (e && e.__exportCancelled) throw e;
                console.error('恢复已删除说说异常', e);
            }
        }

        console.info('导出说说到 SPA 完成', { total: messages.length, years: yearMaps.size, deleted: deletedItems.length });

    } catch (error) {
        console.error('导出说说到 SPA 异常', error, messages);
    }

    // 完成
    indicator.complete();
    return messages;
  },
};
