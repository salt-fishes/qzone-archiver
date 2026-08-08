/**
 * 分享导出（P4，迁移自 modules/shares.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Shares = {
  /**
   * 所有分享转换成导出文件（迁移自 modules/shares.js exportAllListToFiles）
   * @param {Array} items 分享列表
   */
  exportAllListToFiles: async(items) => {
    // 获取用户配置
    const exportType = QZone_Config.Shares.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Shares.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Shares.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Shares.exportToJson(items);
            break;
        case 'SPA':
            await API.Shares.exportToSpa(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
  },

  /**
   * 导出分享到 SPA（迁移自 modules/shares.js exportToSpa）
   *
   * 数据策略：
   *   1. 轻量索引 sharesIndex（uin/昵称/类型/时间/描述/来源/评论数/点赞数）—— SPA 启动时立即加载
   *   2. 按年分片全量数据 shares_<year> —— 用户滚动到某年时按需 <script> 加载
   *
   * 注意：items 是纯数组（ShareInfo[]），与 favorites.js 一致。
   *   shareTime 是 unix 秒，需格式化为字符串供 SPA 端展示。
   *   source.images 已下载并含 custom_url/custom_filepath，全量数据保留供详情页渲染。
   *   Shares 不支持视频/音乐下载（仅图片），无需考虑 video_list/music_list。
   */
  exportToSpa: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Shares_Export_Other');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Shares');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        const shares = items || [];

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        const index = shares.map(s => {
            const source = s.source || {};
            // 描述：去除 HTML 标签后截断
            const desc = (s.desc || '')
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .substring(0, 120);
            return {
                id: s.id || '',
                uin: s.uin || 0,
                nickname: s.nickname || '',
                type: s.type || 0,
                typeLabel: API.Shares.getDisplayType(s.type),
                time: API.Utils.formatDate(s.shareTime),
                shareTime: s.shareTime || 0,
                desc,
                sourceTitle: source.title || '',
                sourceUrl: source.url || '',
                sourceFromName: (source.from && source.from.name) || '',
                sourceCount: source.count || 0,
                sourceImageCount: (source.images && source.images.length) || 0,
                // 来源配图缩略图：最多前 4 张，本地文件优先，回退远程缩略图 URL
                sourceThumbs: (source.images || [])
                    .slice(0, 4)
                    .map(p => p.custom_filepath || p.s_url || p.url3 || p.custom_url || p.url1 || p.b_url || '')
                    .filter(Boolean),
                commentCount: s.commentTotal || (s.comments && s.comments.length) || 0,
                likeCount: s.likeTotal || (s.likes && s.likes.length) || 0,
                visitorCount: (s.custom_visitor && s.custom_visitor.totalNum) || 0
            };
        });
        await API.Common.writeJsonToJs('sharesIndex', index, dataFolder + '/shares-index.js');
        console.info('生成 SPA 分享索引完成', { total: index.length });

        // 2. 按年分片全量数据
        // shareTime 是 unix 秒，groupedByTime 直接处理
        const yearMaps = API.Utils.groupedByTime(shares, "shareTime", 'year');
        for (const [year, yearItems] of yearMaps) {
            await API.Common.writeJsonToJs(
                `shares_${year}`,
                yearItems,
                `${dataFolder}/shares-${year}.js`
            );
            console.info('生成 SPA 分享年份分片完成', { year, count: yearItems.length });
        }

        console.info('导出分享到 SPA 完成', { total: shares.length, years: yearMaps.size });

    } catch (error) {
        console.error('导出分享到 SPA 异常', error, items);
    }

    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 导出分享到HTML文件（迁移自 modules/shares.js exportToHtml）
   * @param {Array} shares 数据
   */
  exportToHtml: async(shares) => {
    const indicator = new StatusIndicator('Shares_Export_Other');
    await indicator.setIndex('HTML');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Shares');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('shares', shares, moduleFolder + '/json/shares.js');

        // 分享数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(shares, "shareTime", 'year');
        // 基于模板生成年份分享HTML
        for (const [year, yearItems] of yearMaps) {
            // 基于模板生成所有分享HTML
            let _sharesMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "shareTime", 'month');
            _sharesMaps.set(year, monthMaps);
            let params = {
                sharesMaps: _sharesMaps,
                total: yearItems.length
            }
            await API.Common.writeHtmlofTpl('shares', params, moduleFolder + "/" + year + ".html");
        }

        // 基于模板生成汇总分享HTML
        let params = {
            sharesMaps: API.Utils.groupedByTime(shares, "shareTime", 'all'),
            total: shares.length
        }
        await API.Common.writeHtmlofTpl('shares', params, moduleFolder + "/index.html");

    } catch (error) {
        console.error('导出分享到HTML异常', error, shares);
    }

    // 完成
    indicator.complete();
    return shares;
  },

  /**
   * 导出分享到Markdown文件（迁移自 modules/shares.js exportToMarkdown）
   * @param {Array} items 数据
   */
  exportToMarkdown: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Shares_Export_Other');
    await indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 分享数据根据年份分组
        const year_month_maps = API.Utils.groupedByTime(items, "shareTime");
        for (const [year, month_maps] of year_month_maps) {
            const yearContents = [];
            yearContents.push("# " + year + "年");
            for (const [month, items] of month_maps) {
                yearContents.push("## " + month + "月");
                for (const item of items) {
                    yearContents.push(API.Shares.getMarkdown(item));
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = API.Common.getModuleRoot('Shares') + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份分享列表到Markdown完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份分享列表到Markdown异常，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Shares') + '/Shares.md').then((fileEntry) => {
            console.info('生成汇总分享Markdown文件完成', items, fileEntry);
        }).catch((e) => {
            console.error("生成汇总分享Markdown文件异常", items, e)
        });

    } catch (error) {
        console.error('导出分享到Markdown文件异常', error, items);
    }
    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 导出分享到JSON文件（迁移自 modules/shares.js exportToJson）
   * @param {Array} items 数据
   */
  exportToJson: async(items) => {
    // 进度功能性期
    const indicator = new StatusIndicator('Shares_Export_Other');
    await indicator.setIndex('JSON');

    // 生成年份JSON
    // 分享数据根据年份分组
    const yearDataMap = API.Utils.groupedByTime(items, "shareTime", "year");
    for (const [year, yearItems] of yearDataMap) {
        console.info('正在生成年份分享JSON文件', year);
        const yearFilePath = API.Common.getModuleRoot('Shares') + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then((fileEntry) => {
            console.info('生成年份分享JSON文件完成', year, fileEntry);
        }).catch((e) => {
            console.error("生成年份分享JSON文件异常", yearItems, e)
        });
    }

    // 生成汇总JSON
    const json = JSON.stringify(items);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Shares') + '/shares.json').then((fileEntry) => {
        console.info('生成汇总分享JSON文件完成', items, fileEntry);
    }).catch((e) => {
        console.error("生成汇总分享JSON文件异常", items, e)
    });

    // 完成
    indicator.complete();
    return items;
  },
};
