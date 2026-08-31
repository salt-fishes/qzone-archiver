/**
 * 仓库层：增量备份（P3）
 * 增量逻辑逐字迁自 modules/common.js（行为零变化）：
 * 标准化/持久化/增量备份逻辑集中于此，模块层 API.Common 单行委托本层。
 * 说明：P3 阶段这些函数仍引用 API.Common/StatusIndicator/window.Backedup/
 * QZone.Common.Target.uin/_/MODULE_NAME_LIST/QZone_Config/Default_IncrementTime 等全局（委托后仍可解析）。
 */
window.QZoneRepo = window.QZoneRepo || {};

QZoneRepo.incremental = QZoneRepo.incremental || {};

/**
 * 移除已备份数据中不符合条件的数据
 * @param {Array} old_items 列表
 * @param {Object} moduleConfig 模块配置
 */
QZoneRepo.incremental.removeOldItems = (old_items, moduleConfig) => {
    if (API.Common.isFullBackup(moduleConfig) || old_items === undefined) {
        // 选择全量备份时，直接返回空数组，当作没有历史数据处理
        return [];
    }

    // 增量备份时间
    const incrementTime = API.Utils.parseDate(moduleConfig.IncrementTime).getTime();
    // 增备份字段
    const field = moduleConfig.IncrementField;

    // items中的数据是从新到旧的，直接倒序判断时间
    for (let i = old_items.length - 1; i >= 0; i--) {
        const item = old_items[i];
        const time = API.Utils.parseDate(item[field]).getTime();
        if (time > incrementTime) {
            // 如果集合中的元素存在大于增量备份时间的，则移除
            old_items.splice(i, 1);
            continue;
        }
        // 旧数据标识
        item.isNewItem = false;
    }
    return old_items;
}

/**
 * 合并已备份数据
 * @param {object} moduleConfig 模块配置
 * @param {Array} old_items 已备份数据
 * @param {Array} new_items 新数据
 */
QZoneRepo.incremental.unionBackedUpItems = (moduleConfig, old_items, new_items) => {
    if (_.isEmpty(old_items)) {
        // 如果已备份数据为空，直接返回新数据
        return new_items;
    }
    // 移除已备份数据中不符合条件的数据
    old_items = API.Common.removeOldItems(old_items, moduleConfig);

    // 移除新数据中不符合条件的数据
    new_items = API.Common.removeNewItems(new_items, moduleConfig);

    // 合并新老数据
    return API.Utils.unionItems(new_items, old_items);
}

/**
 * 保存当前备份数据
 */
QZoneRepo.incremental.saveBackupItems = () => {

    // 状态更新器
    const indicator = new StatusIndicator('Backup_Save');
    indicator.print();

    return new Promise(function(resolve, reject) {

        // 需要保存的备份数据
        const backupInfos = {
            Backedup: window.Backedup || {}
        };

        // 历史数据
        const rows = backupInfos.Backedup[QZone.Common.Target.uin] || [];
        const oldRowMaps = _.keyBy(rows, 'module');

        // 清空数据
        rows.length = 0;

        for (const moduleName of MODULE_NAME_LIST) {

            if (QZone_Config[moduleName].IncrementType === 'Last') {
                // 备份方式为上次备份时，配置的备份时间，刷新为当前时间
                QZone_Config[moduleName].IncrementTime = API.Utils.formatDate(Date.now() / 1000);
            }

            // 历史备份数据是否为空
            const oldItems = API.Common.getOldModuleData(moduleName);

            if (!API.Common.isExport(moduleName) && _.isEmpty(oldItems)) {
                // 如果不导出，且旧数据为空，则不保存该模块
                continue;
            }

            // 是否有新数据导出
            const isNewExport = API.Common.isNewExport(moduleName);

            // 需要保存的模块数据
            const moduleInfo = oldRowMaps[moduleName] || {};
            moduleInfo.module = moduleName;
            moduleInfo.data = API.Common.getSaveModuleData(moduleName);
            moduleInfo.time = isNewExport ? Date.now() : moduleInfo.time || Date.now();
            rows.push(moduleInfo);
        }

        backupInfos.Backedup[QZone.Common.Target.uin] = rows;

        // 保存配置项，主要是上次备份时间
        window.QZonePlatform.storage.set({ QZone_Config });

        // P3-3（§5.3）：增量元数据落产物 Common/backup-meta.json（结构同 storage：{ Backedup: { [uin]: rows } }）。
        // fs 写入主进程侧自动递归建目录；失败仅告警不阻断（下次备份覆盖重写，最坏多备不丢数据）
        const metaPath = API.Common.getRootFolder() + '/Common/backup-meta.json';
        const writeMeta = window.QZonePlatform.fs.writeFile(metaPath, JSON.stringify(backupInfos))
            .then(function() {
                console.info("增量元数据已写入产物", metaPath);
            })
            .catch(function(error) {
                console.error("增量元数据写入产物异常", metaPath, error);
            });

        // 保存数据到 Storage（桌面端：QZonePlatform.storage → 主进程；P3-3 双写过渡，一个版本后清理）
        window.QZonePlatform.storage.set(backupInfos).then(function() {
            console.info("保存当前备份数据到Storage完成");
            return writeMeta;
        }).then(function() {
            indicator.complete();
            resolve(backupInfos);
        });

    })
}

/**
 * 获取上次备份数据
 * P3-3（§5.3）：双读过渡——优先读产物 Common/backup-meta.json；
 * 产物缺失/损坏（首次备份、旧版本产物）时回退 engine-storage，一个版本后清理 storage 读取。
 * 命中条件为本 uin 键存在（产物目录按 uin 隔离，其他 uin 数据不参与命中判断）。
 */
QZoneRepo.incremental.getBackupItems = async() => {
    try {
        const metaPath = API.Common.getRootFolder() + '/Common/backup-meta.json';
        const text = await window.QZonePlatform.fs.readFile(metaPath, 'utf8');
        const meta = text ? JSON.parse(text) : null;
        if (meta && meta.Backedup && meta.Backedup[QZone.Common.Target.uin]) {
            window.Backedup = meta;
            return window.Backedup;
        }
    } catch (e) {
        // 产物不存在或解析失败 → 回退 storage
    }
    return window.QZonePlatform.storage.get('Backedup').then(function(data) {
        window.Backedup = data || {};
        return window.Backedup;
    });
}

/**
 * 初始化已备份数据到全局变量
 */
QZoneRepo.incremental.initBackedUpItems = async() => {
    if (!API.Common.hasIncrementBackup()) {
        // 本次备份，不存在需要增量备份的模块，无需获取上次备份数据
        return;
    }
    // 进度提示
    const indicator = new StatusIndicator('InitIncrement');
    indicator.print();

    // 获取所有备份QQ的数据
    window.Backedup = await API.Common.getBackupItems() || {};
    window.Backedup = window.Backedup.Backedup || {}
    if (!window.Backedup || Object.keys(window.Backedup).length == 0) {
        // 没有上次备份数据
        indicator.complete();
        return;
    }

    // 指定QQ号数据
    const oldDatas = window.Backedup[QZone.Common.Target.uin] || [];
    if (!oldDatas || oldDatas.length == 0) {
        // 没有上次备份数据
        indicator.complete();
        return;
    }

    for (const moduleName of MODULE_NAME_LIST) {
        // 模块数据
        const module = QZone[moduleName] || {};

        const oldModule = _.find(oldDatas, ['module', moduleName]) || {};

        // 更新模块备份时间
        if (QZone_Config[moduleName].IncrementType === 'LastTime') {
            QZone_Config[moduleName].IncrementTime = oldModule.time ? API.Utils.formatDate(oldModule.time / 1000) : Default_IncrementTime;
        }

        switch (moduleName) {
            case 'Photos':
                // 相册
                module.Album.OLD_Data = oldModule.data || [];
                // 是否新数据标识
                module.Album.OLD_Data.forEach(album => {
                    // 相册标识
                    album.isNewItem = false;

                    // 相片标识
                    album.photoList = album.photoList || [];
                    album.photoList.forEach(photo => {
                        photo.isNewItem = false;
                    });
                });
                break;
            case 'Boards':
                // 留言
                module.OLD_Data = oldModule.data || {
                    items: [],
                    authorInfo: {
                        message: '',
                        sign: ''
                    },
                    total: 0
                };
                // 是否新数据标识
                module.OLD_Data.items.forEach(item => {
                    item.isNewItem = false;
                });
                break;
            case 'Visitors':
                // 访客
                module.OLD_Data = oldModule.data || {
                    items: [],
                    authorInfo: {
                        message: '',
                        sign: ''
                    },
                    total: 0
                };
                // 是否新数据标识
                module.OLD_Data.items.forEach(item => {
                    item.isNewItem = false;
                });
                break;
            default:
                module.OLD_Data = oldModule.data || [];
                // 是否新数据标识
                module.OLD_Data.forEach(item => {
                    item.isNewItem = false;
                });
                break;
        }
    }
    indicator.complete();
}

/**
 * 是否全量备份
 * @param {Object} moduleConfig 模块配置
 */
QZoneRepo.incremental.isFullBackup = (moduleConfig) => {
    return moduleConfig.IncrementType === 'Full';
}

/**
 * 是否上次备份
 * @param {Object} moduleConfig 模块配置
 */
QZoneRepo.incremental.isLast = (moduleConfig) => {
    return moduleConfig.IncrementType === 'LastTime';
}

/**
 * 是否自定义备份
 * @param {Object} moduleConfig 模块配置
 */
QZoneRepo.incremental.isCustom = (moduleConfig) => {
    return moduleConfig.IncrementType === 'Custom';
}

/**
 * 数据是否包含上次备份的位置
 * @param {Array} new_items 新数据
 * @param {Object} moduleConfig 模块配置
 */
QZoneRepo.incremental.isPreBackupPos = (new_items, moduleConfig) => {
    if (new_items.length == 0) {
        return false;
    }
    if (API.Common.isFullBackup(moduleConfig)) {
        return false;
    }

    // 增量备份时间
    const incrementTime = API.Utils.parseDate(moduleConfig.IncrementTime).getTime();
    // 增备份字段
    const field = moduleConfig.IncrementField;

    // 新获取到的第一条数据
    const firstTime = API.Utils.parseDate(_.first(new_items)[field]);
    // 新获取到的最后一条数据
    const lastTime = API.Utils.parseDate(_.last(new_items)[field]);

    // 情况一、第一条是符合增量时间的
    // 情况二、最后一条是符合增量时间的
    // 情况三、不是第一也不是最后
    return firstTime <= incrementTime || incrementTime >= lastTime || (firstTime <= incrementTime && incrementTime >= lastTime);
}

/**
 * 是否是新备份数据
 * @param {object} item 对象
 */
QZoneRepo.incremental.isNewItem = (item) => {
    if (item.isNewItem === undefined) {
        return true;
    }
    return item.isNewItem;
}

/**
 * 移除新数据中不符合条件的数据
 * @param {Array} new_items 列表
 * @param {Object} moduleConfig 模块配置
 */
QZoneRepo.incremental.removeNewItems = (new_items, moduleConfig) => {
    if (API.Common.isFullBackup(moduleConfig)) {
        return new_items;
    }
    // 增量备份时间
    const incrementTime = API.Utils.parseDate(moduleConfig.IncrementTime).getTime();
    // 增备份字段
    const field = moduleConfig.IncrementField;

    // items中的数据是从新到旧的，直接倒序判断时间
    for (let i = new_items.length - 1; i >= 0; i--) {
        const item = new_items[i];
        const time = API.Utils.parseDate(item[field]).getTime();
        if (time < incrementTime) {
            // 如果集合中的元素存在小于增量备份时间的，则移除
            new_items.splice(i, 1);
            continue;
        }
        // 新数据标识
        item.isNewItem = true;
    }
    return new_items;
}

/**
 * 获取模块旧数据
 * @param {String} moduleName 模块名称
 */
QZoneRepo.incremental.getOldModuleData = (moduleName) => {
    // 新模块数据
    const module = QZone[moduleName];

    // 旧数据
    let oldData = module.OLD_Data || [];

    if (moduleName === 'Photos') {
        // 相册
        oldData = module.Album.OLD_Data || [];
    }
    if (['Boards', 'Visitors'].includes(moduleName)) {
        // 留言、访客
        oldData = module.OLD_Data.items || [];
    }
    return oldData;
}

/**
 * 获取模块新数据
 * @param {String} moduleName 模块名称
 */
QZoneRepo.incremental.getNewModuleData = (moduleName) => {
    // 新模块数据
    const module = QZone[moduleName];

    // 旧数据
    let oldData = module.Data || [];

    if (moduleName === 'Photos') {
        // 相册
        oldData = module.Album.Data || [];
    }
    if (['Boards', 'Visitors'].includes(moduleName)) {
        // 留言、访客
        oldData = module.Data.items || [];
    }
    return oldData;
}

/**
 * 获取模块保存的数据
 * @param {String} moduleName 模块名称
 */
QZoneRepo.incremental.getSaveModuleData = (moduleName) => {
    // 新模块数据
    const module = QZone[moduleName];

    // 数据
    let data = API.Common.isExport(moduleName) ? module.Data : module.OLD_Data

    if (moduleName === 'Photos') {
        // 相册
        data = API.Common.isExport(moduleName) ? module.Album.Data : module.Album.OLD_Data;
    }
    return data;
}

/**
 * 是否新数据导出
 * @param {String} moduleName 模块名称
 */
QZoneRepo.incremental.isNewExport = (moduleName) => {
    // 新模块数据
    const module = QZone[moduleName];
    const isExportModule = API.Common.isExport(moduleName);

    // 旧数据
    let oldData = module.OLD_Data || [];

    // 保存的列表数据
    let moduleItems = isExportModule ? module.Data : oldData;

    if (moduleName === 'Photos') {
        // 相册
        oldData = module.Album.OLD_Data || [];
        moduleItems = isExportModule ? module.Album.Data : oldData;
    }
    if (['Boards', 'Visitors'].includes(moduleName)) {
        // 留言、访客
        oldData = module.OLD_Data.items || [];
        moduleItems = isExportModule ? module.Data.items : oldData;
    }
    return _.isEmpty(oldData) || _.some(moduleItems, item => item.isNewItem || _.some(item.photoList || [], item => item.isNewItem));
}

/**
 * 是否存在增量备份需求的模块
 */
QZoneRepo.incremental.hasIncrementBackup = () => {
    let hasIncrementBackup = false;
    for (const exportType of QZone.Common.ExportTypes) {
        if (!QZone_Config.hasOwnProperty(exportType)) {
            continue;
        }
        const moduleCfg = QZone_Config[exportType];
        const incrCfg = moduleCfg['IncrementType'] || moduleCfg['isIncrement'];
        if (!incrCfg) {
            continue;
        }
        if (incrCfg === true || ['Last', 'LastTime', 'Custom'].includes(incrCfg)) {
            hasIncrementBackup = true;
            break;
        }
    }
    return hasIncrementBackup;
}

/**
 * 重置QQ空间备份数据
 */
QZoneRepo.incremental.resetQZoneBackupItems = () => {
    // 遍历模块清单
    for (const moduleName of MODULE_NAME_LIST) {
        // 模块数据
        const module = QZone[moduleName] || {};
        switch (moduleName) {
            case 'Photos':
                // 相册
                module.Album.total = 0;
                module.Album.Data = [];
                module.Album.OLD_Data = [];
                break;
            case 'Boards':
                // 留言
                module.Data = {
                    items: [],
                    authorInfo: {
                        message: '',
                        sign: ''
                    },
                    total: 0
                };
                module.OLD_Data = {
                    items: [],
                    authorInfo: {
                        message: '',
                        sign: ''
                    },
                    total: 0
                };
                break;
            case 'Visitors':
                // 访客
                module.Data = {
                    items: [],
                    total: 0,
                    totalPage: 0
                }
                module.OLD_Data = {
                    items: [],
                    total: 0,
                    totalPage: 0
                }
                break;
            default:
                module.total = 0;
                module.Data = [];
                module.OLD_Data = [];
                break;
        }
    }
}

/**
 * 指定模块是否勾选导出
 * @param {string} moduleType 导出模块类型值
 */
QZoneRepo.incremental.isExport = (moduleType) => {
    return QZone.Common.ExportTypes.indexOf(moduleType) > -1;
}

/**
 * 是否仅导出文件
 */
QZoneRepo.incremental.isOnlyFileExport = () => {
    if (QZone.Common.ExportTypes.length > 2) {
        // 大于两个的备份模块，都不是仅文件导出
        return false;
    }
    if (QZone.Common.ExportTypes.includes('Photos') && QZone.Common.ExportTypes.includes('Videos')) {
        // 相册导出类型为文件、视频导出类型为文件
        const isFile = QZone_Config.Photos.exportType === 'File' && QZone_Config.Videos.exportType === 'File';
        // 且下载工具不为下载链接
        return isFile && QZone_Config.Common.downloadType !== 'Thunder_Link';
    }
    // 包含非相册或非视频的，都不是仅文件导出
    return false;
}
