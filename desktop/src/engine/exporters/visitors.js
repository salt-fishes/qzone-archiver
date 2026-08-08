/**
 * 访客导出（P4，迁移自 modules/visitors.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Visitors = {
  /**
   * 所有访客转换成导出文件（迁移自 modules/visitors.js exportAllListToFiles）
   * @param {Array} visitorInfo 访客列表
   */
  exportAllListToFiles: async(visitorInfo) => {
    // 获取用户配置
    const exportType = QZone_Config.Visitors.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Visitors.exportToHtml(visitorInfo);
            break;
        case 'MarkDown':
            await API.Visitors.exportToMarkdown(visitorInfo);
            break;
        case 'JSON':
            await API.Visitors.exportToJson(visitorInfo);
            break;
        case 'SPA':
            await API.Visitors.exportToSpa(visitorInfo);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
  },

  /**
   * 导出访客到 SPA（迁移自 modules/visitors.js exportToSpa）
   * 数据策略：
   *   1. 轻量索引 visitorsIndex（uin/姓名/时间/来源/互动数）—— SPA 启动时立即加载
   *   2. 按年分片全量数据 visitors_<year> —— 用户滚动到某年时按需 <script> 加载
   *
   * 注意：visitorInfo 是 { items: [...], total, totalPage } 对象，
   *   与 messages 数组不同，这里取 items 数组进行分组。
   *   time 字段是 unix 秒，需要格式化为字符串供 SPA 端展示。
   */
  exportToSpa: async(visitorInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Visitors_Export_Other');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Visitors');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        const items = visitorInfo.items || [];

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        const index = items.map(v => ({
            uin: v.uin,
            name: v.name || '',
            time: API.Utils.formatDate(v.time),
            ts: v.time || 0,
            src: v.src || 0,
            platformSrc: v.platform_src || 0,
            isHideVisit: v.is_hide_visit === 1,
            yellow: v.yellow || -1,
            supervip: v.supervip || 0,
            uinsCount: (v.uins && v.uins.length) || 0,
            shuoshuoCount: (v.shuoshuoes && v.shuoshuoes.length) || 0,
            blogCount: (v.blogs && v.blogs.length) || 0,
            photoCount: (v.photoes && v.photoes.length) || 0,
            shareCount: (v.shares && v.shares.length) || 0
        }));
        await API.Common.writeJsonToJs('visitorsIndex', index, dataFolder + '/visitors-index.js');
        console.info('生成 SPA 访客索引完成', { total: index.length });

        // 2. 按年分片全量数据
        // visitorInfo.items 的 time 是 unix 秒，groupedByTime 需要 time 字段
        const yearMaps = API.Utils.groupedByTime(items, "time", 'year');
        for (const [year, yearItems] of yearMaps) {
            // 变量名形如 visitors_2026（与 SPA 端 data-loader 约定一致）
            await API.Common.writeJsonToJs(
                `visitors_${year}`,
                yearItems,
                `${dataFolder}/visitors-${year}.js`
            );
            console.info('生成 SPA 访客年份分片完成', { year, count: yearItems.length });
        }

        console.info('导出访客到 SPA 完成', { total: items.length, years: yearMaps.size });

    } catch (error) {
        console.error('导出访客到 SPA 异常', error, visitorInfo);
    }

    // 完成
    indicator.complete();
    return visitorInfo;
  },

  /**
   * 导出访客到HTML文件（迁移自 modules/visitors.js exportToHtml）
   * @param {Array} visitorInfo 数据
   */
  exportToHtml: async(visitorInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Visitors_Export_Other');
    await indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Visitors');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Utils.createFolder(moduleFolder + '/json');
        await API.Common.writeJsonToJs('visitorInfo', visitorInfo, moduleFolder + '/json/visitors.js');

        // 访客数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(visitorInfo.items, "time", 'year');
        // 基于模板生成年份访客HTML
        for (const [year, yearItems] of yearMaps) {
            let params = {
                visitors: yearItems,
                total: yearItems.length
            }
            await API.Common.writeHtmlofTpl('visitors', params, moduleFolder + "/" + year + ".html");
        }

        // 基于模板生成汇总访客HTML
        let params = {
            visitors: visitorInfo.items,
            total: visitorInfo.total
        }
        await API.Common.writeHtmlofTpl('visitors', params, moduleFolder + "/index.html");

    } catch (error) {
        console.error('导出访客到HTML异常', error, visitorInfo);
    }

    // 完成
    indicator.complete();
    return visitorInfo;
  },

  /**
   * 导出访客到Markdown文件（迁移自 modules/visitors.js exportToMarkdown）
   * @param {Array} visitorInfo 数据
   */
  exportToMarkdown: async(visitorInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Visitors_Export_Other');
    await indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 访客数据根据年份分组
        const year_month_maps = API.Utils.groupedByTime(visitorInfo.items, "time");
        for (const [year, month_maps] of year_month_maps) {
            const yearContents = [];
            yearContents.push("# " + year + "年");
            for (const [month, items] of month_maps) {
                yearContents.push("## " + month + "月");
                for (const item of items) {
                    yearContents.push(API.Visitors.getMarkdown(item));
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = API.Common.getModuleRoot('Visitors') + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份访客列表到Markdown完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份访客列表到Markdown异常，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Visitors') + '/Visitors.md').then((fileEntry) => {
            console.info('生成汇总访客Markdown文件完成', visitorInfo, fileEntry);
        }).catch((e) => {
            console.error("生成汇总访客Markdown文件异常", visitorInfo, e)
        });

    } catch (error) {
        console.error('导出访客到Markdown文件异常', error, visitorInfo);
    }
    // 完成
    indicator.complete();
    return visitorInfo;
  },

  /**
   * 导出访客到JSON文件（迁移自 modules/visitors.js exportToJson）
   * @param {Array} visitorInfo 数据
   */
  exportToJson: async(visitorInfo) => {
    // 进度功能性期
    const indicator = new StatusIndicator('Visitors_Export_Other');
    await indicator.setIndex('JSON');

    // 生成年份JSON
    // 访客数据根据年份分组
    const yearDataMap = API.Utils.groupedByTime(visitorInfo, "time", "year");
    for (const [year, yearItems] of yearDataMap) {
        console.info('正在生成年份访客JSON文件', year);
        const yearFilePath = API.Common.getModuleRoot('Visitors') + "/" + year + ".json";
        const yearInfo = {
            total: yearItems.length,
            items: yearItems
        }
        await API.Utils.writeText(JSON.stringify(yearInfo), yearFilePath).then((fileEntry) => {
            console.info('生成年份访客JSON文件完成', year, fileEntry);
        }).catch((e) => {
            console.error("生成年份访客JSON文件异常", yearInfo, e)
        });
    }

    // 生成汇总JSON
    const json = JSON.stringify(visitorInfo);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Visitors') + '/visitors.json').then((fileEntry) => {
        console.info('生成汇总访客JSON文件完成', visitorInfo, fileEntry);
    }).catch((e) => {
        console.error("生成汇总访客JSON文件异常", visitorInfo, e)
    });

    // 完成
    indicator.complete();
    return visitorInfo;
  },
};
