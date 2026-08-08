/**
 * 收藏导出（P4，迁移自 modules/favorites.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Favorites = {
  /**
   * 导出收藏到 SPA（迁移自 modules/favorites.js exportToSpa）
   * 生成轻量索引（favorites-index.js）和按年份分片的全量数据（favorites-YYYY.js）
   * 索引字段对齐前端 FavoriteIndex 类型，全量数据保留原始结构以支撑详情展示
   * @param {Array} favorites 收藏列表
   */
  exportToSpa: async(favorites) => {
    // 进度更新器
    const indicator = new StatusIndicator('Favorites_Export_Other');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Favorites');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        const items = favorites || [];

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        // owner 信息对齐扩展端 getFavoriteOwner 逻辑（依据 type 从不同子结构取值）
        const index = items.map(fav => {
            const owner = API.Favorites.getFavoriteOwner(fav) || {};
            return {
                id: fav.id || '',
                type: fav.type || 0,
                typeLabel: API.Favorites.getType(fav.type),
                time: fav.custom_create_time || API.Utils.formatDate(fav.create_time),
                ownerUin: owner.uin || fav.custom_uin || 0,
                ownerName: owner.name || fav.custom_name || '',
                title: fav.title || '',
                abstract: fav.custom_abstract || fav.abstract || '',
                imageCount: (fav.custom_images && fav.custom_images.length) || 0,
                // 配图缩略图：最多前 4 张，本地文件优先，回退远程缩略图 URL
                thumbs: (fav.custom_images || [])
                    .slice(0, 4)
                    .map(p => p.custom_filepath || p.s_url || p.url3 || p.custom_url || p.url1 || p.b_url || '')
                    .filter(Boolean),
                originImageCount: (fav.custom_origin_images && fav.custom_origin_images.length) || 0,
                videoCount: (fav.custom_videos && fav.custom_videos.length) || 0,
                audioCount: (fav.custom_audios && fav.custom_audios.length) || 0
            };
        });
        await API.Common.writeJsonToJs('favoritesIndex', index, dataFolder + '/favorites-index.js');
        console.info('生成 SPA 收藏索引完成', { total: index.length });

        // 2. 按年分片全量数据
        // favorites 的 create_time 是 unix 秒，groupedByTime 依据 create_time 字段分组
        const yearMaps = API.Utils.groupedByTime(items, "create_time", 'year');
        for (const [year, yearItems] of yearMaps) {
            await API.Common.writeJsonToJs(
                `favorites_${year}`,
                yearItems,
                `${dataFolder}/favorites-${year}.js`
            );
            console.info('生成 SPA 收藏年份分片完成', { year, count: yearItems.length });
        }

        console.info('导出收藏到 SPA 完成', { total: items.length, years: yearMaps.size });

    } catch (error) {
        console.error('导出收藏到 SPA 异常', error, favorites);
    }

    // 完成
    indicator.complete();
    return favorites;
  },

  /**
   * 导出收藏到HTML文件（迁移自 modules/favorites.js exportToHtml）
   * @param {Array} favorites 数据
   */
  exportToHtml: async(favorites) => {
    // 进度更新器
    const indicator = new StatusIndicator('Favorites_Export_Other');
    await indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Favorites');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('favorites', favorites, moduleFolder + '/json/favorites.js');

        // 数据根据年份分组
        let yearMaps = API.Utils.groupedByTime(favorites, "create_time", 'year');
        // 基于模板生成年份说说HTML
        for (const [year, yearItems] of yearMaps) {
            // 基于模板生成所有说说HTML
            let _dataMaps = new Map();
            const monthMaps = API.Utils.groupedByTime(yearItems, "create_time", 'month');
            _dataMaps.set(year, monthMaps);
            let params = {
                dataMaps: _dataMaps,
                total: yearItems.length
            }
            await API.Common.writeHtmlofTpl('favorites', params, moduleFolder + "/" + year + ".html");
        }

        // 基于模板生成汇总说说HTML
        let params = {
            dataMaps: API.Utils.groupedByTime(favorites, "create_time", 'all'),
            total: favorites.length
        }
        await API.Common.writeHtmlofTpl('favorites', params, moduleFolder + "/index.html");
    } catch (error) {
        console.error('导出收藏到HTML异常', error, favorites);
    }

    // 更新进度信息
    indicator.complete();
    return favorites;
  },

  /**
   * 导出收藏到MD文件（迁移自 modules/favorites.js exportToMarkdown）
   * @param {Array} favorites 收藏列表
   */
  exportToMarkdown: async(favorites) => {
    // 进度更新器
    const indicator = new StatusIndicator('Favorites_Export_Other');
    await indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        // 根据年份分组，每一年生成一个MD文件
        const yearMap = API.Utils.groupedByTime(favorites, "create_time");
        for (const [year, month_maps] of yearMap) {
            const yearContents = [];
            yearContents.push("# " + year + "年");

            for (const [month, month_items] of month_maps) {
                yearContents.push("## " + month + "月 ");
                for (const favorite of month_items) {
                    yearContents.push(API.Favorites.getMarkdown(favorite));
                    yearContents.push('---');
                }
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            const yearFilePath = API.Common.getModuleRoot('Favorites') + "/" + year + ".md";
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份收藏列表完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份收藏列表失败，当前年份=', year, error);
            });
        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Favorites') + '/Favorites.md');
    } catch (error) {
        console.error('导出收藏到Markdown文件异常', error, videos);
    }

    // 完成
    indicator.complete();
    return favorites;
  },

  /**
   * 导出收藏到JSON文件（迁移自 modules/favorites.js exportToJson）
   * @param {Array} favorites 收藏列表
   */
  exportToJson: async(favorites) => {
    // 进度更新器
    const indicator = new StatusIndicator('Favorites_Export_Other');
    await indicator.setIndex(year);
    // 收藏根据年份分组
    let yearDataMap = API.Utils.groupedByTime(favorites, "create_time");
    for (let yearEntry of yearDataMap) {
        let year = yearEntry[0];
        let monthDataMap = yearEntry[1];

        let yearItems = [];
        for (let monthEntry of monthDataMap) {
            let items = monthEntry[1];
            yearItems = yearItems.concat(items);
        }

        const yearFilePath = API.Common.getModuleRoot('Favorites') + "/" + year + ".json";
        await API.Utils.writeText(JSON.stringify(yearItems), yearFilePath).then(fileEntry => {
            console.info('备份收藏列表完成，当前年份=', year, yearItems, fileEntry);
        }).catch(error => {
            console.error('备份收藏列表失败，当前年份=', year, yearItems, error);
        });
    }

    let json = JSON.stringify(favorites);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Favorites') + '/favorites.json').then(fileEntry => {
        console.info('备份收藏列表完成', favorites, fileEntry);
    }).catch(error => {
        console.error('备份收藏列表失败', favorites, error);
    });
    // 完成
    indicator.complete();
    return favorites;
  },
};
