/**
 * QQ空间好友模块导出API
 * @author https://github.com/ShunCai/
 */

/**
 * 导出QQ空间好友
 */
API.Friends.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Friends_Row_Infos');
    indicator.print();

    try {
        // 获取所有的QQ好友
        let friends = await API.Friends.getAllList();
        console.log('好友列表获取完成，共有好友%i个', friends.length);

        // 添加QQ好友的头像下载
        API.Common.downloadUserAvatars(_.filter(friends, API.Friends.isNewItem));

        // 根据分组名称（非分组ID）进行排序
        friends = API.Utils.sort(friends, 'groupSortNo');
        console.log('好友列表排序完成');

        // 根据导出类型导出数据
        await API.Friends.exportAllToFiles(friends);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Friends', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有好友列表（P2：委托 collectors/Friends）
 */
API.Friends.getAllList = QZoneCollectors.Friends.getAllList;

/**
 * 基于分组信息初始化分组名称（P2-3：委托 repos/modules/friends）
 * @param {Object} data 好友信息，含分组信息
 * @param {Array} friends 好友列表，不含分组名称
 */
API.Friends.initGroupName = QZoneRepo.Friends.initGroupName;

/**
 * 获取好友添加时间（P2-3：委托 repos/modules/friends）
 */
API.Friends.getFriendsTime = QZoneRepo.Friends.getFriendsTime;

/**
 * 是否为新好友（P2-3：委托 repos/modules/friends）
 * @param {object} item 好友
 */
API.Friends.isNewItem = QZoneRepo.Friends.isNewItem;

/**
 * 导出好友（P2-4：委托 exporters/friends）
 * @param {Array} friends 好友列表
 */
API.Friends.exportAllToFiles = QZoneExporters.Friends.exportAllToFiles;

/**
 * 导出好友到 SPA
 *
 * 生成文件结构：
 *   Friends/data/
 *     - friends-index.js          → window.friendsIndex    （轻量索引，首屏加载）
 *     - friends-group.js          → window.friendsGroup     （全量数据，按分组聚合）
 *
 * 好友无自然的"发布时间"字段（addFriendTime 可能为 0），
 * 不适合按年份分片，改为按分组（groupName）聚合的全量单文件。
 *
 * 索引字段：uin, name, remark, groupName, addFriendTime, intimacyScore,
 *           care, isFriend, deleted, hasAvatar
 * v5.0 F1：name 的取值来自 friendNick（nick || name || nickname）——接口返回的字段
 * 是 nick，键名保持 name 不变（预构建 SPA 按此键读取）。
 *
 * @param {Array} friends 好友列表
 */
API.Friends.exportToSpa = QZoneExporters.Friends.exportToSpa;

/**
 * 导出QQ好友到Excel（P2-4：委托 exporters/friends）
 * @param {Array} friends 好友列表
 */
API.Friends.exportToExcel = QZoneExporters.Friends.exportToExcel;

/**
 * 导出QQ好友到HTML
 * @param {Array} friends 好友列表
 */
API.Friends.exportToHtml = QZoneExporters.Friends.exportToHtml;


/**
 * 导出QQ好友到MarkDown
 * @param {Array} friends 好友列表
 */
API.Friends.exportToMarkDown = QZoneExporters.Friends.exportToMarkDown;


/**
 * 导出QQ好友到JSON
 * @param {Array} friends 好友列表
 */
API.Friends.exportToJson = QZoneExporters.Friends.exportToJson;

/**
 * 获取好友空间访问权限（P2：委托 collectors/Friends）
 * @param {Array} friends 好友列表
 * @returns 
 */
API.Friends.getZoneAccessList = QZoneCollectors.Friends.getZoneAccessList;

/**
 * 获取特别关心好友列表（P2：委托 collectors/Friends）
 * @param {Array} friends 好友列表
 * @returns 
 */
API.Friends.getCareFriendList = QZoneCollectors.Friends.getCareFriendList;