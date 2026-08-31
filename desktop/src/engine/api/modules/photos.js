/**
 * Photos 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_PHOTOS = {

    /**
     * 基于相片获取相片的文件夹结构路径
     * @param {Object} photo 相片
     */
    getFileStructureFolderPath(photo) {

        // 原图时间、上传时间
        const dateTime = API.Utils.parseDate((photo.rawshoottime || photo.shootTime) || (photo.uploadtime || photo.uploadTime)).getTime();

        // 文件夹结构
        const fileStructureType = QZone_Config.Photos.Images.fileStructureType;

        return API.Common.getFileStructureFolderPath(dateTime, fileStructureType);
    },

    /**
     * 获取相片类型
     * @param {string} photo 相片对象
     */
    getPhotoType(photo) {
        const type = photo.phototype || 1;
        // 默认类型
        let photoType = "JPEG";
        switch (type) {
            case 1:
                photoType = "JPEG";
                break;
            case 2:
                photoType = "GIF";
                break;
            case 3:
                photoType = "PNG";
                break;
            case 4:
                photoType = "BMP";
                break;
            case 5:
                photoType = "JPEG";
                break;
        }
        return photoType;
    },

    /**
     * 获取相册路由
     */
    async getRoute() {
        let params = {
            "UIN": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "type": "json",
            "version": 2,
            "json_esc": 1,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        let data = await API.Utils.get(REST_URLS.PHOTOS_ROUTE_URL, params);
        data = API.Utils.toJson(data, /^photoDomainNameCallback\(/);

        var e = new RegExp("^domain_\\d$"),
            o, c = [];

        function u(t, a, e) {
            for (var i = 0, o = c.length; i < o; i++) {
                if (c[i].domain === t) {
                    c[i].failed = a;
                    return
                }
            }
            c.push({
                domain: t,
                failed: a,
                idcNum: e
            })
        }

        function m() {
            for (var e = 0, i = c.length; e < i; e++) {
                if (!c[e].failed) {
                    return c[e]
                }
            }
            return false
        }

        if (data.domain && data.domain["default"]) {
            o = data.domain["default"];
            if (data[o] && data[o].p) {
                u(data[o].p, 0, data.idcno || 102)
            }
        }
        for (o in data) {
            if (e.test(o) && data[o].p) {
                u(data[o].p, 0, 102)
            }
        }
        let res = m();
        QZone.Common.Target.route = res.idcNum || 102
        return QZone.Common.Target.route;
    },

    /**
     * 获取相册UniKey，用于获取点赞数据
     * @param {string} albumId 相册ID
     */
    getUniKey(albumId) {
        return 'http://user.qzone.qq.com/{0}/photo/{1}'.format(QZone.Common.Target.uin, albumId);
    },

    /**
     * 获取相片UniKey，用于获取点赞数据
     * @param {Object} photo 相片
     */
    getPhotoUniKey(photo) {
        return 'http://user.qzone.qq.com/{0}/photo/{1}/{2}^||^http://user.qzone.qq.com/{3}/batchphoto/{4}/{5}^||^1'.format(QZone.Common.Target.uin, photo.albumId, photo.lloc || photo.sloc, QZone.Common.Target.uin, photo.albumId, photo.batchId);
    },

    /**
     * 获取相册地址
     */
    getAlbumUrl(uin, albumId) {
        return 'https://user.qzone.qq.com/{0}/photo/{1}'.format(uin, albumId);
    },

    /**
     * 获取查看相片的在线链接
     * @param {object} photo 相片对象
     */
    getImageViewLink(photo) {
        return 'https://user.qzone.qq.com/{0}/photo/{1}/{2}'.format(QZone.Common.Target.uin, photo.albumId, this.getImageKey(photo));
    },

    /**
     * 获取相片Key
     * @param {object} photo 相片对象
     */
    getImageKey(photo) {
        return photo.picKey || photo.lloc || photo.sloc;
    },

    /**
     * 获取相册列表
     * @param {integer} page 当前页
     */
    getAlbums(page) {
        let params = {
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "appid": 4,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "source": "qzone",
            "plat": "qzone",
            "format": "jsonp",
            "notice": 0,
            "filter": 1,
            "handset": 4,
            "needUserInfo": 1,
            "idcNum": QZone.Common.Target.route || this.getRoute(),
            "mode": 2, // 视图：普通视图
            "sortOrder": '2', // 排序类型：0：最新创建在后，1：最新创建在前，2：自定义排序，4：最新上传在前，如未自定义，则默认最新创建在后？
            "pageStart": page * QZone_Config.Photos.pageSize,
            "pageNum": QZone_Config.Photos.pageSize,
            // "needSave": 1, // 保存排序
            "callbackFun": "shine0",
            "_": Date.now()
        }
        return API.Utils.get(REST_URLS.ALBUM_LIST_URL, params);
    },

    /**
     * 获取相册评论列表
     * @param {string} albumId 相册ID
     * @param {integer} page 当前页
     */
    getAlbumComments(albumId, page) {
        let params = {
            "need_private_comment": 1,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Photos.Comments.pageSize,
            "num": QZone_Config.Photos.Comments.pageSize,
            "order": 1, //倒序
            "topicId": albumId,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "t": Date.now(),
            "cmtType": 1,
            "plat": "qzone",
            "source": "qzone",
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.ALBUM_PHOTOS_COMMENTS_URL, params);
    },

    /**
     * 获取相册相片列表
     * @param {string} topicId 相册ID
     * @param {integer} page 当前页
     */
    getImages(topicId, page) {
        let params = {
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "shine0_Callback",
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "mode": 0,
            "idcNum": QZone.Common.Target.route || this.getRoute(), // 存储相册的服务器路由？
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "topicId": topicId,
            "noTopic": 0,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "pageStart": page * QZone_Config.Photos.Images.pageSize,
            "pageNum": QZone_Config.Photos.Images.pageSize,
            "skipCmtCount": 0,
            "singleurl": 1,
            "batchId": "",
            "notice": 0,
            "appid": 4,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "source": "qzone",
            "plat": "qzone",
            "outstyle": "json",
            "format": "jsonp",
            "json_esc": 1,
            "callbackFun": "shine0",
            "_": Date.now()
        };
        return API.Utils.get(REST_URLS.IMAGES_LIST_URL, params);
    },


    /**
     * 获取相片详情
     * @param {string} topicId 相册ID
     * @param {integer} picKey 相片ID
     */
    getImageInfo(topicId, picKey) {
        let params = {
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "t": String(Math.random().toFixed(16)).slice(-9).replace(/^0/, '9'),
            "topicId": topicId,
            "picKey": picKey,
            "shootTime": "",
            "cmtOrder": 1,
            "fupdate": 1,
            "plat": "qzone",
            "source": "qzone",
            "cmtNum": 10,
            "likeNum": 5,
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "offset": 0, // 偏移量
            "number": 40,
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 4,
            "isFirst": 1,
            "sortOrder": 1,
            "showMode": 1,
            "need_private_comment": 1,
            "prevNum": 0, // 前序的照片数量
            "postNum": QZone_Config.Photos.Images.Info.pageSize || 0, // 后续的照片数量
            "_": Date.now()
        }
        return API.Utils.get(REST_URLS.IMAGES_INFO_URL, params);
    },

    /**
     * 获取相片评论列表
     * @param {string} albumId 相册ID
     * @param {integer} page 当前页
     */
    getImageComments(albumId, picKey, page) {
        let params = {
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "start": page * QZone_Config.Photos.Images.Comments.pageSize,
            "num": QZone_Config.Photos.Images.Comments.pageSize,
            "order": 1, // 倒序
            "topicId": albumId + '_' + picKey,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "ref": "photo",
            "need_private_comment": 1,
            "albumId": albumId,
            "qzone": "qzone",
            "plat": "qzone",
            "random": Date.now(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.ALBUM_PHOTOS_COMMENTS_URL, params);
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors(targeId, pageIndex) {
        const params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 4, //4:相册
            "param": "2;" + targeId,
            "beginNum": QZone_Config.Blogs.Visitor.pageSize * pageIndex + 1,
            "num": QZone_Config.Blogs.Visitor.pageSize,
            "needFriend": 1, // TODO 待确认，是否需要QQ好友还是仅仅包含QQ好友
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.VISITOR_SINGLE_LIST_URL, params);
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors_2(targeId) {
        const params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "mask": 2,
            "mod": 2,
            "contentid": targeId,
            "fupdate": 1,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.VISITOR_SIMPLE_LIST_URL, params);
    },

    /**
     * 获取相片外链(无权限也可以访问)
     */
    getExternalUrl(oldurl) {
        //var reg = /http\w?:\/\/.*?\/psb\?\/(.*?)\/(.*?)\/\w\/(.*?)&/gi
        var reg = /http\w?:\/\/.*?\/ps(\w)\?\/(.*?)\/(.*?)\/\w\/(.*?)$/gi
        var reg2 = /http\w?:\/\/.*?\/psc\?\/(.*?)$/gi
        var result;
        var newurl;
        if ((result = reg.exec(oldurl)) !== null) {
            console.log('匹配1');
            newurl = "//r.photo.store.qq.com/ps" + result[1] + "?/" + result[2] + "/" + result[3] + "/r/" + result[4] + "_yake_qzoneimgout.png";
            return newurl;
        } else {
            if ((result = reg2.exec(oldurl)) !== null) {
                console.log('匹配2');
                newurl = "//r.photo.store.qq.com/psc?/" + result[1] + "/r/_yake_qzoneimgout.png";
                return newurl;
            }
        }
        return oldurl;
    },

    /**
     * 获取照片下载URL
     * @param {object} photo 
     */
    getDownloadUrl(photo, type) {
        let url = photo.url;
        // 原图
        const raw_url = photo.raw_upload === 1 && photo.raw;
        // 高清图
        const origin_url = photo.origin_upload === 1 && photo.origin_url || photo.origin;
        // 普通图
        const normal_url = photo.downloadUrl || photo.url;
        switch (type) {
            case 'raw':
                // 原图，原图不存在取高清，高清不存在取普通
                url = raw_url || origin_url || normal_url;
                break;
            case 'original':
                // 高清，高清不存在取普通
                url = origin_url || normal_url;
                break;
            default:
                // 一般
                url = normal_url;
                break;
        }
        return API.Utils.trimDownloadUrl(url);
    },

    /**
     * 获取相册预览地址
     * @param {object} url 
     */
    getPhotoPreUrl(url) {
        var reg = /http\w?:\/\/.*?\/ps(\w)\?\/(.*?)\/(.*?)\/\w\/(.*?)$/gi
        var reg2 = /http\w?:\/\/.*?\/psc\?\/(.*?)$/gi
        var result;
        var newurl;
        if ((result = reg.exec(url)) !== null) {
            newurl = "https://r.photo.store.qq.com/ps" + result[1] + "?/" + result[2] + "/" + result[3] + "/m/" + result[4];
            return newurl;
        } else {
            if ((result = reg2.exec(url)) !== null) {
                newurl = "https://r.photo.store.qq.com/psc?/" + result[1] + "/m";
                return newurl;
            }
        }
        return API.Utils.trimDownloadUrl(url);
    },

    /**
     * 获取相片类型
     * @param {string} photo 相片对象
     */
    getPhotoSuffix(photo) {
        const type = photo.phototype;
        // 默认类型
        let extName = ".jpeg";
        switch (type) {
            case 1:
                extName = ".jpeg";
                break;
            case 2:
                extName = ".gif";
                break;
            case 3:
                extName = ".png";
                break;
            case 4:
                extName = ".bmp";
                break;
            case 5:
                extName = ".jpeg";
                break;
        }
        return extName;
    },

    /**
     * 获取已用容量显示值
     * @param {Number} t 已用容量
     */
    getCapacityDisplay(t) {
        t = t > 0 ? t : 0;
        if (t < 100) {
            return t + " M"
        } else if (t < 1024 * 1024) {
            return Math.round(t / 1024 * 10) / 10 + " G"
        } else {
            return Math.round(t / 1024 / 1024 * 10) / 10 + " T"
        }
    },

    /**
     * 获取相片LBS位置
     * @param {Object} photo 相片
     */
    getPhotoLbs(photo) {
        photo = photo || {};
        return photo.shootGeo && photo.shootGeo.idname ? photo.shootGeo : photo.lbs;
    },

    /**
     * 获取相册的悬浮提示
     * @param {Album} album 相册
     */
    getAlbumBasicInfoTooltip(album) {
        const htmls = [];
        htmls.push("<div class='text-left'>");
        // 相册名称
        htmls.push('<p><strong>相册名称：</strong>{0}</p>'.format(album.name));
        // 相册描述
        htmls.push('<p><strong>相册描述：</strong>{0}</p>'.format(API.Common.formatContent(album.desc || '暂无描述', "HTML", false, false, false, false, true)));
        // 创建时间
        htmls.push('<p><strong>创建时间：</strong>{0}</p>'.format(API.Utils.formatDate(album.createtime || album.create_time)));
        // 更新时间
        htmls.push('<p><strong>更新时间：</strong>{0}</p>'.format(API.Utils.formatDate(album.modifytime)));
        // 最后上传时间
        htmls.push('<p><strong>最后上传：</strong>{0}</p>'.format(API.Utils.formatDate(album.lastuploadtime)));
        htmls.push('</div>');
        return htmls.join('');
    },


    /**
     * 获取相片的悬浮提示
     * @param {Album} photo 相片
     */
    getPhotoBasicInfoTooltip(photo) {
        const htmls = [];
        htmls.push("<div class='text-left'>");
        // 相片名称
        htmls.push('<p><strong>相片名称：</strong>{0}</p>'.format(photo.name || API.Utils.formatDate(photo.uploadtime || photo.uploadTime)));
        // 相片描述
        htmls.push('<p><strong>相片描述：</strong>{0}</p>'.format(API.Common.formatContent(photo.desc || '暂无描述', "HTML", false, false, false, false, true)));
        // 上传时间
        htmls.push('<p><strong>上传时间：</strong>{0}</p>'.format(API.Utils.formatDate(API.Utils.parseDate(photo.uploadtime || photo.uploadTime).getTime() / 1000) || '未知'));
        // 拍摄时间
        htmls.push('<p><strong>拍摄时间：</strong>{0}</p>'.format(API.Utils.formatDate(API.Utils.parseDate(photo.rawshoottime || photo.shootTime).getTime() / 1000) || '未知'));
        // 拍摄地点
        const custom_lbs = API.Photos.getPhotoLbs(photo);
        htmls.push('<p><strong>拍摄/上传地点：</strong>{0}</p>'.format(custom_lbs ? custom_lbs.idname || custom_lbs.name || '未知' : '未知'));
        htmls.push('</div>');
        return htmls.join('');
    }

};
