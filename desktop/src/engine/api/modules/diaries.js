/**
 * Diaries 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_DIARIES = {

    /**
     * 获取私密日志列表
     *
     * @param {integer} page 第几页
     */
    getDiaries(page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "vuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "pos": page * QZone_Config.Diaries.pageSize,
            "numperpage": QZone_Config.Diaries.pageSize,
            "pwd2sig": "",
            "r": Math.random(),
            "fupdate": "1",
            "iNotice": "0",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "format": "jsonp",
            "ref": "qzone",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.DIARY_LIST_URL, params);
    },

    /**
     * 获取私密日志详情
     *
     * @param {string} uin QQ号
     * @param {integer} blogid 日志ID
     */
    getInfo(blogid) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "blogid": blogid,
            "pwd2sig": QZone.Common.Config.pwd2sig || "",
            "styledm": "qzonestyle.gtimg.cn",
            "imgdm": "qzs.qq.com",
            "bdm": "b.qzone.qq.com",
            "rs": Math.random(),
            "private": "1",
            "ref": "qzone",
            "refererurl": "https://qzs.qq.com/qzone/app/blog/v6/bloglist.html#nojump=1&catalog=private&page=1"
        };
        return API.Utils.get(REST_URLS.DIARY_INFO_URL, params);
    },

    /**
     * 获取日志评论列表
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getComments(blogid, page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "num": QZone_Config.Diaries.Comments.pageSize,
            "topicId": (QZone.Common.Target.uin || API.Utils.initUin().Target.uin) + "_" + blogid,
            "start": page * QZone_Config.Diaries.Comments.pageSize,
            "r": Math.random(),
            "iNotice": 0,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "format": "jsonp",
            "ref": "qzone",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.BLOGS_COMMENTS_URL, params);
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors(targeId, pageIndex) {
        const params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 2, //311：说说，2：日志
            "param": targeId,
            "beginNum": QZone_Config.Diaries.Visitor.pageSize * pageIndex + 1,
            "num": QZone_Config.Diaries.Visitor.pageSize,
            "needFriend": 1, // TODO 待确认，是否需要QQ好友还是仅仅包含QQ好友
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.VISITOR_SINGLE_LIST_URL, params);
    },

    /**
     * 获取日志阅读数
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getReadCount(blogIds) {
        const params = {
            "type": 1,
            "uinList": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "idList": blogIds.join('_'),
            "r": Math.random(),
            "iNotice": 0,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "format": "jsonp",
            "ref": "qzone",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk()
        };
        return API.Utils.get(REST_URLS.BLOGS_READ_COUNT_URL, params);
    }
};
