/**
 * Blogs 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_BLOGS = {

    getBlogMediaTypeTitle(e) {
        var t = {
            0: "日志中包含图片",
            13: "日志中包含视频"
        };
        for (var i in t) {
            if (API.Blogs.getEffectBit(e, i)) {
                return t[i];
            }
        }
        return null;
    },

    /**
     * 获取日志标签
     * @param {Object} item 日志详情
     * @returns 
     */
    getBlogLabel(item) {
        const allLabelCfg = [
            ["8", "审核不通过"],
            ["22", "审核中"],
            ["4", "置顶"],
            ["21", "推荐"],
            ["3", "转载"],
            ["28", "转载"],
            ["35", "转载"],
            ["36", "转载"]
        ];
        const labels = [];
        for (let i = 0; i < allLabelCfg.length; i++) {
            const bit = allLabelCfg[i][0];
            if (bit == 22) {
                continue;
            }
            if (API.Blogs.getEffectBit(item, bit)) {
                let label = allLabelCfg[i][1];
                if (labels.indexOf(label) > -1) {
                    continue;
                }
                labels.push(label);
            }
        }
        if (labels.length === 0) {
            labels.push('原创');
        }
        return labels;
    },

    getEffectBit(e, t) {
        if (t < 0 || t > 63) {
            throw new Error("nBit param error")
        }
        if (t < 32) {
            return (e.effect || e.effect1) & 1 << t
        } else if (t < 64) {
            return e.effect2 & 1 << t
        }
    },

    /**
     * 获取日志UniKey，用于获取点赞数据
     * @param {string} blogid 日志ID
     */
    getUniKey(blogid) {
        return 'http://user.qzone.qq.com/{0}/blog/{1}'.format(QZone.Common.Target.uin, blogid);
    },

    /**
     * 获取日志列表
     *
     * @param {string} uin QQ号
     * @param {integer} page 第几页
     */
    getBlogs(page) {
        let params = {
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "blogType": "0",
            "cateName": "",
            "cateHex": "",
            "statYear": new Date().getFullYear(),
            // 理论上可以用startTime来做增量
            // 但是目前先按其它类型导出的套路做增量判断吧
            // "startTime": 0,
            // "endTime": Math.floor(Date.now() / 1000),
            "reqInfo": "7",
            "pos": page * QZone_Config.Blogs.pageSize,
            "num": QZone_Config.Blogs.pageSize,
            "sortType": "0",
            "absType": QZone_Config.Blogs.viewType || '0', // 视图类型，0:列表视图，1:摘要视图
            "source": "0",
            "rand": Math.random(),
            "ref": "qzone",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "verbose": "1",
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.BLOGS_LIST_URL, params);
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
    },

    /**
     * 获取日志详情
     *
     * @param {integer} blogid 日志ID
     */
    getInfo(blogid) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "blogid": blogid,
            "styledm": "qzonestyle.gtimg.cn",
            "imgdm": "qzs.qq.com",
            "bdm": "b.qzone.qq.com",
            "mode": "2",
            "numperpage": "50",
            "timestamp": Math.floor(Date.now() / 1000),
            "dprefix": "",
            "inCharset": "gb2312",
            "outCharset": "gb2312",
            "ref": "qzone",
            "page": "1",
            "refererurl": "https://qzs.qq.com/qzone/app/blog/v6/bloglist.html#nojump=1&page=1&catalog=list"
        };
        return API.Utils.get(REST_URLS.BLOGS_INFO_URL, params);
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
            "num": QZone_Config.Blogs.Comments.pageSize,
            "topicId": (QZone.Common.Target.uin || API.Utils.initUin().Target.uin) + "_" + blogid,
            "start": page * QZone_Config.Blogs.Comments.pageSize,
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
            "beginNum": QZone_Config.Blogs.Visitor.pageSize * pageIndex + 1,
            "num": QZone_Config.Blogs.Visitor.pageSize,
            "needFriend": 1, // TODO 待确认，是否需要QQ好友还是仅仅包含QQ好友
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.VISITOR_SINGLE_LIST_URL, params);
    },

    /**
     * 读取日志DOM读取详细信息
     * @param {Object} jqPageDom 
     */
    readDetailInfo(jqPageDom) {
        // 获得网页中的日志JSON数据
        const blogData = API.Utils.readScriptVar(jqPageDom, /var g_oBlogData\s+=\s+({[\s\S]+});\s/);
        return blogData && JSON.parse(blogData[1]).data || null;
    },

    /**
     * 是否为模板日志
     * @param {Object} item 日志信息
     * @returns 
     */
    isTemplateBlog(item) {
        if (!item) {
            return false;
        }
        return item.exblogtype == 2 || item.blogType;
        // return item.exblogtype == 2;
    },

    /**
     * 读取模板日志内容
     * @param {Object} item 日志
     * @param {Object} blogPage DOM对象
     */
    readTemplateContent(blogPage) {
        // 重置前一篇模板日志内容
        window.g_oBlogContent = undefined;
        const reg_res = API.Utils.readScriptVar(blogPage, /var g_oBlogContent\s+=\s+'([\s\S]+\/div>)';/);
        eval((reg_res && reg_res[0] || '').replace('var g_oBlogContent', 'window.g_oBlogContent'))
        return window.g_oBlogContent;
    }
};
