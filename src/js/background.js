// MV3 改造：Service Worker 短生命周期会丢失内存状态
// 将 BrowseDownloads 与 QZoneDownloadId 迁移到 chrome.storage.session
// 为减少调用方改动，封装为与 Map 同名 API 的异步存储助手
const BrowseDownloads = {
    async get(id) {
        const data = await chrome.storage.session.get('browseDownloads');
        const map = data.browseDownloads || {};
        return map[id];
    },
    async set(id, task) {
        const data = await chrome.storage.session.get('browseDownloads');
        const map = data.browseDownloads || {};
        map[id] = task;
        await chrome.storage.session.set({ browseDownloads: map });
    },
    async clear() {
        await chrome.storage.session.remove('browseDownloads');
    },
    async entries() {
        const data = await chrome.storage.session.get('browseDownloads');
        const map = data.browseDownloads || {};
        return Object.entries(map);
    }
};

// QZoneDownloadId 同样迁移到 session，避免 SW 重启后丢失导致 show_export_zip 失效
let QZoneDownloadId = 0;
(async () => {
    const data = await chrome.storage.session.get('qzoneDownloadId');
    QZoneDownloadId = data.qzoneDownloadId || 0;
})();
async function setQZoneDownloadId(id) {
    QZoneDownloadId = id;
    await chrome.storage.session.set({ qzoneDownloadId: id });
}

// MV3 改造：移除 declarativeContent API（MV3 中已废弃）
// 原 PageAction 显示控制改为 manifest.json 的 action.default_popup（图标始终可点击）
// 在 popup.js 中通过 chrome.tabs.query 检测当前 URL，非 QQ 空间页面时显示提示


let sendMessage = (data, callback) => {
    chrome.runtime.sendMessage(data, function(res) {
        callback(res);
    });
}

/**
 * 获取当前任务下载数
 */
const getInProgressTask = () => {
    return new Promise(resolve => {
        chrome.downloads.search({
            state: "in_progress"
        }, function(data) {
            resolve(data)
        })
    })
}

/**
 * 浏览器下载
 * @param {object} request
 */
const downloadByBrowser = function(request) {
    return new Promise(async resolve => {
        let dataList = await getInProgressTask();
        // 如果有配置最大并发数，需要查询当前下载任务数，如果等于或大于，则继续等待
        // MV3 改造：SW 在 await 期间会被下载事件保持活跃，确保循环不被中断
        while (request.downloadThread > 0 && dataList.length >= request.downloadThread) {
            // 等待1秒后重新查询当前任务数
            await new Promise(resolve => setTimeout(resolve, 1000));
            dataList = await getInProgressTask();
        }

        // 下载任务
        const task = request.task;

        // 读取配置
        chrome.storage.sync.get({
            Common: {
                refererUrls: [
                    "gtimg.com"
                ]
            }
        }, async function(options) {

            // 是否需要添加引用页
            const isMatch = options.Common.refererUrls.filter(item => task.url.includes(item)).length > 0;

            if (isMatch) {
                // 通过XHR下载视频文件
                await send(task.url, 'blob').then((xhr) => {
                    // 使用BLOB链接下载文件
                    task.url = URL.createObjectURL(xhr.response);
                }).catch((e) => {
                    console.error('通过XHR下载视频错误，将使用浏览器直接下载 bg', task, e);
                })
            }

            // 添加下载任务
            chrome.downloads.download(task, function(downloadId) {
                if (chrome.runtime.lastError) {
                    console.error(`添加任务到浏览器失败，请求参数：${JSON.stringify(request)}，错误信息：${chrome.runtime.lastError}`);
                    // 返回失败标识
                    resolve(0);
                    return;
                }
                BrowseDownloads.set(downloadId, task).finally(() => {
                    resolve(downloadId);
                });
            });

        })
    })
}

/**
 * 查询下载项
 * @param {string} state
 */
const getDownloadList = function(options) {
    return new Promise(function(resolve, reject) {
        chrome.downloads.search(options, function(data) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message, options);
                // 返回失败标识
                resolve([]);
                return;
            }
            resolve(data);
        })
    });
}

/**
 * 恢复下载
 * @param {string} downloadId
 */
const resumeDownload = function(downloadId) {
    return new Promise(function(resolve, reject) {
        chrome.downloads.resume(downloadId, function() {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message, downloadId);
                // 返回失败标识
                resolve(0);
                return;
            }
            resolve(downloadId);
        })
    });
}

/**
 * 消息监听器，监听来自其他页面的消息
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch (request.from) {
        case 'content':
            // 消息来源，内容脚本
            switch (request.type) {
                case 'reset':
                    // 重置数据
                    BrowseDownloads.clear();
                    // MV3 改造：同步清空 QZoneDownloadId
                    setQZoneDownloadId(0);
                    break;
                case 'download_browser':
                    // 浏览器下载
                    downloadByBrowser(request).then((downloadId) => {
                        sendResponse(downloadId);
                    });
                    break;
                case 'download_list':
                    // 获取下载列表
                    getDownloadList(request.options).then((data) => {
                        sendResponse(data);
                    });
                    break;
                case 'download_info':
                    // 获取下载信息
                    getDownloadList(request.options).then((data) => {
                        sendResponse(data && data.length > 0 ? data[0] : undefined);
                    });
                    break;
                case 'download_resume':
                    // 恢复下载
                    resumeDownload(request.downloadId).then((data) => {
                        sendResponse(data);
                    });
                    break;
                case 'show_export_zip':
                    // 打开下载的ZIP文件
                    chrome.downloads.show(QZoneDownloadId);
                    break;
                case 'skipLink':
                    chrome.tabs.create({
                        url: request.url
                    });
                    break;
                case 'getMimeType':
                    getMimeType(request.url, request.timeout).then((data) => {
                        sendResponse(data);
                    }).catch((e) => {
                        console.error('文件识别异常，将默认不使用文件后缀！', e);
                        sendResponse('');
                    });
                    break;
                case 'getMapJson':
                    getMapJson(request.url).then((data) => {
                        sendResponse(data);
                    }).catch((e) => {
                        sendResponse(e);
                    });
                    break;
                default:
                    console.warn('Background 接收到消息，但未识别类型！', request);
                    break;
            }
            break;
        default:
            console.warn('Background 接收到消息，但未识别来源！', request);
            break;
    }
    return true;
});


/**
 * 下载管理器重命名监听器
 */
// MV3 改造：onDeterminingFilename 监听器改为 async，BrowseDownloads.get 变为异步
chrome.downloads.onDeterminingFilename.addListener(async function(item, __suggest) {
    function suggest(filename) {
        __suggest({
            filename: filename
        });
    }
    let filename = item.filename;
    // 异步从 session 存储读取
    const downloadInfo = await BrowseDownloads.get(item.id);
    if (downloadInfo) {
        filename = downloadInfo['filename'];
    }
    if (filename.startsWith('QQ空间备份') && filename.endsWith('.zip')) {
        // 备份文件
        await setQZoneDownloadId(item.id);
    }
    suggest(filename);
});

// 扩展安装时
chrome.runtime.onInstalled.addListener((details) => {
    console.info('QQ空间导出助手安装中...', details);
    switch (details.reason) {
        // 安装
        case chrome.runtime.OnInstalledReason.INSTALL:
            // 打开本地说明文档
            chrome.tabs.create({
                url: chrome.runtime.getURL('html/docs.html')
            });
            break;
        case chrome.runtime.OnInstalledReason.UPDATE:
            switch (details.previousVersion) {
                case '1.0.0':
                case '1.0.1':
                case '1.0.2':
                case '1.0.5':
                    // 重置配置项
                    chrome.storage.sync.clear(function() {
                        console.info('清空配置完成');
                    });
                    break;
                case '1.1.1':
                    // 重置备份数据
                    chrome.storage.local.clear(function() {
                        console.info('重置备份数据完成');
                    });
                    break;
                case '1.1.4':
                    // 打开更新日志
                    chrome.tabs.create({
                        url: chrome.runtime.getURL('html/docs.html#更新日志')
                    });
                    break;
                case '1.1.5':
                    // 重置配置项
                    chrome.storage.sync.clear(function() {
                        console.info('清空配置完成');
                    });
                    // 重置备份数据S
                    chrome.storage.local.clear(function() {
                        console.info('重置备份数据完成');
                    });
                    break;
                default:
                    break;
            }
            break;
        default:
            break;
    }
})

/**
 * 发送请求
 * @param {string} url 
 * @param {string} responseType 
 * @param {integer} timeout 超时秒数 
 */
// MV3 改造：Service Worker 中无 XMLHttpRequest，统一改用 fetch
// 保持调用方兼容（resolve 返回对象需含 .response / .responseText 字段）
const send = function(url, responseType, timeout) {
    const controller = new AbortController();
    const timer = timeout ? setTimeout(() => controller.abort(), timeout * 1000) : null;
    return fetch(url, {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal
    }).then(async (resp) => {
        if (timer) clearTimeout(timer);
        // 兼容原 XHR 调用方：返回包含 response / responseText 的伪对象
        if (responseType === 'blob') {
            const blob = await resp.blob();
            return { response: blob, responseText: '', status: resp.status, abort: () => {} };
        }
        const text = await resp.text();
        return { response: text, responseText: text, status: resp.status, abort: () => {} };
    }).catch((error) => {
        if (timer) clearTimeout(timer);
        throw error;
    });
}

/**
 * 获取文件类型
 * @param {string} url 文件地址
 * @param {number} timeout 超时秒数
 * @returns 
 */
// MV3 改造：用 fetch HEAD 替代 XHR 的 onreadystatechange 拦截
const getMimeType = function(url, timeout) {
    const controller = new AbortController();
    const timer = timeout ? setTimeout(() => controller.abort(), timeout * 1000) : null;
    return fetch(url, {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal
    }).then((resp) => {
        if (timer) clearTimeout(timer);
        // 主动中断 body 读取，模拟 XHR 在 readyState=2 时 abort 的行为
        try { resp.body && resp.body.cancel(); } catch (e) {}
        const contentType = resp.headers.get('content-type') || resp.headers.get('Content-Type') || '';
        let suffix = '';
        if (contentType.indexOf('/') > -1) {
            suffix = contentType.split('/')[1];
        }
        return suffix;
    }).catch((error) => {
        if (timer) clearTimeout(timer);
        throw error;
    });
}

/**
 * 获取GeoJson
 * @param {string} url 文件地址
 * @returns 
 */
// MV3 改造：用 fetch 替代 XHR
const getMapJson = function(url) {
    return fetch(url, { credentials: 'include' })
        .then((resp) => resp.text())
        .then((text) => {
            var data = {};
            try {
                data = JSON.parse(text);
            } catch (error) {
                // 解析失败返回空对象，保持与原逻辑一致
            }
            return data;
        });
}

// MV3 改造：declarativeNetRequest API 改为 Promise 写法
// 注意：MV3 中 modifyHeaders 需要 declarativeNetRequestWithHostAccess 权限
// 当前 manifest 已包含 declarativeNetRequest 权限与对应 host_permissions
// 额外注意：MV3 中 condition.resourceTypes 不可使用 'xmlhttprequest'，需改为 'xmlhttprequest' 对应的 'other' 或显式列出
;(async () => {
    if (!chrome.declarativeNetRequest) {
        console.warn('declarativeNetRequest API 不可用，跳过 Referer 注入规则');
        return;
    }
    try {
        const res = await chrome.declarativeNetRequest.getDynamicRules();
        const removeRuleIds = res.map(item => item.id);

        const addRules = [{
            "id": 1,
            "priority": 1,
            "action": {
                "type": "modifyHeaders",
                "requestHeaders": [{
                    "header": "Referer",
                    "operation": "set",
                    "value": "https://user.qzone.qq.com/"
                }]
            },
            "condition": {
                "urlFilter": "gtimg.com",
                "resourceTypes": [
                    "xmlhttprequest",
                    "image",
                    "media"
                ]
            }
        }];

        // 一次性移除旧规则并添加新规则
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: removeRuleIds,
            addRules: addRules
        });
        console.info('declarativeNetRequest Referer 注入规则已加载');
    } catch (error) {
        console.error('declarativeNetRequest 规则加载失败', error);
    }
})();