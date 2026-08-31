/**
 * 相册导出（P4，迁移自 modules/photos.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Photos = {
  /**
   * 导出相册与相片（迁移自 modules/photos.js exportAllListToFiles）
   * @param {Array} albums 相册列表
   */
  exportAllListToFiles: async(albums) => {
    // 导出相册
    await API.Photos.exportAlbumsToFiles(albums);
    // 导出相片
    await API.Photos.exportPhotosToFiles(albums);
  },

  /**
   * 导出相册与相片到 SPA（迁移自 modules/photos.js exportToSpa）
   *
   * 生成文件结构：
   *   Photos/data/
   *     - photos-index.js            → window.photosIndex     （相册级轻量索引，首屏加载）
   *     - photos-album-<id>.js       → window.photos_album_<id> （单个相册的相片全量数据，按需加载）
   *
   * 由于相片数据量巨大（单相册可能成千上万张），采用按相册分片而非按年份分片。
   * 索引保留相册元信息 + 相片数量 + 封面图，不含相片列表。
   *
   * 索引字段：albumId, name, desc, className, classid, createTime, modifyTime,
   *           photoCount, commentCount, likeCount, hasCover, coverUrl
   *
   * 全量数据保留扩展端原始相册结构（含 photoList, comments, likes, custom_visitor），
   * SPA 端点击相册后按需加载对应分片。
   *
   * @param {Array} albums 相册列表
   */
  exportToSpa: async(albums) => {
    // 进度更新器
    const indicator = new StatusIndicator('Photos_Export');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Photos');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        // 1. 生成相册级轻量索引（不含 photoList，避免索引过大）
        const index = albums.map(album => {
            // 创建时间：createtime 通常为 unix 秒
            const createTs = album.createtime || 0;
            const createTimeStr = createTs ? API.Utils.formatDate(createTs) : '';
            const modifyTs = album.modifytime || 0;
            const modifyTimeStr = modifyTs ? API.Utils.formatDate(modifyTs) : '';
            // 相片数量
            const photoCount = (album.photoList && album.photoList.length) || album.total || 0;
            // 评论数
            const commentCount = (album.comments && album.comments.length) || 0;
            // 点赞数
            const likeCount = (album.likes && album.likes.length) || (album.like && album.like.total) || 0;
            // 是否有封面图（custom_filepath 通常是相册预览图）
            const hasCover = !!(album.custom_filepath || album.custom_pre_filepath);
            return {
                albumId: album.id || album.albumId || '',
                name: album.name || '',
                desc: album.desc || '',
                className: album.className || '',
                classid: album.classid || 0,
                createTime: createTimeStr,
                createTimestamp: createTs,
                modifyTime: modifyTimeStr,
                modifyTimestamp: modifyTs,
                photoCount,
                commentCount,
                likeCount,
                hasCover,
                coverUrl: album.custom_filepath || album.custom_pre_filepath || ''
            };
        });
        await API.Common.writeJsonToJs('photosIndex', index, dataFolder + '/photos-index.js');
        console.info('生成 SPA 相册索引完成', { total: index.length, photos: index.reduce((s, a) => s + a.photoCount, 0) });

        // 2. 按相册分片全量数据（每个相册一个文件，含 photoList）
        for (const album of albums) {
            const albumId = album.id || album.albumId;
            if (!albumId) {
                console.warn('相册缺少 ID，跳过', album);
                continue;
            }
            await API.Common.writeJsonToJs(
                `photos_album_${albumId}`,
                album,
                `${dataFolder}/photos-album-${albumId}.js`
            );
        }
        console.info('生成 SPA 相册分片完成', { albums: albums.length });

        console.info('导出相册到 SPA 完成', { albums: albums.length });

    } catch (error) {
        console.error('导出相册到 SPA 异常', error, albums);
    }

    // 完成
    indicator.complete();
    return albums;
  },

  // ==================== P2-4 批次3b：以下方法逐字迁自 modules/photos.js（导出侧） ====================

  /**
   * 导出相册（迁移自 modules/photos.js exportAlbumsToFiles）
   * @param {Array} albums 相册列表
   */
  exportAlbumsToFiles: async(albums) => {
    // 获取用户配置
    let exportType = QZone_Config.Photos.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Photos.exportAlbumsToHtml(albums);
            break;
        case 'MarkDown':
            await API.Photos.exportAlbumsToMarkdown(albums);
            break;
        case 'JSON':
            await API.Photos.exportAlbumsToJson(albums);
            break;
        case 'SPA':
            // SPA 模式下相册索引在 exportPhotosToFiles 的 SPA 分支中一起生成
            // 这里不重复处理
            break;
        default:
            break;
    }
  },

  /**
   * 导出相册到HTML文件（迁移自 modules/photos.js exportAlbumsToHtml）
   * @param {Array} albums 相册列表
   */
  exportAlbumsToHtml: async(albums) => {
    // 进度器
    const indicator = new StatusIndicator('Photos_Export');
    await indicator.setIndex('HTML')
    try {
        // 根据类别分组
        const albumsMapping = API.Utils.groupedByField(albums, 'className');

        console.info('生成相册首页HTML文件开始', albumsMapping);
        // 基于模板生成相册首页HTML
        let params = {
            albumsMapping: albumsMapping
        }
        let fileEntry = await API.Common.writeHtmlofTpl('albums', params, API.Common.getModuleRoot('Photos') + "/index.html");
        console.info('生成汇总HTML文件结束', fileEntry, albumsMapping);
    } catch (error) {
        console.error('导出相册到HTML异常', error, albums);
    }
    indicator.complete();
    return albums;
  },

  /**
   * 导出相册到MD文件（迁移自 modules/photos.js exportAlbumsToMarkdown）
   * @param {Array} albums 相册列表
   */
  exportAlbumsToMarkdown: async(albums) => {
    // 进度器
    const indicator = new StatusIndicator('Photos_Export');
    await indicator.setIndex('Markdown');

    // 根据类别分组
    const albumsMapping = API.Utils.groupedByField(albums, 'className');
    // 遍历分组
    for (const [className, items] of albumsMapping) {
        let contents = [];
        contents.push('### {0}'.format(className));

        // 获取相册的Markdown内容
        contents.push(API.Photos.getAlbumsMarkdown(items));

        // 创建文件夹
        let categoryName = API.Utils.filenameValidate(className);
        let folderName = API.Common.getModuleRoot('Photos') + '/' + categoryName;
        await API.Utils.createFolder(folderName);

        // 写入Markdown文件
        await API.Utils.writeText(contents.join('\r\n'), folderName + '/' + categoryName + ".md").then((file) => {
            // 更新成功信息
            console.info('导出相册到Markdown文件完成', file, items);
        }).catch((e) => {
            console.error('写入相册MD文件异常', items, e);
        })
    }

    // 完成
    indicator.complete();
    return albums;
  },

  /**
   * 获取相册的Markdown内容（迁移自 modules/photos.js getAlbumsMarkdown）
   * @param {Array} albums 相册列表
   */
  getAlbumsMarkdown: (albums) => {
    const contents = [];
    for (const album of albums) {

        // 相册名称与地址
        const albumName = album.name;
        const albumUrl = API.Photos.getAlbumUrl(QZone.Common.Target.uin, album.id);
        contents.push('> ' + API.Utils.getLink(albumUrl, albumName, "MD"));
        contents.push('\r\n');

        // 相册预览图
        let pre = API.Common.isQzoneUrl() ? (album.url || API.Photos.getPhotoPreUrl(album.pre)) : '../' + album.custom_filepath;
        contents.push('>[![{0}]({1})](https://user.qzone.qq.com/{2}/photo/{3}) '.format(albumName, pre, QZone.Common.Target.uin, album.id));
        contents.push('\r\n');
        contents.push('>{0} '.format(album.desc || albumName));
        contents.push('\r\n');

        // 评论
        album.comments = album.comments || [];
        contents.push('> 评论({0})'.format(album.comments.length));
        contents.push('\r\n');

        for (const comment of album.comments) {
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
        contents.push('---');
    }
    return contents.join('\r\n');
  },

  /**
   * 导出相册到JSON文件（迁移自 modules/photos.js exportAlbumsToJson）
   * @param {Array} albums 相册列表
   */
  exportAlbumsToJson: async(albums) => {
    const indicator = new StatusIndicator('Photos_Export');
    await indicator.setIndex('JSON')
    let json = JSON.stringify(albums);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Photos') + '/albums.json').then((fileEntry) => {
        console.info('导出相册JSON文件到FileSystem完成', albums, fileEntry);
    }).catch((error) => {
        console.info('导出相册JSON文件到FileSystem异常', albums, error);
    });
    indicator.complete();
    return albums;
  },

  /**
   * 导出相片（迁移自 modules/photos.js exportPhotosToFiles）
   * @param {Array} albums 相册列表
   */
  exportPhotosToFiles: async(albums) => {
    // 获取用户配置
    let exportType = QZone_Config.Photos.exportType;
    switch (exportType) {
        case 'HTML':
            await API.Photos.exportPhotosToHtml(albums);
            break;
        case 'MarkDown':
            await API.Photos.exportPhotosToMarkdown(albums);
            break;
        case 'JSON':
            await API.Photos.exportPhotosToJson(albums);
            break;
        case 'SPA':
            await API.Photos.exportToSpa(albums);
            break;
        default:
            break;
    }
  },

  /**
   * 导出相片到HTML文件（迁移自 modules/photos.js exportPhotosToHtml）
   * @param {Array} albums 相册列表
   */
  exportPhotosToHtml: async(albums) => {
    let indicator = new StatusIndicator('Photos_Images_Export_Other');
    await indicator.setIndex('HTML');
    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Photos');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('albums', albums, moduleFolder + '/json/albums.js');

        // 生成相片列表HTML
        await API.Common.writeHtmlofTpl('photos', null, moduleFolder + "/photos.html");

        for (const album of albums) {
            // 生成静态相册文件
            const name = API.Utils.filenameValidate(album.name);
            await API.Common.writeHtmlofTpl('photos', { album: album, albumId: album.id }, moduleFolder + "/" + name + ".html");
        }

    } catch (error) {
        console.error('导出相片到HTML异常', error, albums);
    }
    // 更新完成信息
    indicator.complete();
    return albums;
  },

  /**
   * 导出相片到MD文件（迁移自 modules/photos.js exportPhotosToMarkdown）
   * @param {Array} albums 相册列表
   */
  exportPhotosToMarkdown: async(albums) => {
    for (const album of albums) {
        // 相片列表
        const photos = album.photoList || [];

        // 每个相册的进度器
        const indicator = new StatusIndicator('Photos_Images_Export');
        await indicator.setIndex(album.name);
        indicator.setTotal(photos.length);
        indicator.addDownload(photos);

        // 相册文件夹
        const folderName = API.Common.getRootFolder() + '/' + API.Photos.getAlbumFolderPath(album, QZone.Photos.Album.Data.length);
        await API.Utils.createFolder(folderName);

        // 生成相片年份的MD文件
        const year_maps = API.Utils.groupedByTime(photos, 'uploadTime', 'year');
        for (const [year, year_photos] of year_maps) {
            let year_content = API.Photos.getPhotosMarkdownContents(year_photos);
            await API.Utils.writeText(year_content, folderName + "/" + year + '.md');
        }

        // 生成相册汇总的MD文件
        const album_content = API.Photos.getPhotosMarkdownContents(photos);
        // 相册名称
        const albumName = API.Utils.filenameValidate(album.name);
        await API.Utils.writeText(album_content, folderName + '/' + albumName + '.md');

        indicator.addSuccess(photos);
        indicator.complete();
    }
    return albums;
  },

  /**
   * 获取相片的MD内容（迁移自 modules/photos.js getPhotosMarkdownContents）
   * @param {Array} albums 相片列表
   */
  getPhotosMarkdownContents: (photos) => {
    const contents = [];
    for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        // 相片名称
        contents.push('> ' + API.Common.formatContent(photo.name || '', 'MD', false, false, false, false, true));
        contents.push('\r\n');

        // 相片
        const custom_filepath = API.Common.getMediaPath(photo.custom_url || photo.url, photo.custom_filepath, true, 3);
        if (photo.is_video) {
            // 视频
            contents.push('<video height="400" src="{0}" controls="controls" ></video>'.format(custom_filepath));
        } else {
            // 图片
            contents.push(API.Utils.getImagesMarkdown(custom_filepath, photo.name));
        }
        contents.push('\r\n');

        // 相片描述
        contents.push('> ' + API.Common.formatContent(photo.desc || photo.name || '', 'MD', false, false, false, false, true));
        contents.push('\r\n');

        // 相片评论
        contents.push('> 评论({0})'.format(photo.cmtTotal || 0));
        contents.push('\r\n');

        // 评论 TODO 兼容私密评论
        photo.comments = photo.comments || [];
        for (const comment of photo.comments) {
            // 评论人
            const poster_name = API.Common.formatContent(comment.poster.name, 'MD', false, false, false, false, true);
            const poster_display = API.Common.getUserLink(comment.poster.id, poster_name, "MD");
            // 评论内容
            let content = API.Common.formatContent(comment.content, 'MD', false, false, false, false, true);
            contents.push("* {0}：{1}".format(poster_display, content));

            // 评论包含图片
            const comment_images = comment.pic || [];
            for (const image of comment_images) {
                let custom_url = image.o_url || image.hd_url || image.b_url || image.s_url || image.url;
                custom_url = API.Common.isQzoneUrl() ? (image.custom_url || custom_url) : image.custom_filepath
                    // 添加评论图片
                contents.push(API.Utils.getImagesMarkdown(custom_url));
            }

            // 评论的回复
            const replies = comment.replies || [];
            for (const repItem of replies) {
                // 回复人
                const repName = API.Common.formatContent(repItem.poster.name, 'MD', false, false, false, false, true);
                const rep_poster_display = API.Common.getUserLink(comment.poster.id, repName, "MD");
                // 回复内容
                const content = API.Common.formatContent(repItem.content, 'MD', false, false, false, false, true);
                contents.push("\t* {0}：{1}".format(rep_poster_display, content));

                const repImgs = repItem.pic || [];
                for (const repImg of repImgs) {
                    // 回复包含图片
                    let custom_url = repImg.o_url || repImg.hd_url || repImg.b_url || repImg.s_url || repImg.url;
                    custom_url = API.Common.isQzoneUrl() ? (repImg.custom_url || custom_url) : repImg.custom_filepath
                        // 添加回复评论图片
                    contents.push(API.Utils.getImagesMarkdown(custom_url));
                }
            }
        }
        contents.push('---');
    }
    return contents.join('\r\n');
  },

  /**
   * 导出相片到JSON文件（迁移自 modules/photos.js exportPhotosToJson）
   * @param {Array} albums 相册列表
   */
  exportPhotosToJson: async(albums) => {
    // 进度显示器
    const indicator = new StatusIndicator('Photos_Images_Export_Other');

    for (const album of albums) {
        // 相册文件夹
        const folderName = API.Common.getRootFolder() + '/' + API.Photos.getAlbumFolderPath(album, QZone.Photos.Album.Data.length);
        await API.Utils.createFolder(folderName);

        // 相册列表
        const photos = album.photoList || [];

        // 相册名称
        const albumName = API.Utils.filenameValidate(album.name);
        await API.Utils.writeText(JSON.stringify(photos), folderName + '/' + albumName + '.json');
    }

    // 完成
    indicator.complete();
    return albums;
  },
};
