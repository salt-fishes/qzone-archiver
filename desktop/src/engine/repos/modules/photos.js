/**
 * 相册数据仓库（P2-3，迁移自 modules/photos.js getAlbumById/getPhotosByAlbumId/isNewAlbum/isNewItem）
 */
window.QZoneRepo = window.QZoneRepo || {};

QZoneRepo.Photos = {
  /**
   * 根据相册ID获取相册列表中的相册
   * @param {Array} items 相册列表
   * @param {integer} albumId 模板相册ID
   */
  getAlbumById(items, albumId) {
    items = items || [];
    // 获取指定相册数据
    const albumIndex = items.getIndex(albumId, 'id');
    const album = items[albumIndex];
    return album;
  },

  /**
   * 根据相册ID获取相册列表中的相片列表
   * @param {Array} items 相册列表
   * @param {integer} albumId 模板相册ID
   */
  getPhotosByAlbumId(items, albumId) {
    const album = API.Photos.getAlbumById(items, albumId);
    if (!album) {
        return [];
    }
    return album.photoList || [];
  },

  /**
   * 是否增量条目
   * @param {integer} albumId 相册ID
   */
  isNewAlbum(albumId) {
    if (API.Common.isFullBackup(QZone_Config.Photos)) {
        return true;
    }
    if (!QZone.Photos.Album.OLD_Data || QZone.Photos.Album.OLD_Data.length === 0) {
        // 没有存在已备份数据的，当作新数据处理
        return true;
    }
    // 因为用户可以指定相册备份，不全量相册备份的情况下，不能直接取IncrementTime增量时间判断相片是否需要备份，IncrementTime仅适用全量备份的场景
    const album = API.Photos.getAlbumById(QZone.Photos.Album.OLD_Data, albumId);
    if (!album) {
        return true;
    }
    return API.Common.isNewItem(album);
  },

  /**
   * 是否增量条目
   * @param {integer} albumId 相册ID
   * @param {Object} photo 相片
   */
  isNewItem(albumId, photo) {
    if (API.Common.isFullBackup(QZone_Config.Photos)) {
        return true;
    }
    // 因为用户可以指定相册备份，不全量相册备份的情况下，不能直接取IncrementTime增量时间判断相片是否需要备份，IncrementTime仅适用全量备份的场景
    const album = API.Photos.getAlbumById(QZone.Photos.Album.OLD_Data, albumId);
    if (!album) {
        return true;
    }
    // 已备份相册，可以直接判断，其实也不严谨，先不处理
    // 存在一种场景有问题（如1号只备份A相册，2号A相册上传了相片，3号只备份B相册，这时IncrementTime已刷成3号，此时备份A相册将无法备份2号上传的相片）
    return API.Common.isNewItem(photo);
  }
};
