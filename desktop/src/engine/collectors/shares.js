/**
 * 分享采集（P2）
 * 采集循环逐字迁自 modules/shares.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Shares = {
  /**
   * 获取所有分享列表（迁移自 modules/shares.js getAllList）
   */
  getAllList: async() => {

      // 分享状态更新器
      const indicator = new StatusIndicator('Shares');
      await indicator.setIndex(1);
      indicator.print();

      const CONFIG = QZone_Config.Shares;

      const nextPage = async function(pageIndex, indicator) {

          // 下一页索引
          const nextPageIndex = pageIndex + 1;
          indicator.index = nextPageIndex;

          // 更新状态-下载中的数量
          indicator.addDownload(QZone_Config.Shares.pageSize);

          return await API.Shares.getList(nextPageIndex, indicator).then(async(html) => {
              // 页面转数据
              const shareInfo = API.Shares.convert(html);
              const dataList = shareInfo.list || [];
              QZone.Shares.total = QZone.Shares.total || shareInfo.total || 0;

              // 更新总数
              indicator.setTotal(QZone.Shares.total);

              // 更新状态-下载成功数
              indicator.addSuccess(dataList);

              // 合并数据
              QZone.Shares.Data = API.Utils.unionItems(QZone.Shares.Data, dataList);
              if (!API.Common.isGetNextPage(QZone.Shares.OLD_Data, dataList, CONFIG)) {
                  // 不再继续获取下一页
                  return QZone.Shares.Data;
              }
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Shares.total, QZone.Shares.Data, arguments.callee, nextPageIndex, indicator);

          }).catch(async(e) => {
              console.error("获取分享列表异常，当前页：", nextPageIndex, e);
              indicator.addFailed(new PageInfo(nextPageIndex, CONFIG.pageSize));
              // 当前页失败后，跳过继续请求下一页
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, QZone.Shares.total, QZone.Shares.Data, arguments.callee, nextPageIndex, indicator);
          });
      }

      await nextPage(0, indicator);

      // 合并、过滤数据
      QZone.Shares.Data = API.Common.unionBackedUpItems(CONFIG, QZone.Shares.OLD_Data, QZone.Shares.Data);

      // 完成
      indicator.complete();

      return QZone.Shares.Data;
  },

  /**
   * 获取单条分享的全部评论列表（迁移自 modules/shares.js getItemAllCommentList）
   * @param {object} item 分享
   * @param {StatusIndicator} indicator 状态更新器
   */
  getItemAllCommentList: async(item) => {

      // 清空原有的评论列表
      item.comments = [];

      // 分享评论配置
      const CONFIG = QZone_Config.Shares.Comments;

      // 更新总数
      const total = item.commentTotal || 0;

      const nextPage = async function(item, pageIndex) {

          // 下一页索引
          const nextPageIndex = pageIndex + 1;

          return await API.Shares.getComments(item.id, pageIndex).then(async(data) => {

              // JSON转换
              data = API.Utils.toJson(data, /^_Callback\(/);
              if (data.code && data.code != 0) {
                  // 获取异常
                  console.warn('获取单条分享的全部评论列表异常：', data);
              }
              data = data.data || {};

              item.commentTotal = item.commentTotal || data.total || 0;

              data.comments = data.comments || [];
              // 处理发表时间
              for (const comment of data.comments) {
                  comment.postTime = API.Utils.toDate(comment.postTime) / 1000;
                  comment.replies = comment.replies || [];
                  for (const repItem of comment.replies) {
                      repItem.postTime = API.Utils.toDate(repItem.postTime) / 1000;
                  }
              }

              // 合并评论列表
              item.comments = item.comments.concat(data.comments);

              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.comments, arguments.callee, item, nextPageIndex);
          }).catch(async(e) => {
              console.error("获取分享评论列表异常，当前页：", pageIndex + 1, item, e);
              // 当前页失败后，跳过继续请求下一页
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, total, item.comments, arguments.callee, item, nextPageIndex);
          });
      }

      await nextPage(item, 0);

      return item.comments;
  },

  /**
   * 获取所有分享的评论列表（迁移自 modules/shares.js getItemsAllCommentList）
   * @param {Array} items 分享
   */
  getItemsAllCommentList: async(items) => {
      if (!QZone_Config.Shares.Comments.isFull) {
          // 不获取全部评论时，跳过
          return items;
      }

      // 单条分享状态更新器
      const indicator = new StatusIndicator('Shares_Comments');
      indicator.setTotal(items.length);

      for (let i = 0; i < items.length; i++) {
          const item = items[i];

          // 更新当前位置
          await indicator.setIndex(i + 1);

          if (!API.Common.isNewItem(item)) {
              // 已备份数据跳过不处理
              indicator.addSkip(item);
              continue;
          }

          // 预防分享无评论
          item.comments = item.comments || [];

          // 获取分享的全部评论
          await API.Shares.getItemAllCommentList(item);

          // 添加成功
          indicator.addSuccess(item);
      }

      // 已完成
      indicator.complete();
      return items;
  },

  /**
   * 获取分享赞记录（迁移自 modules/shares.js getAllLikeList）
   * @param {Array} items 分享列表
   */
  getAllLikeList: async(items) => {

      if (!API.Common.isGetLike(QZone_Config.Shares)) {
          // 不获取赞
          return items;
      }

      // 进度更新器
      const indicator = new StatusIndicator('Shares_Like');
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

              if (!API.Common.isNewItem(item)) {
                  // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                  await Promise.all(tasks);
                  break end;
              }
              await indicator.setIndex(++count);
              tasks.push(API.Common.getModulesLikeList(item, QZone_Config.Shares).then((likes) => {
                  // 获取完成
                  indicator.addSuccess(item);
              }).catch((e) => {
                  console.error("获取分享点赞异常：", item, e);
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
   * 获取单条分享的全部最近访问（迁移自 modules/shares.js getItemAllVisitorsList）
   * @param {object} item 分享
   */
  getItemAllVisitorsList: async(item) => {
      // 清空原有的最近访问信息
      item.custom_visitor = {
          viewCount: 0,
          totalNum: 0,
          list: []
      };

      // 最近访问配置
      const CONFIG = QZone_Config.Shares.Visitor;

      const nextPage = async function(item, pageIndex) {
          // 下一页索引
          const nextPageIndex = pageIndex + 1;

          return await API.Shares.getVisitors(item.id, pageIndex).then(async(data) => {
              data = API.Utils.toJson(data, /^_Callback\(/);
              if (data.code && data.code != 0) {
                  // 获取异常
                  console.warn('获取单条分享的全部最近访问异常：', data);
              }
              data = data.data || {};

              // 合并
              item.custom_visitor.viewCount = data.viewCount || 0;
              item.custom_visitor.totalNum = data.totalNum || 0;
              item.custom_visitor.list = item.custom_visitor.list.concat(data.list || []);

              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
          }).catch(async(e) => {
              console.error("获取分享最近访问列表异常，当前页：", pageIndex + 1, item, e);

              // 当前页失败后，跳过继续请求下一页
              // 递归获取下一页
              return await API.Common.callNextPage(nextPageIndex, CONFIG, item.custom_visitor.totalNum, item.custom_visitor.list, arguments.callee, item, nextPageIndex);
          });
      }

      await nextPage(item, 0);

      return item.custom_visitor;
  },

  /**
   * 获取分享最近访问（迁移自 modules/shares.js getAllVisitorList）
   * @param {Array} items 分享列表
   */
  getAllVisitorList: async(items) => {
      if (!API.Common.isGetVisitor(QZone_Config.Shares)) {
          // 不获取最近访问
          return items;
      }
      // 进度更新器
      const indicator = new StatusIndicator('Shares_Visitor');
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
              if (!API.Common.isNewItem(item)) {
                  // 列表由新到旧，只要遍历到旧项，后续的都是旧的，跳出循环
                  await Promise.all(tasks);
                  break end;
              }
              await indicator.setIndex(++count);
              tasks.push(API.Shares.getItemAllVisitorsList(item).then((visitor) => {
                  // 获取完成
                  indicator.addSuccess(item);
              }).catch((e) => {
                  console.error("获取分享最近访问异常：", item, e);
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
