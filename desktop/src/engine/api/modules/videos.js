/**
 * Videos 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_VIDEOS = {

    /**
     * 基于相片获取相片的文件夹结构路径
     * @param {Object} video 相片
     */
    getFileStructureFolderPath(video) {

        // 上传时间
        const dateTime = API.Utils.parseDate(video.uploadtime || video.uploadTime).getTime();

        // 文件夹结构
        const fileStructureType = QZone_Config.Videos.fileStructureType;

        return API.Common.getFileStructureFolderPath(dateTime, fileStructureType);
    },

    /**
     * 获取视频列表
     * @param {integer} page 当前页
     */
    getVideos(page) {
        let params = {
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 4,
            "getMethod": 2,
            "start": page * QZone_Config.Videos.pageSize,
            "count": QZone_Config.Videos.pageSize,
            "need_old": 0,
            "getUserInfo": 0,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "refer": "qzone",
            "source": "qzone",
            "callbackFun": "shine0",
            "_": Date.now()
        }
        return API.Utils.get(REST_URLS.VIDEO_LIST_URL, params);
    },

    /**
     * 获取视频评论列表
     * @param {string} tid 说说ID
     * @param {integer} page 当前页
     */
    getComments(tid, page) {
        const params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Videos.Comments.pageSize,
            "num": QZone_Config.Videos.Comments.pageSize,
            "order": 0,
            "topicId": QZone.Common.Target.uin + "_" + tid,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "ref": "qzone",
            "need_private_comment": 1,
            "code_version": 1,
            "out_charset": "UTF-8",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.MESSAGES_VIDEOS_COMMONTS_URL, params);
    },

    /**
     * 获取视频文件名
     * @param {string} url 视频地址
     */
    getFileName(url) {
        let result = /http:\/\/(.+)\/(.+\.mp4)\?(.+)/gi.exec(API.Utils.toHttp(url || ''));
        if (result) {
            return result[2];
        }
        return API.Utils.newSimpleUid(8, 16) + '.mp4';
    }
};
