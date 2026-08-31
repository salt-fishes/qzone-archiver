/**
 * 好友数据仓库（P2-3，迁移自 modules/friends.js initGroupName/getFriendsTime/isNewItem）
 */
window.QZoneRepo = window.QZoneRepo || {};

QZoneRepo.Friends = {
  /**
   * 基于分组信息初始化分组名称
   * @param {Object} data 好友信息，含分组信息
   * @param {Array} friends 好友列表，不含分组名称
   */
  initGroupName(data, friends) {
    // 将QQ分组进行分组
    const groups = data.gpnames;
    const groupMap = new Map();
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        group.sortNo = i + 1;
        //group.gpname
        groupMap.set(group.gpid, group);
    }

    // 遍历好友
    for (const friend of friends) {
        const group = groupMap.get(friend.groupid);
        // 排序号
        friend.groupSortNo = group.sortNo || 0;
        // 分组名称
        friend.groupName = group.gpname || "默认分组";
    }
  },

  /**
   * 获取好友添加时间
   */
  async getFriendsTime(data, friends) {
    if (!QZone_Config.Friends.Interactive) {
        // 不获取好友添加时间，则跳过不处理
        return friends;
    }

    // 进度更新器
    const indicator = new StatusIndicator('Friends_Time');
    indicator.setTotal(friends.length);

    // 将QQ分组进行分组
    let groups = data.gpnames;
    let groupMap = new Map();
    for (const group of groups) {
        groupMap.set(group.gpid, group.gpname);
    }
    // 遍历
    for (const friend of friends) {
        // 检查点：每条好友处理前检查暂停/取消（该循环原本无检查点）
        if (await checkExportState()) {
            const err = new Error('[ExportState] 导出已取消')
            err.__exportCancelled = true
            throw err
        }
        // 当前处理好友（更详细的进度提示）
        indicator.setItem(friend.nickname || friend.uin);
        // 设置默认值
        friend.isMe = friend.uin === QZone.Common.Owner.uin;
        if (friend.isMe || !API.Friends.isNewItem(friend)) {
            // 好友号为自己号或非新好友，跳过
            if (friend.isMe) {
                friend.addFriendTime = 0;
                friend.intimacyScore = 0;
                friend.common = {};
            }
            indicator.addSkip(friend);
            continue;
        }
        await API.Friends.getFriendshipTime(friend.uin).then((data) => {
            // JSON转换
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                console.warn('获取互动信息异常：', friend, data);
                indicator.addFailed(friend);
            }

            // 互动信息
            const infoData = data = data.data || {};

            // 添加时间
            friend.addFriendTime = infoData['addFriendTime'] || 0;
            // 好友类型
            friend.isFriend = infoData['isFriend'] || -1;
            // 亲密度
            friend.intimacyScore = infoData['intimacyScore'] || 0;

            // 共同信息(共同好友，共同群组)
            friend.common = infoData['common'] || {};

            // 成功
            indicator.addSuccess(friend);
        }).catch((e) => {
            // 失败
            indicator.addFailed(friend);
            console.error("获取好友添加时间异常", friend, e);
        })

        // 等待一下再请求
        const min = QZone_Config.Friends.randomSeconds.min;
        const max = QZone_Config.Friends.randomSeconds.max;
        const seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
    }
    // 完成
    indicator.complete();
    return friends;
  },

  /**
   * 是否为新好友
   * @param {object} item 好友
   */
  isNewItem(item) {
    if (!QZone_Config.Friends.isIncrement) {
        return true;
    }
    return _.isEmpty(QZone.Friends.OLD_Data) || _.findIndex(QZone.Friends.OLD_Data, ['uin', item.uin]) == -1;
  }
};
