/**
 * QQ空间说说模块的导出API
 * @author https://github.com/ShunCai/
 */

/**
 * 导出说说数据
 */
API.Messages.export = async() => {

    // 模块总进度更新器
    const indicator = new StatusIndicator('Messages_Row_Infos');
    indicator.print();

    try {

        // 获取所有的说说数据
        let items = await API.Messages.getAllList();

        // 过滤指定屏蔽词说说
        items = API.Messages.filterKeyWords(items);

        // 获取所有说说的全文
        items = await API.Messages.getAllFullContent(items);

        // 获取所有图片（超9张需单独获取）
        items = await API.Messages.getAllImages(items);

        // 获取所有的说说评论
        items = await API.Messages.getItemsAllCommentList(items);

        // 获取说说赞记录
        items = await API.Messages.getAllLikeList(items);

        // 获取最近访问
        items = await API.Messages.getAllVisitorList(items);

        // 添加说说多媒体下载任务
        items = await API.Messages.addMediaToTasks(items);

        // 处理特殊坐标数据，避免地图跳转错误
        API.Messages.dealLbs(items);

        // 优化微信同步说说的坐标信息
        await API.Messages.refreshWeChatLbsInfo(items);

        // 根据导出类型导出数据
        await API.Messages.exportAllListToFiles(items);

    } catch (error) {
        // P2-5 错误处理协议：进度复位后包装上抛，orchestrator 统一捕获记录
        indicator.complete();
        throw new ModuleError({ module: 'Messages', phase: 'run', cause: error });
    }

    // 完成
    indicator.complete();
}

/** 获取单页的说说列表（P2：委托 collectors/Messages） */
API.Messages.getList = QZoneCollectors.Messages.getList;

/** 获取所有说说列表（P2：委托 collectors/Messages） */
API.Messages.getAllList = QZoneCollectors.Messages.getAllList;

/** 获取所有说说的全文内容（P2：委托 collectors/Messages） */
API.Messages.getAllFullContent = QZoneCollectors.Messages.getAllFullContent;

/** 获取单条说说的单页评论列表（P2：委托 collectors/Messages） */
API.Messages.getItemCommentList = QZoneCollectors.Messages.getItemCommentList;

/** 获取单条说说的全部评论列表（P2：委托 collectors/Messages） */
API.Messages.getItemAllCommentList = QZoneCollectors.Messages.getItemAllCommentList;

/** 获取所有说说的评论列表（P2：委托 collectors/Messages） */
API.Messages.getItemsAllCommentList = QZoneCollectors.Messages.getItemsAllCommentList;

/** 所有说说转换成导出文件（P2：委托 exporters/Messages） */
API.Messages.exportAllListToFiles = QZoneExporters.Messages.exportAllListToFiles;

/** 导出说说到HTML文件（P2：委托 exporters/Messages） */
API.Messages.exportToHtml = QZoneExporters.Messages.exportToHtml;

/** 导出说说到Markdown文件（P2：委托 exporters/Messages） */
API.Messages.exportToMarkdown = QZoneExporters.Messages.exportToMarkdown;

/** 导出说说到JSON文件（P2：委托 exporters/Messages） */
API.Messages.exportToJson = QZoneExporters.Messages.exportToJson;

/** 导出说说到 SPA（P2：委托 exporters/Messages，数据策略说明见 exporters/messages.js） */
API.Messages.exportToSpa = QZoneExporters.Messages.exportToSpa;

/** 获取说说的MD内容（P2：委托 exporters/Messages） */
API.Messages.getMarkdown = QZoneExporters.Messages.getMarkdown;

/** 添加说说的多媒体下载任务（P2：委托 collectors/Messages） */
API.Messages.addMediaToTasks = QZoneCollectors.Messages.addMediaToTasks;

/** 获取所有图片（超9张需单独获取）（P2：委托 collectors/Messages） */
API.Messages.getAllImages = QZoneCollectors.Messages.getAllImages;

/** 处理数据（P2：委托 repo/Messages） */
API.Messages.convert = QZoneRepo.Messages.convert;

/** 说说内容是否包含指定屏蔽词（P2：委托 collectors/Messages） */
API.Messages.isMatchFilterKey = QZoneCollectors.Messages.isMatchFilterKey;

/** 过滤含屏蔽词的说说（P2：委托 collectors/Messages） */
API.Messages.filterKeyWords = QZoneCollectors.Messages.filterKeyWords;

/** 获取说说赞记录（P2：委托 collectors/Messages） */
API.Messages.getAllLikeList = QZoneCollectors.Messages.getAllLikeList;

/** 获取单条说说的全部最近访问（P2：委托 collectors/Messages） */
API.Messages.getItemAllVisitorsList = QZoneCollectors.Messages.getItemAllVisitorsList;

/** 获取说说最近访问（P2：委托 collectors/Messages） */
API.Messages.getAllVisitorList = QZoneCollectors.Messages.getAllVisitorList;

/** 处理特殊坐标（P2：委托 collectors/Messages） */
API.Messages.dealLbs = QZoneCollectors.Messages.dealLbs;

/** 刷新微信同步说说的坐标信息（P2：委托 collectors/Messages） */
API.Messages.refreshWeChatLbsInfo = QZoneCollectors.Messages.refreshWeChatLbsInfo;

/** 添加下载表情任务（P2：委托 collectors/Messages） */
API.Messages.addDownloadEmoticonTasks = QZoneCollectors.Messages.addDownloadEmoticonTasks;
