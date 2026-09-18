/**
 * Messages 模块接口
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_MODULE_MESSAGES = {

    /**
     * 获取说说UniKey，用于获取点赞数据
     * @param {string} tid 说说ID
     */
    getUniKey(tid) {
        return 'http://user.qzone.qq.com/{0}/mood/{1}'.format(QZone.Common.Target.uin, tid);
    },

    /**
     * 获取说说列表
     * @param {integer} page 第几页
     */
    getMessages(page) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "ftype": 0,
            "sort": 0,
            "pos": page * QZone_Config.Messages.pageSize,
            "num": QZone_Config.Messages.pageSize,
            "replynum": 100,
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "callback": "_preloadCallback",
            "code_version": 1,
            "format": "jsonp",
            "need_private_comment": 1,
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        };
        return API.Utils.get(REST_URLS.MESSAGES_LIST_URL, params);
    },




    /**
     * 获取全文说说的列表
     * @param {Array} items 说说列表
     */
    getMoreItems(items) {
        let new_items = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.has_more_con === 1 || item.rt_has_more_con === 1) {
                // 长说说与转发长说说
                new_items.push(item)
            }
        }
        return new_items;
    },

    /**
     * 获取全文说说的条目数
     * @param {Array} items 说说列表
     */
    getMoreCount(items) {
        return getMoreItems(items).length
    },

    /**
     * 获取说说全文
     * @param {integer} id 说说ID
     */
    getFullContent(id) {
        let params = {
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "tid": id,
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "t1_source": 1,
            "not_trunc_con": 1,
            "hostuin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin,
            "code_version": 1,
            "format": "jsonp",
            "qzreferrer": 'https://user.qzone.qq.com'
        }
        return API.Utils.get(REST_URLS.MESSAGES_DETAIL_URL, params);
    },


    /**
     * 获取说说配图（超9张后需要单独获取）
     * @param {integer} id 说说ID
     */
    getImageInfos(id) {
        let params = {
            "r": Math.random(),
            "tid": id,
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "t1_source": 1,
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.MESSAGES_IMAGES_URL, params);
    },

    /**
     * 获取说说评论列表
     * @param {integer} page 第几页
     */
    getComments(id, page) {
        const params = {
            "need_private_comment": 1, // 是否需要私密评论
            "uin": QZone.Common.Owner.uin || API.Utils.initUin().Owner.uin, // 登录QQ
            "hostUin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin, // 备份QQ
            "start": page * QZone_Config.Messages.Comments.pageSize,
            "num": QZone_Config.Messages.Comments.pageSize,
            "order": 0,
            "topicId": QZone.Common.Target.uin + "_" + id,
            "format": "jsonp",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "ref": "qzone",
            "random": Math.random(),
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.MESSAGES_VIDEOS_COMMONTS_URL, params);
    },

    /**
     * 获取语音内容（HTML）
     * @param {Object} item 说说
     */
    getVoiceHTML(item) {
        const contents = [];
        const voices = item.custom_voices || [];
        for (let i = 0; i < voices.length; i++) {
            const voice = voices[i];
            contents.push('<audio controls src="{0}"></audio>'.format(voice.custom_filepath || voice.custom_url))
        }
        return contents.join('\r\n');
    },

    /**
     * 获取最近访问列表
     * @param {string} targeId 目标ID
     * @param {integer} targeId 当前页索引
     */
    getVisitors(targeId, pageIndex) {
        let params = {
            "uin": QZone.Common.Target.uin || API.Utils.initUin().Target.uin,
            "appid": 311, //311：说说，2：日志
            "param": targeId,
            "beginNum": QZone_Config.Messages.Visitor.pageSize * pageIndex + 1,
            "num": QZone_Config.Messages.Visitor.pageSize,
            "needFriend": 1, // TODO 待确认，是否需要QQ好友还是仅仅包含QQ好友
            "g_tk": QZone.Common.Config.gtk || API.Utils.initGtk(),
            "qzonetoken": QZone.Common.Config.token || API.Utils.getQZoneToken()
        }
        return API.Utils.get(REST_URLS.VISITOR_SINGLE_LIST_URL, params);
    },

    /**
     * 获取图片MD内容
     * @param {Array} images 图片列表
     */
    getImagesMarkdown(images, width, height) {
        const result = [];
        width = width || '';
        height = height || '';
        for (const image of images) {
            if (image.is_video && image.video_info) {
                // 视频
                const video = image.video_info;
                const target_url = API.Videos.getVideoUrl(video);
                const filepath = API.Common.isQzoneUrl() ? video.custom_pre_url : video.custom_pre_filepath;
                if (API.Videos.isExternalVideo(video)) {
                    // 外部视频，只显示图片，点击跳转
                    result.push('<a href="{0}" target="_blank"><img src="{1}" {2} {3} align="center" /></a>'.format(target_url, filepath, width, height));
                } else {
                    // 空间视频
                    const url = video.custom_filepath || video.custom_url;
                    result.push('<video src="{0}" {1} {2} controls="controls" ></video>'.format(url, width, height));
                }
            } else {
                // 普通图片
                const url = API.Common.isQzoneUrl() ? image.custom_url : image.custom_filepath;
                result.push('<img src="{0}" {1} {2} align="center" />'.format(url, width, height));
            }
        }
        return result.join('\r\n');
    },

    /**
     * 转换多媒体内容
     */
    formatMediaMarkdown(item) {
        let images = item.custom_images || [];
        let videos = item.custom_videos || [];
        let audios = item.custom_audios || [];
        let result = [];
        if (images.length > 0) {
            // 说说配图
            if (images.length == 1) {
                // 数量等于1的，不限制图片宽高
                result.push('<div>');
                result.push(this.getImagesMarkdown(images, 'width="600px"'));
                result.push('</div>');
            } else if (2 <= images.length && images.length <= 3) {
                // 数量小于3的，一行存放所有照片
                result.push('<div>');
                result.push(this.getImagesMarkdown(images, 'width="200px"'));
                result.push('</div>');
            } else if (images.length == 4) {
                // 数量为4的，两行，每行两张照片
                result.push('\r\n');
                let _images = _.chunk(images, 2);
                for (let i = 0; i < _images.length; i++) {
                    const _image_list = _images[i];
                    result.push('<div>');
                    result.push(this.getImagesMarkdown(_image_list, 'width="200px"', 'height="200px"'));
                    result.push('</div>');
                }
                result.push('\r\n');
            } else if (5 <= images.length && images.length <= 6) {
                // 数量为5和6的，两行，每行2到3张照片
                result.push('\r\n');
                let _images = _.chunk(images, 3);
                for (let i = 0; i < _images.length; i++) {
                    const _image_list = _images[i];
                    result.push('<div>');
                    result.push(this.getImagesMarkdown(_image_list, 'width="200px"', 'height="200px"'));
                    result.push('</div>');
                }
                result.push('\r\n');
            } else if (images.length >= 7) {
                // 数量为7,8,9以及更多的，每行2到3张照片
                result.push('\r\n');
                let _images = _.chunk(images, 3);
                for (let i = 0; i < _images.length; i++) {
                    const _image_list = _images[i];
                    result.push('<div>');
                    result.push(this.getImagesMarkdown(_image_list, 'width="200px"', 'height="200px"'));
                    result.push('</div>');
                }
                result.push('\r\n');
            }
        }
        // 视频（这里一般为单视频，多视频的逻辑会走上面图片逻辑）
        for (const video of videos) {
            result.push('\r\n');
            const target_url = API.Videos.getVideoUrl(video);
            const filepath = API.Common.isQzoneUrl() ? video.custom_pre_url : video.custom_pre_filepath;
            if (API.Videos.isExternalVideo(video)) {
                // 外部视频，只显示图片，点击跳转
                result.push('<a href="{0}" target="_blank"><img src="{1}" width="600px" height="400px" align="center" /></a>'.format(target_url, filepath));
            } else {
                // 空间视频
                const url = video.custom_filepath || video.custom_url || target_url;
                if (url) {
                    result.push('<video src="{0}" width="600px" height="400px" controls="controls" ></video>'.format(url));
                }
            }
            result.push('\r\n');
        }
        // 歌曲
        for (const audio of audios) {
            result.push('\r\n');
            if (API.Common.isQzoneUrl()) {
                result.push('[![{0}-{1}]({2})]({3})\n'.format(audio.albumname, audio.singername, audio.custom_url, audio.playurl));
            } else {
                result.push('[![{0}-{1}]({2})]({3})\n'.format(audio.albumname, audio.singername, audio.custom_filepath, audio.playurl));
            }
            result.push('\r\n');
        }
        return result.join('\r\n');
    },

    /**
     * 获取地图超链接
     * @param {object} ibs 坐标信息
     */
    getMapUrl(ibs) {
        if (!ibs) {
            return '#';
        }
        return 'https://apis.map.qq.com/uri/v1/marker?marker=coord:{pos_y},{pos_x};title:{idname};addr:{name}'.format(ibs);
    },

    /**
     * 是否为微信同步的说说
     * @param {Message} item 说说
     * @returns 
     */
    isWeChat(item) {
        return item.t1_source === 1 && item.t1_subtype === 29;
    },

    /**
     * 显示来源
     * @param {Message} item 说说
     */
    getSourceHTML(item) {
        if (item.t1_source === 0) {
            // 朋友网
            return '来自<span class="text-info">朋友网</span>';
        }
        if (item.t1_source === 1) {
            // QQ空间
            switch (item.t1_subtype) {
                case 29:
                    return `
                    <svg t="1654947237192" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10603" width="16" height="16">
                        <path
                            d="M512 954.24A442.24 442.24 0 1 0 69.76 512 442.08 442.08 0 0 0 512 954.24z m0-30.88a401.12 401.12 0 0 1-137.12-21.92V621.6l274.24 276.64A356 356 0 0 1 512 923.36z m285.28-119.68a400 400 0 0 1-112 81.28L487.2 687.04l389.44 1.92a359.52 359.52 0 0 1-79.2 114.72z m118.24-289.28a400 400 0 0 1-21.92 136.96H613.76l276.8-273.92a355.04 355.04 0 0 1 25.12 136.96z m-232.8-368a355.68 355.68 0 0 1 114.56 79.04 402.88 402.88 0 0 1 81.44 112L680.96 535.52zM512 653.6A141.6 141.6 0 1 1 653.6 512 141.6 141.6 0 0 1 512 653.6z m0-548.32A400 400 0 0 1 649.12 128v280L375.04 130.4A356.32 356.32 0 0 1 512 105.28z m-285.28 119.84a405.44 405.44 0 0 1 112-81.44l198.4 198.08-389.44-2.08a355.68 355.68 0 0 1 79.04-114.56zM108.64 514.4a400 400 0 0 1 21.92-136.96h279.84L133.6 651.36a357.92 357.92 0 0 1-24.96-136.96z m234.72-21.12l-1.92 389.44a357.12 357.12 0 0 1-114.72-79.04 401.76 401.76 0 0 1-81.28-112z"
                            fill="#FFFFFF" p-id="10604"></path>
                        <path d="M649.12 128A400 400 0 0 0 512 105.28a356.32 356.32 0 0 0-137.12 25.12l274.08 276.8z" fill="#FC6B4F" p-id="10605"></path>
                        <path d="M797.44 225.12a355.68 355.68 0 0 0-114.56-79.04l-1.92 389.44 197.92-198.08a402.88 402.88 0 0 0-81.44-112.32z" fill="#7838F2" p-id="10606"></path>
                        <path d="M893.76 651.36a400 400 0 0 0 21.92-136.96 355.04 355.04 0 0 0-25.12-136.96l-276.8 273.92z" fill="#5698F3" p-id="10607"></path>
                        <path d="M685.12 884.96a400 400 0 0 0 112-81.28 359.52 359.52 0 0 0 79.2-114.72l-389.44-1.92z" fill="#20E9F4" p-id="10608"></path>
                        <path d="M375.04 901.44A401.12 401.12 0 0 0 512 923.36a356 356 0 0 0 136.96-25.12L375.04 621.6z" fill="#00FD60" p-id="10609"></path>
                        <path d="M341.44 882.72l1.92-389.44L145.44 691.2a401.76 401.76 0 0 0 81.28 112 357.12 357.12 0 0 0 114.72 79.52z" fill="#ABFB5B" p-id="10610"></path>
                        <path d="M130.56 377.44a400 400 0 0 0-21.92 136.96 357.92 357.92 0 0 0 24.96 136.96l276.8-273.92z" fill="#F0E254" p-id="10611"></path>
                        <path d="M339.04 144a405.44 405.44 0 0 0-112 81.44 355.68 355.68 0 0 0-79.04 114.56l389.44 2.08z" fill="#F6B351" p-id="10612"></path>
                    </svg>
                    <span class="text-info">朋友圈</span>
                    `;
                default:
                    break;
            }
        }
        return void 0;
    }
};
