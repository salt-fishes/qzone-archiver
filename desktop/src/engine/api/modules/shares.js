/**
 * Shares 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
/**
 * 分享源
 */
class ShareSource {

    /**
     * 
     * @param {string} title 分享标题
     * @param {string} desc 分享内容
     * @param {string} url 分享URL
     * @param {string} source_url 分享来源URL
     * @param {string} source_name 分享来源名称
     * @param {integer} count 分享次数
     * @param {Array} images 图片
     */
    constructor(title, desc, url, source_url, source_name, count, images) {
        this.title = title || '' // 标题
        this.desc = desc || '' // 内容
        this.url = url || '' // URL
        this.from = {
                url: source_url,
                name: source_name
            } // 来源
        this.count = count || 0 // 分享次数
        this.images = images || [] // 来源的图片
    }
}

/**
 * 分享信息
 */
class ShareInfo {

    /**
     * 
     * @param {integer} id ID
     * @param {string} uin 分享人
     * @param {string} nickname 分享人昵称
     * @param {string} type 分享类型
     * @param {string} desc 分享描述
     * @param {ShareSource} source 分享来源
     * @param {integer} shareTime 分享时间
     */
    constructor(id, uin, nickname, type, desc, source, shareTime) {
        this.id = id // ID
        this.uin = uin // 分享人
        this.nickname = nickname || '' // 分享人昵称
        this.type = type || '' // 分享类型
        this.desc = desc || '' // 分享信息
        this.source = source || {} // 分享来源
        this.shareTime = shareTime || 0 // 分享时间
        this.likes = [] // 点赞人
        this.likeTotal = 0 // 点赞数
        this.uniKey = '00' + uin + '00' + id
        this.comments = [] // 评论列表
        this.commentTotal = 0 // 评论数
    }
}

/**
 * 分享数据
 */
class ShareData {

    /**
     * 
     * @param {Array} list 分享信息
     * @param {integer} total 条目总数据
     */
    constructor(list, total) {
        this.list = list || [] // 分享信息
        this.total = total || 0 // 条目总数据
    }
}

const API_MODULE_SHARES = {

    /**
     * 获取类型
     */
    getDisplayType(innerType) {
        const Share_Types = {
            1: '日志',
            2: '相册',
            3: "照片",
            4: "网页",
            5: '视频',
            10: '商品',
            13: '新闻',
            17: '微博',
            18: "音乐"
        }
        return Share_Types[innerType] || "其它";
    },

    getSourceType(url, defaultName) {
        if (!url) {
            return defaultName;
        }
        for (const sourceType of QZone_Config.Shares.SourceType) {
            const name = sourceType.name;
            if (Array.isArray(sourceType.regulars)) {
                for (const reg of sourceType.regulars) {
                    if (url.match(new RegExp(reg))) {
                        return name;
                    }
                }
            } else {
                if (url.match(new RegExp(sourceType.regulars))) {
                    return name;
                }
            }
        }
        if ('undefined' === defaultName) {
            // 特殊处理undefined字符串
            return '网页';
        }
        return defaultName;
    },

    /**
     * 获取分享列表
     * @param {integer} page 当前页
     */
    getList(page) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "page": page, // 当前页，从1开始
            "num": QZone_Config.Shares.pageSize, // 每页条目数
            "spaceuin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "isfriend": 0,
            "ttype": 0 // 全部分享类型
        }
        return API.Utils.get(REST_URLS.SHARE_LIST_URL, params);
    },

    /**
     * 获取分享评论列表
     * @param {integer} page 当前页
     */
    getComments(id, page) {
        const params = {
            "fupdate": 2,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Shares.Comments.pageSize,
            "num": QZone_Config.Shares.Comments.pageSize,
            "order": 1,
            "topicId": (QZone.Common.Target.uin || API.Utils.initUin().Target.uin) + "_" + id,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "ref": "",
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.SHARE_COMMENTS_URL, params);
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors(targeId, pageIndex) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 202, //202
            "param": targeId,
            "beginNum": QZone_Config.Shares.Visitor.pageSize * pageIndex + 1,
            "num": QZone_Config.Shares.Visitor.pageSize,
            "needFriend": 1, // TODO 待确认，是否需要QQ好友还是仅仅包含QQ好友
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.VISITOR_SINGLE_LIST_URL, params);
    }

};
