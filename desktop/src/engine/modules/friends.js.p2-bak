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
        console.error('好友导出异常', error);
    }

    // 完成
    indicator.complete();
}

/**
 * 获取所有好友列表（P2：委托 collectors/Friends）
 */
API.Friends.getAllList = QZoneCollectors.Friends.getAllList;

/**
 * 基于分组信息初始化分组名称
 * @param {Object} data 好友信息，含分组信息
 * @param {Array} friends 好友列表，不含分组名称
 */
API.Friends.initGroupName = (data, friends) => {
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
}

/**
 * 获取好友添加时间
 */
API.Friends.getFriendsTime = async(data, friends) => {
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
}

/**
 * 是否为新好友
 * @param {object} item 好友
 */
API.Friends.isNewItem = (item) => {
    if (!QZone_Config.Friends.isIncrement) {
        return true;
    }
    return _.isEmpty(QZone.Friends.OLD_Data) || _.findIndex(QZone.Friends.OLD_Data, ['uin', item.uin]) == -1;
}

/**
 * 导出好友
 * @param {Array} friends 好友列表
 */
API.Friends.exportAllToFiles = async(friends) => {
    // 获取用户配置
    let exportType = QZone_Config.Friends.exportType;
    switch (exportType) {
        case 'Excel':
            await API.Friends.exportToExcel(friends);
            break;
        case 'HTML':
            await API.Friends.exportToHtml(friends);
            break;
        case 'MarkDown':
            await API.Friends.exportToMarkDown(friends);
            break;
        case 'JSON':
            await API.Friends.exportToJson(friends);
            break;
        case 'SPA':
            await API.Friends.exportToSpa(friends);
            break;
        default:
            console.warn('未支持的导出类型', exportType);
            break;
    }
}

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
 *
 * @param {Array} friends 好友列表
 */
API.Friends.exportToSpa = QZoneExporters.Friends.exportToSpa;

/**
 * 导出QQ好友到Excel
 * @param {Array} friends 好友列表
 */
API.Friends.exportToExcel = async(friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    await indicator.setIndex('Excel');

    // Excel数据
    let ws_data = [
        ["QQ", "QQ昵称", "QQ备注", "QQ分组", "特别关心", "相识时间", "空间权限", "好友关系", "亲密度", "共同好友", "共同群组", "QQ空间", "QQ通讯"]
    ];

    for (const friend of friends) {
        // QQ空间超链接
        const user_qzone_url = { t: 's', v: "QQ空间", l: { Target: API.Common.getUserUrl(friend.uin), Tooltip: "QQ空间" } };
        // QQ聊天超链接
        const user_message_url = { t: 's', v: "QQ聊天", l: { Target: API.Common.getMessageUrl(friend.uin), Tooltip: "QQ聊天" } };

        // 行信息
        const rowData = [
            friend.uin,
            friend.name,
            friend.remark,
            friend.groupName,
            API.Friends.getShowCare(friend),
            API.Friends.getShowFriendTime(friend, 0),
            API.Friends.getShowAccessType(friend),
            API.Friends.getShowFriendType(friend),
            API.Friends.getShowIntimacyScore(friend),
            API.Friends.getShowCommonFriend(friend),
            API.Friends.getShowCommonGroup(friend, '\n'),
            user_qzone_url,
            user_message_url
        ];
        ws_data.push(rowData);
    }

    // 创建WorkBook
    let workbook = XLSX.utils.book_new();

    let worksheet = XLSX.utils.aoa_to_sheet(ws_data);

    XLSX.utils.book_append_sheet(workbook, worksheet, "QQ好友");

    // 写入XLSX到HTML5的FileSystem
    let xlsxArrayBuffer = API.Utils.toArrayBuffer(XLSX.write(workbook, { bookType: 'xlsx', bookSST: false, type: 'binary' }));
    await API.Utils.writeFile(xlsxArrayBuffer, API.Common.getModuleRoot('Friends') + "/QQ好友.xlsx").then(fileEntry => {
        console.info('导出QQ好友到Excel成功', friends, fileEntry);
    }).catch(error => {
        console.error('导出QQ好友到Excel失败', friends, error);
    });
    // 完成
    indicator.complete();
    return friends;
}

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