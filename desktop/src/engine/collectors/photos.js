/**
 * 相册采集（P2）
 * 采集循环逐字迁自 modules/photos.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Photos = {
  /**
   * 获取单页的相册列表（迁移自 modules/photos.js getAlbumPageList）
   * @param {integer} pageIndex 指定页的索引
   * @param {StatusIndicator} indicator 状态更新器
   */
  getAlbumPageList: async(pageIndex, indicator) => {

      // 状态更新器当前页
      await indicator.setIndex(pageIndex + 1);

      // 更新获取中数据
      indicator.addDownload(QZone_Config.Photos.pageSize);

      // 查询相册
      return await API.Photos.getAlbums(pageIndex).then(async(data) => {
          // 去掉函数，保留json
          data = API.Utils.toJson(data, /^shine0_Callback\(/);
          if (data.code && data.code != 0) {
              // 获取异常
              console.warn('获取单页的相册列表异常：', data);
          }
          data = data.data || {};

          // 更新总数
          QZone.Photos.Album.total = data.albumsInUser || QZone.Photos.Album.total || 0;
          indicator.setTotal(QZone.Photos.Album.total);

          // 更新相册分类信息
          if (data.classList && data.classList.length > 0) {
              for (const classItem of data.classList) {
                  QZone.Photos.Class[classItem.id] = classItem.name;
              }
          }

          let dataList = data.albumList || [];

          //  更新获取成功数据
          indicator.addSuccess(dataList);

          return dataList;
      })
  },

  /**
   * 获取所有的相册列表（迁移自 modules/photos.js getAllAlbumList）
   */
  getAllAlbumList: async() => {
      // 进度更新器
      const indicator = new StatusIndicator('Photos');
      await indicator.setIndex(1);
      indicator.print();

      const CONFIG = QZone_Config.Photos;

      const nextPage = async function(pageIndex, indicator) {
          // 下一页索引
          const nextPageIndex = pageIndex + 1;

          return await API.Photos.getAlbumPageList(pageIndex, indicator).then(async(dataList) => {

              // 合并数据
              QZone.Photos.Album.Data = API.Utils.unionItems(QZone.Photos.Album.Data, dataList);

              if (!API.Common.isGetNextPage(QZone.Photos.Album.OLD_Data, dataList, CONFIG)) {
                  // 不再继续获取下一页
                  return QZone.Photos.Album.Data;
              }
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Photos.Album.total, QZone.Photos.Album.Data, arguments.callee, nextPageIndex, indicator);

          }).catch(async(e) => {
              console.error("获取相册列表异常，当前页：", pageIndex + 1, e);
              indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));

              // 当前页失败后，跳过继续请求下一页
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Photos.Album.total, QZone.Photos.Album.Data, arguments.callee, nextPageIndex, indicator);
          });
      }

      await nextPage(0, indicator);

      // 更新相册类别
      for (const album of QZone.Photos.Album.Data) {
          album.className = QZone.Photos.Class[album.classid] || '其他';
          album.photoList = album.photoList || [];
      }

      // 完成
      indicator.complete();

      // 重新排序
      API.Photos.sortAlbums(QZone.Photos.Album.Data);

      return QZone.Photos.Album.Data;

  },

  /**
   * 获取单个相册的指定页相片列表（迁移自 modules/photos.js getAlbumImagePageList）
   * @param {Object} item 相册
   * @param {integer} pageIndex 指定页的索引
   * @param {StatusIndicator} indicator 状态更新器
   */
  getAlbumImagePageList: async(item, pageIndex, indicator) => {
      // 显示当前处理相册
      indicator && await indicator.setIndex(item.name);

      // 更新获取中数据
      indicator && indicator.addDownload(QZone_Config.Photos.Images.pageSize);

      return await API.Photos.getImages(item.id, pageIndex).then(async(data) => {
          // 去掉函数，保留json
          data = API.Utils.toJson(data, /^shine0_Callback\(/);
          if (data.code && data.code != 0) {
              // 获取异常
              console.warn('获取单个相册的指定页相片列表异常：', data);
          }
          data = data.data || {};

          // 更新总数
          QZone.Photos.Images[item.id].total = data.totalInAlbum || QZone.Photos.Images[item.id].total || 0;
          indicator && indicator.setTotal(data.totalInAlbum || 0);

          // 合并相册信息到相册(主要是合并预览图与封面图地址)
          if (data.topic) {
              item.pre = data.topic.pre || item.pre;
              item.url = data.topic.url || item.url;
          }

          // 相片列表
          const dataList = data.photoList || [];

          // 更新获取成功数据
          indicator && indicator.addSuccess(dataList);

          return dataList;
      })
  },

  /**
   * 获取单个相册的全部相片列表（迁移自 modules/photos.js getAlbumImageAllList）
   * @param {Object} album 相册
   */
  getAlbumImageAllList: async(album) => {
      // 获取已备份数据
      const OLD_Data = API.Photos.getPhotosByAlbumId(QZone.Photos.Album.OLD_Data, album.id);
      // 重置单个相册的数据
      QZone.Photos.Images[album.id] = {
          total: 0,
          OLD_Data: OLD_Data,
          Data: []
      };
      // 进度更新器
      const indicator = new StatusIndicator('Photos_Images');
      // 开始
      indicator.print();

      // 相册配置项
      const ALBUM_CONFIG = QZone_Config.Photos
          // 相片配置项
      const PHOTO_CONFIG = ALBUM_CONFIG.Images;

      const nextPage = async function(pageIndex, indicator) {
          // 下一页索引
          const nextPageIndex = pageIndex + 1;

          return await API.Photos.getAlbumImagePageList(album, pageIndex, indicator).then(async(dataList) => {

              // 设置比较信息
              dataList = API.Common.setCompareFiledInfo(dataList, 'uploadtime', 'uploadTime');

              // 合并数据
              QZone.Photos.Images[album.id].Data = API.Utils.unionItems(QZone.Photos.Images[album.id].Data, dataList);
              if (!API.Common.isGetNextPage(QZone.Photos.Images[album.id].OLD_Data, dataList, ALBUM_CONFIG)) {
                  // 不再继续获取下一页
                  return QZone.Photos.Images[album.id].Data;
              }

              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, PHOTO_CONFIG, QZone.Photos.Images[album.id].total, QZone.Photos.Images[album.id].Data, arguments.callee, nextPageIndex, indicator);
          }).catch(async(e) => {
              console.error("获取相册列表异常，当前页：", pageIndex + 1, album, e);
              indicator.addFailed(new PageInfo(pageIndex, PHOTO_CONFIG.pageSize));
              // 当前页失败后，跳过继续请求下一页
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, PHOTO_CONFIG, QZone.Photos.Images[album.id].total, QZone.Photos.Images[album.id].Data, arguments.callee, nextPageIndex, indicator);
          });
      }

      await nextPage(0, indicator) || [];

      if (!API.Photos.isNewAlbum(album.id)) {
          // 合并、过滤数据
          QZone.Photos.Images[album.id].Data = API.Common.unionBackedUpItems(ALBUM_CONFIG, QZone.Photos.Images[album.id].OLD_Data, QZone.Photos.Images[album.id].Data);

          // 上传时间倒序
          QZone.Photos.Images[album.id].Data = API.Utils.sort(QZone.Photos.Images[album.id].Data, ALBUM_CONFIG.IncrementField, true);
      }

      // 完成
      indicator.complete();

      return QZone.Photos.Images[album.id].Data;
  },

  /**
   * 获取指定相册的相片列表（迁移自 modules/photos.js getAllAlbumImageList）
   * @param {Array} items 相册列表
   */
  getAllAlbumImageList: async(items) => {
      for (const item of items) {
          if (!_.some(QZone.Photos.Album.Select, ['id', item.id])) {
              // 不是用户选中的相册，暂不处理
              console.log('不是用户选中的相册，暂不处理');
              continue;
          }
          if (item.allowAccess === 0) {
              // 没权限的跳过不获取
              console.warn("无权限访问该相册", item);
              continue;
          }
          const photos = await API.Photos.getAlbumImageAllList(item);
          item.photoList = photos || [];
      }
      return QZone.Photos.Images;
  },

  /**
   * 获取相册赞记录（迁移自 modules/photos.js getAlbumsLikeList）
   * @param {Array} items 相册列表
   */
  getAlbumsLikeList: async(items) => {
      if (!API.Common.isGetLike(QZone_Config.Photos)) {
          // 不获取赞
          return;
      }
      // 进度更新器
      const indicator = new StatusIndicator('Photos_Albums_Like');
      indicator.setTotal(items.length);

      // 同时请求数
      const _items = _.chunk(items, 10);

      // 获取点赞列表
      let count = 0;
      end: for (let i = 0; i < _items.length; i++) {
          const list = _items[i];

          let tasks = [];
          for (let j = 0; j < list.length; j++) {

              const item = list[j];
              item.likes = item.likes || [];

              if (!API.Photos.isNewAlbum(item.id)) {
                  // 已备份相册
                  continue;
              }

              await indicator.setIndex(++count);
              tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Photos).then((likes) => {
                  // 获取完成
                  indicator.addSuccess(item);
              }).catch((e) => {
                  console.error("获取相册点赞异常：", item, e);
                  indicator.addFailed(item);
              }));

          }

          await Promise.all(tasks);
          // 每一批次完成后暂停半秒
          await API.Utils.sleep(500);
      }

      // 已备份数据跳过不处理
      indicator.setSkip(items.length - count);

      // 完成
      indicator.complete();
  },

  /**
   * 获取相片赞记录（迁移自 modules/photos.js getPhotosLikeList）
   * @param {Array} items 相片列表
   */
  getPhotosLikeList: async(items) => {
      if (!API.Common.isGetLike(QZone_Config.Photos)) {
          // 不获取赞
          return items;
      }
      // 进度更新器
      const indicator = new StatusIndicator('Photos_Images_Like');
      indicator.setTotal(items.length);

      // 同时请求数
      const _items = _.chunk(items, 10);

      // 获取点赞列表
      let count = 0;
      end: for (let i = 0; i < _items.length; i++) {
          const list = _items[i];

          let tasks = [];
          for (let j = 0; j < list.length; j++) {

              const item = list[j];
              item.likes = item.likes || [];

              if (!API.Photos.isNewItem(item.albumId, item)) {
                  // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                  await Promise.all(tasks);
                  break end;
              }

              await indicator.setIndex(++count);
              tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Photos).then((likes) => {
                  // 获取完成
                  indicator.addSuccess(item);
              }).catch((e) => {
                  console.error("获取相片点赞异常：", item, e);
                  indicator.addFailed(item);
              }));

          }

          await Promise.all(tasks);
          // 每一批次完成后暂停半秒
          await API.Utils.sleep(500);
      }

      // 已备份数据跳过不处理
      indicator.setSkip(items.length - count);

      // 完成
      indicator.complete();

      return items;
  },

  /**
   * 获取单条全部最近访问（迁移自 modules/photos.js getItemAllVisitorsList）
   * @param {object} item 说说
   */
  getItemAllVisitorsList: async(item) => {
      // 清空原有的最近访问信息
      item.custom_visitor = {
          viewCount: 0,
          totalNum: 0,
          list: []
      };

      // 最近访问配置
      const CONFIG = QZone_Config.Photos.Visitor;

      const nextPage = async function(item, pageIndex) {
          // 下一页索引
          const nextPageIndex = pageIndex + 1;

          return await API.Photos.getVisitors(item.id, pageIndex).then(async(data) => {
              data = API.Utils.toJson(data, /^_Callback\(/);
              if (data.code && data.code != 0) {
                  // 获取异常
                  console.warn('获取单条全部最近访问异常：', data);
              }
              data = data.data || {};

              // 合并
              item.custom_visitor.viewCount = data.viewCount || 0;
              item.custom_visitor.totalNum = data.totalNum || 0;
              item.custom_visitor.list = item.custom_visitor.list.concat(data.list || []);

              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
          }).catch(async(e) => {
              console.error("获取说说最近访问列表异常，当前页：", pageIndex + 1, item, e);

              // 当前页失败后，跳过继续请求下一页
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
          });
      }

      await nextPage(item, 0);

      return item.custom_visitor;
  },

  /**
   * 获取最近访问（迁移自 modules/photos.js getAllVisitorList）
   * @param {Array} items 说说列表
   */
  getAllVisitorList: async(items) => {
      if (!API.Common.isGetVisitor(QZone_Config.Photos)) {
          // 不获取最近访问
          return items;
      }
      // 进度更新器
      const indicator = new StatusIndicator('Photos_Albums_Visitor');
      indicator.setTotal(items.length);

      // 同时请求数
      const _items = _.chunk(items, 10);

      // 获取最近访问
      let count = 0;
      end: for (let i = 0; i < _items.length; i++) {
          const list = _items[i];

          let tasks = [];
          for (let j = 0; j < list.length; j++) {
              const item = list[j];
              if (!API.Photos.isNewAlbum(item.id)) {
                  // 已备份跳过
                  continue;
              }
              await indicator.setIndex(++count);
              tasks.push(API.Photos.getItemAllVisitorsList(item).then((visitor) => {
                  // 获取完成
                  indicator.addSuccess(item);
              }).catch((e) => {
                  console.error("获取相册最近访问异常：", item, e);
                  indicator.addFailed(item);
              }));

          }

          await Promise.all(tasks);
          // 每一批次完成后暂停半秒
          await API.Utils.sleep(500);
      }

      // 已备份数据跳过不处理
      indicator.setSkip(items.length - count);

      // 完成
      indicator.complete();

      return items;
  },
};
