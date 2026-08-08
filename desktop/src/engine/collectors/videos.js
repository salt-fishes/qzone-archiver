/**
 * 视频采集（P2）
 * 采集循环逐字迁自 modules/videos.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Videos = {
  /**
   * 获取一页的视频列表（迁移自 modules/videos.js getPageList）
   * @param {integer} pageIndex 指定页的索引
   * @param {StatusIndicator} indicator 状态更新器
   */
  getPageList: async(pageIndex, indicator) => {

      // 状态更新器当前页
      await indicator.setIndex(pageIndex + 1);

      // 更新获取中提示
      indicator.addDownload(QZone_Config.Videos.pageSize);

      return await API.Videos.getVideos(pageIndex).then(data => {
          // 去掉函数，保留json
          data = API.Utils.toJson(data, /^shine0_Callback\(/);
          if (data.code && data.code != 0) {
              // 获取异常
              console.warn('获取一页的视频列表异常：', data);
          }
          data = data.data || {};

          // 更新总数
          QZone.Videos.total = data.total || QZone.Videos.total || 0;
          indicator.setTotal(QZone.Videos.total);

          let dataList = data.Videos || [];

          for (const item of dataList) {
              item.uniKey = item.shuoshuoid ? API.Messages.getUniKey(item.shuoshuoid) : item.vid;
          }

          //  更新获取成功数据
          indicator.addSuccess(dataList);

          return dataList;
      })
  },

  /**
   * 获取所有视频列表（迁移自 modules/videos.js getAllList）
   */
  getAllList: async() => {
      // 进度更新器
      const indicator = new StatusIndicator('Videos');
      await indicator.setIndex(1);
      indicator.print();

      // 视频配置项
      const CONFIG = QZone_Config.Videos;

      const nextPage = async function(pageIndex, indicator) {
          // 下一页索引
          const nextPageIndex = pageIndex + 1;

          return await API.Videos.getPageList(pageIndex, indicator).then(async(dataList) => {
              // 合并数据
              QZone.Videos.Data = API.Utils.unionItems(QZone.Videos.Data, dataList);
              if (!API.Common.isGetNextPage(QZone.Videos.OLD_Data, dataList, CONFIG)) {
                  // 不再继续获取下一页
                  return QZone.Videos.Data;
              }
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Videos.total, QZone.Videos.Data, arguments.callee, nextPageIndex, indicator);
          }).catch(async(e) => {
              console.error("获取视频列表异常，当前页：", pageIndex + 1, e);
              indicator.addFailed(new PageInfo(pageIndex, CONFIG.pageSize));
              // 当前页失败后，跳过继续请求下一页
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Videos.total, QZone.Videos.Data, arguments.callee, nextPageIndex, indicator);
          });
      }

      await nextPage(0, indicator);

      // 合并、过滤数据
      QZone.Videos.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Videos.OLD_Data, QZone.Videos.Data);

      // 发表时间倒序
      QZone.Videos.Data = API.Utils.sort(QZone.Videos.Data, CONFIG.IncrementField, true);

      // 完成
      indicator.complete();

      return QZone.Videos.Data;
  },

  /**
   * 获取视频赞记录（迁移自 modules/videos.js getAllLikeList）
   * @param {Array} items 日志列表
   */
  getAllLikeList: async(items) => {
      if (!API.Common.isGetLike(QZone_Config.Videos)) {
          // 不获取赞
          return items;
      }
      // 进度更新器
      const indicator = new StatusIndicator('Videos_Like');
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

              if (!item.shuoshuoid) {
                  // 说说ID为空时跳过不获取 TODO 待定
                  indicator.addSkip(item);
                  continue;
              }

              item.uniKey = API.Messages.getUniKey(item.shuoshuoid);

              if (!API.Common.isNewItem(item)) {
                  // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                  await Promise.all(tasks);
                  break end;
              }


              await indicator.setIndex(++count);
              tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Videos).then((likes) => {
                  // 获取完成
                  indicator.addSuccess(item);
              }).catch((e) => {
                  console.error("获取视频点赞异常：", item, e);
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
