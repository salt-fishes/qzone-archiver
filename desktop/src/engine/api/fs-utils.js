/**
 * 文件系统工具：建目录/写文本/写文件/断点、后缀探测、hashUrl
 * P2-1 自 api.js 逐字拆出（机械切分，重组校验通过）。
 */
const API_FS_METHODS = {
    /**
     * 通过URL直接匹配文件后缀名
     * @param {string} url 文件地址
     */
    getFileSuffixByUrl(url, defaultSuffix) {
        let _url = url || '';
        // 尝试从URL直接匹配后缀名
        const urls = _url.split('?');
        if (urls.length >= 1) {
            _url = urls[0]; //去参数
        }
        let res = /([^\.\/\\]+)\.([a-z]+)$/i.exec(_url);
        if (res) {
            return '.' + res[2];
        }
        return res || defaultSuffix || '';
    },

    /**
     * 通过URL请求文件识别后缀名
     * @param {string} url 文件地址
     */
    async getFileSuffix(url) {
        let viewUrl = API.Utils.makeViewUrl(url);
        return await API.Utils.getMimeType(viewUrl).then((data) => {
            if (data) {
                return '.' + data;
            }
            return '';
        }).catch((e) => {
            console.error('获取文件类型异常', viewUrl, e);
            return '';
        });
    },

    /**
     * 根据配置获取文件后缀名
     * @param {string} url 文件地址
     */
    async autoFileSuffix(url) {
        // 检查点：每个媒体文件类型识别（网络请求）前检查暂停/取消
        // 覆盖 boards/photos/blogs/diaries 等 hander 循环中原本无检查点的识别阶段
        if (await checkExportState()) {
            const err = new Error('[ExportState] 导出已取消')
            err.__exportCancelled = true
            throw err
        }
        let suffix = API.Utils.getFileSuffixByUrl(url);
        if (!QZone_Config.Common.isAutoFileSuffix) {
            return suffix;
        }
        // 转换HTTPS
        url = API.Utils.makeDownloadUrl(url, true);
        return API.Utils.getFileSuffix(this.toHttps(url));
    },

    /**
     * 写入内容到文件
     * @param {string} content 内容
     * @param {string} filepath FileSystem路径
     */
    writeText(content, filepath) {
        return window.QZonePlatform.fs.writeFile(filepath, content);
    },

    /**
     * 写入内容到Excel
     * @param {string} buffer 内容
     * @param {string} filepath FS的文件路径
     */
    writeFile(buffer, filepath) {
        return window.QZonePlatform.fs.writeFile(filepath, buffer);
    },

    /**
     * 下载并写入文件到FileSystem
     * @param {string} url 图片URL
     * @param {string} path FileSystem文件路径
     */
    downloadToFile(url, path) {
        return new Promise(async function(resolve, reject) {
            await API.Utils.send(url, 'blob').then(async (xhr) => {
                let res = xhr.response;
                await window.QZonePlatform.fs.writeFile(path, res).then((r) => {
                    resolve(r);
                }, (e) => {
                    reject(e);
                });
            }).catch((e) => {
                reject(e);
            })
        });
    },

    /**
     * 根据URL生成确定性的文件名（同一URL永远生成同一文件名）
     * 用于文件复用：第二次备份时检测到文件已存在则跳过下载
     * 算法：简单 DJB2 哈希，8位 hex
     * @param {string} url 文件URL
     * @returns {string} 8位十六进制哈希字符串
     */
    hashUrl(url) {
        if (!url) return '00000000';
        let hash = 5381;
        for (let i = 0; i < url.length; i++) {
            hash = ((hash << 5) + hash) + url.charCodeAt(i);
            hash = hash & 0xFFFFFFFF;
        }
        // 转为无符号 8 位 hex
        return (hash >>> 0).toString(16).padStart(8, '0');
    },

    /**
     * 检查文件是否已存在（桌面端：QZonePlatform.fs）
     * 用于文件复用：已存在则跳过下载
     * @param {string} filepath 完整文件路径
     * @returns {Promise<boolean>}
     */
    fileExists(filepath) {
        if (!filepath) {
            return Promise.resolve(false);
        }
        return window.QZonePlatform.fs.exists(filepath);
    },

    /**
     * 创建文件夹
     * @param {string} path 
     */
    createFolder(path) {
        return window.QZonePlatform.fs.mkdir(path);
    }
};
