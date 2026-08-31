/**
 * 公共采集（P2-4，迁移自 modules/common.js）
 * 职责：下载任务执行（Ajax/浏览器/Aria2/迅雷/剪切板）、翻页驱动、点赞/访客判定、用户头像采集
 * 逐字搬迁：函数体内容与原 modules/common.js 完全一致，仅外壳改为对象字面量成员。
 */
window.QZoneCollectors = window.QZoneCollectors || {};

QZoneCollectors.Common = {

  /**
   * 初始化用户信息
   */
  initUserInfo: async() => {

    if (API.Common.isOnlyFileExport()) {
        // 仅文件导出，无需初始化
        console.log('仅文件导出，无需初始化用户信息');
        return;
    }

    // 状态更新器
    const indicator = new StatusIndicator('Init_User_Info_Export');
    indicator.print();

    try {

        // 获取所有的QQ好友
        await API.Common.getUserInfos().then((userInfo) => {
            userInfo = API.Utils.toJson(userInfo, /^_Callback\(/);
            console.info("获取用户信息完成", userInfo);

            if (userInfo.code < 0) {
                // 获取异常
                console.warn('初始化用户信息异常：', userInfo);
            }
            userInfo = userInfo.data || {};

            // 用户信息
            userInfo = userInfo && Object.assign(QZone.Common.Target, userInfo);

            // 添加目标头像下载任务
            API.Common.downloadUserAvatars([QZone.Common.Target, QZone.Common.Owner, userInfo]);

            // 更换用户图片
            userInfo.avatar = API.Common.getUserLogoUrl(userInfo.uin);

            // 是否备份自身空间
            userInfo.isOwner = QZone.Common.Target.uin === QZone.Common.Owner.uin;

        }).catch((error) => {
            console.error("获取用户信息异常", error);
        });
    } catch (error) {
        console.error('初始化用户信息异常', error);
    }

    // 完成
    indicator.complete();
  },

  /**
   * 通过Ajax请求下载文件
   * @param {Array} tasks
   */
  downloadsByAjax: async(tasks) => {

    // 任务分组
    const _tasks = _.chunk(tasks, 10);

    const indicator = new StatusIndicator('Common_File');
    indicator.setTotal(tasks.length);
    let skippedCount = 0;

    for (let i = 0; i < _tasks.length; i++) {
        // 暂停/取消检查点：暂停时挂起，取消时中止（下载循环也必须响应）
        await window.checkExportState();
        const list = _tasks[i];
        let down_tasks = [];
        for (let j = 0; j < list.length; j++) {
            const task = list[j];

            // 创建文件夹
            const folderName = API.Common.getRootFolder() + '/' + task.dir;
            await API.Utils.createFolder(folderName);

            const filepath = folderName + '/' + task.name;
            // 文件复用：检查文件是否已存在，已存在则跳过下载
            const exists = await API.Utils.fileExists(filepath);
            if (exists) {
                task.setState('complete');
                indicator.addSuccess(task);
                skippedCount++;
                continue;
            }
            down_tasks.push(API.Utils.downloadToFile(task.url, filepath).then(() => {
                task.setState('complete');
                indicator.setItem(task.name);
                indicator.addSuccess(task);
            }).catch((error) => {
                indicator.addFailed(task);
                task.setState('interrupted');
                console.error('下载文件异常', task, error);
            }));
        }
        await Promise.all(down_tasks);
    }
    if (skippedCount > 0) {
        console.info('文件复用：跳过已存在的文件', skippedCount, '个');
    }
    indicator.complete();
    return true;
  },

  /**
   * 通过浏览器下载文件
   * @param {BrowserTask} tasks 浏览器下载任务
   */
  downloadsByBrowser: async(tasks) => {
    // 进度器
    let indicator = new StatusIndicator('Common_Browser');
    indicator.setTotal(tasks.length);
    let skippedCount = 0;

    // 开始下载
    const _tasks = _.chunk(tasks, QZone_Config.Common.downloadThread);
    for (let i = 0; i < _tasks.length; i++) {
        // 暂停/取消检查点：暂停时挂起，取消时中止（下载循环也必须响应）
        await window.checkExportState();
        const list = _tasks[i];
        for (let j = 0; j < list.length; j++) {
            const task = list[j];
            // 文件复用：检查文件是否已存在（Filer 路径）
            const filerPath = API.Common.getRootFolder() + '/' + task.dir + '/' + task.name;
            const exists = await API.Utils.fileExists(filerPath);
            if (exists) {
                task.setState('complete');
                indicator.addSuccess(task);
                skippedCount++;
                continue;
            }
            // 添加任务到下载器的时候，可能存在一直无返回的情况，问题暂未定位，先临时添加超时秒数逻辑
            await API.Utils.timeoutPromise(API.Utils.downloadByBrowser(task), 60 * 1000 * 5).then((downloadTask) => {
                if (downloadTask.id > 0) {
                    task.setState('complete');
                    indicator.setItem(task.name);
                    indicator.addSuccess(task);
                } else {
                    const msg = (task && task.lastError) || '添加到浏览器下载异常';
                    console.error('添加到浏览器下载异常：' + msg, task);
                    task.lastError = msg;
                    task.setState('interrupted');
                    indicator.addFailed(task);
                }
            }).catch((error) => {
                const msg = (task && task.lastError)
                    || (error && (error.fullMessage || error.message || String(error)))
                    || '未知错误';
                const msgText = msg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                console.error('添加到浏览器下载异常：' + msgText, error, task);
                task.lastError = msg;
                task.setState('interrupted');
                indicator.addFailed(task);
            })
        }
        // 等待1秒再继续添加
        await API.Utils.sleep(QZone_Config.Common.downloadSleep || 1000);
    }
    if (skippedCount > 0) {
        console.info('文件复用：跳过已存在的文件', skippedCount, '个');
    }
    indicator.complete();
    return true;
  },

  /**
   * 通过Aria2下载文件
   * @param {Array} tasks
   */
  downloadByAria2: async(tasks) => {
    // 进度更新器
    const indicator = new StatusIndicator('Common_Aria2');
    indicator.setTotal(tasks.length);
    // 成功添加的任务计数（用于触发 RPC 上限提示）
    let addedCount = 0;

    // 开始下载
    const _tasks = _.chunk(tasks, QZone_Config.Common.downloadThread);
    for (let i = 0; i < _tasks.length; i++) {
        // 暂停/取消检查点：暂停时挂起，取消时中止（下载循环也必须响应）
        await window.checkExportState();
        const list = _tasks[i];
        for (let j = 0; j < list.length; j++) {
            const task = list[j];
            await API.Utils.downloadByAria2(task).then((result) => {
                if (result.error) {
                    // JSON-RPC 错误对象转可读字符串
                    const rpcErr = result.error;
                    const rpcMsg = (typeof rpcErr === 'object')
                        ? `code=${rpcErr.code || '?'} msg=${rpcErr.message || ''}`
                        : String(rpcErr);
                    let hint = '';
                    // 常见 Aria2 JSON-RPC 错误码翻译
                    if (rpcErr && rpcErr.code === 1) {
                        hint = '💡 Aria2/Motrix RPC 密钥不正确，请在「选项 → 公共 → Aria2 密钥」中配置正确密钥';
                    }
                    const fullMsg = `添加到Aria2异常（${rpcMsg}）${hint ? ' ' + hint : ''}`;
                    console.error(fullMsg, result, task);
                    task.lastError = fullMsg;
                    task.setState('interrupted');
                    indicator.addFailed(task);
                } else {
                    task.setState('complete');
                    // 添加成功
                    indicator.addSuccess(task);
                    addedCount++;
                }
            }).catch((error) => {
                // error 已由 post() 包装为 Error 对象，message 是纯文本，fullMessage 是带 HTML 版本
                const msg = (error && error.fullMessage)
                    || (error && error.message)
                    || 'Aria2 连接失败';
                const msgText = msg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                console.error('添加到Aria2异常：' + msgText, error, task);
                task.lastError = msg;
                task.setState('interrupted');
                indicator.addFailed(task);
            })
        }
        // 等待1秒再继续添加
        await API.Utils.sleep((QZone_Config.Common.downloadSleep || 1) * 1000);
    }

    // 完成
    indicator.complete();

    // Aria2/Motrix 默认 max-download-result=1000，超过后旧结果被清除，
    // 在「打包下载」之前续在已完成日志行末尾（不换行、文案精简）
    if (addedCount > 1000) {
        $('<span class="tip-inline-warn">　·　⚠ 超过结果保留上限 1000，仅显示最近任务，下载仍在继续（可在 Motrix 设置调大）</span>')
            .appendTo(indicator._line);
    }

    return true;
  },

  /**
   * 通过迅雷下载
   * @param {ThunderInfo} thunderInfo 迅雷下载信息
   */
  invokeThunder: async(thunderInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Common_Thunder');
    indicator.setTotal(thunderInfo.tasks.length);

    // 处理迅雷下载信息
    const _thunderInfo = API.Common.handerThunderInfo(thunderInfo);

    // 通过迅雷任务数将任务分组，任务太大时无法唤起迅雷
    const tasks = _thunderInfo.tasks || [];
    const _tasks = _.chunk(tasks, QZone_Config.Common.thunderTaskNum);
    for (let i = 0; i < _tasks.length; i++) {
        // 暂停/取消检查点（下载循环也必须响应）
        await window.checkExportState();
        const index = i + 1;
        await indicator.setIndex(index);

        const list = _tasks[i];
        let taskGroupName = _thunderInfo.taskGroupName;
        if (_tasks.length > 1) {
            taskGroupName = taskGroupName + "_" + index;
        }

        // 唤起迅雷下载
        const groupTask = new ThunderInfo(taskGroupName, QZone_Config.Common.downloadThread, list)
        API.Utils.downloadByThunder(groupTask);

        // 添加唤起数
        indicator.addSuccess(list);

        // 继续唤起
        if (index < _tasks.length) {
            let sleep = QZone_Config.Common.thunderTaskSleep * 1;
            let interId = setInterval(function() {
                indicator.setNextTip(--sleep);
            }, 1000);

            // 等待指定秒再继续唤起，并给用户提示
            await API.Utils.sleep(sleep * 1000);
            clearInterval(interId);
        }
    }

    // 完成
    indicator.complete();
  },

  /**
   * 复制迅雷下载链接到剪切板
   * @param {ThunderInfo} thunderInfo 迅雷下载信息
   */
  copyThunderTasksToClipboard: async(thunderInfo) => {
    // 进度更新器
    const indicator = new StatusIndicator('Common_Thunder_Clipboard');
    indicator.setTotal(thunderInfo.tasks.length);
    indicator.print();

    // 处理迅雷下载信息
    const _thunderInfo = API.Common.handerThunderInfo(thunderInfo);

    // 通过迅雷任务数将任务分组，任务太大时无法唤起迅雷
    const tasks = _thunderInfo.tasks || [];
    const _tasks = _.chunk(tasks, QZone_Config.Common.thunderTaskNum);
    for (let i = 0; i < _tasks.length; i++) {
        // 暂停/取消检查点（下载循环也必须响应）
        await window.checkExportState();
        const index = i + 1;
        await indicator.setIndex(index);

        const list = _tasks[i];
        let taskGroupName = _thunderInfo.taskGroupName;
        if (_tasks.length > 1) {
            taskGroupName = taskGroupName + "_" + index;
        }

        // 唤起迅雷下载
        const groupTask = new ThunderInfo(taskGroupName, QZone_Config.Common.downloadThread, list)

        // 下载任务信息
        const copyTaskLinks = 'thunderx://' + JSON.stringify(groupTask);

        // 复制下载链接到剪切板
        navigator.clipboard.writeText(copyTaskLinks).catch((error) => {

            console.error('异步复制失败', error);

            // 创建text area
            let textArea = document.createElement("textarea");
            textArea.value = copyTaskLinks;
            // 使text area不在viewport，同时设置不可见
            textArea.style.position = "absolute";
            textArea.style.opacity = 0;
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            return new Promise((res, rej) => {
                // 执行复制命令并移除文本框
                document.execCommand('copy') ? res() : rej();
                textArea.remove();
            });
        });

        // 添加唤起数
        indicator.addSuccess(list);

        // 继续唤起
        if (index < _tasks.length) {
            let sleep = QZone_Config.Common.thunderTaskSleep * 1;
            let interId = setInterval(function() {
                indicator.setNextTip(--sleep);
            }, 1000);

            // 等待指定秒再继续唤起，并给用户提示
            await API.Utils.sleep(sleep * 1000);
            clearInterval(interId);
        }
    }

    // 完成
    indicator.complete();
  },

  /**
   * 是否存在下一页
   * @param {integer} pageIndex 下一页索引
   * @param {integer} pageSize 每页条目数
   * @param {integer} total 总数
   * @param {Array} items 已获取数据数组
   */
  hasNextPage: (pageIndex, pageSize, total, items) => {
    return items.length < total && pageIndex * pageSize < total;
  },

  /**
   * 获取下一页数据
   * @param {integer} pageIndex 下一页索引
   * @param {object} moduleConfig 模块配置
   * @param {integer} total 总数
   * @param {Array} items 已获取数据
   * @param {Function} call 下一页函数
   * @param {Array} args 下一页函数参数
   */
  callNextPage: async(pageIndex, moduleConfig, total, items, call, ...args) => {
    // 是否存在下一页
    const hasNextPage = API.Common.hasNextPage(pageIndex, moduleConfig.pageSize, total, items);
    if (hasNextPage) {
        // 暂停 / 取消 检查点：必须在随机间隔 sleep 之前检查，
        // 否则暂停/取消会被下一页的等待间隔拖住，无法实时响应
        if (await checkExportState()) {
            console.info('[callNextPage] 导出已中止，停止翻页');
            return items;
        }
        // 请求一页成功后等待一秒再请求下一页
        const min = moduleConfig.randomSeconds.min;
        const max = moduleConfig.randomSeconds.max;
        const seconds = API.Utils.randomSeconds(min, max);
        await API.Utils.sleep(seconds * 1000);
        return await call.apply(undefined, args);
    }
    return items;
  },

  /**
   * 是否继续获取下一页
   * @param {Array} oldItems 历史备份条目
   * @param {Array} pageItems 新页的条目
   * @param {Object} moduleCfg 模块的配置信息
   */
  isGetNextPage: (oldItems, pageItems, moduleCfg) => {
    if (API.Common.isFullBackup(moduleCfg)) {
        // 如果是全量备份，需要继续获取下一页，是否获取到末页不在这里判断，在hasNextPage判断
        return true;
    }
    if (moduleCfg.IncrementType === 'Last' || API.Common.isCustom(moduleCfg)) {
        // 上次/自定义备份：翻到增量时间点位置即停（Last 首次时 IncrementTime 为默认，等价全量）
        return !API.Common.isPreBackupPos(pageItems, moduleCfg);
    }
    if (API.Common.isLast(moduleCfg)) {
        // 兼容旧配置「上次备份」（LastTime）：有历史时提前停，无历史全量
        if (_.isEmpty(oldItems)) {
            return true;
        }
        return !API.Common.isPreBackupPos(pageItems, moduleCfg);
    }
    return true;
  },

  /**
   * 设置比较差异的字段值
   * @param {Array} items 列表
   * @param {string} sourceFiled 源字段
   * @param {string} targetFiled 目标字段
   */
  setCompareFiledInfo: (items, sourceFiled, targetFiled) => {
    // 处理发布时间，兼容增量备份
    for (const item of items) {
        if (!item.hasOwnProperty(sourceFiled) || item.hasOwnProperty(targetFiled)) {
            continue;
        }
        item[targetFiled] = Math.floor(API.Utils.parseDate(item[sourceFiled]).getTime() / 1000);
    }
    return items;
  },

  /**
   * 是否需要获取赞
   * @param {Object} CONFIG 模块配置项
   */
  isGetLike: (CONFIG) => {
    return CONFIG.Like.isGet && ['HTML', 'JSON', 'SPA'].includes(CONFIG.exportType)
  },

  /**
   * 是否需要获取最近访问
   * @param {Object} CONFIG 模块配置项
   */
  isGetVisitor: (CONFIG) => {
    return CONFIG.Visitor.isGet && ['HTML', 'JSON', 'SPA'].includes(CONFIG.exportType)
  },

  /**
   * 获取模块点赞记录
   * @param {Object} item 对象
   */
  getModulesLikeList: async(item, moduleConfig) => {
    let nextUin = 0;
    item.likes = item.likes || [];
    if (!moduleConfig.Like.isGet) {
        return item.likes;
    }
    let hasNext = true;
    while (hasNext) {
        // 检查点：每页点赞记录前检查暂停/取消（该循环原本无检查点）
        if (await checkExportState()) {
            const err = new Error('[ExportState] 导出已取消')
            err.__exportCancelled = true
            throw err
        }
        await API.Common.getLikeList(item.uniKey, nextUin).then(async(data) => {
            data = API.Utils.toJson(data, /^_Callback\(/);
            if (data.code && data.code != 0) {
                // 获取异常
                console.warn('获取模块点赞记录异常：', data);
            }
            data = data.data || {};

            data.like_uin_info = data.like_uin_info || [];
            if (_.isEmpty(data.like_uin_info)) {
                hasNext = false;
            } else {
                item.likes = _.concat(item.likes, data.like_uin_info);
                nextUin = _.last(item.likes)['fuin'];

                // 请求一页成功后等待一秒再请求下一页
                const min = moduleConfig.Like.randomSeconds.min;
                const max = moduleConfig.Like.randomSeconds.max;
                const seconds = API.Utils.randomSeconds(min, max);
                await API.Utils.sleep(seconds * 1000);
            }
        }).catch((e) => {
            hasNext = false;
            console.error("获取点赞数据异常", item, e);
        });
    }
    item.likeTotal = item.likes.length;
    return item.likes;
  },

  /**
   * 添加QQ空间用户的头像下载
   * @param {Object} user 用户
   */
  downloadUserAvatar: (user) => {
    if (API.Common.isQzoneUrl() || !user || !user.uin) {
        // 如果为QQ空间外链，则不下载
        return;
    }
    const avatarUrl = API.Common.getUserLogoUrl(user.uin);
    if (QZone.Common.FILE_URLS.has(avatarUrl)) {
        // 添加过下载任务则跳过
        user.avatar = API.Common.getUserLogoUrl(user.uin);
        user.custom_avatar = API.Common.getUserLogoLocalUrl(user.uin);
        return;
    }

    API.Utils.newDownloadTask('Friends', avatarUrl, 'Common/images', user.uin + '', user, true);
    user.avatar = API.Common.getUserLogoUrl(user.uin);
    user.custom_avatar = API.Common.getUserLogoLocalUrl(user.uin);

    // 添加映射
    QZone.Common.FILE_URLS.set(avatarUrl, user.custom_avatar);
  },

  /**
   * 添加QQ空间用户的头像下载
   * @param {Array} users 用户列表
   */
  downloadUserAvatars: (users) => {
    if (API.Common.isQzoneUrl() || !users) {
        // 如果为QQ空间外链，则不下载
        return;
    }
    for (const user of users) {
        API.Common.downloadUserAvatar(user);
    }
  },

  /**
   * 导出用户头像
   * @returns
   */
  exportUserAvatar: async() => {

    if (API.Common.isQzoneUrl()) {
        // QQ空间外链，无需导出
        console.log('QQ空间外链，无需导出');
        return;
    }

    // 状态更新器
    const indicator = new StatusIndicator('User_Avatar_Export');
    indicator.print();

    try {

        // 收集所有的互动用户
        const users = API.Statistics.getAllInteractiveUsers();

        // 移除在好友清单中的
        _.remove(users, u_item => _.findIndex(QZone.Friends.Data, _.findIndex(users, ['uin', u_item.uin])) > -1);

        // 添加目标头像下载任务
        API.Common.downloadUserAvatars(users);

    } catch (error) {
        console.error('导出用户头像异常，默认忽略不处理，按道理不会失败！', error);
    }

    // 完成
    indicator.complete();
  },
};
