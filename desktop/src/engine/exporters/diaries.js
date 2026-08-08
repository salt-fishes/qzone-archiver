/**
 * 日记导出（P4，迁移自 modules/diaries.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Diaries = {
  /**
   * 所有日记转换成导出文件（迁移自 modules/diaries.js exportAllListToFiles）
   * @param {Array} items 日记列表
   */
  exportAllListToFiles: async(items) => {
    // 获取用户配置
    let exportType = QZone_Config.Diaries.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Diaries.exportToHtml(items);
            break;
        case 'MarkDown':
            await API.Diaries.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Diaries.exportToJson(items);
            break;
        case 'SPA':
            await API.Diaries.exportToSpa(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
  },

  /**
   * 导出日记到 SPA（迁移自 modules/diaries.js exportToSpa）
   *
   * 生成文件结构：
   *   Diaries/data/
   *     - diaries-index.js          → window.diariesIndex   （轻量索引，首屏加载）
   *     - diaries-YYYY.js           → window.diaries_YYYY   （按年份分片全量数据）
   *
   * 索引字段：blogId, title, category, time(格式化), pubTime(unix秒),
   *           commentCount, likeCount, hasContent
   *
   * 全量数据保留扩展端原始结构（含 base64 编码的 html 内容），
   * SPA 端按需加载年份分片后 atob 解码渲染。
   *
   * @param {Array} items 日记列表
   */
  exportToSpa: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Export_Other');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Diaries');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        const index = items.map(it => {
            // 发布时间：pubtime 通常为 unix 秒（日记字段名为小写 pubtime）
            const ts = it.pubTime || it.pubtime || 0;
            const timeStr = ts ? API.Utils.formatDate(ts) : '';
            // 摘要：html 是 base64 编码的内容，无法直接提取文本；
            //        优先用 category 作为辅助描述
            const abstract = (it.category || '').toString();
            // 是否有正文内容（base64）
            const hasContent = !!(it.custom_html || it.html);
            // 评论数
            const commentCount = (it.comments && it.comments.length) || it.replynum || 0;
            // 点赞数
            const likeCount = (it.likes && it.likes.length) || (it.like && it.like.total) || 0;
            return {
                blogId: it.blogid || it.blogId || '',
                title: it.custom_title || it.title || '',
                category: it.category || '',
                desc: abstract,
                time: timeStr,
                pubTime: ts,
                commentCount,
                likeCount,
                hasContent
            };
        });
        await API.Common.writeJsonToJs('diariesIndex', index, dataFolder + '/diaries-index.js');
        console.info('生成 SPA 日记索引完成', { total: index.length });

        // 2. 按年分片全量数据（pubtime 为 unix 秒，groupedByTime 会自动 *1000）
        const yearMaps = API.Utils.groupedByTime(items, ['pubTime', 'pubtime'], 'year');
        for (const [year, yearItems] of yearMaps) {
            await API.Common.writeJsonToJs(
                `diaries_${year}`,
                yearItems,
                `${dataFolder}/diaries-${year}.js`
            );
            console.info('生成 SPA 日记年份分片完成', { year, count: yearItems.length });
        }

        console.info('导出日记到 SPA 完成', { total: items.length, years: yearMaps.size });

    } catch (error) {
        console.error('导出日记到 SPA 异常', error, items);
    }

    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 导出日记到HTML文件（迁移自 modules/diaries.js exportToHtml）
   * @param {Array} items 日志列表
   */
  exportToHtml: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Export_Other');
    await indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Diaries');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('diaries', items, moduleFolder + '/json/diaries.js');


        // 基于模板生成HTML
        await API.Common.writeHtmlofTpl('diaries', undefined, moduleFolder + "/index.html");

        // 生成日记详情HTML
        await API.Common.writeHtmlofTpl('diaryinfo', undefined, moduleFolder + "/info.html");

        // 每篇日记生成单独的HTML
        for (let i = 0; i < items.length; i++) {
            const blog = items[i];
            let orderNum = API.Utils.prefixNumber(i + 1, items.length.toString().length);
            await API.Common.writeHtmlofTpl('diaryinfo_static', { blog: blog }, moduleFolder + "/{0}_{1}.html".format(orderNum, API.Utils.filenameValidate(blog.title)));
        }

    } catch (error) {
        console.error('导出日记到HTML异常', error, boardInfo);
    }

    // 更新完成信息
    indicator.complete();
    return items;
  },

  /**
   * 导出日记到MarkDown文件（迁移自 modules/diaries.js exportToMarkdown）
   * @param {Array} items 日记列表
   */
  exportToMarkdown: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Diaries_Export');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        // 获取日记MD内容
        let content = await API.Diaries.getMarkdown(item);
        let title = item.title;
        let date = new Date(item.pubtime * 1000).format('yyyyMMddhhmmss');
        let orderNum = API.Utils.prefixNumber(index + 1, QZone.Diaries.total.toString().length);
        let filename = API.Utils.filenameValidate(orderNum + "_" + date + "_【" + title + "】");
        // 文件夹路径
        let categoryFolder = API.Common.getModuleRoot('Diaries') + "/" + item.category;
        // 创建文件夹
        await API.Utils.createFolder(categoryFolder);
        // 日记文件路径
        let filepath = categoryFolder + '/' + filename + ".md";
        await API.Utils.writeText(content, filepath).then(() => {
            // 更新成功信息
            indicator.addSuccess(item);
        }).catch((e) => {
            indicator.addFailed(item);
            console.error('写入日记文件异常', item, e);
        })
    }
    // 更新完成信息
    indicator.complete();
    return items;
  },

  /**
   * 导出日记到JSON文件（迁移自 modules/diaries.js exportToJson）
   * @param {Array} items 日记列表
   */
  exportToJson: async(items) => {
    const indicator = new StatusIndicator('Diaries_Export_Other');
    await indicator.setIndex('JSON');
    let json = JSON.stringify(items);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Diaries') + '/diaries.json');
    indicator.complete();
    return items;
  },
};
