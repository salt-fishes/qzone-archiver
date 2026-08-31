/**
 * Friends 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_FRIENDS = {

    /**
     * 获取QQ好友列表
     * @param {string} uin QQ号
     */
    getFriends() {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "follow_flag": 0, //是否获取关注的认证空间
            "groupface_flag": 0, //是否获取QQ群组信息
            "fupdate": 1,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.FRIENDS_LIST_URL, params);
    },

    /**
     * 获取QQ好友列表（排序）
     * @param {string} uin QQ号
     */
    getSortFriends() {
        let params = {
            "res_uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "res_type": 'normal', // 不知道干嘛的
            "format": 'jsonp', //返回JSON
            "count_per_page": 10, // 不知道干嘛的，像是每页条目数，但是并不生效
            "page_index": 0, // 不知道干嘛的，像是页数，但是并不生效
            "page_type": 0, // 不知道干嘛的
            "mayknowuin": '', // 不知道干嘛的
            "qqmailstat": '', // 不知道干嘛的
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.FRIENDS_SORT_LIST_URL, params);
    },


    /**
     * 获取QQ好友详情
     */
    getQZoneUserInfo() {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "vuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "fupdate": "1",
            "rd": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        // code = -3000 未登录
        // code = -4009 无权限
        return API.Utils.get(REST_URLS.USER_INFO_URL, params);
    },

    /**
     * 获取QQ好友添加时间
     * @param {string} 目标QQ号
     */
    getFriendshipTime(targetUin) {
        let params = {
            "activeuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "passiveuin": targetUin,
            "situation": 1,
            "isCalendar": 1,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.FRIENDSHIP_INFO_URL, params);
    },

    /**
     * 获取首页基本信息
     * @param {string} 目标QQ号
     */
    getZoneAccess(targetUin) {
        let params = {
            "uin": targetUin,
            "param": '3_' + targetUin + '_0|8_8_' + targetUin + '_1_1_0_0_1|15|16',
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.USER_OVERVIEW_URL, params);
    },

    /**
     * 获取特别关心列表
     */
    getSpecialCare() {
        const params = {
            "uin": QZone.Common.Owner.uin,
            "do": 3,
            "fupdate": 1,
            "rd": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.SPECIAL_CARE_LIST_URL, params);
    },

    /**
     * 获取共同好友
     * @param {Object} friend 好友
     */
    getCommonFriend(friend) {
        const list = [];
        if (!friend || !friend.common || !friend.common.friend) {
            return list;
        }
        return friend.common.friend;
    },

    /**
     * 获取共同好友
     * @param {Object} friend 好友
     */
    getShowCommonFriend(friend) {
        if (friend.isMe) {
            return '本人';
        }
        const friends = API.Friends.getCommonFriend(friend);
        return friends.length;
    },

    /**
     * 获取共同群组
     * @param {Object} friend 好友
     */
    getCommonGroup(friend) {
        const list = [];
        if (!friend || !friend.common || !friend.common.group) {
            return list;
        }
        for (const item of friend.common.group) {
            list.push(item['name'] || item);
        }
        friend.common.group = list;
        return list;
    },

    /**
     * 获取共同群组
     * @param {Object} friend 好友
     */
    getShowCommonGroup(friend, joinStr) {
        if (friend.isMe) {
            return '本人';
        }
        const groups = API.Friends.getCommonGroup(friend);
        return groups.length == 0 ? '无' : groups.join(joinStr);
    },

    /**
     * 获取相识显示时间
     * @param {Object} friend 好友
     */
    getShowFriendTime(friend, showType) {
        if (friend.isMe) {
            return '本人';
        }
        if (!friend.addFriendTime || friend.addFriendTime === 0) {
            return '未知';
        }
        if (0 === showType) {
            return API.Utils.formatDate(friend.addFriendTime);
        }
        return moment().from(moment(friend.addFriendTime * 1000), true);
    },

    /**
     * 获取QQ好友关系类型
     * @param {Object} friend 好友信息
     */
    getShowFriendType(friend, showType) {
        let showText = '未知';
        let showClass = 'fa-user-times text-danger';
        if (friend.isMe) {
            showText = '本人';
            showClass = 'fa-user-plus';
        }
        if (friend.deleted) {
            showText = '已删';
            showClass = 'fa-trash text-danger';
        } else {
            if (friend.isFriend === 2) {
                showText = '单向';
            } else if (friend.isFriend === 1) {
                showText = '正常';
                showClass = 'fa-user-plus';
            }
        }
        if (showType === 'HTML') {
            return `<span title="好友关系：{0}" class="fa {1}"></span>`.format(showText, showClass);
        }
        return showText;
    },

    /**
     * 获取空间权限
     * @param {Object} friend 好友信息
     */
    getShowAccessType(friend, showType) {
        let showText = '未知';
        let showClass = 'fa-lock text-danger';
        if (friend.isMe) {
            showText = '本人';
            showClass = 'fa-unlock';
        }
        if (friend.access === false) {
            showText = '无';
        } else if (friend.access === true) {
            showText = '有';
            showClass = 'fa-unlock';
        }
        if (showType === 'HTML') {
            return `<span title="访问权限：{0}" class="fa {1}"></span>`.format(showText, showClass);
        }
        return showText;
    },

    /**
     * 获取特别关心显示值
     * @param {Object} friend 好友信息
     */
    getShowCare(friend, showType) {
        const showText = friend.isMe ? '本人' : friend.care ? '已关心' : '未关心'
        if (showType === 'HTML') {
            return `<span title="{0}" class="fa {1}"></span>`.format(showText, friend.care ? 'fa-heartbeat text-danger' : 'fa-heart-o');
        }
        return showText;
    },

    /**
     * 亲密度显示
     * @param {Object} friend 好友信息
     */
    getShowIntimacyScore(friend) {
        if (friend.isMe) {
            return '本人';
        }
        return friend.intimacyScore || 0;
    },

    /**
     * QQ通讯显示值
     * @param {Object} friend 好友信息
     */
    getShowMessage(friend) {
        return `<a href="{0}" target="_blank">
                    <span title="与TA聊天" class="fa fa-qq"></span>
                </a>`
            .format(API.Common.getMessageUrl(friend.uin));
    }
};
