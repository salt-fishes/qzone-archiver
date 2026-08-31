/**
 * 用户个人档模块导出API
 * @author https://github.com/ShunCai/
 *
 * P2-4：modules 瘦身为纯编排。实现委托 collectors/exporters/repos/packagers，
 * 本文件仅保留 exportOthers 编排与 formatContent 胶水。
 */

/**
 * 其它的导出
 */
API.Common.exportOthers = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Common_Row_Infos');
    indicator.print();

    try {

        // 初始化用户信息
        await API.Common.initUserInfo();

        // 导出用户信息
        await API.Common.exportUser();

        // 导出用户头像
        await API.Common.exportUserAvatar();

        // 下载助手配置信息
        await API.Common.exportConfigToJson();

        // 保存备份数据
        const backupInfos = await API.Common.saveBackupItems();

        // 导出备份数据到JSON
        await API.Common.exportBackupItemsToJson(backupInfos);

        // 下载文件
        await API.Utils.downloadAllFiles();

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Common', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();

}

/** 初始化用户信息（P2：委托 collectors/Common） */
API.Common.initUserInfo = QZoneCollectors.Common.initUserInfo;

/** 导出用户个人档信息（P2：委托 exporters/Common） */
API.Common.exportUser = QZoneExporters.Common.exportUser;

/** 导出个人信息到JSON文件（P2：委托 exporters/Common） */
API.Common.exportUserToJson = QZoneExporters.Common.exportUserToJson;

/** 导出个人信息到MarkDown文件（P2：委托 exporters/Common） */
API.Common.exportUserToMd = QZoneExporters.Common.exportUserToMd;

/** 导出个人信息到HTML文件（P2：委托 exporters/Common） */
API.Common.exportUserToHtml = QZoneExporters.Common.exportUserToHtml;

/** 检测导出类型是否被任一模块启用（P2：委托 exporters/Common） */
API.Common.hasExportType = QZoneExporters.Common.hasExportType;

/** 导出个人信息到SPA入口（P2：委托 exporters/Common） */
API.Common.exportUserToSpa = QZoneExporters.Common.exportUserToSpa;

/** 写入HTML模板文件（P2：委托 exporters/Common） */
API.Common.writeHtmlofTpl = QZoneExporters.Common.writeHtmlofTpl;

/** 获取HTML模板（P2：委托 exporters/Common） */
API.Common.getHtmlTemplate = QZoneExporters.Common.getHtmlTemplate;

/** 写入JSON为js文件（P2：委托 repos/writer） */
API.Common.writeJsonToJs = QZoneRepo.writer.writeJsonToJs;

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
API.Common.formatContent = (item, type, isRt, isSupportedHtml, isEscHTML, isDownloadEmoticon, isFormatEmoticonPath) => {
    // 默认调用原先的内容转换
    return API.Utils.formatContent(item, type, isRt, isSupportedHtml, isEscHTML, isDownloadEmoticon, isFormatEmoticonPath);
}

/** 通过Ajax请求下载文件（P2：委托 collectors/Common） */
API.Common.downloadsByAjax = QZoneCollectors.Common.downloadsByAjax;

/** 通过浏览器下载文件（P2：委托 collectors/Common） */
API.Common.downloadsByBrowser = QZoneCollectors.Common.downloadsByBrowser;

/** 通过Aria2下载文件（P2：委托 collectors/Common） */
API.Common.downloadByAria2 = QZoneCollectors.Common.downloadByAria2;

/** 唤起迅雷下载（P2：委托 collectors/Common） */
API.Common.invokeThunder = QZoneCollectors.Common.invokeThunder;

/** 复制迅雷任务到剪贴板（P2：委托 collectors/Common） */
API.Common.copyThunderTasksToClipboard = QZoneCollectors.Common.copyThunderTasksToClipboard;

/** 写入迅雷任务文件（P2：委托 packagers/Links） */
API.Common.writeThunderTaskToFile = QZonePackagers.Links.writeThunderTaskToFile;

/** 处理迅雷下载信息（P2：委托 packagers/Links） */
API.Common.handerThunderInfo = QZonePackagers.Links.handerThunderInfo;

/** 是否全量备份（P2：委托 repos/incremental） */
API.Common.isFullBackup = QZoneRepo.incremental.isFullBackup;

/** 是否上次备份（P2：委托 repos/incremental） */
API.Common.isLast = QZoneRepo.incremental.isLast;

/** 是否自定义备份（P2：委托 repos/incremental） */
API.Common.isCustom = QZoneRepo.incremental.isCustom;

/** 数据是否包含上次备份的位置（P2：委托 repos/incremental） */
API.Common.isPreBackupPos = QZoneRepo.incremental.isPreBackupPos;

/** 是否是新备份数据（P2：委托 repos/incremental） */
API.Common.isNewItem = QZoneRepo.incremental.isNewItem;

/** 移除已备份数据中不符合条件的数据（P2：委托 repos/incremental） */
API.Common.removeOldItems = QZoneRepo.incremental.removeOldItems;

/** 移除新数据中不符合条件的数据（P2：委托 repos/incremental） */
API.Common.removeNewItems = QZoneRepo.incremental.removeNewItems;

/** 合并已备份数据（P2：委托 repos/incremental） */
API.Common.unionBackedUpItems = QZoneRepo.incremental.unionBackedUpItems;

/** 保存当前备份数据（P2：委托 repos/incremental） */
API.Common.saveBackupItems = QZoneRepo.incremental.saveBackupItems;

/** 获取模块旧数据（P2：委托 repos/incremental） */
API.Common.getOldModuleData = QZoneRepo.incremental.getOldModuleData;

/** 获取模块新数据（P2：委托 repos/incremental） */
API.Common.getNewModuleData = QZoneRepo.incremental.getNewModuleData;

/** 获取模块保存的数据（P2：委托 repos/incremental） */
API.Common.getSaveModuleData = QZoneRepo.incremental.getSaveModuleData;

/** 是否新数据导出（P2：委托 repos/incremental） */
API.Common.isNewExport = QZoneRepo.incremental.isNewExport;

/** 导入备份数据到JSON文件（P2：委托 exporters/Common） */
API.Common.exportBackupItemsToJson = QZoneExporters.Common.exportBackupItemsToJson;

/** 是否存在增量备份需求的模块（P2：委托 repos/incremental） */
API.Common.hasIncrementBackup = QZoneRepo.incremental.hasIncrementBackup;

/** 获取上次备份数据（P2：委托 repos/incremental） */
API.Common.getBackupItems = QZoneRepo.incremental.getBackupItems;

/** 重置QQ空间备份数据（P2：委托 repos/incremental） */
API.Common.resetQZoneBackupItems = QZoneRepo.incremental.resetQZoneBackupItems;

/** 初始化已备份数据到全局变量（P2：委托 repos/incremental） */
API.Common.initBackedUpItems = QZoneRepo.incremental.initBackedUpItems;

/** 是否存在下一页（P2：委托 collectors/Common） */
API.Common.hasNextPage = QZoneCollectors.Common.hasNextPage;

/** 获取下一页数据（P2：委托 collectors/Common） */
API.Common.callNextPage = QZoneCollectors.Common.callNextPage;

/** 指定模块是否勾选导出（P2：委托 repos/incremental） */
API.Common.isExport = QZoneRepo.incremental.isExport;

/** 设置比较差异的字段值（P2：委托 collectors/Common） */
API.Common.setCompareFiledInfo = QZoneCollectors.Common.setCompareFiledInfo;

/** 是否获取点赞列表（P2：委托 collectors/Common） */
API.Common.isGetLike = QZoneCollectors.Common.isGetLike;

/** 是否获取访客列表（P2：委托 collectors/Common） */
API.Common.isGetVisitor = QZoneCollectors.Common.isGetVisitor;

/** 获取模块点赞列表（P2：委托 collectors/Common） */
API.Common.getModulesLikeList = QZoneCollectors.Common.getModulesLikeList;

/** 下载单个用户头像（P2：委托 collectors/Common） */
API.Common.downloadUserAvatar = QZoneCollectors.Common.downloadUserAvatar;

/** 下载用户头像列表（P2：委托 collectors/Common） */
API.Common.downloadUserAvatars = QZoneCollectors.Common.downloadUserAvatars;

/** 导出助手到JSON文件（P2：委托 exporters/Common） */
API.Common.exportConfigToJson = QZoneExporters.Common.exportConfigToJson;

/** 是否仅导出文件（P2：委托 repos/incremental） */
API.Common.isOnlyFileExport = QZoneRepo.incremental.isOnlyFileExport;

/** 是否继续获取下一页（P2：委托 collectors/Common） */
API.Common.isGetNextPage = QZoneCollectors.Common.isGetNextPage;

/** 导出用户头像（P2：委托 collectors/Common） */
API.Common.exportUserAvatar = QZoneCollectors.Common.exportUserAvatar;
