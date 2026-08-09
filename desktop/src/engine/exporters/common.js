/**
 * 公共导出（P4，迁移自 modules/common.js）
 */
window.QZoneExporters = window.QZoneExporters || {};

QZoneExporters.Common = {

    /**
     * 检测指定导出类型是否被任一模块启用
     * 用于判断是否需要复制 SPA 静态资源等共享行为
     * 仅检查本次实际备份的模块（桌面端），未备份模块的配置不参与判断
     * @param {string} exportType 导出类型，如 'SPA' / 'HTML' / 'MarkDown' / 'JSON'
     * @returns {boolean}
     */
    hasExportType: (exportType) => {
        const backupModules = (window.__engineExportState && window.__engineExportState.modules) || [];
        const modules = backupModules.length
            ? backupModules
            : ['Messages', 'Blogs', 'Diaries', 'Photos', 'Videos',
                'Boards', 'Friends', 'Favorites', 'Shares', 'Visitors'];
        return modules.some(m => QZone_Config[m] && QZone_Config[m].exportType === exportType);
    },

    /**
     * 导出个人信息到HTML文件
     * @param {Array} friends 好友列表
     */
    exportUserToHtml: async(userInfo) => {
        // 导出类型存在HTML的时候才生成首页HTML
        // 说说
        let hasHtml = QZone_Config.Messages.exportType === 'HTML';
        // 日志
        hasHtml = hasHtml || QZone_Config.Blogs.exportType === 'HTML';
        // 日记
        hasHtml = hasHtml || QZone_Config.Diaries.exportType === 'HTML';
        // 留言
        hasHtml = hasHtml || QZone_Config.Boards.exportType === 'HTML';
        // 好友
        hasHtml = hasHtml || QZone_Config.Friends.exportType === 'HTML';
        // 收藏
        hasHtml = hasHtml || QZone_Config.Favorites.exportType === 'HTML';
        // 分享
        hasHtml = hasHtml || QZone_Config.Shares.exportType === 'HTML';
        // 访客
        hasHtml = hasHtml || QZone_Config.Visitors.exportType === 'HTML';
        // 相册
        hasHtml = hasHtml || QZone_Config.Photos.exportType === 'HTML';
        // 视频
        hasHtml = hasHtml || QZone_Config.Videos.exportType === 'HTML';

        if (!hasHtml) {
            return;
        }

        // 导出HTML依赖的JS、CSS
        for (let index = 0; index < QZone.Common.ExportFiles.length; index++) {
            const pathInfo = QZone.Common.ExportFiles[index];
            let paths = (API.Common.getRootFolder() + '/' + pathInfo.target).split('/');
            let filename = paths.pop();
            await API.Utils.createFolder(paths.join('/'));
            // 桌面端：资源经 QZonePlatform.resources 读取（IPC，避开跨源 fetch 限制）
            await window.QZonePlatform.resources.copyToFile(pathInfo.original, paths.join('/') + '/' + filename);
        }

        console.info('生成首页HTML文件开始', userInfo);
        // 基于模板生成HTML
        let fileEntry = await API.Common.writeHtmlofTpl('index', { user: userInfo }, API.Common.getRootFolder() + "/index.html");
        console.info('生成首页HTML文件结束', fileEntry, userInfo);
    },

    /**
     * 导出个人信息到 SPA
     * 检测任一模块是否启用 SPA，是则复制 SPA 静态资源到 Common/spa/，
     * 并在备份根目录生成入口 index.html（重定向到 Common/spa/index.html）
     * @param {object} userInfo 用户信息
     */
    exportUserToSpa: async(userInfo) => {
        // 检测任一模块是否启用 SPA
        const hasSpa = API.Common.hasExportType('SPA');
        if (!hasSpa) return;

        console.info('复制 SPA 静态资源开始', userInfo);
        // 复制 SPA 静态资源（index.html / assets/*）到 Common/spa/
        for (const pathInfo of QZone.Common.SpaExportFiles) {
            const paths = (API.Common.getRootFolder() + '/' + pathInfo.target).split('/');
            const filename = paths.pop();
            await API.Utils.createFolder(paths.join('/'));
            // 桌面端：资源经 QZonePlatform.resources 读取
            await window.QZonePlatform.resources.copyToFile(pathInfo.original, paths.join('/') + '/' + filename);
        }
        console.info('复制 SPA 静态资源结束');

        // 生成备份根目录入口 index.html（重定向到 Common/spa/index.html）
        // 优先使用 spa-dist 内置的 export-entry.html，若不存在则用内联兜底模板
        let entryHtml = '';
        try {
            entryHtml = await window.QZonePlatform.resources.readText('export/spa-dist/export-entry.html');
        } catch (e) {
            console.warn('SPA export-entry.html 未找到，使用内联兜底模板', e);
        }
        if (!entryHtml) {
            entryHtml = [
                '<!DOCTYPE html>',
                '<html lang="zh-CN">',
                '<head>',
                '  <meta charset="UTF-8">',
                '  <title>QQ空间档案</title>',
                '  <meta http-equiv="refresh" content="0; url=Common/spa/index.html">',
                '  <script>location.href = \'Common/spa/index.html\';</script>',
                '</head>',
                '<body>',
                '  <a href="Common/spa/index.html">进入档案</a>',
                '</body>',
                '</html>'
            ].join('\r\n');
        }
        await API.Utils.writeText(entryHtml, API.Common.getRootFolder() + '/index.html');
        console.info('生成 SPA 入口 index.html 完成');
    },

    /**
     * 基于模板生成HTML文件
     * @param {string} name 模板文件名
     * @param {object} params 参数
     * @param {object} params 参数
     */
    writeHtmlofTpl: async(name, params, indexHtmlePath) => {
        let html = await API.Common.getHtmlTemplate(name, params);
        let fileEntry = await API.Utils.writeText(html, indexHtmlePath);
        return fileEntry;
    },

    /**
     * 渲染HTML模板
     * @param {string} name 模板文件名
     * @param {object} params 参数
     */
    getHtmlTemplate: async(name, params) => {
        // MV3 改造：原通过 template(html, params) 运行时编译，受 CSP unsafe-eval 限制
        // 改为调用预编译函数 templates-compiled.js 中的 window.__templates__[name]
        if (!params) {
            // 无参数时仍读取原始模板文件（仅返回 HTML 骨架）
            return await window.QZonePlatform.resources.readText('templates/' + name + '.html');
        }
        const templates = window.__templates__ || {};
        const render = templates[name];
        if (typeof render !== 'function') {
            // 兜底：预编译函数未找到，回退到运行时编译（仅在 CSP 允许 unsafe-eval 时生效）
            console.warn('预编译模板未找到：' + name + '，回退到运行时编译');
            const html = await window.QZonePlatform.resources.readText('templates/' + name + '.html');
            return template(html, params);
        }
        // 调用预编译函数，第二个参数为 modifierMap（在 templates-compiled.js 中定义）
        return render(params, window.__modifierMap__);
    },
};
