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
};
