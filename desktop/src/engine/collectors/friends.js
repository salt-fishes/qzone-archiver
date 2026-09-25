/**
 * 好友采集（P2）
 * 采集循环逐字迁自 modules/friends.js（行为零变化）；P2 阶段仍引用 API.Common/StatusIndicator/QZone 全局。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Friends = {
  /**
   * 获取所有好友列表（迁移自 modules/friends.js getAllList）
   */
  getAllList: async() => {
      // 重置数据
      QZone.Friends.Data = [];

      // 进度更新器
      const indicator = new StatusIndicator('Friends');
      await indicator.setIndex(1);
      indicator.print();

      // 接口
      const friendListRest = QZone_Config.Friends.SortType === 'QQ' ? API.Friends.getSortFriends : API.Friends.getFriends;

      await friendListRest().then(async(data) => {
          data = API.Utils.toJson(data, /^_Callback\(/);
          if (data.code && data.code != 0) {
              // 获取异常
              console.warn('获取所有好友列表异常：', data);
          }
          data = data.data || {};

          QZone.Friends.Data = data.items || data.list || [];

          QZone.Friends.total = QZone.Friends.Data.length || QZone.Friends.total || 0;
          indicator.setTotal(QZone.Friends.total);

          indicator.addSuccess(QZone.Friends.Data);

          // 初始化分组名称
          API.Friends.initGroupName(data, QZone.Friends.Data);

          // 获取好友成立时间
          QZone.Friends.Data = await API.Friends.getFriendsTime(data, QZone.Friends.Data);

          // 获取好友空间权限
          await API.Friends.getZoneAccessList(QZone.Friends.Data);

          // 获取特别关心好友
          await API.Friends.getCareFriendList(QZone.Friends.Data);

          return QZone.Friends.Data;
      }).catch((e) => {
          console.error("获取好友列表异常", e);
      })

      // 完成
      indicator.complete();

      // 根据QQ号去重合并
      if (QZone_Config.Friends.isIncrement) {

          // 最新数据没有，历史数据存在的，表示已删除
          const deleteItems = _.filter(QZone.Friends.OLD_Data, item => _.findIndex(QZone.Friends.Data, ['uin', item.uin]) < 0);

          // 合并数据，并去重
          QZone.Friends.Data = _.unionBy(_.concat(QZone.Friends.OLD_Data, QZone.Friends.Data), 'uin');

          // 全部修改为非删除
          _.forEach(QZone.Friends.Data, item => item.deleted = false);

          // 再把删除项改为删除
          _.forEach(_.filter(QZone.Friends.Data, item => _.findIndex(deleteItems, ['uin', item.uin]) > -1), item => item.deleted = true);

      }

      return QZone.Friends.Data;
  },

  /**
   * 获取好友空间访问权限（迁移自 modules/friends.js getZoneAccessList）
   * @param {Array} friends 好友列表
   * @returns 
   */
  getZoneAccessList: async(friends) => {
      if (!QZone_Config.Friends.ZoneAccess) {
          // 不获取好友空间访问权限，则跳过不处理
          return friends;
      }

      // 进度更新器
      const indicator = new StatusIndicator('Friends_Access');
      indicator.setTotal(friends.length);

      // v4.7 P2：该接口是「逐个好友访问其空间主页」（main_page_cgi），
      // 此前循环内无任何间隔，几百上千好友会在几分钟内连打同一域名 ——
      // 这是 issue #1 报 501 的直接诱因。改为每条随机间隔 + 每批额外停顿。
      const ACCESS_MIN_MS = 300;
      const ACCESS_MAX_MS = 1200;
      const ACCESS_BATCH = 20;
      const ACCESS_BATCH_SLEEP_MS = 3000;
      let processed = 0;
      let intervalSkipped = false;

      // 遍历
      for (const friend of friends) {
          // 检查点：每条好友处理前检查暂停/取消（该循环原本无检查点）
          if (await checkExportState()) {
              const err = new Error('[ExportState] 导出已取消')
              err.__exportCancelled = true
              throw err
          }
          if (friend.isMe || !API.Friends.isNewItem(friend)) {
              indicator.addSkip(friend);
              continue;
          }
          // 请求间隔：降低被识别为爬虫/频率限制的风险
          await API.Utils.sleep(ACCESS_MIN_MS + Math.random() * (ACCESS_MAX_MS - ACCESS_MIN_MS));
          processed++;
          if (processed % ACCESS_BATCH === 0) {
              await API.Utils.sleep(ACCESS_BATCH_SLEEP_MS);
          }
          // 设置默认值
          await API.Friends.getZoneAccess(friend.uin).then((data) => {
              // 转换JSON
              data = API.Utils.toJson(data, /^_Callback\(/);
              if (data.code && data.code != 0 && data.code != -4009) {
                  // 获取异常
                  console.warn('获取好友空间访问权限异常：', friend, data);
              }

              // 状态码慰-4009表示无权限
              friend.access = data.code !== -4009;

              // 成功
              indicator.addSuccess(friend);
          }).catch((e) => {
              // 失败
              indicator.addFailed(friend);
              console.error("获取好友空间权限异常", friend, e);
              // v4.7：熔断生效时无需继续逐条打接口，提前结束本模块
              if (API.Utils.isServerFailureTripped && API.Utils.isServerFailureTripped()) {
                  intervalSkipped = true;
              }
          })
          if (intervalSkipped) {
              console.warn('[getZoneAccessList] 接口连续异常已熔断，停止继续判断好友空间权限');
              break;
          }
      }
      // 完成
      indicator.complete();
      return friends;
  },

  /**
   * 获取特别关心好友列表（迁移自 modules/friends.js getCareFriendList）
   * @param {Array} friends 好友列表
   * @returns 
   */
  getCareFriendList: async(friends) => {
      if (!QZone_Config.Friends.SpecialCare) {
          // 不获取特别关心的好友，则跳过
          return;
      }

      // 进度更新器
      const indicator = new StatusIndicator('Friends_Care');

      // 查询
      await API.Friends.getSpecialCare().then((data) => {
          // 转换JSON
          data = API.Utils.toJson(data, /^_Callback\(/);
          if (data.code && data.code != 0) {
              // 获取异常
              console.warn('获取特别关心好友列表异常：', data);
          }
          data = data.data || {};

          // 关心的好友列表
          const items = data.items_special || [];

          // 总数
          indicator.setTotal(items.length);

          for (const item of items) {
              const friend = _.find(friends, (f) => f.uin === item.uin);
              // v5.0 F4：特别关心列表可能含不在好友列表里的 uin（非好友/认证空间）——
              // 原实现 undefined.care 直接抛错中断循环，其余好友全部丢失标记
              if (friend) friend.care = true;
          }

          // 成功
          indicator.addSuccess(items);
      }).catch((e) => {
          // 失败
          console.error("获取特别关心好友列表异常：", e);
      })

      // 完成
      indicator.complete();
  },
};
