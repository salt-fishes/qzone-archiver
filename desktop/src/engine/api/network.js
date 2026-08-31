/**
 * 网络层：请求方法、WAF 检测、g_tk/uin 鉴权、重试/稍候
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_NETWORK_METHODS = {
    /**
     * 根据 xhr/status/error/url 组装具体可读的错误信息，
     * 并识别 WAF/风控拦截（403 特征）、登录态失效（302/401）等常见场景。
     * 返回 string，可直接赋给 customMessage 或塞进 innerHTML（包含 <br/> + <span> 建议）。
     * @param {XMLHttpRequest} xhr XHR 对象（可为 jQuery 包装的 jqXHR）
     * @param {string} status jQuery textStatus（'timeout'/'error'/'abort'/'parsererror'）
     * @param {string|Error} error 原始错误对象/字符串
     * @param {string} url 请求 URL（用于附带接口短名 + Aria2/Motrix 端口检测）
     * @returns {string} 可读错误信息（可能含 HTML 标签，给 innerHTML 用）
     */
    buildNetworkErrorMessage(xhr, status, error, url) {
        let msg = '';
        let hint = ''; // 附加建议
        const statusCode = xhr && xhr.status ? xhr.status : 0;

        // --- HTTP 状态码分类 ---
        if (statusCode > 0) {
            msg += 'HTTP ' + statusCode;
            if (xhr.statusText) msg += ' ' + xhr.statusText;

            if (statusCode === 403) {
                // ========== 重点：WAF / 风控 拦截检测 ==========
                let isWAF = false;
                const wafHeaders = [
                    { name: 'Server',         re: /\bwaf\b/i },
                    { name: 'X-Powered-By',   re: /\bwaf\b/i },
                    { name: 'X-Response-By',  re: /\bwaf\b/i },
                    { name: 'X-Waf-Event',    re: /./ },       // 只要存在这个头就是 WAF
                    { name: 'X-Cdn-Error',    re: /\bwaf\b/i },
                ];
                try {
                    for (const h of wafHeaders) {
                        const v = xhr.getResponseHeader ? xhr.getResponseHeader(h.name) : null;
                        if (v && h.re.test(v)) { isWAF = true; break; }
                    }
                } catch (_) {}
                // 退而求其次：检查响应体文本里的关键词（常见 WAF block 页）
                if (!isWAF && xhr.responseText && typeof xhr.responseText === 'string') {
                    const body = xhr.responseText.slice(0, 2000);
                    if (/\bwaf\b|intercept|拦截|安全加固|cloudflare|tencent.?sec|访问被拒绝|forbidden.*html|访问频率/i.test(body)) {
                        isWAF = true;
                    }
                }
                if (isWAF) {
                    msg = 'WAF 风控拦截（HTTP 403）';
                    hint = '请求过于频繁被腾讯安全策略拦截，建议：① 调大「查询间隔 / 翻页随机间隔」；② 调大「列表重试间隔」并勾选「稍候重试接口」对应模块；③ 暂停 10-30 分钟或换网络环境后再试。';
                } else {
                    // 非 WAF 特征的 403，可能是接口本身的访问控制（如登录态失效后返回 403）
                    msg += '（疑似登录态失效或权限不足）';
                    hint = '请在新标签打开 QQ 空间首页确认是否需要重新登录，登录后刷新当前备份页面重新开始。';
                }
            }
            else if (statusCode === 401) {
                msg += '（未授权/登录态失效）';
                hint = '请重新登录 QQ 空间后刷新当前备份页面。';
            }
            else if (statusCode === 429) {
                msg = '接口请求频率超限（HTTP 429）';
                hint = '调大「查询间隔」或减少下载并发数。';
            }
            else if (statusCode >= 500) {
                msg += '（QQ 空间服务端异常）';
                hint = '稍后重试即可。若持续出现，可能是接口变更，请到项目提 issue。';
            }
            else if (statusCode === 302 || statusCode === 301) {
                msg += '（被重定向，疑似登录态过期跳登录页）';
                hint = '请重新登录 QQ 空间后刷新当前备份页面。';
            }
        }

        // --- jQuery textStatus ---
        if (status) {
            let statusZh = status;
            switch (status) {
                case 'timeout':    statusZh = '请求超时'; break;
                case 'error':      statusZh = '网络错误'; break;
                case 'abort':      statusZh = '请求被中止'; break;
                case 'parsererror':statusZh = '响应解析失败'; break;
            }
            if (!msg || !statusCode) {
                msg = statusZh;
            } else if (status !== 'error') { // status='error' 时与 HTTP 码信息重复，省去
                msg += ' · ' + statusZh;
            }
            if (status === 'timeout') {
                hint = hint || '网络不稳定或接口响应慢，可在选项里调大「超时秒数」或稍后重试。';
            }
        }

        // --- 原生错误字符串 ---
        if (error && typeof error === 'string' && error !== status) {
            const e = error.toLowerCase();
            if (e.includes('cors') || e.includes('access-control-allow-origin')) {
                msg += (msg ? ' · ' : '') + '跨域被拒绝（CORS）';
                hint = hint || 'QQ 空间接口未返回跨域头。请确认当前页面在 user.qzone.qq.com 域名下，或检查是否被广告拦截插件篡改响应头。';
            } else if (e.includes('failed to fetch') || e.includes('networkerror')) {
                msg += (msg ? ' · ' : '') + '连接失败（无法建立连接）';
                hint = hint || '请检查本机网络是否正常，QQ 空间首页能否打开；代理/VPN 可能导致连接中断。';
            } else {
                msg += (msg ? '：' : '') + error;
            }
        }

        if (!msg) msg = '网络请求失败';

        // --- 附带接口短名（隐私友好：去掉 query/token）---
        if (url) {
            try {
                const u = new URL(url, location.href);
                const parts = u.pathname.split('/').filter(Boolean);
                const short = parts.slice(-2).join('/') || u.pathname;
                msg += ` [${short}]`;
            } catch (_) {
                if (url.length < 80) msg += ` [${url}]`;
            }
        }

        // --- 本地 Aria2 / Motrix RPC 端口检测（downloadByAria2 场景） ---
        if (url) {
            try {
                const u = new URL(url, location.href);
                if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && /\/jsonrpc$/.test(u.pathname)) {
                    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
                    if (port === '6800') {
                        hint = hint || '当前 RPC 端口为 6800（Aria2 原生默认）。' +
                            '· 若你使用的是 Motrix，请将端口改为 <b>16800</b>（Motrix 默认端口）；' +
                            '· 若使用 aria2 原生版，请确认 aria2c 已启动并监听了 6800；' +
                            '· 请在「选项 → 公共 → Aria2 RPC地址」中修改，修改后可点击旁边的「测试」按钮验证。';
                    } else if (port === '16800') {
                        hint = hint || '当前 RPC 端口为 16800（Motrix 默认）。请确认 Motrix 已启动：' +
                            '· 打开 Motrix 主界面（系统托盘有图标不代表 RPC 已就绪）；' +
                            '· 检查 Motrix 设置 → 高级设置 → RPC 是否启用、端口是否为 16800；' +
                            '· 若设置了 RPC 密钥，请在「Aria2 密钥」中填入相同密钥；' +
                            '· 关闭可能拦截本地端口的杀毒软件/防火墙。';
                    } else {
                        hint = hint || `RPC 端口 ${port} 非标准端口。Aria2 原生默认 6800，Motrix 默认 16800。请确认端口配置与下载工具实际监听端口一致。`;
                    }
                    // JSON-RPC 错误码翻译
                    if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
                        const rpcErr = xhr.responseJSON.error;
                        if (rpcErr.code === 1) {
                            hint = 'Aria2/Motrix RPC 密钥不正确，请在「选项 → 公共 → Aria2 密钥」中配置与下载工具设置相同的 RPC Secret。' + (hint || '');
                        }
                    }
                }
            } catch (_) {}
        }

        // --- 追加操作建议（换行用 <br>，因为会被塞进 innerHTML）---
        if (hint) {
            msg += "<br/><span style='color:#f39c12'>💡 建议：" + hint + "</span>";
        }
        return msg;
    },

    /**
     * 发送请求
     * @param {string} url 
     * @param {string} responseType 
     * @param {integer} timeout 超时秒数 
     */
    send(url, responseType, timeout) {
        return new Promise(function(resolve, reject) {
            var request = new XMLHttpRequest();
            request.open("GET", url);
            if (responseType) {
                request.responseType = responseType;
            }
            // 允许跨域
            request.withCredentials = true;
            // 超时秒数
            if (timeout) {
                request.timeout = timeout * 1000;
            }
            request.onload = function() {
                if ((request.status >= 200 && request.status < 300) || request.status === 304) {
                    resolve(this);
                    return;
                }
                // 注意：onload 在 HTTP 403/404/5xx 时也会触发！原生 XHR 只有真正网络错误才走 onerror。
                // 这里也需要走 buildNetworkErrorMessage 处理 HTTP 403 WAF 场景
                const msg = API.Utils.buildNetworkErrorMessage(
                    request, request.status >= 400 ? 'error' : '',
                    request.statusText || '', url
                );
                const err = new Error(msg.replace(/<[^>]+>/g, ''));
                err.fullMessage = msg;
                err.status = request.status;
                reject(err);
            };
            request.onerror = function() {
                const msg = API.Utils.buildNetworkErrorMessage(request, 'error', 'NetworkError', url);
                const err = new Error(msg.replace(/<[^>]+>/g, ''));
                err.fullMessage = msg;
                err.status = request.status;
                reject(err);
                try { this.abort(); } catch (_) {}
            };
            request.ontimeout = function() {
                const msg = API.Utils.buildNetworkErrorMessage(request, 'timeout', '', url);
                const err = new Error(msg.replace(/<[^>]+>/g, ''));
                err.fullMessage = msg;
                err.status = 0;
                reject(err);
                try { this.abort(); } catch (_) {}
            };
            request.send();
        });
    },

    /**
     * 下载文件
     * @param {string} url 
     */
    downloadFile(url) {
        return API.Utils.send(url, 'blob');
    },

    /**
     * GET 请求
     * @param {string} url 请求URL
     */
    get(url, params) {
        // 重试
        const retryRequest = (ajax, reject, error) => {
            // 纯文本版（给 console 用，去 HTML 标签）
            const msgText = (ajax.customMessage || '未知错误').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (ajax.retries > 0) {
                console.warn('请求接口异常，正在重试，接口：%s，参数：%o，剩余重试次数：%i，错误：%s', url, params, ajax.retries, msgText);
                $('#errorTips').show();
                $('#errorTips').html("<span style='color:red'>请求发生错误，错误信息：{0}，将会在{1}重试，剩余次数：{2}</span>".format(ajax.customMessage || '未知错误', API.Utils.formatDate((Date.now() + ajax.retryInterval) / 1000, 'MM-dd hh:mm:ss'), ajax.retries));
                ajax.retries--;
                // 指定秒数后继续请求
                setTimeout(function() {
                    $.ajax(ajax);
                }, ajax.retryInterval);
                return;
            }
            console.warn('重试次数已用完，准备回调，接口：%s，参数：%o，错误：%s', this.url, params, msgText);
            $('#errorTips').show();
            $('#errorTips').html("<span style='color:red'>请求发生错误，错误信息：{0}，重试次数用完，已取消</span>".format(ajax.customMessage || '未知错误', API.Utils.formatDate((Date.now() + ajax.retryInterval) / 1000, 'MM-dd hh:mm:ss'), ajax.retries));
            reject(error);
        }
        return new Promise(function(resolve, reject) {
            $.ajax({
                url: url,
                type: 'GET',
                data: params,
                // 强制按文本处理：qzone JSONP 接口返回 text/javascript，jQuery 会误判为 script 并 globalEval 执行
                // （如 shine0_Callback({...})），依赖页面定义的回调——桌面引擎窗口页面未定义该回调会 ReferenceError 导致请求失败。
                // 统一按文本返回后由 toJson 字符串截取解析，行为与扩展端一致。
                dataType: 'text',
                xhrFields: {
                    withCredentials: true
                },
                // 请求超时：qzone 接口偶发无响应时 jQuery 默认无限等待（timeout=0），
                // 相册等翻页采集会永久卡住；30s 无响应走 error 分支重试，避免卡死
                timeout: 30000,
                retries: QZone_Config.Common.listRetryCount, // 重试次数
                retryInterval: QZone_Config.Common.listRetrySleep * 1000, // 每次重试间隔秒数
                success: function(result) {
                    try {
                        const resJson = API.Utils.toJson(result);
                        // 0 正常场景
                        // -4009 权限问题，无需重试；内容已删除等永久错误同样不重试（重试只会浪费请求、增加限流风险）
                        const code = resJson && resJson.code;
                        const msgText = (resJson && resJson.message) || '';
                        const isPermanent = code === -4009 || /原文已经被删除|已被删除|无法查看|无权限/.test(msgText);
                        if (code && code != 0 && !isPermanent) {
                            console.warn('接口请求成功，接口处理返回错误，将尝试重试，接口：%s，参数：%o，返回值：%o', this.url, params, resJson);
                            if (code === -10000 || msgText === '使用人数过多，请稍后再试') {
                                let isWaitTimeRest = false;
                                for (const cfgUrlKey of QZone_Config.Common.RestSleepUrls) {
                                    if (this.url.includes(REST_URLS[cfgUrlKey])) {
                                        isWaitTimeRest = true;
                                        break;
                                    }
                                }
                                if (isWaitTimeRest) {
                                    // 请稍候重试专用时间间隔
                                    this.retries = QZone_Config.Common.waitCount;
                                    this.retryInterval = QZone_Config.Common.waitTime * 1000;
                                }
                            }
                            this.customMessage = msgText;
                            retryRequest(this);
                            return;
                        }
                    } catch (error) {
                        $('#errorTips').hide();
                        // 转换JSON错误时，当作成功返回
                        resolve(result);
                        return;
                    }
                    $('#errorTips').hide();
                    resolve(result);
                },
                error: function(xhr, status, error) {
                    // 使用统一的错误构造器，自动识别 WAF 403 / 超时 / CORS / Motrix 端口 等
                    this.customMessage = API.Utils.buildNetworkErrorMessage(xhr, status, error, this.url);
                    // HTTP 501：服务端异常（接口不支持/该请求不可用），重试无法恢复，快速失败避免请求风暴
                    if (xhr.status === 501) {
                        $('#errorTips').hide();
                        reject(new Error(this.customMessage));
                        return;
                    }
                    // 401/403：登录态失效 / 权限 / WAF 风控拦截，重试无法恢复（WAF 重试反而加重风控），与 POST 保持一致快速失败
                    if (xhr.status === 401 || xhr.status === 403) {
                        $('#errorTips').hide();
                        reject(new Error(this.customMessage));
                        return;
                    }
                    retryRequest(this, reject, error);
                }
            });
        });
    },

    /**
     * POST 请求
     * @param {string} url 请求URL
     * @param {object} data 请求数据
     * @param {object} [options] 可选配置：{ retries, retryInterval, contentType, timeout }
     */
    post(url, data, options) {
        options = options || {};
        const retries = options.retries != null ? options.retries : 2;
        const retryInterval = (options.retryInterval || 2) * 1000;
        let attempt = 0;

        const doRequest = () => new Promise(function(resolve, reject) {
            $.ajax({
                url: url,
                type: 'POST',
                data: data,
                // 同上：POST 接口同样按文本返回，避免 jQuery 误判 script 执行 JSONP 回调
                dataType: 'text',
                contentType: options.contentType || "application/json;charset=utf-8",
                timeout: (options.timeout || 15) * 1000,
                success: function(result) {
                    resolve(result);
                },
                error: function(xhr, status, err) {
                    const msg = API.Utils.buildNetworkErrorMessage(xhr, status, err, url);
                    const msgText = msg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    // 401/403 不重试（重试也不会过，反而消耗次数），其它类型继续
                    const isAuthFail = !!(xhr && (xhr.status === 401 || xhr.status === 403));
                    if (attempt < retries && !isAuthFail) {
                        attempt++;
                        console.warn('POST 接口异常，正在重试，接口：%s，剩余次数：%i，错误：%s',
                            url, retries - attempt + 1, msgText);
                        setTimeout(doRequest, retryInterval);
                    } else {
                        const wrapped = new Error(msgText); // Error 消息为纯文本
                        wrapped.fullMessage = msg; // 保留带 HTML 版本给 UI 用
                        wrapped.xhr = xhr; wrapped.status = status; wrapped.raw = err;
                        reject(wrapped);
                    }
                }
            });
        });
        return doRequest();
    },

    /**
     * 获得一个Cookie值
     * @param {string} name 
     */
    getCookie(name) {
        // 桌面端：引擎窗口运行于 qzone 同源页面，直接读 document.cookie；
        // httpOnly cookie 经 QZonePlatform.cookies.get 读取
        var value = "; " + document.cookie;
        var parts = value.split("; " + name + "=");
        if (parts.length == 2) {
            return parts.pop().split(";").shift();
        }
    },

    /**
     * 从 HTML 页面找到 token 保存起来
     */
    getQZoneToken() {
        $("script").each(function() {
            var t = $(this).text();
            t = t.replace(/\ /g, "");
            if (t.indexOf('window.g_qzonetoken') !== -1) {
                var qzonetokenM = /return"(\w*?)";/g;
                var qzonetoken = qzonetokenM.exec(t);
                if (qzonetoken != null && qzonetoken != '') {
                    QZone.Common.Config.token = qzonetoken[1];
                    return false;
                }
            }
        });
        return QZone.Common.Config.token;
    },

    /**
     * 获取QQ号
     */
    initUin() {

        let rs = /\/user\.qzone\.qq\.com\/([\d]+)/.exec(window.location.href);
        if (rs) {
            // 获取登录QQ
            const res = /\d.+/g.exec(API.Utils.getCookie('uin'));
            if (res && res.length > 0) {

                // 当前登录用户信息
                const $ownerInfoDom = document.querySelector('#QZ_Toolbar_Container > div > div.user-info > a.user-home > span');
                QZone.Common.Owner.uin = /\d.+/g.exec(API.Utils.getCookie('uin'))[0] - 0;
                QZone.Common.Owner.name = $ownerInfoDom && $ownerInfoDom.innerText.trim() || '我';
                QZone.Common.Owner.nickname = QZone.Common.Owner.name;

                // 备份目标用户信息
                const $targetInfoDom = document.querySelector('#headContainer > div.head-detail > div.head-detail-name > span.user-name.textoverflow');

                QZone.Common.Target = {
                    uin: rs[1] - 0,
                    title: document.title,
                    description: $('meta[name="description"]').attr("content") || document.title,
                    name: $targetInfoDom && $targetInfoDom.innerText.trim() || 'TA',
                    nickname: $targetInfoDom && $targetInfoDom.innerText.trim() || 'TA'
                }
            }
        }
        return QZone.Common;
    },

    /**
     * 生成 g_tk
     * @param {string} url
     */
    initGtk(url) {
        var skey;
        url = url || window.location.href;
        if (url.indexOf("qzone.qq.com") > 0) {
            skey = API.Utils.getCookie("p_skey");
        } else {
            if (url.indexOf("qq.com") > 0) {
                skey = API.Utils.getCookie("skey") || API.Utils.getCookie("rv2");
            }
        }
        if (!skey) {
            return undefined;
        }
        var hash = 5381;
        for (var i = 0, len = skey.length; i < len; ++i) {
            hash += (hash << 5) + skey.charAt(i).charCodeAt();
        }
        return QZone.Common.Config.gtk = hash & 2147483647;
    },

    /**
     * @param {integer} ms 毫秒
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    },

    /**
     * Promise超时
     */
    timeoutPromise(promise, ms) {
        const timeout = API.Utils.sleep(ms).then(function() {
            throw new Error('Operation timed out after ' + ms + ' ms');
        });
        return Promise.race([promise, timeout]);
    },

    /**
     * 转换JSON对象
     *  @param {string} json 
     *  @param {string} jsonpKey 
     */
    toJson(json, jsonpKey) {
        // 前后去空格
        json = json.trim();

        if (jsonpKey && json.match(jsonpKey)) {
            //JSONP转换

            // JSONP的函数部分仍使用正则替换
            json = json.replace(jsonpKey, "");

            // 不基于正则替换，如果JSON本身有这些字符，会被替换掉
            // 懒得折腾了，还是直接截取简单
            if (json.endsWith(';')) {
                // 截取掉最后一个;
                json = json.substring(0, json.length - 1);
                // 前后去空格
                json = json.trim();
            }
            if (json.endsWith(')')) {
                // 截取掉最后一个)
                json = json.substring(0, json.length - 1);
                // 前后去空格
                json = json.trim();
            }

        } else {
            // 是否包含Callback关键字
            if (json.indexOf('Callback(') > -1) {
                // 截取掉Callback(
                json = json.substring(json.indexOf('Callback(') + 'Callback('.length);
                if (json.endsWith(';')) {
                    // 截取掉最后一个;
                    json = json.substring(0, json.length - 1);
                    // 前后去空格
                    json = json.trim();
                }
                if (json.endsWith(')')) {
                    // 截取掉最后一个)
                    json = json.substring(0, json.length - 1);
                    // 前后去空格
                    json = json.trim();
                }
            }
        }

        try {
            // 使用默认JSON转换器
            return JSON.parse(json);
        } catch (error) {
            // 如果异常了再使用eval转换
            // 不使用JSON.parse，文案中有特殊字符时会异常，比如有反斜杠\
            return eval("(" + json + ")");
        }
    },

    /**
     * 随机秒数
     */
    randomSeconds(min, max) {
        min = min - 0;
        max = max - 0;
        var range = max - min;
        var random = Math.random();
        var num = min + Math.round(random * range); //四舍五入
        return num;
    }
};
