/**
 * 公共模块：账号/名片/点赞/头像/表情/坐标等公共逻辑
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_COMMON = {
    /**
     * 是否为备份QQ号
     * @param {Number} uin 
     * @returns 
     */
    isTargetUin(uin) {
        return QZone.Common.Target.uin == uin;
    },

    /**
     * 添加评论的配图下载任务
     * @param {Object} item 
     * @param {String} module 
     * @param {StatusIndicator} indicator 
     */
    async addCommentImageDownloadTasks(item, module, indicator) {
        const module_dir = module + '/images';
        // 评论内容
        const comments = item.custom_comments || item.comments || [];
        for (const comment of comments) {
            // 评论包含图片
            const images = comment.pic || [];
            for (const image of images) {
                await API.Utils.addDownloadTasks(module, image, image.hd_url || image.b_url, module_dir, item, QZone[module].FILE_URLS);
                indicator && indicator.addSuccess(1);
            }

            // 回复包含图片，理论上回复现在不能回复图片，兼容一下
            const replies = comment.list_3 || comment.replies || comment.replyList || [];
            for (const repItem of replies) {
                const repImages = repItem.pic || [];
                for (const repImage of repImages) {
                    await API.Utils.addDownloadTasks(module, repImage, repImage.hd_url || repImage.b_url, module_dir, item, QZone[module].FILE_URLS);
                    indicator && indicator.addSuccess(1);
                }
            }
        }
    },

    /**
     * 获取评论人
     * @param {Comment} comment 评论
     */
    getCommentUser(comment) {
        if (comment.poster) {
            comment.poster.id = comment.poster.id || comment.poster.uin || comment.poster.fuin;
            comment.poster.uin = comment.poster.uin || comment.poster.id || comment.poster.fuin;
            return comment.poster;
        }
        return {
            uin: comment.uin || comment.fuin,
            name: comment.name || comment.nick || comment.nickname
        }
    },

    /**
     * 添加评论的表情下载任务
     * @param {Object} item 
     */
    addCommentEmoticonDownloadTasks(item) {
        const comments = item.custom_comments || item.comments || item.replyList || [];
        for (const comment of comments) {

            // 评论人
            API.Common.formatContent(API.Common.getCommentUser(comment).name, "HTML", false, false, false, true, false);

            // 评论内容
            API.Common.formatContent(comment.content, "HTML", false, false, false, true, false);

            // 回复内容
            const replies = comment.list_3 || comment.replies || comment.replyList || [];
            for (const repItem of replies) {

                // 评论人
                API.Common.formatContent(API.Common.getCommentUser(repItem).name, "HTML", false, false, false, true, false);

                // 评论内容
                API.Common.formatContent(repItem.content, "HTML", false, false, false, true, false);
            }
        }
    },

    /**
     * 添加评论的表情下载任务
     * @param {Array} items 说说、日志等，需遵从item.custom_comments || item.comments
     */
    addAllCommentEmoticonDownloadTasks(items) {
        if (API.Common.isQzoneUrl()) {
            // QQ空间外链或已备份项，跳过
            return;
        }
        for (const item of items) {
            if (!API.Common.isNewItem(item)) {
                // QQ空间外链或已备份项，跳过
                return;
            }
            this.addCommentEmoticonDownloadTasks(item);
        }
    },

    /**
     * 基于相片获取相片的文件夹结构路径
     * @param {Date} dateTime 日期时间
     * @param {String} fileStructureType 归类方式
     */
    getFileStructureFolderPath(dateTime, fileStructureType) {
        let folder = '';
        switch (fileStructureType) {
            case 'Year':
                // 年份/文件
                folder = API.Utils.formatDate(dateTime / 1000, 'yyyy年');
                break;
            case 'Month':
                // 年份/月份/文件
                folder = API.Utils.formatDate(dateTime / 1000, 'yyyy年/MM月');
                break;
            case 'Date':
                // 年份/月份/日期/文件
                folder = API.Utils.formatDate(dateTime / 1000, 'yyyy年/MM月/dd日');
                break;
            default:
                break;
        }
        return folder;
    },

    /**
     * 获取来源类型（该判断不严谨）
     */
    getSourceType(source) {
        if (source.tid) {
            return 'Messages';
        } else if (source.vid) {
            return 'Videos';
        } else if (source.phototype) {
            return 'Images';
        } else if (source.blogid) {
            return 'Blogs';
        }
        return 'Others';
    },

    /**
     * 获取用户统计信息
     */
    getUserStatistics() {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "param": 16,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.USER_OVERVIEW_URL, params);
    },

    /**
     * 获取用户信息
     */
    getUserInfos() {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "vuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "fupdate": 1,
            "rd": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.USER_INFO_URL, params);
    },

    /**
     * 获取点赞列表
     * @param {string} unikey 来源Key
     */
    getLikeInfo(unikey) {
        let params = {
            "fupdate": 1,
            "unikey": unikey,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
        }
        return API.Utils.get(LIKE_COUNT_URL, params);
    },

    /**
     * 获取点赞列表
     * @param {string} unikey 来源Key
     * @param {string} begin_uin 分页拉取，第一次为0，以后为上次数据最末uin的值
     */
    getLikeList(unikey, begin_uin) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "unikey": unikey,
            "begin_uin": begin_uin || 0,
            "query_count": 60,
            "if_first_page": begin_uin === 0 ? 1 : 0, //标识是否为首次请求 第一次请求为1，以后为0
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.LIKE_LIST_URL, params);
    },

    /**
     * 获取用户名片
     */
    getUserCardInfo(uin) {
        const params = {
            "uin": uin,
            "fupdate": 1,
            "rd": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
        }
        return API.Utils.get(REST_URLS.USER_CARD_URL, params);
    },

    /**
     * 获取用户空间地址
     */
    getUserUrl(uin) {
        return 'https://user.qzone.qq.com/' + uin;
    },

    /**
     * 获取唤起QQ聊天地址
     * @param {string} uin 目标QQ号
     */
    getMessageUrl(uin) {
        return "tencent://message/?uin=" + uin;
    },

    /**
     * 获取用户空间超链接
     * @param {string} uin 目标QQ号
     * @param {string} nickName 目标昵称
     * @param {string} type 类型
     */
    getUserLink(uin, nickName, type, isConfig) {
        if (isConfig && !QZone_Config.Common.hasUserLink) {
            return nickName;
        }
        return API.Utils.getLink(this.getUserUrl(uin), nickName, type);
    },

    /**
     * 获取用户空间超链接
     * @param {string} uin 目标QQ号
     * @param {string} nickName 目标昵称
     * @param {string} type 类型
     */
    getMessageLink(uin, nickName, type) {
        return API.Utils.getLink(this.getMessageUrl(uin), nickName, type);
    },

    /**
     * 是否为指定下载方式
     * @param {string} type 类型
     */
    isDownloadType(type) {
        // 文件备份类型
        let downloadType = QZone_Config.Common.downloadType;
        // 是否为QQ空间外链
        return downloadType === type;
    },

    /**
     * 下载工具是否为QQ空间外链
     */
    isQzoneUrl() {
        return this.isDownloadType('QZone');
    },

    /**
     * 下载工具是否为迅雷
     */
    isThunder() {
        return this.isDownloadType('Thunder');
    },

    /**
     * 下载工具是否为Aria2
     */
    isAria2() {
        return this.isDownloadType('Aria2');
    },

    /**
     * 下载工具是否为助手内部
     */
    isFile() {
        return this.isDownloadType('File');
    },

    /**
     * 下载工具是否为浏览器
     */
    isBrowser() {
        return this.isDownloadType('File');
    },

    /**
     * 获取用户空间的头像在线地址
     */
    getUserLogoUrl(uin) {
        // 桌面端修复：接口返回的 uin 可能是数字字符串（'2568678134'），
        // _.isFinite 对字符串返回 false 会误入 py.qlogo.cn/friend（该端点已失效，返回 400）；
        // 统一按「纯数字」判断走 store.qq.com，仅真正的非数字 uin（朋友网/腾讯微博）走 py 分支。
        if (!/^\d+$/.test(String(uin == null ? '' : uin))) {
            // 这里简单判断一下，不是数字，就认为是朋友网的，腾讯微博的，也当朋友网，使用who判断太麻烦了。
            return 'http://py.qlogo.cn/friend/{0}/audited/100'.format(uin);
        }
        return "https://qlogo{host}.store.qq.com/qzone/{uin}/{uin}/{size}".format({
            host: QZone_Config.Common.AvatarHost <= 0 ? uin % 4 || 1 : QZone_Config.Common.AvatarHost,
            uin: uin,
            size: 100
        });
    },

    /**
     * 获取用户空间的头像本地地址
     */
    getUserLogoLocalUrl(uin, isAppendPrePath, count) {
        let filePath;
        if (!this.isQzoneUrl()) {
            filePath = 'Common/images/' + uin;
        }
        return API.Common.getMediaPath(this.getUserLogoUrl(uin), filePath, isAppendPrePath, count);
    },

    /**
     * 获取图片Class乐行
     * @param {Object} message 说说
     */
    getImgClassType(message, isShare) {
        let medias = isShare ? message.source.images || [] : message.custom_images || [];
        if (message.custom_magics && message.custom_magics.length > 0) {
            medias = medias.concat(message.custom_magics || []);
        }
        if (message.custom_videos && message.custom_videos.length > 0) {
            medias = medias.concat(message.custom_videos || []);
        }
        if (medias.length == 3) {
            // 数量为3，小图，放一行
            return 'three';
        } else if (1 < medias.length && medias.length <= 4) {
            // 数量为2-4的，大图
            return 'two';
        } else if (5 <= medias.length) {
            // 数量大于5的，小图
            return 'three';
        }
        return '';
    },

    /**
     * 转换微信新表情
     */
    formatWxEmoji(content, type) {
        const contentList = parseEmoji(content);
        const imgRelativePath = 'https://cdn.jsdelivr.net/gh/ShunCai/QZoneExport@dev/src/img/emoji';
        const result = [];
        for (const _content of contentList) {
            if (_content.type === 1) {
                result.push(_content.content);
            }
            if (_content.type === 2) {
                const url = imgRelativePath + "/" + _content.image;
                const res = type === 'MD' ? API.Utils.getImagesMarkdown(url) : "<img src='{0}' >".format(url);
                result.push(res);
            }
        }
        return result.join('');
    },

    /**
     * 获取备份QQ的FS根目录
     * @returns /QQ空间备份_QQ号
     */
    getRootFolder() {
        return FOLDER_ROOT + '_' + QZone.Common.Target.uin;
    },

    /**
     * 获取备份QQ的FS根目录
     * @returns /QQ空间备份_QQ号
     */
    getRootFolderName() {
        return QZone.Common.Config.ZIP_NAME + '_' + QZone.Common.Target.uin;
    },

    /**
     * 获取模块的FS根目录
     * @param {string} module 模块名称
     * @returns /QQ空间备份_QQ号/模块名称
     */
    getModuleRoot(module) {
        return API.Common.getRootFolder() + '/' + QZone[module].ROOT;
    },

    /**
     * 获取多媒体路径
     * @param {string} url 远程URL
     * @param {string} filepath 本地文件路径
     * @param {Boolean} isAppendPrePath 是否追加前一个路径
     * @param {Number} count 追加次数，默认1
     */
    getMediaPath(url, filepath, isAppendPrePath, count) {
        if (!filepath) {
            return url;
        }
        count = count || 1;
        if (isAppendPrePath) {
            for (let i = 0; i < count; i++) {
                filepath = '../' + filepath;
            }
        }
        return filepath;
    },

    /**
     * 获取坐标的地址信息
     * @param {Number} lat 纬度
     * @param {Number} lng 经度
     */
    getLbsInfo(lat, lng) {
        const params = {
            "location": '{0},{1}'.format(lat, lng),
            "key": QZone_Config.Dev.Maps.TxKey
        };
        return API.Utils.get(REST_URLS.MAP_LBS_INFO, params);
    },

    /**
     * 转换坐标到腾讯坐标，也就是火星系坐标
     * @param {Number} lat 纬度
     * @param {Number} lng 经度
     */
    toTxLbs(lat, lng, type) {
        const params = {
            "locations": '{0},{1}'.format(lat, lng),
            "type": type || "1",
            "key": QZone_Config.Dev.Maps.TxKey
        };
        // 1 GPS坐标
        // 2 sogou经纬度
        // 3 baidu经纬度
        // 4 mapbar经纬度
        // 5 [默认]腾讯、google、高德坐标
        // 6 sogou墨卡托
        return API.Utils.get(REST_URLS.TO_TX_LBS, params);
    },

    /**
     * 添加表情下载任务
     * @param {string} content 表情内容
     * @returns 
     */
    addEmoticonDowanloadTask(content) {
        if (this.isQzoneUrl() || !content) {
            return content;
        }
        // 内置表情库清单（emoticons.js 注入）：命中的表情无需网络下载，
        // 备份时由主进程从内置库直接复制到 Common/images/
        // roster 给出「id → 真实文件名」（经典 .gif / 魔法 .png），
        // 没有 roster 时回落到旧的 qq 数组判断（兼容旧构建产物）
        const manifest = window.__EMOTICONS_MANIFEST || { qq: [], wx: [], roster: {} };
        const roster = manifest.roster || {};
        const qqSet = new Set((manifest.qq || []).map(String));

        // 匹配QQ表情地址
        const imageUrls = content.match(/(https|http):\/\/qzonestyle.gtimg.cn\/qzone\/em\/e\d+.gif/g) || [];
        // 遍历，并添加任务
        for (const imageUrl of imageUrls) {
            // 内置表情：跳过下载（本地已有，主进程会复制进备份目录）
            const em = /e(\d+)\.gif$/.exec(imageUrl);
            if (em && (roster[em[1]] || qqSet.has(em[1]))) {
                continue;
            }
            let custom_filename = QZone.Common.FILE_URLS.get(imageUrl);
            if (custom_filename) {
                continue;
            }

            // 文件名称
            custom_filename = this.getEmoticonFileName(imageUrl, 'gif');

            // 添加下载任务
            API.Utils.newDownloadTask('Common', imageUrl, 'Common/images', custom_filename);
            QZone.Common.FILE_URLS.set(imageUrl, custom_filename);
        }

        // 匹配微信表情地址
        const wxImageUrls = content.match(/https:\/\/cdn.jsdelivr.net\/gh\/ShunCai\/QZoneExport@dev\/src\/img\/emoji\/(.{1,15}).png/g) || [];
        // 遍历，并添加任务
        for (const imageUrl of wxImageUrls) {
            // 内置表情：跳过下载
            const wm = /\/([^/]+)\.png$/.exec(imageUrl);
            if (wm && (manifest.wx || []).includes(wm[1])) {
                continue;
            }
            let custom_filename = QZone.Common.FILE_URLS.get(imageUrl);
            if (custom_filename) {
                continue;
            }

            // 文件名称
            custom_filename = this.getEmoticonFileName(imageUrl, 'png');

            // 添加下载任务
            API.Utils.newDownloadTask('Common', imageUrl, 'Common/images', custom_filename);
            QZone.Common.FILE_URLS.set(imageUrl, custom_filename);
        }

        return content;
    },

    /**
     * 替换表情路径
     * @param {string} content 表情内容
     * @returns 
     */
    formatEmoticonPath(content) {
        if (this.isQzoneUrl() || !content) {
            return content;
        }

        // 替换QQ表情地址（v4.7.2：按 roster 的真实文件名定位，魔法表情多为 .png；
        // 此前写死 e{id}.gif，导致备份里 224 个 png 表情全部指向不存在的文件）
        const roster = (window.__EMOTICONS_MANIFEST || {}).roster || {};
        content = content.replace(/(https|http):\/\/qzonestyle.gtimg.cn\/qzone\/em\/e(\d+).gif/g, function(emoji, protocol, eid) {
            const fileName = roster[eid] || `e${eid}.gif`;
            return API.Common.getMediaPath(emoji, 'Common/images/' + fileName, true);
        });

        // 替换微信表情地址
        content = content.replace(/https:\/\/cdn.jsdelivr.net\/gh\/ShunCai\/QZoneExport@dev\/src\/img\/emoji\/(.{1,15}).png/g, function(emoji, eid) {
            return API.Common.getMediaPath(emoji, 'Common/images/{0}.png'.format(eid), true);
        });

        return content;
    },

    /**
     * 获取表情文件名
     * @param {string} url 文件地址
     */
    getEmoticonFileName(url, mineType) {
        const result = new RegExp('(http|https):\/\/.+\/(.+\.' + mineType + ')', 'gi').exec(API.Utils.toHttp(url || ''));
        if (result) {
            return result[2];
        }
        return API.Utils.newSimpleUid(8, 16) + '.' + mineType;
    }
};
