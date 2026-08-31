/**
 * 视频导出（P4，迁移自 modules/videos.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Videos = {
  /**
   * 导出视频到 SPA（迁移自 modules/videos.js exportToSpa）
   *
   * 生成文件结构：
   *   Videos/data/
   *     - videos-index.js          → window.videosIndex   （轻量索引，首屏加载）
   *     - videos-YYYY.js           → window.videos_YYYY   （按年份分片全量数据）
   *
   * 索引字段：vid, title, desc(摘要), time(格式化时间), uploadTime(unix秒),
   *           commentCount, likeCount, hasLocalVideo, hasCover, coverUrl, videoSrc
   *
   * 全量数据保留扩展端原始结构，SPA 端按需加载年份分片后渲染详情。
   *
   * @param {Array} videos 视频列表
   */
  exportToSpa: async(videos) => {
    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Videos');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        const index = videos.map(v => {
            // 上传时间：uploadTime 通常为 unix 秒
            const ts = v.uploadTime || v.uploadtime || 0;
            const timeStr = ts ? API.Utils.formatDate(ts) : '';
            // 摘要：desc 可能为 HTML，去标签后截断 120 字
            const descRaw = v.desc || v.name || '';
            const descText = String(descRaw)
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            const abstract = descText.length > 120 ? descText.substring(0, 120) + '…' : descText;
            // 是否有本地视频文件（外部视频 play_url 非空时不下载）
            const hasLocalVideo = !!v.custom_filepath && !v.play_url;
            // 是否有封面图
            const hasCover = !!(v.custom_pre_filepath || v.custom_pre_url || v.pre || v.preview_img);
            return {
                vid: v.vid || v.video_id || '',
                title: v.title || '',
                desc: abstract,
                time: timeStr,
                uploadTime: ts,
                commentCount: (v.comments && v.comments.length) || v.cmtTotal || 0,
                likeCount: (v.likes && v.likes.length) || (v.like && v.like.total) || 0,
                hasLocalVideo,
                hasCover,
                // 封面图地址：本地优先（列表缩略图用），回退远程 URL
                coverUrl: v.custom_pre_filepath || v.custom_pre_url || v.pre || v.preview_img || '',
                // 本地视频文件路径（相对 Videos/ 模块根），用于列表黑封面修复
                videoSrc: v.custom_filepath || ''
            };
        });
        await API.Common.writeJsonToJs('videosIndex', index, dataFolder + '/videos-index.js');
        console.info('生成 SPA 视频索引完成', { total: index.length });

        // 2. 按年分片全量数据（uploadTime 为 unix 秒，groupedByTime 会自动 *1000）
        const yearMaps = API.Utils.groupedByTime(videos, ['uploadTime', 'uploadtime'], 'year');
        for (const [year, yearItems] of yearMaps) {
            await API.Common.writeJsonToJs(
                `videos_${year}`,
                yearItems,
                `${dataFolder}/videos-${year}.js`
            );
            console.info('生成 SPA 视频年份分片完成', { year, count: yearItems.length });
        }

        console.info('导出视频到 SPA 完成', { total: videos.length, years: yearMaps.size });

    } catch (error) {
        console.error('导出视频到 SPA 异常', error, videos);
    }

    // 完成
    indicator.complete();
    return videos;
  },

  /**
   * 导出视频到HTML文件（迁移自 modules/videos.js exportToHtml）
   * @param {Array} videos 视频列表
   */
  exportToHtml: async(videos) => {
    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    await indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Videos');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('videos', videos, moduleFolder + '/json/videos.js');

        // 生成视频汇总列表HTML
        await API.Common.writeHtmlofTpl('videos', { videos: videos, targetYear: 'ALL' }, moduleFolder + "/index.html");

        // 根据年份分组
        const year_maps = API.Utils.groupedByTime(videos, 'uploadTime', 'year');
        for (const [year, year_items] of year_maps) {
            // 生成视频年份列表HTML
            await API.Common.writeHtmlofTpl('videos', { videos: year_items, targetYear: year }, moduleFolder + "/" + year + ".html");
        }

    } catch (error) {
        console.error('导出视频到HTML异常', error, videos);
    }

    // 更新完成信息
    indicator.complete();
    return videos;
  },

  /**
   * 导出视频到MD文件（迁移自 modules/videos.js exportToMarkdown）
   * @param {Array} videos 视频列表
   */
  exportToMarkdown: async(videos) => {

    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    await indicator.setIndex('Markdown');

    try {
        // 汇总内容
        const allYearContents = [];
        const year_month_maps = API.Utils.groupedByTime(videos, 'uploadTime', 'all');
        for (const [year, month_maps] of year_month_maps) {
            // 年份内容
            const yearContents = [];
            yearContents.push('# {0}年'.format(year));
            for (const [month, month_videos] of month_maps) {
                // 标题
                const month_title = '## {0}月'.format(month);
                // 月份内容
                const month_content = API.Videos.getMarkdowns(month_videos);

                // 年份内容
                yearContents.push(month_title);
                yearContents.push(month_content);
                // 月份分割线
                yearContents.push('---');
            }

            // 年份内容
            const yearContent = yearContents.join('\r\n');

            // 汇总年份内容
            allYearContents.push(yearContent);

            // 生成年份文件
            const yearFilePath = API.Common.getModuleRoot('Videos') + "/" + year + '.md';
            await API.Utils.writeText(yearContent, yearFilePath).then(fileEntry => {
                console.info('备份视频列表完成，当前年份=', year, fileEntry);
            }).catch(error => {
                console.error('备份视频列表失败，当前年份=', year, error);
            });

        }

        // 生成汇总文件
        await API.Utils.writeText(allYearContents.join('\r\n'), API.Common.getModuleRoot('Videos') + '/Videos.md');

    } catch (error) {
        console.error('导出视频到Markdown文件异常', error, videos);
    }

    // 完成
    indicator.complete();
    return videos;
  },

  /**
   * 导出视频到JSON文件（迁移自 modules/videos.js exportToJson）
   * @param {Array} videos 视频列表
   */
  exportToJson: async(videos) => {
    // 状态更新器
    const indicator = new StatusIndicator('Videos_Export');
    await indicator.setIndex('JSON');

    let json = JSON.stringify(videos);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Videos') + '/videos.json').then((file) => {
        console.info('导出视频到JSON成功', file);
    }).catch((e) => {
        console.error('导出视频到JSON异常', e);
    });

    // 完成
    indicator.complete();
    return videos;
  },

  /**
   * 导出视频（迁移自 modules/videos.js exportAllToFiles）
   * @param {Array} videos 视频列表
   */
  exportAllToFiles: async(videos) => {
    // 获取用户配置
    let exportType = QZone_Config.Videos.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Videos.exportToHtml(videos);
            break;
        case 'JSON':
            await API.Videos.exportToJson(videos);
            break;
        case 'MarkDown':
            await API.Videos.exportToMarkdown(videos);
            break;
        case 'Link':
            await API.Videos.exportToLink(videos);
            break;
        case 'SPA':
            await API.Videos.exportToSpa(videos);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
  },

  /**
   * 获取视频的Markdown内容（迁移自 modules/videos.js getMarkdowns）
   */
  getMarkdowns: (videos) => {
    const contents = [];
    for (let i = 0; i < videos.length; i++) {
        const video = videos[i];

        video.desc = video.desc || video.name || API.Utils.formatDate(video.uploadTime);

        // 视频描述
        contents.push('> ' + API.Common.formatContent(video.desc, 'MD', false, false, false, false, true));
        contents.push('\r\n');

        // 视频
        contents.push('<video height="400" src="{0}" controls="controls" ></video>'.format(video.custom_filepath || video.custom_url || video.url));
        contents.push('\r\n');

        // 视频评论 TODO 私密评论处理
        video.comments = video.comments || [];
        contents.push('> 评论({0})'.format(video.cmtTotal || video.comments.length));
        contents.push('\r\n');

        for (const comment of video.comments) {
            // 评论人
            const poster_name = API.Common.formatContent(comment.poster.name, 'MD', false, false, false, false, true);
            const poster_display = API.Common.getUserLink(comment.poster.id, poster_name, "MD");

            // 评论内容
            let content = API.Common.formatContent(comment.content, 'MD', false, false, false, false, true);
            contents.push("* {0}：{1}".format(poster_display, content));

            // 评论包含图片
            if (comment.pictotal > 0) {
                let comment_images = comment.pic || [];
                for (const image of comment_images) {
                    let custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
                    custom_url = API.Common.isQzoneUrl() ? (image.custom_url || custom_url) : '../' + image.custom_filepath;
                    // 添加评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
            // 评论的回复
            let replies = comment.replies || [];
            for (const repItem of replies) {

                // 回复人
                let repName = API.Common.formatContent(repItem.poster.name, 'MD', false, false, false, false, true);
                const rep_poster_display = API.Common.getUserLink(comment.poster.id, repName, "MD");

                // 回复内容
                let content = API.Common.formatContent(repItem.content, 'MD', false, false, false, false, true);
                contents.push("\t* {0}：{1}".format(rep_poster_display, content));

                const repImgs = repItem.pic || [];
                for (const repImg of repImgs) {
                    // 回复包含图片
                    let custom_url = repImg.o_url || repImg.hd_url || repImg.b_url || repImg.s_url || repImg.url;
                    custom_url = API.Common.isQzoneUrl() ? (repImg.custom_url || custom_url) : '../' + repImg.custom_filepath;
                    // 添加回复评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
        }

        // 分割线
        contents.push('---');
    }
    return contents.join('\r\n');
  },

  /**
   * 导出视频下载链接到下载链接（迁移自 modules/videos.js exportToLink）
   * @param {Array} items 视频列表
   */
  exportToLink: async(videos) => {
    // 进度更新器
    const indicator = new StatusIndicator('Videos_Export');
    await indicator.setIndex('下载链接');

    let videoUrls = [];
    for (const video of videos) {
        videoUrls.push(API.Utils.makeDownloadUrl(video.url, true));
    }
    let filepath = API.Common.getModuleRoot('Videos') + '/videos.downlist';
    await API.Utils.writeText(videoUrls.join('\r\n'), filepath).then((file) => {
        console.info('导出视频下载链接成功', file);
    }).catch((e) => {
        console.error('导出视频下载链接异常', e);
    });

    // 完成
    indicator.complete();
    return videos;
  },
};
