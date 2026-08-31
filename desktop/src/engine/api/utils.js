/**
 * 通用工具：格式化/分组/编码/下载器适配等（Utils 其余方法）
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_UTILS_METHODS = {
    /**
     * 转换为ArrayBuffer
     */
    toArrayBuffer(str) {
        let buf = new ArrayBuffer(str.length)
        let view = new Uint8Array(buf)
        for (let i = 0; i !== str.length; ++i) {
            view[i] = str.charCodeAt(i) & 0xFF
        }
        return buf;
    },

    /**
     * 根据年月份分组数据
     * @param {array} data 数据集合
     * @param {object} timeField 时间字段名
     * @param {string} type 分组类型 all/year/month
     */
    groupedByTime(data, timeField, type) {
        data = data || [];
        let resMaps = new Map();
        for (const item of data) {
            let time = item[timeField];
            if (Array.isArray(timeField) && !time) {
                for (const field of timeField) {
                    time = item[field];
                    if (time) {
                        break;
                    }
                }
            }
            let date = null;
            if (typeof(time) === 'string') {
                date = new Date(time);
            } else {
                date = new Date(time * 1000);
            }
            if (!date) {
                date = new Date('1970-01-01');
            }
            switch (type) {
                case 'year':
                    let year_items = resMaps.get(date.getFullYear()) || [];
                    year_items.push(item);
                    resMaps.set(date.getFullYear(), year_items);
                    break;
                case 'month':
                    let month_items = resMaps.get(date.getMonth() + 1) || [];
                    month_items.push(item);
                    resMaps.set(date.getMonth() + 1, month_items);
                    break;
                case 'day':
                    let day_items = resMaps.get(date.getDate()) || [];
                    day_items.push(item);
                    resMaps.set(date.getDate(), day_items);
                    break;
                default:
                    let all_month_maps = resMaps.get(date.getFullYear()) || new Map();
                    let all_month_items = all_month_maps.get(date.getMonth() + 1) || [];
                    all_month_items.push(item);
                    all_month_maps.set(date.getMonth() + 1, all_month_items);
                    resMaps.set(date.getFullYear(), all_month_maps);
                    break;
            }
        }
        return resMaps;
    },

    /**
     * 根据指定字段分组
     * @param {array} data 数据集合
     * @param {string} field 字段名
     */
    groupedByField(data, field) {
        data = data || [];
        const groupData = new Map();
        for (const item of data) {
            const targetVal = item[field];
            const targetList = groupData.get(targetVal) || [];
            targetList.push(item);
            groupData.set(targetVal, targetList);
        }
        return groupData;
    },

    /**
     * 获取文件类型
     * @param {string} url 文件URL
     * @param {funcation} doneFun 回调函数
     */
    getMimeTypeOnContent(url) {
        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            // 超时设置
            xhr.timeout = (QZone_Config.Common.autoFileSuffixTimeOut || 20) * 1000;
            xhr.onreadystatechange = function() {
                if (2 == xhr.readyState) {
                    let contentType = xhr.getResponseHeader('content-type') || xhr.getResponseHeader('Content-Type') || '';
                    let suffix = '';
                    if (contentType.indexOf('/') > -1) {
                        suffix = contentType.split('/')[1];
                    }
                    this.abort();
                    resolve(suffix);
                }
            }
            xhr.onerror = function(e) {
                reject(e);
            }
            xhr.ontimeout = function(e) {
                this.abort();
                reject(e);
            }
            xhr.send();
        });
    },

    /**
     * 获取文件类型
     * @param {string} url 文件URL
     */
    getMimeType(url) {
        // 桌面端：主进程带 Referer 探测（等价扩展 background getMimeType）
        return window.QZonePlatform.network.getMimeType(url, QZone_Config.Common.autoFileSuffixTimeOut);
    },

    /**
     * 切换根目录
     */
    switchToRoot() {
        return window.QZonePlatform.fs.list('/');
    },

    /**
     * 压缩
     * 桌面端：打包由主进程 archiver 承担（M2b）；引擎侧仅保留签名以兼容调用方
     * @param {string} root 文件或文件夹路径
     */
    Zip(root) {
        return window.QZonePlatform.zip.generate(root);
    },

    /**
     * 获取URL参数值
     * @param {string} name 
     */
    getUrlParam(name) {
        const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
        const r = window.location.search.substr(1).match(reg);
        if (r != null) {
            return decodeURI(r[2]);
        }
        return null;
    },

    /**
     * 获取URL参数值
     * @param {string} url 
     */
    toParams(url) {
        var reg_url = /^[^\?]+\?([\w\W]+)$/,
            reg_para = /([^&=]+)=([\w\W]*?)(&|$|#)/g,
            arr_url = reg_url.exec(url),
            ret = {};
        if (arr_url && arr_url[1]) {
            var str_para = arr_url[1],
                result;
            while ((result = reg_para.exec(str_para)) != null) {
                ret[result[1]] = result[2];
            }
        }
        return ret;
    },

    /**
     * 通过参数构建URL
     * @param {string} url 
     * @param {object} params 
     */
    toUrl(url, params) {
        let paramsArr = [];
        if (params) {
            Object.keys(params).forEach(item => {
                paramsArr.push(item + '=' + params[item]);
            })
            if (url.search(/\?/) === -1) {
                url += '?' + paramsArr.join('&');
            } else {
                url += '&' + paramsArr.join('&');
            }

        }
        return url;
    },

    /**
     * 生成一个UUID
     */
    newUid() {
        const s4 = function() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    },

    /**
     * 生成一个简短的UUID
     * @param {integer} len 长度
     * @param {integer} radix 算法类型
     */
    newSimpleUid(len, radix) {
        var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
        var uuid = [],
            i;
        radix = radix || chars.length;
        if (len) {
            for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
        } else {
            var r;
            uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
            uuid[14] = '4';
            for (i = 0; i < 36; i++) {
                if (!uuid[i]) {
                    r = 0 | Math.random() * 16;
                    uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
                }
            }
        }
        return uuid.join('').toLowerCase();
    },

    /**
     * 替换文件名特殊符号
     *
     * @param {原名} name
     */
    filenameValidate(name) {
        // 操作系统特殊符号
        name = name.replace(/'|#|~|&| |!|\\|\/|:|\?|"|<|>|\*|\|/g, "_");
        return name;
    },

    /**
     * 按照长度给指定的数字前面补0
     * @param {int} num 
     * @param {int} length 
     */
    prefixNumber(num, length) {
        return (Array(length).join('0') + num).slice(-length);
    },

    /**
     * 转码
     * @param {string} b 
     */
    decode(b) {
        return b && b.replace(/(%2C|%25|%7D)/g, function(b) {
            return unescape(b);
        })
    },

    /**
     * 获取超链接
     */
    getLink(url, text, type) {
        // 默认HTML超链接
        let res = "<a href='{url}' target='_blank'>{text}</a>";
        switch (type) {
            case 'MD':
                res = '[{text}]({url})';
                break;
            default:
                break;
        }
        return res.format({
            url: url,
            text: text
        });
    },

    /**
     * 转换艾特内容
     * @param {string} contet 艾特内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     */
    formatMention(contet, type) {
        if (!contet) {
            return contet;
        }
        const format = (item) => {
            var result = "<a href='https://user.qzone.qq.com/{uin}' target='_blank'>@{name}</a>".format(item);
            switch (type) {
                case 'MD':
                    result = '[@{name}](https://user.qzone.qq.com/{uin})'.format(item);
                    break;
            }
            return result;
        }
        if (typeof contet === 'object') {
            return format(contet);
        }

        // 先处理一遍正常的@的内容
        contet = contet.replace(/@\{uin:([^\}]*),nick:([^\}]*?)(?:,who:([^\}]*))?(?:,auto:([^\}]*))?\}/g, function(str, uin, name) {
            return format({
                uin: uin,
                name: name
            });
        })

        // 如果处理后，仍包含uin、nick、who，则表示是特殊情况(即nick存的是内容)，再处理一遍
        if (contet.indexOf('uin') > -1 && contet.indexOf('nick') > -1 && contet.indexOf('who') > -1) {
            contet = contet.replace(/\{uin:([^\}]*),nick:([^\}]*?)(?:,who:([^\}]*))\}/g, function(str, uin, name) {
                return name;
            })
        }
        return contet;
    },

    /**
     * 转换表情内容
     * @param {string} content 表情内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     */
    formatEmoticon(content, type) {
        if (!content) {
            return content;
        }

        // 替换无协议的链接
        content = content.replace(/src=\"\/qzone\/em/g, 'src=\"http://qzonestyle.gtimg.cn/qzone/em');

        // 转换emoji表情链接
        content = content.replace(/\[em\]e(\d+)\[\/em\]/gi, function(emoji, eid) {
            let url = 'http://qzonestyle.gtimg.cn/qzone/em/e{0}.gif'.format(eid);
            // 默认返回HMTL格式
            let res = "<img src='{0}' >".format(url);
            switch (type) {
                case 'MD':
                    res = API.Utils.getImagesMarkdown(url);
            }
            return res;
        });

        return content;
    },

    /**
     * 转换HTML特殊字符
     */
    escHTML(content) {
        var l = { "&amp;": /&/g, "&lt;": /</g, "&gt;": />/g, "&quot;": /\x22/g };
        for (var i in l) {
            content = content.replace(l[i], i);
        }
        return content;
    },

    /**
     * 获取分享来源标题
     */
    getURLTitle(item, index) {
        return item["url_title_" + index] || "";
    },

    /**
     * 获取评论数
     */
    getCommentCount(item) {
        return item.replies || item.reply_num || item.cmtnum || 0;
    },

    /**
     * 转换内容
     * @param {string} contet 内容
     * @param {string} type 转换类型，默认TEXT,可选HTML,MD
     * @param {boolean} isRt 是否是处理转发内容
     * @param {boolean} isSupportedHtml 内容本身是否支持HTML
     * @param {boolean} isEscHTML 是否全部转换HTML标签
     * @param {boolean} isDownloadEmoticon 是否下载表情
     * @param {boolean} isFormatEmoticonPath 是否转换本地地址
     */
    formatContent(item, type, isRt, isSupportedHtml, isEscHTML, isDownloadEmoticon, isFormatEmoticonPath) {
        if (!item) {
            return item;
        }
        if (typeof item === 'string') {
            // 转换特殊符号
            if (!isSupportedHtml) {
                item = API.Utils.escHTML(item);
            }
            // 转换话题
            item = API.Utils.formatTopic(item, type);
            // 转换表情
            item = API.Utils.formatEmoticon(item, type);
            // 转换@内容
            item = API.Utils.formatMention(item, type);
            // 转换微信表情
            item = API.Common.formatWxEmoji(item, type);
            // 转换特殊字符
            item = isEscHTML ? API.Utils.escHTML(item) : item;
            // 是否下载表情
            item = isDownloadEmoticon ? API.Common.addEmoticonDowanloadTask(item) : item;
            // 转换表情路径
            return isFormatEmoticonPath ? API.Common.formatEmoticonPath(item) : item;
        }
        var conlist = (isRt && item.rt_con && item.rt_con['conlist']) || item.conlist || [];
        var contents = [];
        var titleIndex = 0;
        for (let index = 0; index < conlist.length; index++) {
            let info = conlist[index];
            // 说说内容类型
            switch (info.type) {
                case 0:
                    // 艾特某人？
                    info.custom_url = "http://user.qzone.qq.com/{uin}".format(info);
                    // 转换特殊符号
                    info.custom_display = API.Utils.escHTML(info.nick);
                    // 转换话题
                    info.custom_display = this.formatTopic(info.con || info.custom_display, type);
                    // 转换表情
                    info.custom_display = API.Utils.formatEmoticon(info.custom_display, type);
                    // 转换微信表情
                    info.custom_display = API.Common.formatWxEmoji(info.custom_display, type);
                    // 转换@内容
                    info.custom_display = API.Utils.formatMention({
                        uin: info.uin,
                        name: info.custom_display
                    }, type);
                    // 添加到内容数组
                    contents.push(info.custom_display);
                    break;
                case 1:
                    // 分享来源？
                    titleIndex++;
                    // 获取分享URL
                    info.url = API.Utils.escHTML(info.url);
                    // 获取分享提示
                    info.text = API.Utils.getURLTitle(item, titleIndex) || info.url;
                    // 获取Link
                    info.custom_display = API.Utils.getLink(info.url, info.text, type);
                    // 添加到内容数组
                    contents.push(info.custom_display)
                    break;
                case 2:
                    // 普通说说内容？
                    if (info.con) {
                        // 转换话题
                        info.custom_display = this.formatTopic(this.escHTML(info.con), type);
                        // 转换表情
                        info.custom_display = API.Utils.formatEmoticon(info.custom_display, type);
                        // 转换微信表情
                        info.custom_display = API.Common.formatWxEmoji(info.custom_display, type);
                        // 转换@内容
                        info.custom_display = API.Utils.formatMention(info.custom_display, type);
                        // 替换换行符
                        switch (type) {
                            case 'MD':
                                info.custom_display = info.custom_display.replaceAll('\n', '\r\r\r\n');
                                break;
                            default:
                                break;
                        }
                        // 添加到内容数组
                        contents.push(info.custom_display)
                    }
                    break;
            }
        }
        // 转换特殊字符
        let content = contents.join("").replace(/^[\s\xA0]+/, "").replace(/[\s\xA0]+$/, "");
        content = isEscHTML ? API.Utils.escHTML(content) : content;

        // 是否下载表情
        item = isDownloadEmoticon ? API.Common.addEmoticonDowanloadTask(content) : content;

        // 转换表情路径
        return isFormatEmoticonPath ? API.Common.formatEmoticonPath(content) : content;
    },

    /**
     * 格式化文件大小, 输出成带单位的字符串
     * @param {Number} size 文件大小
     * @param {Number} [pointLength=2] 精确到的小数点数。
     * @param {Array} [units=["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB" ]] 单位数组。
     */
    formatFileSize(size, pointLength, units) {
        var unit;
        units = units || ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        while ((unit = units.shift()) && size > 1024) {
            size = size / 1024;
        }
        return (unit === 'Bytes' ? size : size.toFixed(pointLength === undefined ? 2 : pointLength)) + unit;
    },

    /**
     * 消息通知
     */
    notification: (title, message) => {
        if (!window.Notification) {
            return;
        }
        Notification.requestPermission().then(function(permission) {
            if (permission === 'denied') {
                return;
            }
            if (permission === 'granted') {
                var notice_ = new Notification(title, {
                    body: message,
                    icon: API.Common.getUserLogoUrl(QZone.Common.Target.uin || API.Utils.initUin().Target.uin),
                    requireInteraction: true
                });
                notice_.onclick = function() {
                    // 单击消息提示框，进入浏览器页面
                    window.focus();
                }
            }
        });
    },

    /**
     * 转换时间
     *  @param {integer} time 
     */
    formatDate(time, str) {
        if (!_.isNumber(time)) {
            return time;
        }
        str = str || 'yyyy-MM-dd hh:mm:ss';
        return new Date(time * 1000).format(str);
    },

    /**
     * 转换时间
     *  @param {integer} time 
     */
    parseDate(time) {
        if (_.isNumber(time)) {
            const sec = time * 1000;
            if (sec < Date.now()) {
                return new Date(sec);
            }
        }
        return new Date(time);
    },

    /**
     * 转换时间
     *  @param {integer} time 
     */
    toDate(time) {
        const now = new Date();
        if (time.indexOf('今天') > -1) {
            // 今天 13:46
            time = time.replace('今天', now.format('yyyy-MM-dd'));
        } else if (time.indexOf('昨天') > -1) {
            // 昨天 23:46
            time = time.replace('昨天', new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).format('yyyy-MM-dd'));
        } else if (time.indexOf('前天') > -1) {
            // 前天 23:46
            time = time.replace('前天', new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2).format('yyyy-MM-dd'));
        } else if (time.indexOf('年') == -1) {
            // 11 月 01 日 03:29
            time = new Date().getFullYear() + '-' + time.replace('月', '-').replace('日', '');
        } else if (time.indexOf('年') > -1) {
            // 2019 年 08 月 01 日 16:36
            time = time.replace('年', '-').replace('月', '-').replace('日', '');
        }
        return new Date(time);
    },

    /**
     * 转换超链接
     * @param {string} content 内容
     * @param {string} type 转换类型，默认HTML,MD
     */
    formatLink(content, type) {
        return content.replace(/(https|http|ftp|rtsp|mms)?:\/\/(([a-zA-Z0-9_-])+(\.)?)*(:\d+)?(\/((\.)?(\?)?=?&?[a-zA-Z0-9_-](\?)?)*)*/g, function(e, t, i) {
            return API.Utils.getLink(e, '网页链接', type);
        })
    },

    /**
     * 转换话题
     * @param {string} content 内容
     * @param {string} type 转换类型，默认HTML,MD
     */
    formatTopic(content, type) {
        content = (content || "") + "";
        var t = content.split(/(#(?:.|<br\/>)+?#)/g);
        var o = false;
        var n = "",
            res = "";
        for (var a = 0; a < t.length; a++) {
            tag = t[a];
            o = false;
            n = "";
            n = tag.replace(/#((?:.|<br\/>)+?)#/g, function(e, t, n) {
                o = true;
                let url = 'http://rc.qzone.qq.com/qzonesoso/?search=' + encodeURIComponent(t);
                var a = API.Utils.getLink(url, '#{0}#'.format(t));
                switch (type) {
                    case 'MD':
                        a = API.Utils.getLink(url, '#{0}#'.format(t), type);
                        break;
                    default:
                        break;
                }
                return a
            });
            if (!o) {
                n = tag;
            }
            res += n
        }
        return res;
    },

    /**
     * 替换URL
     * @param {string} url URL
     */
    toHttps(url) {
        url = url || '';
        if (url.indexOf('//p.qpimg.cn/cgi-bin/cgi_imgproxy') > -1) {
            // 替换图片代理URL为实际URL
            url = API.Utils.toParams(url)['url'] || url;
        }
        // 替换相对协议
        url = url.replace(/^\/\//g, 'https://');
        // 替换HTTP协议
        url = url.replace(/http:\//, "https:/");
        try {
            // 解码
            url = decodeURIComponent(url);
        } catch (e) {
            console.error("URL解码异常", e, url);
        }
        return url;
    },

    /**
     * 替换URL
     * @param {string} url URL
     */
    toHttp(url) {
        url = url || '';
        if (url.indexOf('//p.qpimg.cn/cgi-bin/cgi_imgproxy') > -1) {
            // 替换图片代理URL为实际URL
            url = API.Utils.toParams(url)['url'] || url;
        }
        // 替换相对协议
        url = url.replace(/^\/\//g, 'http://');
        // 替换HTTPS协议
        url = url.replace(/https:\//, "http:/");
        try {
            // 解码
            url = decodeURIComponent(url);
        } catch (e) {
            console.error("URL解码异常", e, url);
        }
        return url;
    },

    /**
     * 迅雷下载
     * @param {ThunderInfo} taskInfo 
     */
    downloadByThunder(taskInfo) {
        thunderLink.newTask(taskInfo);
    },

    /**
     * 删除浏览器任务属性
     * @param {BrowserTask} task
     */
    transformBrowserTask(task) {
        // 简单克隆
        const newTask = JSON.parse(JSON.stringify(task));

        // 删除多余属性
        delete newTask.id;
        delete newTask.dir;
        delete newTask.name;
        delete newTask.source;
        delete newTask.state;
        delete newTask.downloadState;
        delete newTask.module;

        return newTask;
    },

    /**
     * 原生下载（桌面端：主进程 DownloadManager 流式下载）
     * @param {BrowserTask} task
     */
    downloadByBrowser(task) {
        return window.QZonePlatform.download.enqueue({
            url: task.url,
            name: task.name,
            dir: task.dir,
            module: task.module
        }).then((id) => {
            task.setId(id);
            return task;
        });
    },

    /**
     * [实验性] 图片下载链接转换为 QQ 官方图片代理网关地址
     * QQ 官方图片代理（p.qpimg.cn/cgi-bin/cgi_imgproxy）对防盗链更宽容、
     * 可能走更优 CDN 路径。仅对图片类任务生效（视频等仍走原始链接），
     * 识别依据：任务文件名后缀（addDownloadTasks 已按 MIME 补全后缀）。
     * @param {DownloadTask} task 下载任务
     * @returns {string} 代理 URL；未开启或非图片时返回原始 URL
     */
    getImageProxyUrl(task) {
        if (!QZone_Config.Common.useImageProxyGateway) {
            return task.url;
        }
        // 仅图片后缀走代理网关
        if (!/\.(jpe?g|png|gif|bmp|webp)$/i.test(task.name || '')) {
            return task.url;
        }
        const proxyUrl = 'https://p.qpimg.cn/cgi-bin/cgi_imgproxy?url=' + encodeURIComponent(task.url);
        console.info('[ImageProxy] 图片任务走 QQ 官方代理网关：', task.name);
        return proxyUrl;
    },

    /**
     * Aria2下载
     * @param {DownloadTask} task
     */
    downloadByAria2(task) {
        const Aria2Setting = QZone_Config.Common.Aria2;
        const token = "token:" + Aria2Setting.token;
        // [实验性] 图片任务优先走 QQ 官方代理网关；aria2 按数组顺序尝试，
        // 代理失败时自动回退到原始链接（downloadByAria2 前请勿覆盖 task.url）
        const proxyUrl = API.Utils.getImageProxyUrl(task);
        const uris = proxyUrl === task.url ? [task.url] : [proxyUrl, task.url];
        const data = {
            "jsonrpc": "2.0",
            "method": "aria2.addUri",
            "id": Date.now(),
            "params": [
                token, uris,
                {
                    "referer": 'https://user.qzone.qq.com/',
                    'header': ['Cookie: ' + document.cookie],
                    "out": API.Common.getRootFolderName() + '/' + task.dir + "/" + task.name
                }
            ]
        };
        // 添加下载任务到Aria2
        return API.Utils.post(Aria2Setting.rpc, JSON.stringify(data));
    },

    /**
     * 获取下载管理器列表（桌面端：主进程 DownloadManager 维护，UI 走 download:get-state）
     * @param {string} state
     */
    getDownloadList(state) {
        return Promise.resolve([]);
    },

    /**
     * 恢复下载（桌面端：DownloadManager 断点续传由主进程管理，M2b）
     * @param {integer} downloadId
     */
    resumeDownload(downloadId) {
        return Promise.resolve(0);
    },

    /**
     * Base64编码
     * @param {string} str 原始字符串
     */
    utf8ToBase64(str) {
        return btoa(unescape(encodeURIComponent(str)));
    },

    /**
     * Base64解码
     * @param {string} str base64字符串
     */
    base64ToUtf8(str) {
        return decodeURIComponent(escape(atob(str)));
    },

    /**
     * 转换URL
     * @param {string} e 
     */
    trimDownloadUrl(url) {
        url = url || '';
        if (url && url.indexOf("?t=5&") > 0) {
            url = url.replace("?t=5&", "?")
        } else if (url && url.indexOf("?t=5") > 0) {
            url = url.replace("?t=5", "")
        } else if (url && url.indexOf("&t=5") > 0) {
            url = url.replace("&t=5", "")
        }
        return url
    },

    /**
     * 转换下载链接
     * @param {string} e 
     */
    makeDownloadUrl(url, isDownload) {
        url = url || '';
        var d = "save=1" + (isDownload ? '&d=1' : '');
        if (url && url.indexOf("?") > 0) {
            url = url + "&" + d
        } else if (url) {
            url = url + "?" + d
        }
        return this.trimDownloadUrl(url);
    },

    /**
     * 转换查看地址
     * @param {string} e 
     */
    makeViewUrl(url) {
        url = url || '';
        url = url.replace("?save=1&d=1", "")
        url = url.replace("&save=1&d=1", "")
        url = url.replace("?save=1", "")
        url = url.replace("&save=1", "")
        url = url.replace("?d=1", "")
        url = url.replace("&d=1", "")
        return url
    },

    /**
     * 获取Markdown的图片内容
     * @param {string} url 图片地址
     * @param {string} title 图片提示
     */
    getImagesMarkdown(url, title) {
        return '![{0}]({1})'.format(title || '', url);
    },

    /**
     * 对象中的字符串字段简单排序
     * @param {Array} items 对象数组
     * @param {string} filed 排序字段
     * @param {boolean} desc 是否倒序
     */
    sort(items, filed, desc) {
        if (!items || items.length === 1) {
            return items;
        }
        const compare = function(obj1, obj2) {
            let val1 = obj1[filed];
            let val2 = obj2[filed];
            if (typeof val1 === 'string' && typeof val2 === 'string') {
                return desc ? -val1.localeCompare(val2) : val1.localeCompare(val2);
            }
            if (val1 === val2) {
                return 0;
            }
            let isMax = val1 > val2 ? 1 : -1;
            return desc ? -isMax : isMax;
        }
        return items.sort(compare);
    },

    /**
     * 合并数组
     * @param {Array} items_a 数组A
     * @param {Array} items_b 数组B
     */
    unionItems(items_a, items_b) {
        items_a = items_a || [];
        items_b = items_b || [];
        return items_a.concat(items_b);
    },

    /**
     * 读取页面DOM变量的值
     * @param {Object} jqPageDom 页面DOM元素
     * @param {RegExp} regexp 正则
     * @returns 
     */
    readScriptVar(jqPageDom, regexp) {
        let targetVarValue = null;
        if (!jqPageDom) {
            return null;
        }
        // 获得网页中的指定脚本中变量的值
        const scripts = [];
        scripts.push(...jqPageDom.filter('script'));
        scripts.push(...jqPageDom.find('script'));
        for (const domScript of scripts) {
            const text = $(domScript).text();
            targetVarValue = regexp.exec(text);
            if (targetVarValue != null) {
                break;
            }
        }
        return targetVarValue;
    },

    /**
     * 计算年份条目数量
     * @param {Map} yearMaps 
     */
    sumYearItemSize(yearMaps) {
        let i = 0;
        for (const [year, yearMap] of yearMaps) {
            // 如果是Map
            if (yearMap instanceof Map) {
                i += this.sumYearItemSize(yearMap);
            }
            // 如果是数组
            if (Array.isArray(yearMap)) {
                i += yearMap.length;
            }
        }
        return i;
    }
};
