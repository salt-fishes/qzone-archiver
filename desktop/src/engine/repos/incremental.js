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

        // 保存数据到 Storage（桌面端：QZonePlatform.storage → 主进程）
        window.QZonePlatform.storage.set(backupInfos).then(function() {
            console.info("保存当前备份数据到Storage完成");
            indicator.complete();
            resolve(backupInfos);
        });

    })
}

/**
 * 获取上次备份数据
 */
QZoneRepo.incremental.getBackupItems = () => {
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
