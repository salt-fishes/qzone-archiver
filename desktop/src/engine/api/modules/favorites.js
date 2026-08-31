/**
 * Favorites 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_FAVORITES = {

    /**
     * 获取查询类型
     */
    getQueryType(innerType) {
        let Fav_Tyep = {
            0: "全部",
            1: "日志",
            2: "照片",
            3: "说说",
            4: "分享",
            5: "文字",
            6: "网页",
            7: "未知",
            8: "未知"
        }
        return Fav_Tyep[innerType] || "未知";
    },


    /**
     * 获取类型
     */
    getType(innerType) {
        let Fav_Tyep = {
            0: "全部",
            1: "网页",
            2: "照片",
            3: "日志",
            4: "照片",
            5: "说说",
            6: "文字",
            7: "分享",
            8: "未知"
        }
        return Fav_Tyep[innerType] || "未知";
    },

    /**
     * 获取收藏源用户
     * @param {Object} favorite 收藏
     */
    getFavoriteOwner(favorite) {
        const user = {
            uin: favorite.custom_uin,
            name: favorite.custom_name
        };
        switch (favorite.type) {
            case 3:
                // 日志                    
                user.uin = favorite.blog_info && favorite.blog_info.owner_uin;
                user.name = favorite.blog_info && favorite.blog_info.owner_name;
                break;
            case 4:
                if (favorite.album_info && favorite.album_info.owner_uin) {
                    // 相册收藏？暂无数据
                    user.uin = favorite.album_info.owner_uin;
                    user.name = favorite.album_info.owner_name;
                } else {
                    // 照片收藏
                    user.uin = favorite.photo_list && favorite.photo_list[0].owner_uin;
                    user.name = favorite.photo_list && favorite.photo_list[0].owner_name;
                }
                break;
            case 5:
                // 说说
                user.uin = favorite.shuoshuo_info && favorite.shuoshuo_info.owner_uin;
                user.name = favorite.shuoshuo_info && favorite.shuoshuo_info.owner_name;
                break;
            case 7:
                // 分享
                user.uin = favorite.share_info && favorite.share_info.owner_uin;
                user.name = favorite.share_info && favorite.share_info.owner_name;
                break;
            default:
                break;
        }
        return user;
    },

    /**
     * 获取收藏列表
     * @param {integer} page 当前页
     */
    getFavorites(page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "type": 0, //全部\
            "start": page * QZone_Config.Favorites.pageSize,
            "num": QZone_Config.Favorites.pageSize,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "need_nick": 1,
            "need_cnt": 0,
            "need_new_user": 0,
            "fupdate": 1,
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.FAVORITE_LIST_URL, params);
    },

    /**
     * 获取收藏分享的URL
     * @param {object} share_info 收藏分享信息
     */


    /**
     * 获取收藏分享的URL
     * @param {object} share_info 收藏分享信息
     */
    getShareUrl(share_info) {
        if (!share_info) {
            return "#";
        }
        // 相册分享
        if (share_info.album_info && Object.keys(share_info.album_info).length > 0) {
            return 'https://user.qzone.qq.com/{owner_uin}/photo/{id}'.format(share_info.album_info);
        }
        // 日志分享
        if (share_info.blog_info && Object.keys(share_info.blog_info).length > 0) {
            return 'https://user.qzone.qq.com/{owner_uin}/blog/{id}'.format(share_info.blog_info);
        }
        // 音乐分享
        if (share_info.music_list && share_info.music_list.length > 0) {
            return share_info.music_list[0].music_info.play_url;
        }
        // 视频分享
        if (share_info.video_list && share_info.video_list.length > 0) {
            return share_info.video_list[0].video_info.play_url;
        }
        return share_info.share_url;
    }
};
