/**
 * Boards 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_BOARDS = {

    /**
     * 获取留言列表
     * @param {integer} page 第几页
     */
    getBoards(page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Boards.pageSize,
            "s": Math.random(),
            "format": "jsonp",
            "num": QZone_Config.Boards.pageSize,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.BOARD_LIST_URL, params);
    },

    /**
     * 获取留言人
     * @param {object} board 留言对象
     */
    getOwner(board) {
        return board.nickname || board.nick || '神秘者';
    }
};
