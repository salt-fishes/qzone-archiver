/**
 * Visitors 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_VISITORS = {

    /**
     * 获取访客列表
     * @param {integer} page 当前页
     */
    getList(page) {
        const isOwner = QZone.Common.Owner.uin === QZone.Common.Target.uin;
        const params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "mask": isOwner ? 7 : 2,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "page": page,
            "fupdate": 1,
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        if (isOwner) {
            params.clear = 1;
            params.sd = Math.random()
        }
        return API.Utils.get(isOwner ? REST_URLS.VISITOR_MORE_LIST_URL : REST_URLS.VISITOR_SIMPLE_LIST_URL, params);
    },

    /**
     * 是否访问主页
     * @param {Object} item 访客
     */
    isHome(item) {
        item.blogs = item.blogs || [];
        item.photoes = item.photoes || [];
        item.shuoshuoes = item.shuoshuoes || [];
        item.shares = item.shares || [];
        return item.blogs.length === 0 && item.photoes.length === 0 && item.shuoshuoes.length === 0 && item.shares.length === 0;
    },

    /**
     * 获取访问标题
     * @param {Object} item 访客
     */
    getTitle(item) {
        item.blogs = item.blogs || [];
        item.photoes = item.photoes || [];
        item.shuoshuoes = item.shuoshuoes || [];
        item.shares = item.shares || [];
        if (API.Visitors.isHome(item)) {
            // 主页
            return "访问了主页";
        }
        const titles = [];
        // 说说
        if (item.shuoshuoes.length > 0) {
            titles.push('说说');
        }
        // 日志
        if (item.blogs.length > 0) {
            titles.push('日志');
        }
        // 相册
        if (item.photoes.length > 0) {
            titles.push('相册');
        }
        // 分享
        if (item.shares.length > 0) {
            titles.push('分享');
        }
        return '查看了' + titles.join('、');
    }
};
