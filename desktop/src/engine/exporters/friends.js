/**
 * 好友导出（P4，迁移自 modules/friends.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Friends = {
  /**
   * 导出好友到 SPA（迁移自 modules/friends.js exportToSpa）
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
  exportToSpa: async(friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    await indicator.setIndex('SPA');

    try {
        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Friends');
        // 创建 data 子目录（SPA 专用数据文件目录）
        const dataFolder = moduleFolder + '/data';
        await API.Utils.createFolder(dataFolder);

        // 1. 生成轻量索引：仅保留 SPA 首屏需要的字段
        const index = friends.map(f => {
            // 添加时间：addFriendTime 可能为 0（自己或未获取）
            const ts = f.addFriendTime || 0;
            const timeStr = ts ? API.Utils.formatDate(ts) : '';
            return {
                uin: f.uin || 0,
                name: f.name || '',
                remark: f.remark || '',
                groupName: f.groupName || '',
                groupId: f.groupid || 0,
                addFriendTime: ts,
                time: timeStr,
                intimacyScore: f.intimacyScore || 0,
                care: !!f.care,
                isFriend: f.isFriend !== false,
                deleted: !!f.deleted,
                hasAvatar: !!f.custom_avatar || !!f.avatar
            };
        });
        await API.Common.writeJsonToJs('friendsIndex', index, dataFolder + '/friends-index.js');
        console.info('生成 SPA 好友索引完成', { total: index.length });

        // 2. 按分组聚合全量数据（单文件，好友总量通常不大）
        //    分组名可能为空（非好友或未分组），统一归入"未分组"
        const groupMap = new Map();
        for (const f of friends) {
            const groupName = f.groupName || '未分组';
            if (!groupMap.has(groupName)) groupMap.set(groupName, []);
            groupMap.get(groupName).push(f);
        }
        // 转为数组结构，保留分组顺序
        const groupData = Array.from(groupMap.entries()).map(([name, items]) => ({
            groupName: name,
            count: items.length,
            friends: items
        }));
        await API.Common.writeJsonToJs('friendsGroup', groupData, dataFolder + '/friends-group.js');
        console.info('生成 SPA 好友分组数据完成', {
            groups: groupData.length,
            groupNames: groupData.map(g => g.groupName + '(' + g.count + ')')
        });

        console.info('导出好友到 SPA 完成', { total: friends.length, groups: groupData.length });

    } catch (error) {
        console.error('导出好友到 SPA 异常', error, friends);
    }

    // 完成
    indicator.complete();
    return friends;
  },

  /**
   * 导出QQ好友到HTML（迁移自 modules/friends.js exportToHtml）
   * @param {Array} friends 好友列表
   */
  exportToHtml: async(friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    await indicator.setIndex('HTML');

    try {

        // 模块文件夹路径
        const moduleFolder = API.Common.getModuleRoot('Friends');
        // 创建模块文件夹
        await API.Utils.createFolder(moduleFolder + '/json');

        // 基于JSON生成JS
        await API.Common.writeJsonToJs('friends', friends, moduleFolder + '/json/friends.js');

        // 基于模板生成HTML
        await API.Common.writeHtmlofTpl('friends', null, moduleFolder + "/index.html");

    } catch (error) {
        console.error('导出好友到HTML异常', error, favorites);
    }

    // 更新完成信息
    indicator.complete();
    return friends;
  },


  /**
   * 导出QQ好友到MarkDown（迁移自 modules/friends.js exportToMarkDown）
   * @param {Array} friends 好友列表
   */
  exportToMarkDown: async(friends) => {
    // 进度更新器
    const indicator = new StatusIndicator('Friends_Export');
    await indicator.setIndex('Markdown');

    // 群组分组
    const groupMaps = API.Utils.groupedByField(friends, 'groupName');

    // MD内容
    const contents = [];
    for (const [groupName, groupItems] of groupMaps) {
        contents.push('###### ' + groupName + "(" + groupItems.length + ")");
        for (const item of groupItems) {
            let nickname = item.remark || item.name;
            // 备份/昵称
            contents.push('\r\n');
            contents.push('- {0}'.format(API.Common.getUserLink(item.uin, nickname, "MD")));
            contents.push('\r\n');

            // 其它信息
            if (QZone_Config.Friends.SpecialCare) {
                contents.push('\t- 特别关心：{0}\r\n'.format(API.Friends.getShowCare(item)));
            }
            if (QZone_Config.Friends.Interactive) {
                contents.push('\t- 相识时间：{0}\r\n'.format(API.Friends.getShowFriendTime(item, 0)));
            }
            if (QZone_Config.Friends.ZoneAccess) {
                contents.push('\t- 空间权限：{0}\r\n'.format(API.Friends.getShowAccessType(item)));
            }
            if (QZone_Config.Friends.Interactive) {
                contents.push('\t- 好友类型：{0}\r\n'.format(API.Friends.getShowFriendType(item)));
                contents.push('\t- 亲密度：{0}\r\n'.format(API.Friends.getShowIntimacyScore(item)));
                contents.push('\t- 共同好友：{0}\r\n'.format(API.Friends.getShowCommonFriend(item)));
                contents.push('\t- 共同群组：{0}\r\n'.format(API.Friends.getShowCommonGroup(item, ',')));
            }
        }
        contents.push('\r\n');
        contents.push('---');
        contents.push('\r\n');
    }
    let content = contents.join('');
    await API.Utils.writeText(content, API.Common.getModuleRoot('Friends') + '/QQ好友.md').then((fileEntry) => {
        console.info("导出QQ好友的MarkDown文件到FileSystem完成", fileEntry);
    }).catch((error) => {
        console.error("导出QQ好友的MarkDown文件到FileSystem异常", error);
    });
    // 完成
    indicator.complete();
    return friends;
  },


  /**
   * 导出QQ好友到JSON（迁移自 modules/friends.js exportToJson）
   * @param {Array} friends 好友列表
   */
  exportToJson: async(friends) => {
    // 状态更新器
    const indicator = new StatusIndicator('Friends_Export');
    await indicator.setIndex('JSON');

    let json = JSON.stringify(friends);
    await API.Utils.writeText(json, API.Common.getModuleRoot('Friends') + '/friends.json').then((fileEntry) => {
        console.info("导出QQ好友的JSON文件到FileSystem完成", fileEntry);
    }).catch((error) => {
        console.error("导出QQ好友的JSON文件到FileSystem异常", error);
    });

    // 完成
    indicator.complete();
    return friends;
  },
};
