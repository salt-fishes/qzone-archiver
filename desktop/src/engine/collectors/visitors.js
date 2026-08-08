/**
 * 访客采集（P2）
 * 采集循环逐字迁自 modules/visitors.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Visitors = {
  /**
   * 获取所有访客列表（迁移自 modules/visitors.js getAllList）
   */
  getAllList: async() => {
      // 初始化数据
      QZone.Visitors.Data = {
          items: [],
          total: 0,
          totalPage: 0
      }

      // 访客状态更新器
      const indicator = new StatusIndicator('Visitors');
      await indicator.setIndex(1);
      indicator.print();

      const CONFIG = QZone_Config.Visitors;

      const nextPage = async function(pageIndex) {

          // 下一页索引
          const nextPageIndex = pageIndex + 1;
          await indicator.setIndex(nextPageIndex);

          return await API.Visitors.getList(nextPageIndex).then(async(data) => {

              // 页面转数据
              data = API.Utils.toJson(data, /^_Callback\(/) || {};
              if (data.code && data.code != 0) {
                  // 获取异常
                  console.warn('获取单页的访客列表异常：', nextPageIndex, data);
              }
              data = data.data || {};
              const items = data.items || [];
              if (data.Ishost === 0) {
                  // 访客身份
                  QZone.Visitors.Data.total = QZone.Visitors.Data.total || data.modvisitcount[0]['totalcount'] || 0;
                  QZone.Visitors.Data.totalPage = QZone.Visitors.Data.totalPage || 1;
              } else {
                  QZone.Visitors.Data.total = QZone.Visitors.Data.total || data.totalcount || 0;
                  QZone.Visitors.Data.totalPage = QZone.Visitors.Data.totalPage || data.totalpage || 0;
              }

              // 更新总数
              indicator.setTotal(QZone.Visitors.Data.total);
              indicator.setTotalPage(QZone.Visitors.Data.totalPage);

              // 合并数据
              QZone.Visitors.Data.items = API.Utils.unionItems(QZone.Visitors.Data.items, items);
              if (!_.isEmpty(QZone.Visitors.OLD_Data.items) && API.Common.isPreBackupPos(items, CONFIG)) {
                  // 如果备份到已备份过的数据，则停止获取下一页，适用于增量备份
                  return QZone.Visitors.Data;
              }

              if (nextPageIndex >= QZone.Visitors.Data.totalPage) {
                  // 最后一页停止获取
                  return QZone.Visitors.Data;
              }

              // 请求一页成功后等待一秒再请求下一页
              const min = CONFIG.randomSeconds.min;
              const max = CONFIG.randomSeconds.max;
              const seconds = API.Utils.randomSeconds(min, max);
              await API.Utils.sleep(seconds * 1000);
              return await arguments.callee.apply(undefined, [nextPageIndex]);
          }).catch(async(e) => {
              console.error("获取访客列表异常，当前页：", nextPageIndex, e);
              // PATCH: 如果服务器错误，则判断页数再进入重试
              if (nextPageIndex >= QZone.Visitors.Data.totalPage) {
                  // 最后一页停止获取
                  return QZone.Visitors.Data;
              }

              // 当前页失败后，跳过继续请求下一页
              // 递归获取下一页
              // 请求一页成功后等待一秒再请求下一页
              const min = CONFIG.randomSeconds.min;
              const max = CONFIG.randomSeconds.max;
              const seconds = API.Utils.randomSeconds(min, max);
              await API.Utils.sleep(seconds * 1000);
              return await arguments.callee.apply(undefined, [nextPageIndex]);
          });
      }

      await nextPage(0);

      // 合并、过滤数据
      QZone.Visitors.Data.items = API.Common.unionBackedUpItems(CONFIG, QZone.Visitors.OLD_Data.items, QZone.Visitors.Data.items);

      // 完成
      indicator.complete();

      return QZone.Visitors.Data;
  },
};
