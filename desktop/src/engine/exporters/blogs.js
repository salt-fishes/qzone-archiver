/**
 * 日志导出（P4，迁移自 modules/blogs.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Blogs = {
  /**
   * 所有日志转换成导出文件（迁移自 modules/blogs.js exportAllListToFiles）
   * @param {Array} items 日志列表
   */
  exportAllListToFiles: async(items) => {
    // 获取用户配置
    let exportType = QZone_Config.Blogs.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Blogs.exportToHtml(items);
            break;
        case 'PDF':
            await API.Blogs.exportToPDF(items);
            break;
        case 'MarkDown':
            await API.Blogs.exportToMarkdown(items);
            break;
        case 'JSON':
            await API.Blogs.exportToJson(items);
            break;
        case 'SPA':
            await API.Blogs.exportToSpa(items);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
  },

  /**
   * 导出日志到 SPA（迁移自 modules/blogs.js exportToSpa）
   *
   * 生成文件结构：
   *   Blogs/data/
   *     - blogs-index.js            → window.blogsIndex     （轻量索引，首屏加载）
   *     - blogs-YYYY.js             → window.blogs_YYYY     （按年份分片全量数据）
   *
   * 索引字段：blogId, title, category, time(格式化), pubTime(unix秒),
   *           commentCount, likeCount, hasContent, hasImages
   *
   * 全量数据保留扩展端原始结构（含 base64 编码的 html 内容），
   * SPA 端按需加载年份分片后 atob 解码渲染。
   *
   * @param {Array} items 日志列表
   */
  exportToSpa: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Blogs_Export_Other');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Blogs');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        const index = items.map(it => {
            // 发布时间：pubTime 通常为 unix 秒
            const ts = it.pubTime || it.pubtime || 0;
            const timeStr = ts ? API.Utils.formatDate(ts) : '';
            // 摘要：html 是 base64 编码的内容，无法直接提取文本；
            //        优先用 effect / category 作为辅助描述
            const abstract = (it.effect || it.category || '').toString();
            // 是否有正文内容（base64）
            const hasContent = !!(it.custom_html || it.html);
            // 是否有配图
            const hasImages = !!(it.img && it.img.length);
            // 评论数
            const commentCount = (it.comments && it.comments.length) || it.replynum || 0;
            // 点赞数
            const likeCount = (it.likes && it.likes.length) || (it.like && it.like.total) || 0;
            return {
                blogId: it.blogId || it.blogid || '',
                title: it.custom_title || it.title || '',
                category: it.category || '',
                desc: abstract,
                time: timeStr,
                pubTime: ts,
                commentCount,
                likeCount,
                hasContent,
                hasImages
            };
        });
        await API.Common.writeJsonToJs('blogsIndex', index, dataFolder + '/blogs-index.js');
        console.info('生成 SPA 日志索引完成', { total: index.length });

        // 2. 按年分片全量数据（pubTime 为 unix 秒，groupedByTime 会自动 *1000）
        const yearMaps = API.Utils.groupedByTime(items, ['pubTime', 'pubtime'], 'year');
        for (const [year, yearItems] of yearMaps) {
            await API.Common.writeJsonToJs(
                `blogs_${year}`,
                yearItems,
                `${dataFolder}/blogs-${year}.js`
            );
            console.info('生成 SPA 日志年份分片完成', { year, count: yearItems.length });
        }

        console.info('导出日志到 SPA 完成', { total: items.length, years: yearMaps.size });

    } catch (error) {
        console.error('导出日志到 SPA 异常', error, items);
    }

    // 完成
    indicator.complete();
    return items;
  },

  /**
   * 导出日志到HTML文件（迁移自 modules/blogs.js exportToHtml）
   * @param {Array} items 日志列表
   */
  exportToHtml: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Blogs_Export_Other');
    await indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Blogs');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('blogs', items, moduleFolder + '/json/blogs.js');

        // 基于模板生成HTML
        await API.Common.writeHtmlofTpl('blogs', undefined, moduleFolder + "/index.html");

        // 生成日志详情HTML
        await API.Common.writeHtmlofTpl('bloginfo', undefined, moduleFolder + "/info.html");

        // 每篇日志生成单独的HTML
        for (let i = 0; i < items.length; i++) {
            const blog = items[i];
            const orderNum = API.Utils.prefixNumber(i + 1, items.length.toString().length);
            await API.Common.writeHtmlofTpl('bloginfo_static', { blog: blog }, moduleFolder + "/{0}_{1}.html".format(orderNum, API.Utils.filenameValidate(blog.title)));
        }

    } catch (error) {
        console.error('导出日记到HTML异常', error);
    }

    // 更新进度信息
    indicator.complete();

    return items;
  },

  /**
   * 导出日志到MarkDown文件（迁移自 modules/blogs.js exportToMarkdown）
   * @param {Array} items 日志列表
   */
  exportToMarkdown: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Blogs_Export');
    indicator.setTotal(items.length);

    for (let index = 0; index < items.length; index++) {
        const item = items[index];
        // 获取日志MD内容
        const content = await API.Blogs.getMarkdown(item);
        // 写入内容到文件
        // 标签
        const labels = API.Blogs.getBlogLabel(item);
        // const date = new Date(item.pubtime * 1000).format('yyyyMMddhhmmss');
        const date = (item.pubTime || new Date(item.pubtime * 1000).format('yyyyMMddhhmmss')).replace(' ', '');
        // 序号
        const orderNum = API.Utils.prefixNumber(index + 1, QZone.Blogs.total.toString().length);
        // 文件名
        let filename = API.Utils.filenameValidate(orderNum + "_" + date + "_【" + item.title + "】");
        if (labels && labels.length > 0) {
            filename = API.Utils.filenameValidate(orderNum + "_" + date + "_" + labels.join("_") + "【" + item.title + "】");
        }
        // 文件夹路径
        const categoryFolder = API.Common.getModuleRoot('Blogs') + "/" + item.category;
        // 创建文件夹
        await API.Utils.createFolder(categoryFolder);
        // 日志文件路径
        const filepath = categoryFolder + '/' + filename + ".md";
        await API.Utils.writeText(content, filepath).then(() => {
            // 更新成功信息
            indicator.addSuccess(item);
        }).catch((e) => {
            indicator.addFailed(item);
            console.error('写入日志文件异常', item, e);
        })
    }
    // 更新完成信息
    indicator.complete();
    return items;
  },

  /**
   * 导出日志到JSON文件（迁移自 modules/blogs.js exportToJson）
   * @param {Array} items 日志列表
   */
  exportToJson: async(items) => {
    let indicator = new StatusIndicator('Blogs_Export_Other');
    await indicator.setIndex('JSON');
    let json = JSON.stringify(items);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Blogs') + '/blogs.json');
    indicator.complete();
    return items;
  },

  /**
   * 导出日志到HTML文件（迁移自 modules/blogs.js exportToPDF）
   * @param {Array} items 日志列表
   */
  exportToPDF: async(items) => {
    // 进度更新器
    const indicator = new StatusIndicator('Blogs_Export_Other');
    await indicator.setIndex('PDF');

    // 每篇日志生成单独的HTML
    for (let i = 0; i < items.length; i++) {
        const blog = items[i];
        const orderNum = API.Utils.prefixNumber(i + 1, items.length.toString().length);
        const doc = new jsPDF();
        doc.setFont('QZoneExport');
        const html = API.Utils.base64ToUtf8(blog.html);
        doc.html($(html)[0], {
            callback: function(doc) {
                doc.save("{0}_{1}.pdf".format(orderNum, API.Utils.filenameValidate(blog.title)));
            },
            x: 10,
            y: 10
        });
    }

    indicator.addSuccess(items);
    // 更新完成信息
    indicator.complete();
    return items;
  },

  /**
   * 获取单篇日志的MD内容（迁移自 modules/blogs.js getMarkdown）
   * @param {object} item 日志信息
   */
  getMarkdown: async(item) => {
    const contents = [];
    // 标题
    contents.push("# " + item.title);
    // 日期
    contents.push("> " + API.Utils.formatDate(item.pubTime || item.pubtime));
    contents.push('\r\n');
    // 内容
    // 根据HTML获取MD内容
    let markdown = QZone.Common.MD.turndown(API.Utils.base64ToUtf8(item.custom_html));
    contents.push(markdown.replace(/\n/g, "\r\n"));

    // 评论
    contents.push("> 评论({0})".format(item.replynum));
    contents.push('\r\n');

    let comments = item.comments || [];
    for (const comment of comments) {
        // 评论人
        let poster = comment.poster.name || QZone.Common.Target.nickname || '';
        poster = API.Common.formatContent(poster, 'MD', false, false, false, false, true);
        poster = API.Common.getUserLink(comment.poster.id, poster, 'MD', true);

        // 评论内容
        let content = API.Common.formatContent(comment.content, 'MD', false, false, false, false, true);
        // 替换换行符
        content = content.replace(/\n/g, "");

        // 添加评论内容
        contents.push('* {0}：{1}'.format(poster, content));

        // 评论的回复
        const replies = comment.replies || [];
        for (const rep of replies) {
            // 回复人
            let repPoster = rep.poster.name || QZone.Common.Target.nickname || '';
            repPoster = API.Common.formatContent(repPoster, 'MD', false, false, false, false, true);
            repPoster = API.Common.getUserLink(rep.poster.id, repPoster, 'MD', true);

            // 回复内容
            let repContent = API.Common.formatContent(rep.content, 'MD', false, false, false, false, true);
            // 替换换行符
            repContent = repContent.replace(/\n/g, "");

            // 添加评论内容
            contents.push('\t* {0}：{1}'.format(repPoster, repContent));
        }
    }
    return contents.join('\r\n');
  },
};
